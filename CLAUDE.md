# Vautch — instruções do projeto

Repositório de **produção** do Vautch (app de salvar tudo, anti-algoritmo).

## Antes de mexer, leia
- `docs/system-design.md` — arquitetura canônica (fonte da verdade)
- `docs/decisions/0001-embeds-spec.md` — engenharia dos embeds (regex, geometria de crop). **NÃO redescobrir; portar verbatim.**
- `docs/decisions/0002-seguranca-e-segredos.md` — checklist de segurança **OBRIGATÓRIO**.
- `docs/decisions/0003-ui-interacoes-prototipo.md` — drag FLIP/WAAPI, anti-flash, filterbar, subtags, URL tracking. **NÃO redescobrir; portar verbatim.**
- `docs/decisions/0004-auth-schema-fase0.md` — auth (login/signup/reset), rotas, schema `items` (jsonb), RLS, cookie httpOnly, ponte de sync feed↔Supabase. **Fonte da verdade de auth/backend.**

## Stack
Next.js App Router + TypeScript + Tailwind v4 + Supabase (Postgres/Storage/Edge Functions/Auth) + Vercel. PWA.

## Regras inegociáveis
- **Sessão/JWT em cookie httpOnly** (`@supabase/ssr`), NUNCA localStorage. Nenhum segredo com prefixo `NEXT_PUBLIC_` (só anon key + base URL).
- **RLS default-deny** em toda tabela (`auth.uid() = user_id`).
- **Complexidade ciclomática ≤ 10** por função (ESLint).
- `src/core` = TypeScript puro, **ZERO imports de Next/React** (reuso em extensão/mobile).
- Proporção de vídeo é sagrada — nunca distorcer embed.

## Fluxo de trabalho — OBRIGATÓRIO
1. Fazer as alterações localmente (`prototype/` + `public/proto/`)
2. Testar no localhost (servidor `vautch-prod`, porta 3210)
3. **Aguardar aprovação explícita do Paulo** ("pode fazer o deploy", "push", etc.)
4. Só então commitar e fazer `git push` para o Vercel buildar
5. Documentar decisões estruturais como novos ADRs em `docs/decisions/`

**Nunca fazer push automático sem aprovação do Paulo.**

## Estado atual (Fase 0 — backend de produção)
- **Backend ligado:** Supabase (projeto `Vautch MVP`, sa-east-1). Auth email/senha + reset; confirmação de e-mail obrigatória.
- **Rotas:** `/login`, `/forgot`, `/reset-password` (públicas/recuperação); `/app` (timeline, privada); `/auth/callback` + `/auth/signout`; `/api/items` (CRUD do feed). Middleware (`src/proxy.ts`) protege as rotas.
- **Feed no Supabase:** o bundle (`public/proto/bundle.js`) usa localStorage como cache e sincroniza com `/api/items` (server-side + RLS). Isolamento por usuário provado.
- **Env vars:** `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable) — locais em `.env.local` (gitignored) e na Vercel. Secret key **nunca** no repo.
- **Pendências:** Google OAuth (botão escondido até configurar `GOOGLE_ENABLED`), migração do export JSON do Paulo, sync multi-aba.

## Protótipo de referência
O protótipo vanilla está em `../prototype/` (fora deste repo) — fonte para portar UI/lógica.
