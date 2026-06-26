# ADR 0005 — Fase 1/2/3: estabilização, performance e features

**Status:** Aceito · **Data:** 2026-06-25 · **Contexto:** Primeira rodada sobre o feed real (datas, ordem, performance e features) depois que a Fase 0 ligou o backend. Itens guiados pelo [ROADMAP](../../ROADMAP.md). Construído sobre o [ADR 0004](0004-auth-schema-fase0.md).

> Verificação desta sessão: como o dev local trava ~25s/página no middleware (TLS do proxy
> corporativo — ver memória), a UI foi validada num **harness estático** em `/proto/_harness.html`
> (rota fora do middleware, `fetch` stub, localStorage semeado) + **testes de lógica em Node**
> (datas, ordenação, stripTracking) + `next build`. O harness e os testes foram removidos ao fim.

---

## 1. Data canônica do item (`createdAt`) — B5

- O `GET /api/items` passou a **selecionar e devolver `created_at`** e a injetar `createdAt` no item:
  `createdAt = data.createdAt ?? row.created_at`. Itens legados (sem `createdAt` no jsonb) herdam o
  `created_at` real do banco. O save grava `createdAt: new Date().toISOString()` (nota, print, link).
- `itemEpoch(item)` = época canônica em ms: prefere `createdAt` (ISO), cai pro epoch do id `v<13díg>`,
  senão 0. `relativeTime()` formata "agora mesmo / há X min / há X h / ontem / há X dias / data absoluta".
- `itemTimestamp` passou a exigir **exatamente 13 dígitos** (`/^v(\d{13})$/`) — o id de print
  (`v<epoch><performance>`) tem mais que isso e devolvia um número-lixo gigante; agora cai pro `createdAt`.

## 2. Ordenação canônica estável — B1

- **Raiz do "scramble":** o feed renderizava a ordem CRUA do array (que o servidor devolvia por
  `created_at DESC`); itens importados em lote têm `created_at` quase idêntico → ordem instável do Postgres.
- **Fix:** `byEpochDesc` ordena por época desc com **desempate determinístico por id** (`localeCompare`).
  Como o id `v<epoch>` é monotônico, o desempate recupera a cronologia mesmo com `created_at` empatado.
  Tie-break por `id` também no `GET` (defensivo). `orderedUserItems` aplica `vault.order` quando existe
  (religando o drag-reorder, que era **código morto** no render — `saveOrder` gravava e ninguém lia).

## 3. Paginação / infinite scroll — P2

- `buildFeed` agora guarda a lista em `_feedItems` e renderiza em páginas de **10** via `renderPage(n)`,
  com um `IntersectionObserver` sobre um `.feed-sentinel` no fim (rootMargin 700px). Reduz o custo de
  render inicial (antes: 50+ cards/iframes de uma vez).
- **Filtro/busca e drag** chamam `renderAllRemaining()` antes de operar — o `applyFilter` trabalha sobre o
  DOM (só veria a página atual) e o `saveOrder` precisa de todos os cards. Sem filtro, a paginação fica intacta.
- `insertNewItem` (novo card no topo) segue sem rebuild — autocorrige no próximo `buildFeed`.
- **Guard da lixeira (regressão pega na revisão adversarial):** salvar um item com a **lixeira aberta**
  injetava um card vivo no DOM da lixeira e, pior, o `renderAllRemaining` (novo no `applyFilter`) chamava
  `insertBefore(card, _feedSentinel)` com o sentinel já destacado (a lixeira faz `feed.innerHTML=""`)
  → `NotFoundError`. Corrigido com **defesa em profundidade**: (a) `renderAllRemaining` sai cedo se
  `_feedSentinel` não está conectado; (b) `applyFilter` não chama `renderAllRemaining` quando
  `activeCat==="__trash"`; (c) `exitTrashView()` (volta pro feed normal antes do persist) em
  `insertNewItem` e no fluxo de URL. Verificado no harness (salvar na lixeira e no fluxo normal, sem erro).

## 4. Favorito / Priority Cards — F3 (mecanismo)

- Campo `item.fav` (booleano) persiste no **`data` jsonb** via `updateSavedField` → ponte de sync (PUT).
  **Sem migração de schema** (o `data` é jsonb livre).
- UI: botão ★ no `card-top`; `is-fav` no card; favoritos sobem pro topo (`byEpochDesc` trata `fav` primeiro).
- Destaque **editorial** (anel dourado `--gold` via `color-mix` + estrela), não "glow". O efeito **React
  Three Fiber** (partículas) pedido fica como **camada futura**: WebGL por card não escala (~16 contextos
  por browser) — exige um canvas único compartilhado ou migração do card pra React.

