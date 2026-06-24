# ADR 0003 — UI & Interações do Protótipo (decisões técnicas)

**Status:** Aceito · **Data:** 2026-06-21 · **Contexto:** Decisões tomadas durante o desenvolvimento do protótipo vanilla (`prototype/`) nas sessões de 19–21/06/2026. Registradas aqui para não serem redescoblertas na migração Next.js. Origem: `prototype/js/app.js`, `prototype/css/style.css`.

---

## 1. Drag & Drop — FLIP + WAAPI

**Decisão:** Usar Web Animations API (WAAPI) para animar cards durante drag, não CSS transitions.

**Por quê:** CSS `transition` em `transform` inline sofre race condition — o browser agrupa a mudança de layout e a transition num único frame, a animação não chega a rodar. WAAPI (`element.animate([from, to], opts)`) roda no compositor independentemente do CSS, garantindo que a animação aconteça de fato.

**Padrão FLIP adotado:**
1. Medir posição de TODOS os cards antes da mutação do DOM (`getBoundingClientRect`)
2. Aplicar a mudança de DOM (inserir card na nova posição)
3. Calcular delta (`prev - new`)
4. Animar do delta → zero via WAAPI

**Drop sem flash:**
- NÃO usar `position: fixed` para o card em drop — produz piscada ao remover.
- Gravar `fromR = card.getBoundingClientRect()` antes do insert no DOM, inserir card no flow, depois animar `fromR → toR` via WAAPI. O card já está no flow; a animação é puramente visual.

**`body.is-reordering`:**
- Classe adicionada em `startDrag()`, removida após 300ms em `endDrag()`/`cancelDrag()`.
- Suprime via CSS qualquer `transform` decorativo nos cards (nth-child rotate, hover lift) enquanto o WAAPI está rodando — evita conflito entre transforms.

**Easing padrão:** `cubic-bezier(.2,.85,.25,1)` — constante `EASE` no app.js.

**Migração Next.js:** WAAPI é nativo do browser; sem dependência. A lógica de FLIP pode ser extraída para um hook `useDragReorder()`.

---

## 2. Cards — Rotação e Hover

**Decisão:** Remover rotação decorativa `nth-child(odd/even)` dos cards. Remover hover `translateY`.

**Por quê — rotação:** após reordenar via drag, os cards trocam de posição no DOM e a paridade muda — um card que era `odd` vira `even`. A rotação residual ficava incorreta e visualmente quebrada após qualquer reordenação.

**Por quê — hover lift:** o `translateY(-4px)` no hover conflitava com os transforms do WAAPI durante drag. Além disso, o efeito de levitar não é coerente com o design system atual.

**Estado atual:** cards têm apenas `box-shadow` elevado no hover (sem transform).

---

## 3. Anti-Flash de Tema (FOUC)

**Decisão:** Script inline no `<head>` + classe `html.theme-init` para suprimir transições no primeiro paint.

**Problema resolvido:** sem isso, o browser pinta a página com o tema default (light) e depois o JS aplica o tema salvo — o usuário vê um flash de troca (branco → escuro ou vice-versa).

**Implementação:**
```js
// injeta antes do CSS carregar (no <head>, antes do <link rel="stylesheet">)
(function(){
  try {
    var t = localStorage.getItem('vault.theme') || 'light';
    var r = document.documentElement;
    r.dataset.theme = t;
    r.style.background = (t === 'dark' ? '#131316' : '#f4efe6');
    r.classList.add('theme-init');
  } catch(e) {}
})();
```

```css
/* suprime TODAS as transições enquanto theme-init está presente */
html.theme-init *, html.theme-init *::before, html.theme-init *::after {
  transition: none !important;
}
```

**Remoção da classe:** via `requestAnimationFrame(() => requestAnimationFrame(clearThemeInit))` + `setTimeout(clearThemeInit, 120)` de fallback (rAF não dispara em contextos headless/sem paint).

**`applyTheme()` deve sincronizar o fundo do `<html>`:** ao trocar tema via botão, o `html.style.background` deve ser atualizado. Se não for, a cor antiga vaza atrás do `body` como uma faixa colorida.

**Migração Next.js:** já implementado em `src/app/layout.tsx` via `<Script strategy="beforeInteractive">`.

---

## 4. Filterbar — Chips de Overflow (+N / −)

**Decisão:** Botão `+N` fixo fora do scroll, calculado por posição de viewport, não por contagem fixa.

**Estrutura HTML:**
```html
<div class="filters-line">       <!-- wrapper flex -->
  <nav class="filters" id="filters">  <!-- chips roláveis no mobile -->
  </nav>
  <div class="filters-more" id="filtersMore">  <!-- +N fixo, não rola -->
  </div>
</div>
```

**`countHiddenChips()`:** mede por posição de linha (`.getBoundingClientRect().top` relativo ao primeiro chip), não por `scrollWidth` ou `offsetHeight` do container. Isso é necessário porque o container usa `max-height` com transição animada — durante a animação, a altura ainda não reflete o estado final, mas as posições dos chips já refletem.

