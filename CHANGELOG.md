# Changelog

Histórico de mudanças do Vautch. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Datas em UTC-3 (horário de Brasília).

## [Não lançado]

## 2026-06-24 — Fase 0: backend de produção (auth + feed no Supabase)

### ✨ Autenticação
- **Tela de login** (`/login`) no design Vautch (claro/escuro, switch igual ao do app),
  com e-mail/senha, confirmar senha no signup e link "esqueci minha senha".
- **Signup + confirmação de e-mail obrigatória**; **reset de senha**
  (`/forgot` → e-mail → `/reset-password`) com mensagem anti-enumeração.
- **Sessão em cookie httpOnly** (`@supabase/ssr`), endurecida em `cookie-options.ts`
  (httpOnly + Secure + SameSite=Lax) — corrigida a falha do scaffold padrão que
  deixava o token de sessão legível por JavaScript.
- **Middleware** protege rotas privadas; `/` redireciona pra `/app`; assets
  estáticos (`/proto`, `/assets`) liberados. Logout limpa cookie + cache local.

### 🗄️ Banco de dados (Supabase Postgres)
- Schema inicial (`supabase/migrations/0001_init.sql`): `profiles` + `items`
  (design **jsonb** — item completo em `data`, `created_at` real, `deleted_at`
  p/ lixeira, PK composta `(user_id, id)`).
- **RLS default-deny** em tudo (`auth.uid() = user_id`); GRANTs explícitos
  (`authenticated` CRUD, `anon` bloqueado); trigger de profile no signup;
  bucket privado `media`.

### 🔗 Feed conectado ao Supabase
- API `/api/items` (GET lista, PUT reconcilia estado completo) — auth server-side + RLS.
- Ponte de sync no bundle: carrega do servidor no init, sincroniza nas escritas
  (debounce 800ms), trava anti-perda de dados, limpa cache no logout.
- **Isolamento por usuário provado** (2 contas): B não vê dados do A.
- Resiliência: item sem `cat` não derruba mais o feed (default "geral").

### 📦 Migração de dados
- Botões **exportar/importar JSON** no menu; o import sobe pro Supabase antes
  do reload (preserva os dados na migração).

### ⏳ Pendências
- Google OAuth (botão pronto, escondido via `GOOGLE_ENABLED` até configurar o provider).
- Migração do export real; sync multi-aba/device.

## 2026-06-19

### ✨ Novidades
- **Marcar como visto** — botão de olho em cada card. Ao marcar, o card fica mais
  discreto (opacidade reduzida, com transição suave) e aparece um balão
  "Marcado como visto". Clicar de novo desfaz.
- **Arrastar pra reorganizar** — agora dá pra pegar o card e arrastar pra onde
  quiser. Os outros cards se reorganizam com animação fluida e o card "encaixa"
  no lugar mais próximo ao soltar.
- **Modo compacto** — visualização enxuta da lista, com mini-thumbnail. Clique
  duas vezes (ou toque, no celular) pra expandir um card.
- **Dicas contextuais** — balõezinhos que saem do próprio botão clicado,
  ensinando a expandir e arrastar. Texto específico pra desktop ("clique duas
  vezes / arraste") e celular ("toque / segure o dedo").
- **App no ar** — protótipo rodando em produção (Next.js + Vercel) com 100% de
  fidelidade visual ao original.

### 🐛 Correções
- **Tema sem flash** — acabou o "pisca" de tela clara → escura ao dar refresh.
  O tema salvo é aplicado antes da página pintar; primeiro acesso entra em claro.
- **Erro de console eliminado** — o aviso do React/Next sobre `<script>` no tema
  foi resolvido (migrado para `next/script`).
- **Drag não some mais o card** — a animação ficou visível e fluida do começo ao fim.
- **Tooltips e menus inteligentes** — sempre ficam dentro da tela; se não cabem,
  são empurrados pra caber e a setinha se reposiciona pra continuar apontando o botão.
- **Menu de tag no celular** — volta a subir acima do teclado pra não ser coberto.
- **Menu de tag** — não estoura mais a largura da tela; "categoria" virou "tag"
  (consistente com "subtag").
- **"não mostrar dicas"** — texto agora legível no modo escuro.
- **Lote inicial de bugs** — estado vazio na primeira abertura, filtro no modo
  compacto, sobreposição de camadas (z-index), editor de nota, conteúdo privado
  do Facebook e altura de threads.