## 5. Blocos "home" — F1 (Morning Reminder) e F2 (Remember Carousel)

- `<section>` **fora do `#feed`** (no markup, entre filterbar e feed) — sobrevivem ao `feed.innerHTML=""`.
- F1: itens com `itemEpoch > vault.lastSeen`, só se a última visita foi há > 2h. `vault.lastSeen` é
  gravado no fim do init (device-local; a ponte de sync **ignora** essa chave).
- F2: amostra aleatória de 5, scroll horizontal, cards compactos **sem iframe** (`homeCardHTML`).
- Ambos somem quando há filtro/busca (`homeView()`), via `updateHomeBlocks()` no `applyFilter`.

## 6. Limpeza de tracking híbrida — B6

- `stripTracking` deixou de ser denylist pura e virou **híbrido**:
  - **Plataforma conhecida** (IG/YT/FB/TikTok/Vimeo/X/Threads): **allowlist** — mantém só os params
    funcionais (`youtube: v,t,start,list,index`; `instagram: img_index`; `facebook: v`; `vimeo: h`) e
    remove TODO o resto (utm_*, mibextid, rdid, eav, _rdr, si, fbclid…). Robusto a params novos de boost.
  - **Host genérico (web):** **denylist** — preserva o link (ex.: `?id=123`) e tira só rastreadores conhecidos.
- Fallback: link social reconhecido **sem embed** mostra a imagem do preview + mensagem "abrir original".

## 7. UX — B2, B3, U1

- **B2:** `toggleExpand` preserva/restaura `scrollY` (com `scroll-behavior:auto`) em torno do reflow
  grid→block; `overflow-anchor:none` no card em animação. (drift = 0 no teste).
- **B3:** `title=` carrega o conteúdo (tooltip do texto truncado); instrução vai pro `aria-label`;
  edição do título no compacto destrava o ellipsis (`.card-title.is-editing`).
- **U1:** botão × no campo principal (reusa `is-typing`) + utilitária `attachClear(el)` (editor de nota).

## 8b. Refinos (rodada 2026-06-26)

- **Embed Instagram:** o save passou a montar o embed PREFERINDO o link colado (`buildEmbed(url) ||
  buildEmbed(meta.url)`) — preserva `/reel/` (Microlink canonicaliza pra `/p/`, e reel via `/p/` o IG
  rejeita). Itens antigos se autocorrigem na migração do `loadSaved`. **Limite conhecido (B7):** o IG
  bloqueia embed de anúncios/boost e o JS não detecta (cross-origin) → facade pendente.
- **Relembre (F2) virou sob demanda:** botão `.chip-remember` na filterbar (antes do compacto);
  drag-to-scroll com mouse (`initTrackDrag`), sem scrollbar; clique num card abre `openCardMax` (overlay
  read-only, não vai pro link externo). Guarda `_suppressClick` evita maximizar logo após arrastar.
- **Ícones:** os SVGs do Paulo (`assets/icons/*.svg`) foram inlinados nos chips com `fill="currentColor"`
  (herdam a cor do texto por tema; lixeira vermelha via `.chip-trash`). Não referenciados como arquivo
  (currentColor não funciona em `<img>`).
- **Botão prioridade (`.chip-prio`)** + `filterFav`: filtro que mostra só `.is-fav` (entra no predicado
  do `applyFilter` e no gate do `renderAllRemaining`).
- **Favorito em terracota:** estrela `var(--accent)`; degradê terracota como CAMADA de background do
  card (`linear-gradient(...) , var(--card)`) — não tinge o texto; é a zona do futuro efeito R3F.
- **Bypass de login DEV** (`DEV_AUTH_BYPASS` + `NODE_ENV!=="production"` no `middleware.ts`) e
  `--use-system-ca` no `.claude/launch.json` — só local; ver CLAUDE.md / memória.

## 8. Pendências (não bloqueiam)

- **IMG (Fase 2):** migrar imagens base64 → bucket `media` com signed URLs. Exige rota `POST /api/media`,
  assinatura no GET, fallback offline e migração de legados — e **verificação logada** (não testável no
  local). Plano detalhado no ROADMAP. P1+P2 já entregam o load "levinho"; IMG é o ganho de rede.
- **F3 R3F:** efeito de partículas (camada de canvas compartilhado / migração pra React).
- Complexidade ciclomática do `bundle.js` (port vanilla) segue acima de 10 em `cardHTML`/`makeCard` —
  baseline pré-existente, **não lintado no `next build`** (só `src/`). Funções novas mantidas ≤10.
