# ADR 0001 — Especificação dos Embeds (engenharia a preservar)

**Status:** Aceito · **Data:** 2026-06-19

**Contexto:** O protótipo resolveu, com calibração no pixel, como embutir cada plataforma sem distorcer proporção e sem o usuário sair do app por engano. Essa engenharia é cara e NÃO deve ser redescoberta na migração pro Next.js — deve ser **portada verbatim**. Este documento é a fonte da verdade. Origem: `prototype/js/data.js` (`buildEmbed`, `detectSource`) e `prototype/css/style.css` + `prototype/js/app.js` (`fitReels`/`scaleCrop`/`fitIgStage`).

**Regra de ouro:** proporção é sagrada. Nunca distorcer vídeo. Escala sempre via `transform: scale()` (preserva aspect ratio), nunca via width/height direto. O fator de escala é calculado em JS porque depende da largura real do card.

---

## detectSource(url) — ordem importa
threads.net/.com → `threads` · instagram → `instagram` · facebook/fb.watch → `facebook` · youtube/youtu.be → `youtube` · tiktok → `tiktok` · x.com/twitter → `twitter` · vimeo → `vimeo` · senão → `web`.

## buildEmbed(url, meta) — retorna HTML do iframe ou null

Para cada plataforma: **regex → URL de embed → container → geometria**.

### Instagram — `/p/`, `/reel/`, `/reels/`, `/tv/`
- Regex: `/instagram\.com\/(?:[\w.]+\/)?(p|reels|reel|tv)\/([A-Za-z0-9_-]+)/i`
- `reels` normaliza p/ `reel`. Embed: `https://www.instagram.com/{kind}/{id}/embed/`
- **`/p/` (post/carrossel)** → `.card-embed.embed-square` (aspect 4/5). iframe `inset:0`, 100%.
- **`reel`/`tv`** → `.card-embed.embed-reel > .reel-crop` (9:16).
- ⚠️ OG image do IG vem 1:1 mesmo em reel vertical — **NÃO confiar nela**.
- **Carrossel:** detectado por `img_index=` no link; ganha dica visual de setas (`.carousel-hint`).

### YouTube Shorts (vertical 9:16)
- Regex: `/(?:(?:www\.|m\.)?youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,})/i`
- Embed: `https://www.youtube.com/embed/{id}` em `.card-embed.embed-reel.embed-fill`
- `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"`

### YouTube comum (horizontal 16:9)
- Regex: `/(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|embed\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i`
- Embed: `https://www.youtube.com/embed/{id}` em `.card-embed.embed-wide` (16/9)
- **Fallback embed desativado pelo dono:** se `meta.embedDisabled`, trocar player por thumbnail `https://img.youtube.com/vi/{id}/hqdefault.jpg`.

### X / Twitter
- Regex: `/(?:(?:mobile\.)?twitter|x)\.com\/(?:i\/web\/status\/|[A-Za-z0-9_]+\/status\/)(\d+)/i`
- Embed: `https://platform.twitter.com/embed/Tweet.html?id={id}&dnt=true` em `.embed-tweet`
- **Altura dinâmica via `postMessage`:** ouvir `message` de origem twitter/x, ler `twttr.embed.params[0].height`, aplicar no iframe. Começa em 320px.

### Threads — `/@user/post/{code}`
- Regex: `/threads\.(?:net|com)\/@([\w.]+)\/post\/([A-Za-z0-9_-]+)/i`
- Embed: `https://www.threads.net/@{user}/post/{code}/embed` em `.embed-threads` (altura 580px).

### Facebook — reels, vídeos, watch, share/r/, share/v/, fb.watch
- Regex: `/(?:facebook\.com\/(?:share\/[rv]\/|reels?\/|watch|[\w.]+\/videos\/)|fb\.watch\/)/i`
- Embed: `https://www.facebook.com/plugins/video.php?href={URL_ENCODADA}&show_text=false` em `.embed-reel.embed-fill`

### TikTok — URL padrão `/@user/video/ID`
- Regex: `/(?:www\.)?tiktok\.com\/@[\w.]+\/video\/(\d+)/i`
- Embed: `https://www.tiktok.com/embed/v2/{id}` em `.embed-reel.embed-tiktok > .tt-crop`

### TikTok — URLs curtas (`vm.`/`vt.tiktok.com`, `tiktok.com/t/`)
- Teste: `/v[mt]\.tiktok\.com|tiktok\.com\/t\//i` **+** precisa de `meta.url` (o Microlink resolve o redirect).
- Extrai o ID do `meta.url` resolvido com a regex padrão acima.

