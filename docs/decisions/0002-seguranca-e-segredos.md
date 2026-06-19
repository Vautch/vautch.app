# ADR 0002 — Segurança & Segredos (checklist obrigatório)

**Status:** Aceito · **Data:** 2026-06-19 · **Contexto:** baseline de cybersegurança para a v1 do Vautch (Next.js App Router + Supabase + Vercel). Origem: system design do Paulo + material externo (vídeo "como proteger seu SaaS" + comentários de praticantes). Este documento é a fonte da verdade de segurança; revisar a cada feature que toca auth, storage, rede ou segredos.

## Princípio
Segurança é fundação, não afterthought. Default-deny em tudo. O frontend é território hostil — nada sensível pode viver nele.

## Checklist

### Segredos & build
- [ ] **Nenhum segredo com prefixo `NEXT_PUBLIC_`.** Só podem ser públicos: a `anon key` do Supabase (segura SE RLS estiver ligado) e a base URL da API. Tudo o mais (`service_role`, chaves de IA futuras, tokens de provider) vive **só** em env vars server-side na Vercel.
- [ ] `.env*` no `.gitignore` (Fase 0). Confirmar que nenhum `.env` nem `pass.txt` jamais entrou no histórico do git.
- [ ] **Source maps de browser desligados em produção** — `productionBrowserSourceMaps: false` (default do Next; confirmar). Evita expor o código `.tsx` no DevTools.

### Auth & tokens (o ponto mais crítico)
- [ ] **Sessão/JWT em cookie `httpOnly` + `Secure` + `SameSite=Lax`. NUNCA em localStorage.** Usar **`@supabase/ssr`** (cookie-based) em vez do client default (que usa localStorage). Resolve também o 401-fantasma (cookie vai em toda request; localStorage não).
- [ ] localStorage/IndexedDB: **só** conteúdo de cache (os itens do próprio usuário, offline-first). **Zero** token, zero PII (e-mail, CPF, telefone).
- [ ] sessionStorage: só não-sensível (ex: tema). Limpa sozinho no fechar a aba.
- [ ] **Limpar IndexedDB/caches no logout.**
- [ ] Validar authn **só em rotas privadas** (middleware Next). Rotas públicas funcionam anônimas — não passam pela camada de auth. Definir o mapa público/privado explicitamente.

### Rede
- [ ] **CORS** nas Edge Functions: liberar **só** a origem do frontend (`https://vautch.com` + URLs de preview da Vercel). Nunca `*`.
- [ ] **CSP** (Content-Security-Policy) via headers no Next: `default-src 'self'`; `frame-src` allowlist **só** dos embeds (youtube.com/youtube-nocookie.com, instagram.com, tiktok.com, platform.twitter.com); `img-src`/`connect-src` conforme necessário. Cuidado: CSP errado quebra os embeds — testar cada tipo.
- [ ] **Rate limit** nas Edge Functions (ingestion/scraping + auth). Por usuário e por IP.
- [ ] **Captcha** no signup/login — **Cloudflare Turnstile** (grátis, privacy-friendly).

### Banco & storage
- [ ] **RLS ligado em TODA tabela**, default-deny, `auth.uid() = user_id` em SELECT/INSERT/UPDATE/DELETE.
- [ ] `service_role` só server-side.
- [ ] Bucket de mídia **privado** com RLS no nível do objeto.

### Conteúdo
- [ ] **Sanitizar** todo metadado externo com **DOMPurify** antes de renderizar (anti-XSS).
- [ ] **Strip de EXIF/GPS** + conversão WebP client-side antes do upload (Canvas).

### Embeds (interage com CSP)
- [ ] iframes com `sandbox` sem `allow-top-navigation` (já no protótipo) — impede o embed levar o usuário pra fora. Ver `0001-embeds-spec.md`.

## Infra / escala (fora do escopo v1, registrar p/ depois)
- Vercel + Supabase cobrem WAF/anti-DDoS na borda da plataforma. fail2ban é p/ servidor self-managed (não temos — serverless).
- Crítica "não use Vercel p/ produto sério" = concern de escala (multi-região, redundância multi-cloud). Revisitar quando o volume justificar; **não é bloqueio de v1**.
