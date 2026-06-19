# Vautch — instruções do projeto

Repositório de **produção** do Vautch (app de salvar tudo, anti-algoritmo).

## Antes de mexer, leia
- `docs/system-design.md` — arquitetura canônica (fonte da verdade)
- `docs/decisions/0001-embeds-spec.md` — engenharia dos embeds (regex, geometria de crop). **NÃO redescobrir; portar verbatim.**
- `docs/decisions/0002-seguranca-e-segredos.md` — checklist de segurança **OBRIGATÓRIO**.

## Stack
Next.js App Router + TypeScript + Tailwind v4 + Supabase (Postgres/Storage/Edge Functions/Auth) + Vercel. PWA.

## Regras inegociáveis
- **Sessão/JWT em cookie httpOnly** (`@supabase/ssr`), NUNCA localStorage. Nenhum segredo com prefixo `NEXT_PUBLIC_` (só anon key + base URL).
- **RLS default-deny** em toda tabela (`auth.uid() = user_id`).
- **Complexidade ciclomática ≤ 10** por função (ESLint).
- `src/core` = TypeScript puro, **ZERO imports de Next/React** (reuso em extensão/mobile).
- Proporção de vídeo é sagrada — nunca distorcer embed.

## Fluxo de trabalho
Commit local; **o Paulo revisa e dá o push** (ele pediu revisar sempre). Documentar decisões estruturais como novos ADRs em `docs/decisions/`.

## Protótipo de referência
O protótipo vanilla está em `../prototype/` (fora deste repo) — fonte para portar UI/lógica.
