# ADR 0006 — Rodada 2026-06-26: pílula, filtros, relembre navegável, facade IG, "esquecidos" e efeito R3F

**Status:** Aceito · **Data:** 2026-06-26 · **Contexto:** Segunda rodada sobre o feed real, executando as "Pendências da rodada 2026-06-26" do [ROADMAP](../../ROADMAP.md). Construído sobre o [ADR 0005](0005-fase1-estabilizacao-perf.md).

> Verificação desta sessão: dev local rodando (`vautch-prod`, porta 3210) com o
> bypass DEV (`DEV_AUTH_BYPASS`); UI validada no app real via `preview_*`
> (seed de localStorage + reload + snapshot/screenshot/eval), `node --check` no
> `bundle.js`, `tsc --noEmit` e `next build` (todos verdes). Sem push (aguardando Paulo).

---

## 1. F1b — "bem-vindo de volta" vira PÍLULA + filtro "última visita"

- O bloco-carrossel do morning reminder (igual ao relembre) deu lugar a uma **pílula
  de notificação** (terracota suave): texto + **"visualizar"** + **×**. Markup reusa a
  `<section id="morningReminder">` (ganha a classe `.morning-pill`); CSS dedicado.
- **"visualizar"** liga o período de filtro **`lastvisit`** — a timeline mostra só o
  guardado desde a visita anterior. `passesPeriod` ganhou o caso ABSOLUTO
  (`ts > _lastSeenAtLoad`), distinto das janelas relativas (hoje/7d/30d).
- **×** descarta a pílula na sessão (`_morningDismissed`); `updateHomeBlocks` respeita.
- Gate de exibição inalterado: visita há > 2h e há itens novos.

## 2. FILT — período "última visita" no dropdown de filtros

- `openFilterDropdown` adiciona `["lastvisit", "última visita"]` ao grupo **período**
  quando há uma visita anterior real (`_lastSeenAtLoad > 0`). Amarra com F1b (o mesmo
  filtro que a pílula liga). Reorg visual mais amplo da filterbar fica como dívida leve
  (Paulo marcou FILT "não urgente") — o concreto pedido (o período) está entregue.

## 3. F2b — relembre paginado (5 → +5 ao arrastar, até 20)

- `renderRememberCarousel` deixou de despejar tudo: monta um **pool** (`rememberCandidates`,
  teto `REMEMBER_MAX = 20`) e renderiza páginas de `REMEMBER_PAGE = 5` via
  `appendRememberPage`. Um listener de `scroll` no `.home-track` revela a próxima página
  quando chega perto do fim (o drag mexe em `scrollLeft`, então dispara o mesmo evento).

## 4. F2c — navegar no relembre maximizado (deck)

- `openCardMax(item, list, index)`: com lista, vira um **deck horizontal** — o slide ativo
  é centralizado e os vizinhos **espiam esmaecidos** (`opacity .42; scale .93`) nas bordas.
- **Navegação (revisão do Paulo — desktop):** arraste em **qualquer lugar da tela** (os
  listeners ficam no overlay inteiro, não só entre os cards), **roda do mouse** vira lateral
  enquanto o maximizado está aberto (ao fechar, volta o scroll da timeline — o listener morre
  com o overlay), **setas ←/→** na tela (somem no mobile) e **setas do teclado**. Detecção de
  eixo no drag evita brigar com o scroll vertical do slide.
- **Sempre cheio (bug do compacto):** o card maximizado é sempre full mesmo com a timeline em
  modo compacto — `body.view-compact` transformava o `.card` em grid e ESCONDIA a mídia
  (`.card-embed{display:none}`). Override em `.card-max-card` (`!important`) força o layout cheio.
- A lista navegável = os cards **já revelados** no track (ordem exibida), montada no
  `wireHomeTrack`. `cardMaxInner` isola o HTML de um card; o caso de 1 item segue sem deck.

## 5. B7 — facade do embed Instagram — **REVERTIDO** (segue em aberto)

- Tentativa: `buildEmbed` (IG) emitia um **facade** (pôster + "ver aqui" + "abrir no Instagram"),
  carregando o iframe só no clique.
- **Revertido na revisão do Paulo:** o facade era aplicado a **TODOS** os posts IG (não só os
  quebrados) — fricção desnecessária nos que funcionam. E o problema-raiz (saber se um post está
  quebrado) **não é detectável**: o iframe é cross-origin, o JS não enxerga o "link broken".
  Blanket-facade não é a solução certa.