### Vimeo — `vimeo.com/ID` ou `player.vimeo.com/video/ID`
- Regex: `/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/i`
- Embed: `https://player.vimeo.com/video/{id}?byline=0&portrait=0` em `.embed-wide`

---

## Geometria de crop (valores exatos — calibrados, não mexer sem reteste visual)

### Instagram reel — `.reel-crop` (base 330)
```
.embed-reel       { width:100%; aspect-ratio:9/16; overflow:hidden; }
.reel-crop        { width:330px; height:586.7px; /* 330×16/9 */ transform-origin:top left; overflow:hidden; }
.reel-crop iframe { top:-54px;  /* esconde header */  left:-70px; /* centraliza coluna 4:5→9:16 */
                    width:470px; /* 330÷0.703 */       height:800px; /* sobra cobre rodapé de likes */ }
```

### Instagram post quadrado/carrossel — `.embed-square` (aspect 4/5), iframe `inset:0`.

### Instagram via `.ig-media` + `.ig-stage` (aspect real do conteúdo)
- `IG_STAGE = 350` (largura fixa do iframe), `IG_HEADER = 54` (header cortado por cima).
- `--ar` = largura/altura real (default 0.5625 = 9:16). `fitIgStage()` calcula altura = `IG_STAGE/ar`, posiciona iframe com `marginTop:-IG_HEADER`, escala o stage por `clientWidth/IG_STAGE`, e expande o container p/ `(mediaH+160)*scale`.

### TikTok — `.tt-crop` (base 302)
```
.embed-tiktok   { aspect-ratio:302/534; overflow:hidden; }
.tt-crop        { width:302px; /* overscan ~4px/lado, nunca expõe margem branca */
                  height:534px; transform-origin:top left; overflow:hidden; }
.tt-crop iframe { top:-10px;  /* esconde barra de progresso */  left:-229px; /* centro do iframe = 380 */
                  width:760px; /* largura onde a geometria foi medida */  height:620px; }
```
Geometria validada com iframe travado em 760px: vídeo em x205→515 (310), y10→558 (548) ≈ 9:16.

### Mecanismo de escala (JS)
- `CROP_BASE = { "reel-crop": 330, "tt-crop": 302 }`.
- `scaleCrop(win)`: aplica `transform: scale(clientWidth / CROP_BASE[cls])` no crop.
- `fitReels()`: roda em todo `.embed-reel` (com `.reel-crop`/`.tt-crop`) e `.ig-media`; registra um `ResizeObserver`. Também roda no `resize` da janela e num watchdog `setInterval(600ms)` p/ casos onde resize não dispara.
- **No port React:** isso vira um hook (`useEffect` + `ref` + `ResizeObserver`). A MATEMÁTICA e o CSS são idênticos — só muda o invólucro.

---

## Cross-cutting (vale p/ todos os embeds)

1. **Anti-saída acidental (sandbox):** iframe recebe `sandbox="allow-scripts allow-same-origin allow-presentation"` — **sem `allow-top-navigation`** → o embed não consegue levar o usuário pra fora do app. Há link "abrir original" separado (fora do sandbox) p/ saída intencional.
2. **Camada de ativação:** primeiro toque libera a interação (evita clique acidental que abre o Instagram).
3. **Migração de embeds antigos:** itens salvos por versões antigas são reconstruídos via `buildEmbed` ao carregar (TikTok sem `tt-crop`/`scrolling="no"`, tweets sem `scrolling="no"`).
4. **scrubMeta:** metadados genéricos (`GENERIC_META`: "enjoy the videos...", "log into facebook", etc.) = lixo de bloqueio anti-robô → descartar título/descrição.
5. **CSP:** o `frame-src` da Content-Security-Policy precisa liberar EXATAMENTE estes domínios: `www.instagram.com`, `www.youtube.com`, `platform.twitter.com`, `www.threads.net`, `www.facebook.com`, `www.tiktok.com`, `player.vimeo.com`. CSP errado = embed quebrado. Ver `0002-seguranca-e-segredos.md`.

## Checklist de paridade na migração
Para CADA tipo, screenshot do build novo vs. protótipo, lado a lado, antes de marcar como pronto:
- [ ] IG reel · [ ] IG post/carrossel · [ ] YouTube · [ ] YouTube Shorts · [ ] TikTok (longo) · [ ] TikTok (curto vm/vt) · [ ] Twitter/X · [ ] Threads · [ ] Facebook · [ ] Vimeo
