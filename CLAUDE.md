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

## Estado atual (rodada 2026-06-26 — v0.1.4, pendente de review/deploy)
- **Rodada 2026-06-26 (v0.1.4):** pílula "bem-vindo de volta" + filtro "última visita" (F1b/FILT), relembre paginado 5→20 (F2b), maximizado em deck navegável (arraste em qualquer lugar + setas + roda; sempre cheio mesmo em compacto) (F2c), relembre dos "esquecidos" via tracking device-local `vault.seen` (F2d), e o **efeito React Three Fiber** nos favoritos — camada React `src/app/app/favorite-particles.tsx`, 1 canvas WebGL compartilhado, campo denso de pontos nítidos, só favoritos no viewport, `pointer-events:none` (F3). Deps novas: `three`, `@react-three/fiber`, `@types/three`. **B7 (facade IG) foi revertido** — segue em aberto. Ver [ADR 0006](docs/decisions/0006-rodada-relembre-facade-r3f.md).

## Estado anterior (Fase 1/2/3 — v0.1.3)
- **Backend ligado:** Supabase (projeto `Vautch MVP`, sa-east-1). Auth email/senha + Google OAuth + reset.
- **Rotas:** `/login`, `/forgot`, `/reset-password`; `/app` (timeline, privada); `/auth/callback` + `/auth/signout`; `/api/items` (GET agora devolve `created_at`; PUT reconcilia). Middleware (`src/proxy.ts`).
- **Feed no Supabase:** o bundle (`public/proto/bundle.js`) usa localStorage como cache e sincroniza com `/api/items` (server-side + RLS). Isolamento por usuário provado.
- **Fase 1/2/3 (v0.1.3):** datas reais (`relativeTime`/`createdAt`), ordem canônica estável (B1), scroll no expand (B2), ellipsis/tooltip (B3), botão × (U1), limpeza de tracking híbrida (B6), skeleton (P1), **paginação/infinite scroll de 10** (P2), favoritos ★ (F3 mecanismo), blocos home "bem-vindo de volta" (F1) e "relembre" (F2). Ver [ADR 0005](docs/decisions/0005-fase1-estabilizacao-perf.md) e [ROADMAP](ROADMAP.md).
- **Env vars:** `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable) — locais em `.env.local` (gitignored) e na Vercel. Secret key **nunca** no repo.
- **Dev local:** o dev trava ~25s/página no middleware (TLS do proxy corporativo) → resolvido com `--use-system-ca` no `.claude/launch.json` (server `vautch-prod`, porta 3210). Ver memória `reference_vautch_local_tls`.
- **Bypass de login (DEV ONLY):** `DEV_AUTH_BYPASS=1` no `.env.local` + gate `NODE_ENV !== "production"` no `middleware.ts` deixam `/app` abrir SEM login no localhost (pra testar a UI quando o login local falha por EPERM do Dropbox / Supabase). **IMPOSSÍVEL de ativar em produção** (a flag nunca está na Vercel + gate de NODE_ENV). Sem sessão, `/api/items` dá 401 e o feed usa cache/import local — usar "importar dados" (menu) pra carregar o JSON real. Para reexigir login local: comentar a flag e reiniciar o dev.
- **Pendências:** imagens base64 → Storage (IMG), efeito R3F nos favoritos, SMTP (Resend), vídeo no Safari (B4). Ver ROADMAP.

## Protótipo de referência
O protótipo vanilla está em `../prototype/` (fora deste repo) — fonte para portar UI/lógica.