- **Estado:** voltou o **embed IG direto** (igual v0.1.3). B7 segue como pendência — abordagem
  futura precisa de um sinal real de falha (ex.: heurística de timeout, ou identificar anúncio
  pelo link) antes de degradar pra pôster. Não degradar o caminho feliz.

## 6. F2d — relembre = "esquecidos" de verdade (tracking de interação)

- Novo store **device-local** `vault.seen` = `{ [id]: { opens, lastSeen } }`. Como
  `vault.lastSeen`, **NÃO entra na ponte de sync** (só itens do usuário; seeds ignorados).
  *(Cross-device fica como evolução futura — exigiria coluna/sync.)*
- `markSeen(id)` é disparado em: **maximizar/navegar** no relembre (cada slide visto),
  **ativar o embed** do facade IG ("deu play"), **expandir** um card no compacto, e
  **dwell** (`IntersectionObserver` + `DWELL_MS = 60000`: card ≥60% visível por > 1 min).
- `rememberCandidates` trocou o aleatório por ordenação dos **esquecidos**: menor `lastSeen`
  (0 = nunca visto) primeiro, desempate pelo item mais antigo (`itemEpoch`).

## 7. F3 — efeito de partículas nos favoritos — **2ª arquitetura: canvas 2D por card**

> 1ª tentativa (R3F / 1 canvas WebGL compartilhado, opção A do ADR 0005) foi **descartada**
> na revisão do Paulo: (a) o overlay fixo ficava SOBRE o conteúdo (tag/embed/título), e ele
> queria o efeito **no FUNDO do card** (conteúdo por cima); (b) o `<canvas>` do R3F bloqueava
> cliques (descendente com `pointer-events:auto`); (c) a instância única acoplava os cards
> (mudar um favorito mexia nos outros). Removidos `three`/`@react-three/fiber`/`@types/three`.

- **Insight que destrava a opção "1 canvas por card":** o limite de ~16 contextos é só do
  **WebGL**. Com **canvas 2D** não há esse limite → cada favorito tem o **seu próprio** `<canvas>`
  (independência total) sem estourar nada. Tudo em **vanilla** (`public/proto/bundle.js`) — os
  cards são vanilla, então não há ganho em React aqui.
- **Camada de fundo:** o `<canvas class="fav-fx">` entra como filho do card com **`z-index:-1`** →
  pinta SOBRE o fundo/degradê do card mas **ATRÁS de todo o conteúdo** (tag, embed, ícones,
  título, descrição). Acompanha `border-radius` do card; `pointer-events:none` (não bloqueia UI).
- **Efeito:** campo **DENSO** de pontos terracota **nítidos** (arcos 2D, **sem blur/glow** por
  padrão — `shadowBlur` só se o slider blur > 0), grade jitterada, acendendo/apagando em **onda**
  (`sin` por posição+tempo), fade vertical acompanhando o degradê. Cor lida de `--accent`
  (re-lida no toggle de tema). `requestAnimationFrame` único varrendo todos os canvases.
- **Performance:** só desenha favoritos **no viewport** (`IntersectionObserver`); o rAF só roda
  enquanto há favoritos (`_fxEntries.size`); cards que saem do DOM (rebuild) são limpos no loop
  (`isConnected`). `ResizeObserver` por card reconstrói a grade no resize.
- **Painel de controle (tuning):** `buildFxPanel()` injeta um painel com **sliders** —
  `on, densidade, tamanho, opacidade, intensidade, velocidade, onda (escala), zona topo %,
  zona altura %, blur`. Persistido em `vault.fxconfig` (device-local; fora da ponte de sync).
  "copiar valores" exporta o JSON p/ fixar como padrão depois. **É ferramenta de tuning — esconder
  antes de produção** (ou trocar por defaults fixos quando o Paulo fechar os valores).
- **Pitfall corrigido (TDZ):** `applyTheme()` roda no top-level ANTES do módulo FX; chamar
  `fxReadAccent()` (que atribui ao `let _fxAccentRGB`) de dentro do `applyTheme` travava TODO o
  init por TDZ. Solução: `fxReadAccent` só no **clique do tema** (e o loop lê o accent ao iniciar).

### 7b. Refinos do efeito (2ª revisão do Paulo)

