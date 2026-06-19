# Vautch — System Design

> Documento canônico de arquitetura para levar o protótipo à produção.
> Autoria/aprovação: Paulo. Fonte da verdade. Decisões pontuais ficam em `docs/decisions/` (ADRs).

## Client (Frontend)
- **Next.js + TypeScript (App Router)** — PWA instalável
- **Tailwind CSS + next-themes** (dark mode nativo, OLED-ready)
- **IndexedDB** para cache offline-first
- **DOMPurify** para sanitização de metadados externos (anti-XSS)
- **Canvas API** para strip de EXIF/GPS + compressão WebP antes do upload
- **Hospedagem: Vercel** (deploy automático por push, domínio vautch.com)

## API Layer
- **Supabase Edge Functions** (serverless, sem infraestrutura própria)
- Responsável por: auth, CRUD de itens, scraping de URLs, classificação

## Core Services
- **Ingestion Service** — recebe URL/texto/imagem, extrai Open Graph, detecta tipo
- **Classification Service** — categoriza o item. **No launch = heurística** (classificador por palavra-chave do protótipo, sem chave de IA). Slot pronto p/ IA real (Gemini/Claude) depois, sem refactor.
- **Embed Resolver** — transforma URLs em embeds ricos (YouTube/Shorts, Instagram reel/reels/carrossel/imagem, TikTok, Twitter/X). Especificação detalhada em `docs/decisions/0001-embeds-spec.md`.
- **Image Processor** — strip de EXIF/GPS + conversão WebP client-side antes do upload

## Storage
- **Supabase Postgres** — dados estruturados (users, items, tags, sub_tags) com FKs e índices para scroll cronológico
- **Supabase Storage** — bucket **privado** para mídia; políticas RLS no nível do objeto

## Auth
- **Supabase GoTrue** — email/senha com **confirmação obrigatória**, reset de senha, hooks para 2FA futuro
- OAuth Google/Apple — **fase 2**
- Middleware Next.js bloqueia rota privada se sessão nula

## Security Layer (fundação, não afterthought)
> Checklist completo e obrigatório em `docs/decisions/0002-seguranca-e-segredos.md`. Resumo:
- **Row Level Security em todas as tabelas** — `auth.uid() = user_id` em cada SELECT/INSERT/UPDATE/DELETE. **Default-deny**.
- **`service_role` key NUNCA exposta ao client.** Nenhum segredo com prefixo `NEXT_PUBLIC_` (só anon key + base URL são públicos).
- **Sessão em cookie `httpOnly`+`Secure` via `@supabase/ssr` — NUNCA em localStorage.** localStorage/IndexedDB só p/ cache de conteúdo (sem token, sem PII); limpa no logout.
- **CORS** travado na origem do frontend; **CSP** com `frame-src` allowlist só dos embeds; **rate limit** nas Edge Functions; **Cloudflare Turnstile** no signup/login.
- Source maps de browser off em produção. Validar authn só em rota privada (middleware).
- **Complexidade ciclomática máxima 10 por função** (gate no ESLint).

## Multi-client Architecture
- **`src/core`** — lógica de negócio em TypeScript puro, **zero imports de Next.js**
- Mesma camada compartilhada com extensão de browser e app mobile (Capacitor) sem reescrita

## Fluxo de um save
```
User cola URL
  → Edge Function recebe
  → Ingestion Service extrai metadados (Open Graph)
  → Embed Resolver gera embed
  → Classification Service classifica categoria
  → Salva no Postgres (RLS valida user_id)
  → Retorna item pro client
  → Client atualiza IndexedDB local
```
