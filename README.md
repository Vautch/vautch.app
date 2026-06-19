# Vautch

App pessoal de salvar tudo (links, notas, imagens) num arquivo cronológico. Sem algoritmo.

- **Stack:** Next.js (App Router) + TypeScript + Tailwind v4 + Supabase + Vercel · PWA
- **Arquitetura:** [`docs/system-design.md`](docs/system-design.md)
- **Decisões (ADRs):** [`docs/decisions/`](docs/decisions/) — embeds (`0001`), segurança (`0002`)

## Dev
```bash
npm install
cp .env.example .env.local   # preencher com as chaves do Supabase
npm run dev
```

## Scripts
- `npm run dev` · `npm run build` · `npm run start`
- `npm run lint` · `npm run typecheck`

> **Segurança:** ver `docs/decisions/0002-seguranca-e-segredos.md`. Sessão em cookie httpOnly, RLS default-deny, nenhum segredo no client.