- **Quadradinhos, não círculos:** `fillRect` em vez de `arc` — mais perf e a estética que ele quis.
- **Config POR TEMA + cor:** `vault.fxconfig = { dark:{…}, light:{…} }`, cada um com `color` própria
  (o resultado no claro pedia cor/opacidade diferentes do dark). O efeito usa `fxCur()` (tema ativo).
  Painel ganhou **abas 🌙/☀️** (edita um tema por vez) e **color picker**. Defaults dark = valores
  que o Paulo afinou nos sliders (`density 80, size 1.6, opacity .27, intensity .05, speed 2.55,
  waveScale 1, zoneHeight 17, sides 12, blur 0`).
- **"Abraça" o card:** máscara de borda (`fxEdgeMask`) — forte no **topo + laterais**, some pro
  centro/baixo (slider `laterais %`). A grade só guarda pontos com máscara > 0 (perf). Verificado:
  topo/lados com pontos, **centro = 0**.
- **Efeito no maximizado:** `openCardMax` anexa o canvas ao `.card-max-card` dos itens favoritos.
- **Ícones do topo:** sobre as partículas ficavam apagados → ganharam **fundo circular** translúcido
  (`.card.is-fav .card-top-right > button`), com hover (X → terracota).
- **Confirmado:** o efeito **só processa favoritos na viewport** (IntersectionObserver) e o rAF só
  roda enquanto há favoritos — rolar pra fora = não processa.

### 7c. Refinos do efeito (3ª revisão do Paulo)

- **Menos uniforme — concentração no topo dissipando pra baixo:** a máscara virou um **gradiente
  vertical** (`fxWeight`): peso 1 no topo → 0 embaixo. O peso reduz tanto a **quantidade**
  (thinning probabilístico no build: `random() > 0.15 + 0.85*peso` descarta) quanto a **opacidade**
  (alpha ∝ peso). Resultado medido: ~1800 pontos no topo vs ~13 no meio/baixo.
- **`feather` (suavizar borda):** alarga a transição da máscara (smoothstep) — o "corte" das
  laterais/altura deixa de ser brusco. É o **blur da máscara**; as **shapes nunca** levam blur
  (removido o `shadowBlur`; `blur` saiu do painel).
- **`topLight` (clarear topo):** a cor escolhida clareia em direção ao topo (lerp → branco
  proporcional ao peso, **teto 0.85** pra nunca virar branco puro).
- **Quadrados sem empilhar:** jitter reduzido pra `0.3 * spacing` (era 0.7) → menos sobreposição.
- **Ícones do topo circulares e padronizados:** todos `26×26`/`border-radius:50%` (o `card-fold`
  era retangular). Cuidado: o `display:inline-flex` do círculo NÃO pode reativar o `card-fold` no
  modo timeline (ele é só do compacto) → display forçado só em `card-fav-btn`/`card-del`.
- **Timing do build:** favoritos do load inicial são criados (`makeCard`) ANTES do layout (rect=0).
  Além do `ResizeObserver`, um rebuild deferido (rAF duplo + `setTimeout 400`) no init garante medir
  o tamanho real. Sliders novos: `feather`, `topLight` (no lugar de `blur`).

### 1b. Pílula "bem-vindo de volta" — redesign (revisão do Paulo)

- A 1ª versão (pílula com stroke + fundo de baixa opacidade) tinha "cara de AI". Agora: **fundo
  OPACO invertido** (`background: var(--ink)` / `color: var(--paper)` → creme no dark, escuro no
  claro, contraste se inverte sozinho com o tema), **sem stroke**, sombra mínima. Texto **capitalizado**,
  **sem travessão** (usa ":"): "Bem-vindo de volta: N coisas novas desde a última visita."

### Relembre — preview de nota na thumbnail

- Notas sem imagem mostram o **texto da nota** (clamp 5 linhas) no thumb em vez do ✦. Prioridade do
  thumb: imagem → texto da nota → favicon → ✦.

## 8. Pendências (não bloqueiam)

- **IMG (Fase 2):** base64 → Storage (signed URLs) — segue pendente.
- **FILT:** reorganização visual mais ampla da filterbar (o período "última visita" já entrou).
- **F2d cross-device:** o tracking é device-local hoje.
- **B7:** facade restrito ao IG; estender a outras plataformas só se aparecer necessidade.
- Complexidade ciclomática do `bundle.js` (port vanilla) segue baseline pré-existente; funções
  novas mantidas enxutas. `bundle.js` não é lintado/typechecked pelo `next build` (só `src/`).