**Comportamento:**
- `+N` → ao clicar, vira `−` (símbolo unicode, não a palavra "menos") na mesma posição.
- `−` → ao clicar, colapsa e vira `+N` novamente.
- Recalculado no `resize` da janela via `requestAnimationFrame`.

---

## 5. Subtag — Atualização em Tempo Real

**Decisão:** `setItemSubcat()` atualiza o DOM do card sem reescrever `innerHTML` do container.

**Problema:** o `.card-cat` (span da categoria no card) tem um `addEventListener('click', ...)` adicionado em `makeCard()`. Reescrever `innerHTML` do container `.card-tags` destrói esse elemento e o listener junto — a tag para de abrir o menu de categorias.

**Solução:** remover apenas os filhos `.card-sep` e `.card-subcat`, e usar `appendChild` para os novos elementos. O `.card-cat` nunca é tocado.

```js
tagsEl.querySelectorAll('.card-sep, .card-subcat').forEach(el => el.remove());
if (item.subcat) {
  const sep = document.createElement('span');
  sep.className = 'card-sep';
  // ...
  const sub = document.createElement('span');
  sub.className = 'card-subcat';
  // ...
  tagsEl.appendChild(sep);
  tagsEl.appendChild(sub);
}
```

**Regra geral para migração:** nunca reescrever `innerHTML` de um container que tem filhos com listeners. Usar append/remove cirúrgicos ou delegação de eventos no container pai.

---

## 6. Subtag — Layout Vertical no Menu

**Decisão:** `.sub-option` tem `display: block; width: 100%`.

**Por quê:** `<button>` é `inline-block` por default. Sem `display: block`, múltiplas subtags fluem lado a lado (inline), quebrando em duas colunas em resoluções menores. Cada subtag deve ocupar uma linha inteira.

---

## 7. URL Tracking — Strip Automático

**Decisão:** `stripTracking()` remove UTMs e parâmetros de rastreamento de toda URL ao salvar.

**Parâmetros removidos:** qualquer param com prefixo `utm_` + conjunto fixo: `ig_rid`, `igshid`, `igsh`, `fbclid`, `gclid`, `gclsrc`, `dclid`, `mc_cid`, `mc_eid`, `_gl`, `msclkid`, `yclid`, `twclid`.

**Preservados intencionalmente:** `img_index` (seletor de frame em carrosséis IG), `v=` (ID de vídeo YouTube).

**Aplicado em dois pontos:** ao salvar novo item + no `buildEmbed()` antes de construir o iframe src.

**Contexto Instagram Reels:** links de campanha publicitária do Instagram incluem `ig_rid` / `igshid`. Esses parâmetros podem ativar restrições de embed (o IG bloqueia play inline, exibe "Watch on Instagram"). Remoção dos params ao salvar mitiga mas **não resolve completamente** — o bloqueio pode ser account-level ou content-level (ex: áudio licenciado). Investigação pendente.

---

## 8. Contagem de Itens — Dinâmica

**Decisão:** `.topbar-meta` é preenchido 100% via JS. Nenhum texto hardcoded no HTML.

**Por quê:** HTML estático com "47 itens guardados" aparecia no DOM antes do JS carregar — o usuário via o número errado por alguns frames. O elemento fica vazio no HTML; o JS preenche via `updateCount()` após `buildFeed()`.

---

## 9. Lixeira no Modo Compacto

**Decisão:** `body.view-compact .card.card-trash { display: block; }` sobreescrito explicitamente.

**Por quê:** o modo compacto usa `display: grid` nos cards para criar o layout de miniatura + texto. Cards da lixeira têm estrutura diferente (sem thumbnail) e quebravam com grid. A solução é um override específico para `.card-trash` no modo compacto.

---

## 10. Convenção de Backup Local

**Decisão:** a cada versão estável, criar backup em `D:\Dropbox\Claude Code\Personal\Vautch App\backup\vX.X.X` (cópia completa do `vautch.app/`, incluindo `node_modules`).

| Versão | Data | Conteúdo principal |
|--------|------|-------------------|
| v0.1.0 | 2026-06-19 | Protótipo inicial — embeds, drag, categorias, lixeira |
| v0.1.1 | 2026-06-21 | Drag FLIP/WAAPI, anti-flash, filterbar overflow, subtag real-time |

---

## Checklist de paridade na migração Next.js

Para cada item abaixo, validar no build Next antes de marcar como pronto:

- [ ] Drag FLIP funciona com WAAPI (sem CSS transition conflict)
- [ ] `body.is-reordering` suprime transforms decorativos durante drag
- [ ] Tema aplica sem flash (script `beforeInteractive` + `html.style.background`)
- [ ] `applyTheme()` sincroniza `html.style.background`
- [ ] Chips de overflow `+N/−` calculados por viewport
- [ ] Subtag reflete no card sem refresh (append/remove, não innerHTML)
- [ ] `.sub-option` vertical (display: block)
- [ ] URLs salvas sem UTM/tracking params
- [ ] `.topbar-meta` sem texto hardcoded
- [ ] Cards da lixeira no modo compacto com `display: block`
