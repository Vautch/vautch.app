// Vault — dados de exemplo + captura real de metadados e classificação por conteúdo

const VAULT_ITEMS = [];

const AI_STEPS = [
  "lendo o link",
  "buscando o conteúdo do post",
  "analisando o tema",
  "guardando no seu vautch"
];

/* ---------- fonte (rede social) por domínio ---------- */
function detectSource(raw) {
  const u = raw.toLowerCase();
  if (u.includes("threads.net") || u.includes("threads.com")) return "threads";
  if (u.includes("instagram")) return "instagram";
  if (u.includes("facebook") || u.includes("fb.watch")) return "facebook";
  if (u.includes("youtube") || u.includes("youtu.be")) return "youtube";
  if (u.includes("tiktok")) return "tiktok";
  if (u.includes("x.com") || u.includes("twitter")) return "twitter";
  if (u.includes("vimeo")) return "vimeo";
  return "web";
}

/* ---------- embed real por plataforma ---------- */

// aspect ratio largura/altura a partir das dimensões da imagem (metadados)
function aspectFromMeta(meta) {
  if (meta && meta.imageW && meta.imageH) return meta.imageW / meta.imageH;
  return null;
}

// Retorna HTML de iframe oficial da plataforma, ou null se não reconhecer.
// `meta` (opcional) traz o URL resolvido (links curtos) e dimensões reais do conteúdo.
function buildEmbed(raw, meta) {
  if (!raw) return null;
  const url = raw.trim();

  // Instagram: /p/, /reel/, /reels/, /tv/
  let m = url.match(/instagram\.com\/(?:[\w.]+\/)?(p|reels|reel|tv)\/([A-Za-z0-9_-]+)/i);
  if (m) {
    const kind = m[1].toLowerCase() === "reels" ? "reel" : m[1].toLowerCase();
    const iframe = `<iframe src="https://www.instagram.com/${kind}/${m[2]}/embed/" loading="lazy" allowfullscreen scrolling="no" allowtransparency="true"></iframe>`;
    // OBS: OG image do IG vem 1:1 mesmo em reel vertical — NÃO confiar nela.
    // reel/tv = sempre 9:16 (recorte calibrado). /p/ = post quadrado.
    if (kind === "p") return `<div class="card-embed embed-square">${iframe}</div>`;
    return `<div class="card-embed embed-reel"><div class="reel-crop">${iframe}</div></div>`;
  }

  // YouTube Shorts: vertical 9:16 (inclui m.youtube.com)
  m = url.match(/(?:(?:www\.|m\.)?youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,})/i);
  if (m) {
    return `<div class="card-embed embed-reel embed-fill"><iframe src="https://www.youtube.com/embed/${m[1]}" loading="lazy" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></div>`;
  }

  // YouTube comum: watch, embed, live, /v/, youtu.be — horizontal 16:9 (inclui m.youtube.com)
  m = url.match(/(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|embed\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
  if (m) {
    return `<div class="card-embed embed-wide"><iframe src="https://www.youtube.com/embed/${m[1]}" loading="lazy" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></div>`;
  }

  // X / Twitter: twitter.com, x.com, mobile.twitter.com, i/web/status/
  m = url.match(/(?:(?:mobile\.)?twitter|x)\.com\/(?:i\/web\/status\/|[A-Za-z0-9_]+\/status\/)(\d+)/i);
  if (m) {
    return `<div class="card-embed embed-tweet"><iframe src="https://platform.twitter.com/embed/Tweet.html?id=${m[1]}&dnt=true" loading="lazy" allowfullscreen scrolling="no"></iframe></div>`;
  }

  // Threads: /@user/post/{code}
  m = url.match(/threads\.(?:net|com)\/@([\w.]+)\/post\/([A-Za-z0-9_-]+)/i);
  if (m) {
    return `<div class="card-embed embed-threads"><iframe src="https://www.threads.net/@${m[1]}/post/${m[2]}/embed" loading="lazy" allowfullscreen scrolling="no"></iframe></div>`;
  }

  // Facebook: reels (reel/ e reels/ plural), vídeos, watch, share/r/, share/v/, fb.watch
  m = url.match(/(?:facebook\.com\/(?:share\/[rv]\/|reels?\/|watch|[\w.]+\/videos\/)|fb\.watch\/)/i);
  if (m) {
    return `<div class="card-embed embed-reel embed-fill"><iframe src="https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false" loading="lazy" allowfullscreen scrolling="no" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe></div>`;
  }

  // TikTok: /video/ID (URL padrão)
  m = url.match(/(?:www\.)?tiktok\.com\/@[\w.]+\/video\/(\d+)/i);
  if (m) {
    return `<div class="card-embed embed-reel embed-tiktok"><div class="tt-crop"><iframe src="https://www.tiktok.com/embed/v2/${m[1]}" loading="lazy" allowfullscreen scrolling="no"></iframe></div></div>`;
  }

  // TikTok: URLs curtas (vm./vt.tiktok.com/CODE ou tiktok.com/t/CODE)
  // O Microlink resolve o redirect — usa meta.url se disponível
  if (/v[mt]\.tiktok\.com|tiktok\.com\/t\//i.test(url) && meta?.url) {
    const resolved = meta.url.match(/tiktok\.com\/@[\w.]+\/video\/(\d+)/i);
    if (resolved) {
      return `<div class="card-embed embed-reel embed-tiktok"><div class="tt-crop"><iframe src="https://www.tiktok.com/embed/v2/${resolved[1]}" loading="lazy" allowfullscreen scrolling="no"></iframe></div></div>`;
    }
  }

  // Vimeo: vimeo.com/ID ou player.vimeo.com/video/ID
  m = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/i);
  if (m) {
    return `<div class="card-embed embed-wide"><iframe src="https://player.vimeo.com/video/${m[1]}?byline=0&portrait=0" loading="lazy" allowfullscreen allow="autoplay; fullscreen; picture-in-picture"></iframe></div>`;
  }

  return null;
}

/* ---------- metadados reais (título, descrição, imagem) ---------- */
// Usa a API pública do Microlink (grátis, ~50 req/dia) para ler os
// metadados Open Graph do link — o mesmo mecanismo das prévias do WhatsApp.
// Metadados genéricos que as plataformas servem quando bloqueiam robôs —
// se aparecerem, é lixo, não conteúdo do post.
const GENERIC_META = /enjoy the videos and music you love|^youtube$|log into facebook|log in or sign up to facebook|explore the things you love|connect with friends and the world|^facebook$|^instagram$|^tiktok( pwa)?$|make your day/i;

function scrubMeta(meta) {
  if (!meta) return null;
  if (meta.title && GENERIC_META.test(meta.title)) meta.title = null;
  if (meta.description && GENERIC_META.test(meta.description)) meta.description = null;
  return meta;
}

async function fetchMicrolink(raw) {
  try {
    const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(raw)}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== "success") return null;
    const img = json.data.image || json.data.logo;
    return scrubMeta({
      title: json.data.title || null,
      description: json.data.description || null,
      image: json.data.image?.url || null,
      imageW: img?.width || null,    // dimensões → aspect ratio do conteúdo
      imageH: img?.height || null,
      author: json.data.author || null,
      url: json.data.url || null   // URL final resolvido (links /share/ viram canônicos)
    });
  } catch {
    return null;
  }
}

async function fetchMetadata(raw) {
  const source = detectSource(raw);

  // YouTube: o oEmbed oficial devolve o título real do vídeo (o scraping
  // genérico costuma receber a página de consentimento, com meta genérica)
  if (source === "youtube") {
    // o oEmbed não entende /shorts/ — reconstrói a URL limpa só com o ID
    // (descarta ?feature=share, ?si= e qualquer outro parâmetro)
    const ytId = (raw.match(/(?:(?:m\.)?youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i) || [])[1];
    const norm = ytId ? `https://www.youtube.com/watch?v=${ytId}` : raw;
    try {
      const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(norm)}`);
      const json = await res.json();
      if (json.title) {
        return {
          title: json.title,
          preferTitle: true,
          description: json.author_name ? `Canal ${json.author_name} · YouTube` : null,
          image: json.thumbnail_url || null,
          author: json.author_name || null,
          url: raw
        };
      }
      // oEmbed com erro = dono desativou a incorporação
      const fallback = await fetchMicrolink(raw);
      return { ...(fallback || {}), embedDisabled: true };
    } catch { /* rede falhou: cai no microlink normal */ }
  }

  // Vimeo: oEmbed oficial (título real, thumbnail, autor)
  if (source === "vimeo") {
    const vm = raw.match(/vimeo\.com\/(\d+)/i);
    if (vm) {
      try {
        const res = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${vm[1]}`)}`);
        const json = await res.json();
        if (json.title) {
          return {
            title: json.title,
            preferTitle: true,
            description: json.author_name ? `${json.author_name} · Vimeo` : null,
            image: json.thumbnail_url || null,
            author: json.author_name || null,
            url: raw
          };
        }
      } catch {}
    }
  }

  // TikTok: o oEmbed oficial (CORS liberado) traz a legenda real e o autor —
  // o scraping da página devolve só o título genérico do PWA ("TikTok PWA").
  if (source === "tiktok") {
    try {
      const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(raw)}`);
      const json = await res.json();
      if (json.title && !json.error) {
        // reconstrói a URL canônica (@user/video/ID) a partir dos campos do
        // oEmbed — essencial p/ links curtos (vt./vm.), que senão não dão
        // para o buildEmbed montar o player (vinha só a thumbnail).
        const canonical = (json.author_url && json.embed_product_id)
          ? `${json.author_url}/video/${json.embed_product_id}`
          : (json.embed_product_id
              ? `https://www.tiktok.com/@i/video/${json.embed_product_id}`
              : raw);
        return {
          title: json.title,             // a legenda do vídeo
          description: json.title,        // usada como corpo do card
          image: json.thumbnail_url || null,
          author: json.author_name || null,
          url: canonical
        };
      }
    } catch { /* rede falhou: cai no microlink normal */ }
    // sem oEmbed: ao menos evita gravar o título genérico "TikTok"/"TikTok PWA"
    return scrubMeta(await fetchMicrolink(raw));
  }

  return fetchMicrolink(raw);
}

/* ---------- classificação pelo CONTEÚDO do post ---------- */
// Analisa título + descrição reais (não o URL). Heurística local por
// enquanto — o passo seguinte é trocar por uma chamada de LLM real.
const CATEGORY_SIGNALS = {
  receitas: ["receita", "recipe", "cozinha", "ingrediente", "bolo", "massa", "forno", "airfryer", "fit", "lanche", "jantar", "almoço", "sobremesa", "molho", "tempero", "cooking", "food"],
  moda: ["moda", "look", "looks", "outfit", "achados", "shein", "shopee", "roupa", "estilo", "fashion", "tendência", "vestido", "calça", "loja", "masculina", "feminina", "provador", "haul"],
  design: ["design", "tipografia", "font", "branding", "identidade", "logo", "ui", "ux", "figma", "layout", "paleta", "designer"],
  viagem: ["viagem", "roteiro", "destino", "praia", "trilha", "chapada", "hotel", "pousada", "passagem", "travel", "trip", "mochilão", "turismo"],
  música: ["música", "show", "banda", "álbum", "album", "playlist", "setlist", "song", "music", "festival", "vinil", "spotify", "official video", "official audio", "clipe", "lyrics", "letra", "remaster", "ao vivo", "live session", "acústico", "cover", "feat", "dj "],
  games: ["gameplay", "game", "jogo", "jogos", "gamer", "fps", "moba", "rpg", "steam", "playstation", "xbox", "nintendo", "twitch", "esports", "e-sports", "ranked", "patch notes", "patch", "speedrun", "boss", "loot", "trailer de jogo", "demo trailer", "indie game", "deadlock", "league of legends", "valorant", "counter-strike", "minecraft", "fortnite"]
};

/* ---------- limpeza e título inteligente ---------- */

// Extrai likes/comments do prefixo padrão do Instagram: "10K likes, 450 comments - user on June 1, 2026: "..."
function parseSocialStats(desc) {
  if (!desc) return null;
  // Instagram: "10K likes, 450 comments - ..."
  let m = desc.match(/^([\d.,]+[KM]?)\s+likes?,\s*([\d.,]+[KM]?)\s+comments?/i);
  if (m) return { likes: m[1], comments: m[2] };
  // Facebook: "28K views · 584 reactions | ..."
  m = desc.match(/([\d.,]+[KM]?)\s+views?\s*·\s*([\d.,]+[KM]?)\s+reactions?/i);
  if (m) return { views: m[1], likes: m[2] };
  return null;
}

// Remove o prefixo de stats e a assinatura do Instagram da descrição.
function cleanDescription(desc) {
  if (!desc) return "";
  return desc
    .replace(/^[\d.,]+[KM]?\s+likes?,\s*[\d.,]+[KM]?\s+comments?\s*-\s*[\w._]+\s+on\s+[^:]+:\s*/i, "")
    .replace(/^[\d.,]+[KM]?\s+views?\s*·\s*[\d.,]+[KM]?\s+reactions?\s*\|\s*/i, "")
    .replace(/^[“"']+|[”"']+$/g, "")
    .trim();
}

// Gera um título curto e humano a partir do conteúdo real do post.
function smartTitle(meta) {
  // título oficial (oEmbed): usa direto, sem heurística
  if (meta?.preferTitle && meta.title) {
    let t = meta.title.trim();
    if (t.length > 60) t = t.slice(0, 60).replace(/\s+\S*$/, "") + "…";
    return t;
  }
  const desc = cleanDescription(meta?.description);
  // primeiro trecho útil: corta em hashtag, emoji de CTA, quebra de linha ou ponto
  let candidate = desc.split(/[#\n👉🔗➡️📲]|(?:\.\s)/)[0].trim();
  // remove CTAs comuns
  candidate = candidate.replace(/\b(baixe o app|link na bio|segue lá|arrasta pra cima)\b.*$/i, "").trim();

  if (candidate.length >= 8) {
    // ALL CAPS → Sentence case
    if (candidate === candidate.toUpperCase()) {
      candidate = candidate.charAt(0) + candidate.slice(1).toLowerCase();
    }
    // restaura capitalização de nomes próprios conhecidos
    const BRANDS = ["Shein", "Shopee", "Amazon", "Nike", "Adidas", "Zara", "Renner", "iPhone", "Instagram", "TikTok", "YouTube", "Spotify", "Netflix", "Airbnb"];
    BRANDS.forEach(b => { candidate = candidate.replace(new RegExp(`\\b${b}\\b`, "gi"), b); });
    // limita em ~60 chars na fronteira de palavra
    if (candidate.length > 60) {
      candidate = candidate.slice(0, 60).replace(/\s+\S*$/, "") + "…";
    }
    return candidate;
  }

  // fallback: título OG limpo de stats e assinaturas de plataforma
  let t = (meta?.title || "")
    .replace(/^[\d.,]+[KM]?\s+views?\s*·\s*[\d.,]+[KM]?\s+reactions?\s*\|\s*/i, "")
    .replace(/\s*\(@[\w._]+\)\s*/g, " ")
    .replace(/[•|–-]\s*Instagram[^|]*$/i, "")
    .trim();
  if (t.length > 60) t = t.slice(0, 60).replace(/\s+\S*$/, "") + "…";
  return t || "Link guardado";
}

// learned: { categoria: [palavras] } — sinais aprendidos com as correções
// do usuário. Pesam mais que os sinais de fábrica (1.5 vs 1).
function classifyContent(text, learned = {}) {
  if (!text) return { cat: "ideias", confidence: 0 };
  const t = text.toLowerCase();
  let best = { cat: "ideias", score: 0 };
  for (const [cat, words] of Object.entries(CATEGORY_SIGNALS)) {
    const score = words.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0);
    if (score > best.score) best = { cat, score };
  }
  for (const [cat, words] of Object.entries(learned)) {
    const score = words.reduce((s, w) => s + (t.includes(w) ? 1.5 : 0), 0)
      + (CATEGORY_SIGNALS[cat] ? CATEGORY_SIGNALS[cat].reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0) : 0);
    if (score > best.score) best = { cat, score };
  }
  return { cat: best.cat, confidence: best.score };
}
// Vault — protótipo de interface
// Feed, filtros, entrada de links com embed real + metadados reais + persistência local.

const feed = document.getElementById("feed");
const filters = document.getElementById("filters");
const filterActions = document.getElementById("filterActions");
const form = document.getElementById("intakeForm");
const input = document.getElementById("intakeInput");
const status = document.getElementById("intakeStatus");

let activeCat = "tudo";
let activeSub = null;   // subtag ativa dentro da categoria
let openDropdownChip = null; // chip que tem o sub-dropdown aberto no momento
let searchQuery = "";

/* ---------- persistência ---------- */

const STORAGE_KEY = "vault.items";
const DELETED_KEY = "vault.deleted";

function loadDeleted() {
  try { return JSON.parse(localStorage.getItem(DELETED_KEY)) || []; }
  catch { return []; }
}

const TRASH_KEY = "vault.trash";
const CATS_KEY = "vault.cats";       // categorias criadas pelo usuário
const LEARN_KEY = "vault.learn";     // palavras aprendidas por categoria
const CATOV_KEY = "vault.catov";     // categoria corrigida dos itens de exemplo
const SUBOV_KEY = "vault.subov";     // subtag dos itens de exemplo (seed-N → subtag)
const SEEN_KEY  = "vault.seen";      // IDs marcados como visto (Set serializado)
const ORDER_KEY = "vault.order";     // ordem customizada dos cards no modo compacto

function loadSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY)) || []); }
  catch { return new Set(); }
}
function toggleSeenFor(id) {
  const s = loadSeen();
  const nowSeen = !s.has(id);
  if (nowSeen) s.add(id); else s.delete(id);
  localStorage.setItem(SEEN_KEY, JSON.stringify([...s]));
  return nowSeen;
}
function loadOrder() {
  try { return JSON.parse(localStorage.getItem(ORDER_KEY)) || []; }
  catch { return []; }
}
function saveOrder(ids) { localStorage.setItem(ORDER_KEY, JSON.stringify(ids)); }

const BUILTIN_CATS = ["receitas", "moda", "design", "viagem", "música", "games", "ideias"];

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}

function loadCats() { return loadJSON(CATS_KEY, []); }
function allCats() { return [...BUILTIN_CATS, ...loadCats()]; }
function loadLearn() { return loadJSON(LEARN_KEY, {}); }
function loadCatOverrides() { return loadJSON(CATOV_KEY, {}); }
function loadSubOverrides() { return loadJSON(SUBOV_KEY, {}); }

// subtags presentes numa categoria (derivadas dos itens vivos)
function subcatsOf(cat) {
  return [...new Set(currentItems().filter(i => i.cat === cat && i.subcat).map(i => i.subcat))].sort();
}

// define/limpa a subtag de um item (e persiste)
function setItemSubcat(item, subcat, card) {
  item.subcat = subcat || null;
  if (card) card.dataset.sub = item.subcat || "";
  if (item.id.startsWith("seed-")) {
    const ov = loadSubOverrides();
    if (item.subcat) ov[item.id] = item.subcat; else delete ov[item.id];
    localStorage.setItem(SUBOV_KEY, JSON.stringify(ov));
  } else {
    const saved = loadSaved();
    const it = saved.find(i => i.id === item.id);
    if (it) { it.subcat = item.subcat; localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); }
  }
  renderCats();
  applyFilter();
}

const STOPWORDS = new Set(["para", "como", "mais", "este", "esta", "esse", "essa", "isso", "você", "voce", "minha", "meus", "pela", "pelo", "the", "and", "that", "this", "with", "from", "your", "instagram", "youtube", "tiktok", "facebook", "canal", "vídeo", "video"]);

// aprende com a correção do usuário: extrai palavras-chave do card
// e associa à categoria escolhida
function learnFrom(item, cat) {
  const text = `${item.title || ""} ${item.body || ""} ${item.text || ""} ${item.author || ""}`.toLowerCase();
  const words = [...new Set((text.match(/[a-zà-ú0-9]{4,}/gi) || [])
    .filter(w => !STOPWORDS.has(w)))].slice(0, 10);
  if (!words.length) return;
  const learn = loadLearn();
  learn[cat] = [...new Set([...(learn[cat] || []), ...words])].slice(-60);
  // palavra que aparece em duas categorias é ambígua ("gameplay" não
  // distingue deadlock de lol) — sai de todas para não puxar errado
  for (const w of words) {
    const owners = Object.keys(learn).filter(c => learn[c].includes(w));
    if (owners.length > 1) owners.forEach(c => { learn[c] = learn[c].filter(x => x !== w); });
  }
  localStorage.setItem(LEARN_KEY, JSON.stringify(learn));
}

function setItemCat(item, cat, card) {
  // categoria nova criada pelo usuário entra na lista (aparece no menu)
  if (!allCats().includes(cat)) {
    localStorage.setItem(CATS_KEY, JSON.stringify([...loadCats(), cat]));
  }
  item.cat = cat;
  card.dataset.cat = cat;
  const chipEl = card.querySelector(".card-cat");
  chipEl.className = `card-cat cat-${cat.replace(/\s+/g, "-")}`;
  chipEl.textContent = cat;
  if (item.id.startsWith("seed-")) {
    const ov = loadCatOverrides();
    ov[item.id] = cat;
    localStorage.setItem(CATOV_KEY, JSON.stringify(ov));
  } else {
    const saved = loadSaved();
    const it = saved.find(i => i.id === item.id);
    if (it) { it.cat = cat; localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); }
  }
  learnFrom(item, cat);
  renderCats();   // recalcula chips com a categoria atualizada já persistida
  applyFilter();
}

/* ---------- gerenciar tags/subtags (renomear, remover) ---------- */

// reclassifica um item pelo conteúdo, evitando a categoria removida
function reclassifyText(item, exclude) {
  const text = [item.title, item.body, item.text, item.quote, item.author].filter(Boolean).join(" ");
  let { cat } = classifyContent(text, loadLearn());
  if (!cat || cat === exclude) cat = "ideias";
  return cat;
}

function renameCategory(oldName, newName) {
  newName = (newName || "").trim().toLowerCase();
  if (!newName || newName === oldName) return;
  const saved = loadSaved();
  saved.forEach(i => { if (i.cat === oldName) i.cat = newName; });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  const catOv = loadCatOverrides();
  VAULT_ITEMS.forEach((seed, idx) => {
    const id = `seed-${idx}`;
    if ((catOv[id] || seed.cat) === oldName) catOv[id] = newName;
  });
  localStorage.setItem(CATOV_KEY, JSON.stringify(catOv));
  localStorage.setItem(CATS_KEY, JSON.stringify([...new Set(loadCats().map(c => c === oldName ? newName : c))]));
  if (activeCat === oldName) activeCat = newName;
  closeSubDropdown(); buildFeed();
}

// remove a categoria: cada item dela é reclassificado (sempre fica com uma tag)
function removeCategory(cat) {
  const saved = loadSaved();
  saved.forEach(i => { if (i.cat === cat) { i.cat = reclassifyText(i, cat); i.subcat = null; } });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  const catOv = loadCatOverrides(), subOv = loadSubOverrides();
  VAULT_ITEMS.forEach((seed, idx) => {
    const id = `seed-${idx}`;
    if ((catOv[id] || seed.cat) === cat) { catOv[id] = reclassifyText({ ...seed }, cat); delete subOv[id]; }
  });
  localStorage.setItem(CATOV_KEY, JSON.stringify(catOv));
  localStorage.setItem(SUBOV_KEY, JSON.stringify(subOv));
  localStorage.setItem(CATS_KEY, JSON.stringify(loadCats().filter(c => c !== cat)));
  if (activeCat === cat) { activeCat = "tudo"; activeSub = null; }
  closeSubDropdown(); buildFeed();
}

function renameSubcat(cat, oldSub, newSub) {
  newSub = (newSub || "").trim().toLowerCase();
  if (!newSub || newSub === oldSub) return;
  const saved = loadSaved();
  saved.forEach(i => { if (i.cat === cat && i.subcat === oldSub) i.subcat = newSub; });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  const catOv = loadCatOverrides(), subOv = loadSubOverrides();
  VAULT_ITEMS.forEach((seed, idx) => {
    const id = `seed-${idx}`;
    if ((catOv[id] || seed.cat) === cat && (subOv[id] || seed.subcat) === oldSub) subOv[id] = newSub;
  });
  localStorage.setItem(SUBOV_KEY, JSON.stringify(subOv));
  if (activeSub === oldSub) activeSub = newSub;
  closeSubDropdown(); buildFeed();
}

function removeSubcat(cat, sub) {
  const saved = loadSaved();
  saved.forEach(i => { if (i.cat === cat && i.subcat === sub) i.subcat = null; });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  const catOv = loadCatOverrides(), subOv = loadSubOverrides();
  VAULT_ITEMS.forEach((seed, idx) => {
    const id = `seed-${idx}`;
    if ((catOv[id] || seed.cat) === cat && (subOv[id] || seed.subcat) === sub) delete subOv[id];
  });
  localStorage.setItem(SUBOV_KEY, JSON.stringify(subOv));
  if (activeSub === sub) activeSub = null;
  closeSubDropdown(); buildFeed();
}

function loadTrash() {
  try { return JSON.parse(localStorage.getItem(TRASH_KEY)) || []; }
  catch { return []; }
}

function deleteItem(item) {
  const id = item?.id;
  if (!id) return;
  if (id.startsWith("seed-")) {
    const del = loadDeleted();
    if (!del.includes(id)) del.push(id);
    localStorage.setItem(DELETED_KEY, JSON.stringify(del));
  } else {
    const saved = loadSaved().filter(i => i.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }
  // guarda na lixeira (últimos 50) para poder restaurar
  const trash = loadTrash().filter(t => t.id !== id);
  trash.unshift({ ...item });
  localStorage.setItem(TRASH_KEY, JSON.stringify(trash.slice(0, 50)));
}

function restoreItem(id) {
  const trash = loadTrash();
  const item = trash.find(t => t.id === id);
  if (!item) return;
  if (id.startsWith("seed-")) {
    const del = loadDeleted().filter(d => d !== id);
    localStorage.setItem(DELETED_KEY, JSON.stringify(del));
  } else {
    const saved = loadSaved();
    saved.unshift(item);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }
  localStorage.setItem(TRASH_KEY, JSON.stringify(trash.filter(t => t.id !== id)));
}

// remove de vez: tira da lixeira e, se for seed, mantém na lista de excluídos
// para nunca mais reaparecer.
function purgeItem(id) {
  localStorage.setItem(TRASH_KEY, JSON.stringify(loadTrash().filter(t => t.id !== id)));
}

function loadSaved() {
  try {
    const items = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    // migração: itens salvos por versões antigas não tinham id
    let migrated = false;
    items.forEach((i, idx) => {
      if (!i.id) { i.id = `v-legacy-${idx}`; migrated = true; }
      // embeds do Instagram salvos por versões antigas: regenera com a
      // estrutura atual. SÓ Instagram — outros embeds (Facebook) são
      // construídos a partir do URL resolvido, que não dá para refazer
      // a partir do link original guardado.
      if (i.embed && i.embed.includes("instagram.com") && !i.embed.includes("ig-media") && i.url) {
        i.embed = buildEmbed(`https://${i.url}`) || i.embed;
        migrated = true;
      }
      // TikTok salvo por versões antigas (sem o recorte .tt-crop): reconstrói
      // a partir do embed/v2/ID já resolvido — funciona inclusive p/ links curtos.
      if (i.embed && i.embed.includes("embed-tiktok") &&
          (!i.embed.includes("tt-crop") || !i.embed.includes('scrolling="no"'))) {
        const tt = i.embed.match(/embed\/v2\/(\d+)/);
        if (tt) {
          i.embed = `<div class="card-embed embed-reel embed-tiktok"><div class="tt-crop"><iframe src="https://www.tiktok.com/embed/v2/${tt[1]}" loading="lazy" allowfullscreen scrolling="no"></iframe></div></div>`;
          migrated = true;
        }
      }
      // tweets salvos sem scrolling="no": reconstrói a partir do id do tweet
      if (i.embed && i.embed.includes("embed-tweet") && !i.embed.includes('scrolling="no"')) {
        const tw = i.embed.match(/Tweet\.html\?id=(\d+)/);
        if (tw) {
          i.embed = `<div class="card-embed embed-tweet"><iframe src="https://platform.twitter.com/embed/Tweet.html?id=${tw[1]}&dnt=true" loading="lazy" allowfullscreen scrolling="no"></iframe></div>`;
          migrated = true;
        }
      }
    });
    if (migrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return items;
  } catch { return []; }
}

function persist(item) {
  const saved = loadSaved();
  saved.unshift(item);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

function updateSavedTitle(id, title) {
  const saved = loadSaved();
  const it = saved.find(i => i.id === id);
  if (it) {
    it.title = title;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }
}

// salva título/descrição editados — funciona p/ itens do usuário e de exemplo
function updateSavedField(id, field, value) {
  if (id.startsWith("seed-")) {
    const key = field === "title" ? "vault.titleov" : "vault.bodyov";
    const ov = loadJSON(key, {});
    ov[id] = value;
    localStorage.setItem(key, JSON.stringify(ov));
  } else {
    const saved = loadSaved();
    const it = saved.find(i => i.id === id);
    if (it) { it[field] = value; localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); }
  }
}

/* ---------- render ---------- */

function sourceLabel(s) {
  return { instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", tiktok: "TikTok", twitter: "X / Twitter", threads: "Threads", vimeo: "Vimeo", web: "Web", nota: "Nota", print: "Print" }[s] || s;
}

const SOURCE_ICONS = {
  instagram: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5"/><circle cx="12" cy="12" r="4.4"/><circle cx="17.6" cy="6.4" r="1.3" fill="currentColor" stroke="none"/></svg>`,
  youtube: `<svg viewBox="0 0 24 24"><rect x="1.5" y="4.5" width="21" height="15" rx="4" fill="currentColor"/><path d="M10 9.3v5.4L14.8 12z" fill="var(--card)"/></svg>`,
  tiktok: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M16.6 3c.4 2.2 1.8 3.7 4 4v3.1a7.5 7.5 0 0 1-4-1.3v6.4a6.1 6.1 0 1 1-6.1-6.1c.34 0 .7.03 1 .1v3.2a3 3 0 1 0 2.1 2.8V3z"/></svg>`,
  twitter: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3.3 3h4.7l4.8 6.4L18.2 3h2.6l-6.9 8.3L21.3 21h-4.7l-5.1-6.9L5.8 21H3.2l7.2-8.7z"/></svg>`,
  facebook: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M13.4 21v-7h2.7l.4-3h-3.1V9.2c0-.9.3-1.5 1.6-1.5h1.7V5c-.3 0-1.3-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9V11H8v3h2.6v7z"/></svg>`,
  web: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a13.4 13.4 0 0 1 0 18M12 3a13.4 13.4 0 0 0 0 18"/></svg>`,
  threads: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.2 2C6.9 2 3.6 5.3 3.6 12s3.3 10 8.6 10c4 0 6.6-2.1 7.5-5.2l-2.1-.6c-.6 2-2.3 3.6-5.4 3.6-3.8 0-6-2.4-6-7.8s2.2-7.8 6-7.8c2.9 0 4.6 1.4 5.2 3.3.9 2.9-.6 5.2-3.6 5.2-1.3 0-2.3-.5-2.3-1.6 0-.8.6-1.4 1.8-1.4.8 0 1.4.3 1.7.9.5-1.8-.3-3-2-3-1.9 0-3.2 1.4-3.2 3.4 0 2.2 1.7 3.5 4 3.5z"/></svg>`,
  nota: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16.5 3.5l4 4L8 20H4v-4z"/><path d="M14 6l4 4"/></svg>`,
  print: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2.5" y="6" width="19" height="14" rx="3"/><circle cx="12" cy="13" r="4"/><path d="M8 6l1.5-2.5h5L16 6"/></svg>`,
  vimeo: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.4 7.3c-.1 2.4-1.8 5.7-5 10a23.7 23.7 0 0 1-5.2 5.3c-1.2.8-2.4 1.3-3.6 1.3-1 0-1.9-.7-2.6-2.2L4.7 17c-.7-2.4-1.4-3.7-2.2-3.7-.2 0-.7.3-1.7 1L.5 13.1c1-.9 2-1.8 3-2.8 1.4-1.2 2.4-1.8 3.1-1.9 1.6-.2 2.6.9 3 3.4.4 2.6.7 4.3 1 5 .5 2.3 1.1 3.5 1.8 3.5.5 0 1.3-.8 2.3-2.3 1-1.6 1.5-2.8 1.6-3.6.1-1.4-.4-2.1-1.6-2.1-.6 0-1.1.1-1.7.4 1.1-3.6 3.2-5.4 6.3-5.2 2.3.1 3.4 1.5 3.1 4z"/></svg>`
};

const EYE_SVG        = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_CLOSED_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function cardHTML(item) {
  const cat = `<span class="card-cat cat-${item.cat.replace(/\s+/g, "-")}" title="clique para trocar a categoria">${item.cat}</span>`;
  const sub = item.subcat
    ? `<span class="card-subcat" title="subtag">${item.subcat}</span>`
    : "";
  const seenBtn = item.id
    ? `<button class="card-seen${item.seen ? " is-seen" : ""}" title="${item.seen ? "marcar como não visto" : "marcar como visto"}" aria-label="visto">${item.seen ? EYE_CLOSED_SVG : EYE_SVG}</button>`
    : "";
  const seenLabel = item.id
    ? `<span class="seen-label">Marcado como visto</span>`
    : "";
  const top = `
    <div class="card-top">
      <span class="card-source source-${item.source}"><span class="source-icon">${SOURCE_ICONS[item.source] || SOURCE_ICONS.web}</span>${sourceLabel(item.source)}</span>
      <span class="card-top-right">${seenBtn}${seenLabel}${cat}${sub}<button class="card-del" title="excluir do vautch" aria-label="excluir">×</button></span>
    </div>`;

  let body = "";
  if (item.type === "note") {
    body = `<div class="note-body">${renderNote(item.text || "")}</div>`;
  } else if (item.type === "quote") {
    body = `<p class="card-quote">${item.quote}</p><p class="card-body" style="margin-top:10px">${item.body || ""}</p>`;
  } else if (item.type === "recipe") {
    body = `<h2 class="card-title">${item.title}</h2>
      <ul class="card-list">${item.list.map(i => `<li>${i}</li>`).join("")}</ul>`;
  } else {
    const media = item.isPrivate
      ? `<div class="card-private-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>`
      : item.embed
        ? item.embed
        : item.image
          ? `<div class="card-thumb card-thumb-img"><img src="${item.image}" alt="" loading="lazy"></div>`
          : item.thumb ? `<div class="card-thumb ${item.thumb}"></div>` : "";
    const statParts = item.stats ? [
      item.stats.views    ? `<span title="visualizações">▶ ${item.stats.views}</span>` : "",
      item.stats.likes    ? `<span title="curtidas">♥ ${item.stats.likes}</span>` : "",
      item.stats.comments ? `<span title="comentários">✎ ${item.stats.comments}</span>` : ""
    ].filter(Boolean) : [];
    const stats = statParts.length ? `<div class="card-stats mono">${statParts.join("")}</div>` : "";
    const editable = item.id
      ? ` contenteditable="false" data-editable="true" title="clique para renomear"`
      : "";
    const editableBody = item.id
      ? ` contenteditable="false" data-editable-body="true" title="clique para editar a descrição"`
      : "";
    // miniatura usada só no modo compacto (poster do vídeo / print salvo)
    const cthumb = item.image
      ? `<div class="card-cthumb"><img src="${item.image}" alt="" loading="lazy"></div>`
      : "";
    body = `${media}${cthumb}
      <h2 class="card-title"${editable}>${item.title || "Sem título"}</h2>
      <p class="card-body"${editableBody}>${item.body || ""}</p>
      ${stats}`;
  }

  const action = item.type === "note"
    ? `<button class="note-edit card-link">editar</button>`
    : item.url
      ? `<a class="card-link" href="https://${item.url}" target="_blank" rel="noopener">abrir original ↗</a>`
      : "";
  const reportBtn = item.embed
    ? `<button class="card-report" title="reportar problema de visualização" aria-label="reportar">!</button>`
    : "";
  const footer = `
    <div class="card-footer">
      <span class="card-time">${item.time}</span>
      <div class="card-footer-right">${action}${reportBtn}</div>
    </div>`;

  return top + body + footer;
}

// nota → HTML: escapa, aplica **negrito**, bullets (- ou •) e parágrafos
function renderNote(t) {
  const esc = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bold = esc.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  let html = "", inList = false;
  for (const ln of bold.split("\n")) {
    if (/^\s*[-•]\s+/.test(ln)) {
      if (!inList) { html += `<ul class="note-list">`; inList = true; }
      html += `<li>${ln.replace(/^\s*[-•]\s+/, "")}</li>`;
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      if (ln.trim()) html += `<p>${ln}</p>`;
    }
  }
  if (inList) html += "</ul>";
  return html || "<p></p>";
}

// timestamp do item: o id "v<epoch>" carrega o momento do save; senão 0
// (itens de seed sem epoch contam como "sempre" no filtro de período)
function itemTimestamp(item) {
  const m = String(item.id || "").match(/^v(\d{10,})$/);
  return m ? Number(m[1]) : 0;
}

function makeCard(item, isNew = false) {
  const card = document.createElement("article");
  card.className = "card" + (isNew ? " is-new" : "");
  if (item.embed && item.embed.includes("embed-reel")) {
    card.classList.add("card-reel");
  }
  if (item.type === "note") card.classList.add("card-note");
  if (item.seen) card.classList.add("is-seen");
  card.dataset.cat = item.cat;
  card.dataset.sub = item.subcat || "";
  card.dataset.id = item.id || "";
  // metadados p/ o sistema de filtros (tipo + período)
  card.dataset.type = item.type || "video";
  card.dataset.source = item.source || "";
  card.dataset.ts = itemTimestamp(item);
  // texto pesquisável: só o conteúdo significativo (sem rótulos de UI)
  card.dataset.search = [item.title, item.body, item.text, item.quote, item.cat, sourceLabel(item.source), item.author]
    .filter(Boolean).join(" ");
  card.innerHTML = cardHTML(item);

  // ---- botão VISTO ----
  const seenBtn = card.querySelector(".card-seen");
  if (seenBtn) {
    seenBtn.addEventListener("click", e => {
      e.stopPropagation();
      let nowSeen;
      if (item.id && item.id.startsWith("seed-")) {
        nowSeen = toggleSeenFor(item.id);
      } else if (item.id) {
        item.seen = !item.seen;
        nowSeen = item.seen;
        updateSavedField(item.id, "seen", nowSeen);
      }
      card.classList.toggle("is-seen", nowSeen);
      seenBtn.classList.toggle("is-seen", nowSeen);
      seenBtn.title = nowSeen ? "marcar como não visto" : "marcar como visto";
      seenBtn.innerHTML = nowSeen ? EYE_CLOSED_SVG : EYE_SVG;
      if (!localStorage.getItem("vault.seenTip")) {
        localStorage.setItem("vault.seenTip", "1");
        showHintBalloon(seenBtn, nowSeen ? "<strong>Marcado como visto</strong> — o card fica mais discreto." : "Desmarcado — o card voltou ao normal.");
      }
    });
  }

  // ---- EXPAND card individual no modo compacto — com animação de height ----
  const expandHandler = e => {
    if (viewMode !== "compact") return;
    if (e.target.closest("button, a, input, textarea, [contenteditable]")) return;
    const isExpanded = card.classList.contains("is-expanded");
    const from = card.offsetHeight;
    if (isExpanded) {
      card.classList.remove("is-expanded");
    } else {
      card.classList.add("is-expanded");
    }
    const to = card.offsetHeight;
    card.style.height = from + "px";
    card.classList.add("is-animating");
    card.style.transition = "height 300ms cubic-bezier(.2,.85,.25,1)";
    card.offsetHeight;
    card.style.height = to + "px";
    setTimeout(() => {
      card.style.height = "";
      card.style.transition = "";
      card.classList.remove("is-animating");
      if (!isExpanded) fitReels();
    }, 300);
  };
  if (isTouch) {
    card.addEventListener("click", expandHandler);
  } else {
    card.addEventListener("dblclick", expandHandler);
  }

  // ---- DRAG para reordenar (só modo compacto) ----
  if (viewMode === "compact") card.classList.add("is-draggable");

  // imagem/print: clicar abre em tela cheia (lightbox), respeitando o aspect ratio
  const thumbImg = card.querySelector(".card-thumb-img img");
  if (thumbImg) thumbImg.closest(".card-thumb-img").addEventListener("click", () => openLightbox(thumbImg.src));

  // o embed toca inline e é interativo no 1º toque. Em vez do antigo "lock"
  // (camada que exigia 2 toques), travamos a NAVEGAÇÃO via sandbox: o iframe
  // pode rodar scripts (play, setas) mas não pode abrir aba nem navegar a
  // página — então clicar no post não leva mais pra rede social.
  const embedBox = card.querySelector(".card-embed");
  if (embedBox && embedBox.querySelector("iframe")) {
    const iframe = embedBox.querySelector("iframe");
    // sem allow-popups nem allow-top-navigation → links externos bloqueados
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation");
    iframe.src = iframe.src; // re-aplica o load já sob o sandbox

    // carrossel do Instagram: dica de navegação (link com img_index= comprova)
    if (embedBox.classList.contains("embed-square") && /img_index=/.test(item.url || "")) {
      const hint = document.createElement("div");
      hint.className = "carousel-hint";
      hint.innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="hint-label">carrossel · navegue pelas setas</span>`;
      embedBox.after(hint);
    }
  }

  // nota: botão editar troca o corpo por um editor inline
  const noteEdit = card.querySelector(".note-edit");
  if (noteEdit) {
    noteEdit.addEventListener("click", () => {
      if (card.querySelector(".note-editor")) {
        // salvar
        const ta = card.querySelector(".note-editor");
        item.text = ta.value.trim();
        item.title = (item.text.split("\n")[0] || "Nota").slice(0, 60);
        const saved = loadSaved();
        const it = saved.find(i => i.id === item.id);
        if (it) { it.text = item.text; it.title = item.title; localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); }
        card.replaceWith(makeCard(item));
      } else {
        // editar
        const ta = document.createElement("textarea");
        ta.className = "note-editor";
        ta.value = item.text || "";
        card.querySelector(".note-body").replaceWith(ta);
        ta.style.height = `${ta.scrollHeight}px`;
        ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = `${ta.scrollHeight}px`; });
        ta.focus();
        noteEdit.textContent = "salvar";
      }
    });
  }

  // trocar categoria: clique no chip abre o menu
  card.querySelector(".card-cat").addEventListener("click", e => {
    e.stopPropagation();
    openCatMenu(card, item, e.target);
  });

  // botão de report: baixa JSON de diagnóstico (só em cards com embed)
  const reportBtn = card.querySelector(".card-report");
  if (reportBtn) {
    reportBtn.addEventListener("click", e => { e.stopPropagation(); downloadEmbedReport(item, card); });
  }

  // excluir (vai para a lixeira) — card amassa e cai, feed se fecha,
  // chip da lixeira "engole"
  card.querySelector(".card-del").addEventListener("click", () => {
    deleteItem(item);
    const r = card.getBoundingClientRect();
    card.style.height = `${r.height}px`;
    card.offsetHeight; // força o reflow antes de animar
    card.classList.add("is-leaving");
    puff(r.left + r.width / 2, r.top + Math.min(r.height / 2, 160), 12);
    setTimeout(() => {
      card.classList.add("is-collapsing");
      card.style.height = "0px";
      const chip = filters.querySelector(".chip-trash");
      updateTrashChip();
      chip.classList.add("is-gulping"); // só pisca em laranja
      setTimeout(() => chip.classList.remove("is-gulping"), 600);
    }, 430);
    setTimeout(() => { card.remove(); updateCount(); renderCats(); applyFilter(); }, 740);
  });

  // título editável: clique para renomear, Enter/blur salva, Esc cancela
  const title = card.querySelector('[data-editable="true"]');
  if (title && item.id) {
    title.addEventListener("click", () => { title.contentEditable = "true"; title.focus(); });
    title.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); title.blur(); }
      if (e.key === "Escape") { title.textContent = item.title; title.blur(); }
    });
    title.addEventListener("blur", () => {
      title.contentEditable = "false";
      const t = title.textContent.trim();
      if (t && t !== item.title) { item.title = t; updateSavedField(item.id, "title", t); }
      else title.textContent = item.title || "Sem título";
    });
  }

  // descrição editável: clique para editar; Enter quebra linha; blur salva; Esc cancela
  const desc = card.querySelector('[data-editable-body="true"]');
  if (desc && item.id) {
    desc.addEventListener("click", () => { desc.contentEditable = "true"; desc.classList.add("is-editing"); desc.focus(); });
    desc.addEventListener("keydown", e => {
      if (e.key === "Escape") { desc.textContent = item.body || ""; desc.blur(); }
    });
    desc.addEventListener("blur", () => {
      desc.contentEditable = "false";
      desc.classList.remove("is-editing");
      const t = desc.textContent.trim();
      if (t !== (item.body || "")) { item.body = t; updateSavedField(item.id, "body", t); }
    });
  }
  return card;
}

// abre uma imagem em tela cheia
function openLightbox(src) {
  document.querySelector(".lightbox")?.remove();
  const lb = document.createElement("div");
  lb.className = "lightbox";
  lb.innerHTML = `<button class="lightbox-close" aria-label="fechar">×</button><img src="${src}" alt="">`;
  const close = () => lb.remove();
  lb.addEventListener("click", e => { if (e.target === lb || e.target.tagName === "IMG" || e.target.classList.contains("lightbox-close")) close(); });
  addEventListener("keydown", function esc(ev) { if (ev.key === "Escape") { close(); removeEventListener("keydown", esc); } });
  document.body.appendChild(lb);
}

function ensureTodayMark() {
  let firstMark = feed.querySelector(".daymark");
  if (!firstMark || firstMark.dataset.day !== "hoje") {
    const mark = document.createElement("div");
    mark.className = "daymark";
    mark.dataset.day = "hoje";
    mark.innerHTML = `<span>hoje</span>`;
    feed.prepend(mark);
    firstMark = mark;
  }
  return firstMark;
}

// lista única de itens vivos: guardados pelo usuário (primeiro, em "hoje")
// + exemplos não excluídos, com a categoria possivelmente corrigida
function currentItems() {
  const deleted = loadDeleted();
  const catOv = loadCatOverrides();
  const subOv = loadSubOverrides();
  const titleOv = loadJSON("vault.titleov", {});
  const bodyOv = loadJSON("vault.bodyov", {});
  const seenSet = loadSeen();
  const userItems = loadSaved().map(i => ({ ...i, day: "hoje" }));
  const seeds = VAULT_ITEMS
    .map((i, idx) => ({ ...i, id: `seed-${idx}` }))
    .map(i => catOv[i.id] ? { ...i, cat: catOv[i.id] } : i)
    .map(i => subOv[i.id] ? { ...i, subcat: subOv[i.id] } : i)
    .map(i => titleOv[i.id] !== undefined ? { ...i, title: titleOv[i.id] } : i)
    .map(i => bodyOv[i.id] !== undefined ? { ...i, body: bodyOv[i.id] } : i)
    .filter(i => !deleted.includes(i.id))
    .map(i => ({ ...i, seen: seenSet.has(i.id) }));
  // seed items usam seenSet; saved items têm seen persistido diretamente no objeto
  return [...userItems, ...seeds];
}

function buildFeed() {
  feed.innerHTML = "";
  let lastDay = null;
  let delay = 0;

  const all = currentItems();

  all.forEach(item => {
    if (item.day !== lastDay) {
      const mark = document.createElement("div");
      mark.className = "daymark";
      mark.innerHTML = `<span>${item.day}</span>`;
      mark.dataset.day = item.day;
      feed.appendChild(mark);
      lastDay = item.day;
    }
    const card = makeCard(item);
    card.style.animationDelay = `${0.25 + delay * 0.08}s`;
    feed.appendChild(card);
    delay++;
  });

  updateCount();
  renderCats();
  applyFilter();
  fitReels();
}

function updateCount() {
  const n = currentItems().length;
  const txt = n === 0 ? "nada guardado ainda" : n === 1 ? "1 item guardado" : `${n} itens guardados`;
  document.querySelector(".topbar-meta").textContent = txt;
  updateEmptyState();
}

// quando não há nada guardado (e não estamos na lixeira), centraliza tudo no
// meio da tela; ao adicionar itens, o layout volta a fluir do topo — com uma
// transição suave (FLIP) dos elementos do centro ao topo e vice-versa.
let emptyStateInit = false;

function updateEmptyState() {
  const empty = activeCat !== "__trash" && currentItems().length === 0;
  const was = document.body.classList.contains("is-empty");
  if (!emptyStateInit) {            // 1ª renderização: sem animação
    emptyStateInit = true;
    document.body.classList.toggle("is-empty", empty);
    return;
  }
  if (empty === was) return;        // nada mudou
  flipLayout(() => document.body.classList.toggle("is-empty", empty));
}

// FLIP: mede a posição antes, aplica a mudança de layout, e anima do delta
// até zero — dá o movimento "deslizando" com ease entre centro e topo.
function flipLayout(applyChange) {
  // limpa o transform inline do wordmark antes de medir — o scroll pode ter
  // deixado scale(0.4) no elemento, o que distorce o getBoundingClientRect
  wordmarkEl.style.transform = "";
  const els = [...document.querySelectorAll(".wordmark, .tagline, .intake, .topbar-meta, #filterbar")];
  const firsts = els.map(el => el.getBoundingClientRect().top);
  applyChange();
  els.forEach((el, i) => {
    const dy = firsts[i] - el.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) return;
    el.animate(
      [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
      { duration: 520, easing: "cubic-bezier(.2,.85,.25,1)" }
    );
  });
}

/* ---------- fumacinha ---------- */

// Sopro de partículas que se dissipam — usado quando um card chega ou sai.
function puff(x, y, count = 10) {
  const p = document.createElement("div");
  p.className = "puff";
  p.style.left = `${x}px`;
  p.style.top = `${y}px`;
  for (let i = 0; i < count; i++) {
    const s = document.createElement("span");
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const dist = 28 + Math.random() * 46;
    s.style.setProperty("--dx", `${Math.cos(ang) * dist}px`);
    s.style.setProperty("--dy", `${Math.sin(ang) * dist * 0.7 - 12}px`);
    s.style.setProperty("--s", (0.9 + Math.random() * 1.5).toFixed(2));
    s.style.animationDelay = `${Math.random() * 90}ms`;
    p.appendChild(s);
  }
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 900);
}

/* ---------- tema claro/escuro ---------- */

const THEME_KEY = "vault.theme";
const themeToggle = document.getElementById("themeToggle");

function applyTheme(t) {
  // atributo no <html> (não no body): assim o script inline do <head> aplica
  // o tema antes do paint, sem flash, e o CSS html[data-theme] reage via CSS
  document.documentElement.dataset.theme = t;
}

themeToggle.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

// default é "light" (primeiro acesso entra em claro). O tema salvo já foi
// aplicado por um script inline no <head>/<body> antes do paint (sem flash);
// aqui só sincronizamos o estado em runtime.
applyTheme(localStorage.getItem(THEME_KEY) || "light");

/* ---------- escala dos reels (auto-layout sem distorção) ---------- */

// O palco do reel tem 330px de base; escala via transform até a largura
// real do card — proporção sempre intacta, em qualquer tela.
const IG_STAGE = 350;     // largura fixa do iframe do IG (dentro da faixa que funciona)
const IG_HEADER = 54;     // altura do cabeçalho do embed (cortado por cima)

// posiciona/escala o palco do Instagram conforme o aspect ratio (--ar)
function fitIgStage(media) {
  const stage = media.querySelector(".ig-stage");
  if (!stage) return;
  const w = media.clientWidth;
  if (!w) return;
  const ar = parseFloat(getComputedStyle(media).getPropertyValue("--ar")) || 0.5625;
  const mediaH = IG_STAGE / ar;                 // altura da mídia na escala do palco
  const ifr = stage.querySelector("iframe");
  if (ifr) {
    ifr.style.width = `${IG_STAGE}px`;
    ifr.style.height = `${IG_HEADER + mediaH + 160}px`;  // sobra cobre o rodapé (cortado)
    ifr.style.marginTop = `-${IG_HEADER}px`;
  }
  stage.style.width = `${IG_STAGE}px`;
  const scale = w / IG_STAGE;
  stage.style.transform = `scale(${scale})`;
  // expande o container para mostrar mídia + rodapé completos (não clipar)
  media.style.height = `${(mediaH + 160) * scale}px`;
}

// cada tipo de palco recortado tem sua largura-base própria
const CROP_BASE = { "reel-crop": 330, "tt-crop": 302 };

function scaleCrop(win) {
  const w = win.clientWidth;
  if (w <= 0) return;
  for (const cls in CROP_BASE) {
    const crop = win.querySelector("." + cls);
    if (crop) { crop.style.transform = `scale(${w / CROP_BASE[cls]})`; break; }
  }
}

const reelObserver = new ResizeObserver(entries => {
  entries.forEach(entry => {
    scaleCrop(entry.target);
    if (entry.target.classList.contains("ig-media")) fitIgStage(entry.target);
  });
});

function fitReels() {
  document.querySelectorAll(".embed-reel").forEach(win => {
    if (!win.querySelector(".reel-crop, .tt-crop")) return;
    scaleCrop(win);
    reelObserver.observe(win);
  });
  document.querySelectorAll(".ig-media").forEach(m => { fitIgStage(m); reelObserver.observe(m); });
}

window.addEventListener("resize", fitReels); // redundância: cobre resize de viewport

// o embed do Twitter manda a altura real via postMessage → ajusta o iframe
addEventListener("message", e => {
  if (!/twitter\.com|x\.com/.test(e.origin)) return;
  const h = e.data?.["twttr.embed"]?.params?.[0]?.height || e.data?.["twttr.embed"]?.params?.[0]?.data?.height;
  if (!h) return;
  document.querySelectorAll(".embed-tweet iframe").forEach(ifr => {
    if (ifr.contentWindow === e.source) ifr.style.height = `${h}px`;
  });
});

// vigia leve: garante o encaixe mesmo onde eventos de resize não disparam
setInterval(() => {
  const m = document.querySelector(".ig-media");
  if (m) {
    const stage = m.querySelector(".ig-stage");
    const expected = `scale(${m.clientWidth / IG_STAGE})`;
    if (stage && stage.style.transform !== expected) fitReels();
  }
}, 600);

/* ---------- busca aproximada ---------- */

// normaliza: minúsculas + remove acentos
function norm(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// distância de edição (Levenshtein) com teto — para tolerar erros de digitação
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1; // poda: linha inteira já passou do teto
    prev = cur;
  }
  return prev[b.length];
}

// um token casa com uma palavra se: contém / é contido (plural, prefixo)
// ou está perto o bastante (erro de digitação). Ignora casamentos por
// fragmentos minúsculos ("a", "na") que gerariam falsos positivos.
function tokenMatches(token, word) {
  if (token.length >= 3 && word.includes(token)) return true;   // loja → lojas
  if (word.length >= 4 && token.includes(word)) return true;    // lojas → loja (evita "queijo" ⊃ "que")
  if (token.length < 3) return false;                           // tokens curtos: só exato/contido
  const max = token.length <= 4 ? 1 : 2;
  const stem = w => w.replace(/s$/, "");                         // plural simples PT
  return editDistance(token, word, max) <= max
    || editDistance(stem(token), stem(word), max) <= max;       // maslucina ~ masculina(s)
}

// o item casa a busca se TODO token do query bate com ALGUMA palavra dele
function matchesSearch(haystack, query) {
  const words = norm(haystack).split(/\s+/).filter(Boolean);
  const tokens = norm(query).split(/\s+/).filter(Boolean);
  return tokens.every(tok => words.some(w => tokenMatches(tok, w)));
}

/* ---------- filtros ---------- */

function applyFilter() {
  const q = searchQuery.trim();
  const cards = feed.querySelectorAll(".card");
  cards.forEach(c => {
    const byCat = activeCat !== "tudo" && c.dataset.cat !== activeCat;
    const bySub = activeSub && (c.dataset.sub || "") !== activeSub;
    const byText = q && !matchesSearch(c.dataset.search || c.textContent, q);
    const byType = !passesType(c);
    const byPeriod = !passesPeriod(c);
    c.classList.toggle("is-hidden", byCat || bySub || byText || byType || byPeriod);
  });
  feed.querySelectorAll(".daymark").forEach(mark => {
    let el = mark.nextElementSibling;
    let visible = false;
    while (el && !el.classList.contains("daymark")) {
      if (el.classList.contains("card") && !el.classList.contains("is-hidden")) { visible = true; break; }
      el = el.nextElementSibling;
    }
    mark.style.display = visible ? "" : "none";
  });
}

let catsExpanded = false;        // "mais" revela todas as categorias
const CAT_CAP = 4;               // quantas categorias mostrar antes do "mais"

// ---- modo de visualização + filtros (tipo / período) ----
const VIEW_KEY = "vault.view";
let viewMode = localStorage.getItem(VIEW_KEY) || "full"; // "full" | "compact"
let filterType = "all";          // all | video | note | image
let filterPeriod = "all";        // all | today | week | month

function applyViewMode() {
  document.body.classList.toggle("view-compact", viewMode === "compact");
}
function toggleViewMode() {
  viewMode = viewMode === "compact" ? "full" : "compact";
  localStorage.setItem(VIEW_KEY, viewMode);
  applyViewMode();
  feed.querySelectorAll(".card").forEach(c => {
    if (viewMode === "compact") {
      c.classList.add("is-draggable");
    } else {
      c.classList.remove("is-draggable", "is-expanded");
      c.style.height = "";
      c.style.transition = "";
    }
  });
  // toast educativo ao entrar no modo compacto pela primeira vez
  if (viewMode === "compact" && !localStorage.getItem("vault.compactTip")) {
    localStorage.setItem("vault.compactTip", "1");
    const msg = isTouch
      ? "<strong>Modo compacto.</strong> Toque num card para expandir. Segure o dedo para arrastar e reposicionar."
      : "<strong>Modo compacto.</strong> Clique duas vezes num card para expandir. Arraste para reposicionar.";
    showHintBalloon(document.querySelector(".chip-view"), msg);
  }
  renderCats();
  if (viewMode === "full") fitReels();
}

/* ---------- toast global ---------- */
function showToast(msg, duration = 3000, anchor = null) {
  document.querySelector(".vault-toast")?.remove();
  const t = document.createElement("div");
  t.className = "vault-toast";
  t.textContent = msg;
  document.body.appendChild(t);
  if (anchor) {
    const r = anchor.getBoundingClientRect();
    t.style.top    = (r.bottom + 10) + "px";
    t.style.left   = (r.left + r.width / 2) + "px";
    t.style.bottom = "";
    Object.assign(t.style, { transform: "translateX(-50%) translateY(-8px)", opacity: "0", transition: "opacity .22s, transform .22s cubic-bezier(.2,.85,.25,1)" });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      t.style.transform = "translateX(-50%) translateY(0)";
      t.style.opacity = "1";
    }));
  } else {
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add("is-in")));
  }
  setTimeout(() => {
    t.style.opacity = "0";
    t.classList.remove("is-in");
    setTimeout(() => t.remove(), 320);
  }, duration);
}

/* ---------- drag para reordenar (só modo compacto) ---------- */
function initDrag() {
  const EASE = "cubic-bezier(.2,.85,.25,1)";
  let dragging = null, placeholder = null;
  let offX = 0, offY = 0;
  let lastOver = null;

  function snapAll() {
    const m = new Map();
    feed.querySelectorAll(".card.is-draggable").forEach(c => {
      if (c !== dragging) m.set(c, c.getBoundingClientRect().top);
    });
    return m;
  }

  function flipOthers(before) {
    feed.querySelectorAll(".card.is-draggable").forEach(c => {
      if (c === dragging) return;
      const prev = before.get(c);
      if (prev === undefined) return;
      const dy = prev - c.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) return;
      c.style.transition = "none";
      c.style.transform = `translateY(${dy}px)`;
      c.offsetHeight;
      c.style.transition = `transform 220ms ${EASE}`;
      c.style.transform = "";
    });
  }

  function movePlaceholder(clientY) {
    const cards = [...feed.querySelectorAll(".card.is-draggable")].filter(c => c !== dragging);
    let target = null;
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      if (clientY < r.top + r.height / 2) { target = c; break; }
    }
    if (target === lastOver) return;
    lastOver = target;
    const before = snapAll();
    if (target) feed.insertBefore(placeholder, target);
    else feed.appendChild(placeholder);
    flipOthers(before);
  }

  function startDrag(card, clientX, clientY) {
    if (viewMode !== "compact") return;
    dragging = card;
    lastOver = null;
    const r = card.getBoundingClientRect();
    offX = clientX - r.left;
    offY = clientY - r.top;

    // placeholder INVISÍVEL — mantém espaço no fluxo
    placeholder = document.createElement("div");
    placeholder.style.cssText = `height:${r.height}px;pointer-events:none;`;
    feed.insertBefore(placeholder, card);

    // card real fica fixed e segue o mouse
    Object.assign(card.style, {
      position: "fixed",
      left: r.left + "px",
      top: r.top + "px",
      width: r.width + "px",
      zIndex: "800",
      boxShadow: "0 18px 44px rgba(0,0,0,.4)",
      transform: "scale(1.02)",
      transformOrigin: "center",
      transition: "box-shadow .15s, transform .15s",
      margin: "0",
    });
    card.classList.add("is-dragging");
  }

  function moveCard(clientX, clientY) {
    if (!dragging) return;
    dragging.style.left = (clientX - offX) + "px";
    dragging.style.top  = (clientY - offY) + "px";
    movePlaceholder(clientY);
  }

  function endDrag() {
    if (!dragging || !placeholder) return;
    const targetR = placeholder.getBoundingClientRect();
    dragging.style.transition = `left 260ms ${EASE}, top 260ms ${EASE}, transform 260ms ${EASE}, box-shadow 200ms`;
    dragging.style.left      = targetR.left + "px";
    dragging.style.top       = targetR.top  + "px";
    dragging.style.transform = "scale(1)";
    dragging.style.boxShadow = "";
    const before = snapAll();
    feed.insertBefore(dragging, placeholder);
    placeholder.remove(); placeholder = null;
    flipOthers(before);
    setTimeout(() => {
      if (!dragging) return;
      dragging.classList.remove("is-dragging");
      Object.assign(dragging.style, {
        position: "", left: "", top: "", width: "",
        zIndex: "", boxShadow: "", transform: "",
        transformOrigin: "", transition: "", margin: ""
      });
      feed.querySelectorAll(".card.is-draggable").forEach(c => {
        c.style.transition = ""; c.style.transform = "";
      });
      const order = [...feed.querySelectorAll(".card")].map(c => c.dataset.id).filter(Boolean);
      saveOrder(order);
      dragging = null; lastOver = null;
    }, 260);
  }

  function cancelDrag() {
    if (!dragging) return;
    dragging.classList.remove("is-dragging");
    Object.assign(dragging.style, {
      position: "", left: "", top: "", width: "",
      zIndex: "", boxShadow: "", transform: "",
      transformOrigin: "", transition: "", margin: ""
    });
    placeholder?.remove(); placeholder = null;
    feed.querySelectorAll(".card.is-draggable").forEach(c => { c.style.transition = ""; c.style.transform = ""; });
    dragging = null; lastOver = null;
  }

  // ---- Desktop (mouse) ----
  feed.addEventListener("mousedown", e => {
    const card = e.target.closest(".card.is-draggable");
    if (!card || e.button !== 0) return;
    if (e.target.closest("button, a, input, textarea, [contenteditable]")) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    let dragStarted = false;
    const onMove = ev => {
      if (dragStarted) { moveCard(ev.clientX, ev.clientY); return; }
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (Math.sqrt(dx * dx + dy * dy) > 8) {
        startDrag(card, ev.clientX, ev.clientY);
        dragStarted = true;
      }
    };
    const onUp = () => { if (dragStarted) endDrag(); cleanup(); };
    const cleanup = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });

  // ---- Touch (mobile) ----
  let touchTimer = null;
  feed.addEventListener("touchstart", e => {
    if (viewMode !== "compact") return;
    const card = e.target.closest(".card.is-draggable");
    if (!card || e.target.closest("button, a, input, textarea, [contenteditable]")) return;
    const t = e.touches[0];
    touchTimer = setTimeout(() => startDrag(card, t.clientX, t.clientY), 250);
  }, { passive: true });

  feed.addEventListener("touchmove", e => {
    clearTimeout(touchTimer);
    if (!dragging) return;
    e.preventDefault();
    const t = e.touches[0];
    moveCard(t.clientX, t.clientY);
  }, { passive: false });

  feed.addEventListener("touchend", () => { clearTimeout(touchTimer); endDrag(); });
  feed.addEventListener("touchcancel", () => { clearTimeout(touchTimer); cancelDrag(); });
} // fim initDrag

function filtersActive() {
  return filterType !== "all" || filterPeriod !== "all";
}
const PERIOD_MS = { today: 864e5, week: 6048e5, month: 2592e6 };
function passesType(card) {
  if (filterType === "all") return true;
  if (filterType === "image") return !!card.querySelector(".card-thumb-img");
  return card.dataset.type === filterType;
}
function passesPeriod(card) {
  if (filterPeriod === "all") return true;
  const ts = Number(card.dataset.ts || 0);
  if (!ts) return true; // itens sem timestamp (seed) não somem no filtro
  return (Date.now() - ts) <= PERIOD_MS[filterPeriod];
}

function selectCat(cat, chipEl) {
  const leavingTrash = activeCat === "__trash";
  const wasActive = activeCat === cat;
  const ddWasOpen = openDropdownChip === chipEl; // toggle: mesmo chip com dd aberto → só fecha
  activeCat = cat;
  activeSub = null;              // troca de categoria zera a subtag
  closeSubDropdown();            // zera openDropdownChip
  if (cat === "__trash") {
    if (wasActive) { activeCat = "tudo"; buildFeed(); return; } // toggle: fecha a lixeira
    markActiveChip(); renderTrash(); return;
  }
  if (leavingTrash) buildFeed(); // reconstrói o feed normal ao sair da lixeira
  markActiveChip();
  // dropdown abre se a categoria tem subtags OU se reclicada (p/ gerenciar)
  // se já estava aberto (toggle), fechar é suficiente — não reabre
  if (!ddWasOpen && chipEl && cat !== "tudo" && (subcatsOf(cat).length || wasActive)) {
    openTagDropdown(cat, chipEl);
  }
  applyFilter();
}

function markActiveChip() {
  document.querySelectorAll("#filters .chip, #filterActions .chip").forEach(c =>
    c.classList.toggle("is-active", c.dataset.cat === activeCat));
}

function onFilterClick(e) {
  const view = e.target.closest(".chip-view");
  if (view) { toggleViewMode(); return; }
  const filt = e.target.closest(".chip-filter");
  if (filt) { openFilterDropdown(filt); return; }
  const more = e.target.closest(".chip-more");
  if (more) { catsExpanded = !catsExpanded; renderCats(); return; }
  const chip = e.target.closest(".chip");
  if (chip) selectCat(chip.dataset.cat, chip);
}
filters.addEventListener("click", onFilterClick);
filterActions.addEventListener("click", onFilterClick);

/* ---------- dropdown de subtags (ancorado no chip) ---------- */

function closeSubDropdown() {
  openDropdownChip = null;
  const dd = document.querySelector(".sub-dropdown");
  if (!dd) return;
  if (dd._place) {
    filters.removeEventListener("scroll", dd._place);
    removeEventListener("scroll", dd._place);
    removeEventListener("resize", dd._place);
  }
  dd.remove();
}

// dropdown da tag: cabeçalho com ✎ + subtags (cada uma com ✎ para editar/excluir).
function openTagDropdown(cat, chipEl) {
  closeSubDropdown();
  const dd = document.createElement("div");
  dd.className = "sub-dropdown";

  const TRASH_ICO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M10 4h4M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>`;

  const render = () => {
    const subs = subcatsOf(cat);
    const subsHTML = subs.length ? `<div class="dd-div"></div><div class="dd-subs">
        ${subs.map(s => `<div class="dd-sub-row" data-sub="${s}">
            <button class="sub-opt${activeSub === s ? " is-active" : ""}" data-sub="${s}">${s}</button>
            <button class="dd-mini" data-act="edit-sub" title="editar">✎</button>
            <button class="dd-mini dd-danger" data-act="del-sub" title="excluir subtag">${TRASH_ICO}</button>
          </div>`).join("")}
      </div>` : "";
    dd.innerHTML = `<div class="dd-head-row">
        <button class="dd-head-name${!activeSub ? " is-active" : ""}" data-act="all">${cat}</button>
        <button class="dd-mini" data-act="edit-cat" title="editar">✎</button>
        <button class="dd-mini dd-danger" data-act="del-cat" title="excluir tag">${TRASH_ICO}</button>
      </div>${subsHTML}`;
  };
  render();

  // edit inline: só ✓ salvar e ✕ cancelar (excluir ficou na linha inicial)
  const showEdit = (rowEl, val, onSave) => {
    const el = document.createElement("div");
    el.className = "dd-edit-row";
    el.innerHTML = `<input class="dd-edit-inp" value="${val}" maxlength="24" spellcheck="false">
      <button class="dd-mini" data-act="save-edit" title="salvar">✓</button>
      <button class="dd-mini" data-act="cancel-edit" title="cancelar">✕</button>`;
    const inp = el.querySelector("input");
    const doSave = () => { const v = inp.value.trim().toLowerCase(); if (v && v !== val) onSave(v); else render(); };
    el._doSave = doSave;
    inp.addEventListener("keydown", ev => { if (ev.key === "Enter") doSave(); if (ev.key === "Escape") render(); });
    rowEl.replaceWith(el);
    inp.focus(); inp.select();
  };

  dd.addEventListener("click", e => {
    e.stopPropagation(); // impede que cliques dentro do dd alcancem o close listener do document
    if (e.target.closest("[data-act='save-edit']")) {
      e.target.closest(".dd-edit-row")._doSave?.(); return;
    }
    if (e.target.closest("[data-act='cancel-edit']")) { render(); return; }

    const opt = e.target.closest(".sub-opt");
    if (opt) {
      activeSub = opt.dataset.sub || null;
      applyFilter();
      closeSubDropdown(); // fecha após selecionar subtag
      return;
    }
    if (e.target.closest("[data-act='all']")) {
      activeSub = null; applyFilter();
      closeSubDropdown(); // fecha após selecionar a tag principal
      return;
    }
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "del-cat") {
      if (confirm(`Remover tag "${cat}"? Os itens não serão apagados.`)) removeCategory(cat);
    } else if (act === "del-sub") {
      const sub = e.target.closest(".dd-sub-row").dataset.sub;
      if (confirm(`Remover subtag "${sub}"?`)) { removeSubcat(cat, sub); render(); }
    } else if (act === "edit-cat") {
      showEdit(
        dd.querySelector(".dd-head-row"), cat,
        novo => { renameCategory(cat, novo); cat = novo; render(); }
      );
    } else if (act === "edit-sub") {
      const sub = e.target.closest(".dd-sub-row").dataset.sub;
      showEdit(
        e.target.closest(".dd-sub-row"), sub,
        novo => { renameSubcat(cat, sub, novo); render(); }
      );
    }
  });

  openDropdownChip = chipEl;
  document.body.appendChild(dd);
  const place = () => {
    const r = chipEl.getBoundingClientRect();
    dd.style.top  = `${r.bottom + 7}px`;
    dd.style.left = `${r.left + r.width / 2}px`;
  };
  place();
  dd._place = place;
  filters.addEventListener("scroll", place, { passive: true });
  addEventListener("scroll", place, { passive: true });
  addEventListener("resize", place);
  if (isTouch) setTimeout(() => chipEl.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  requestAnimationFrame(() => dd.classList.add("is-in"));
  setTimeout(() => {
    document.addEventListener("click", function close(ev) {
      if (!document.contains(ev.target)) return;
      if (!dd.contains(ev.target) && !chipEl.contains(ev.target)) {
        closeSubDropdown(); document.removeEventListener("click", close);
      }
    });
  }, 0);
}

// dropdown de filtros: tipo (vídeo/nota/imagem) + período (hoje/7d/30d).
// Reaproveita o visual do .sub-dropdown; ancorado no chip "filtrar".
function openFilterDropdown(chipEl) {
  closeSubDropdown();
  const dd = document.createElement("div");
  dd.className = "sub-dropdown filter-dropdown";

  const TYPES = [["all", "tudo"], ["video", "vídeos"], ["note", "notas"], ["image", "imagens"]];
  const PERIODS = [["all", "sempre"], ["today", "hoje"], ["week", "7 dias"], ["month", "30 dias"]];

  const render = () => {
    dd.innerHTML = `
      <div class="dd-group-label mono">tipo</div>
      <div class="dd-filter">${TYPES.map(([v, l]) => `<button class="sub-opt${filterType === v ? " is-active" : ""}" data-ftype="${v}">${l}</button>`).join("")}</div>
      <div class="dd-div"></div>
      <div class="dd-group-label mono">período</div>
      <div class="dd-filter">${PERIODS.map(([v, l]) => `<button class="sub-opt${filterPeriod === v ? " is-active" : ""}" data-fperiod="${v}">${l}</button>`).join("")}
      </div>${filtersActive() ? `<div class="dd-div"></div><div class="dd-manage"><button class="dd-act dd-danger" data-fclear="1">limpar filtros</button></div>` : ""}`;
  };
  render();

  dd.addEventListener("click", e => {
    const t = e.target.closest("[data-ftype]");
    const p = e.target.closest("[data-fperiod]");
    const clr = e.target.closest("[data-fclear]");
    if (t) filterType = t.dataset.ftype;
    else if (p) filterPeriod = p.dataset.fperiod;
    else if (clr) { filterType = "all"; filterPeriod = "all"; }
    else return;
    render();
    applyFilter();
    chipEl.classList.toggle("is-active", filtersActive());
  });

  document.body.appendChild(dd);
  const place = () => {
    const r = chipEl.getBoundingClientRect();
    dd.style.top = `${r.bottom + 7}px`;
    dd.style.left = `${r.left + r.width / 2}px`;
  };
  place();
  dd._place = place;
  addEventListener("scroll", place, { passive: true });
  addEventListener("resize", place);
  requestAnimationFrame(() => dd.classList.add("is-in"));
  setTimeout(() => {
    document.addEventListener("click", function close(ev) {
      if (!document.contains(ev.target)) return;
      if (!dd.contains(ev.target) && !chipEl.contains(ev.target)) {
        closeSubDropdown(); document.removeEventListener("click", close);
      }
    });
  }, 0);
}

// troca o dropdown por um campo de renomear
function inlineRename(dd, current, onSave) {
  dd.innerHTML = `<div class="dd-rename">
      <input type="text" value="${current}" maxlength="24" spellcheck="false">
      <button class="sub-create">ok</button>
    </div>`;
  const inp = dd.querySelector("input");
  const go = () => { const v = inp.value.trim(); if (v) onSave(v); };
  dd.querySelector(".sub-create").addEventListener("click", go);
  inp.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
  inp.focus(); inp.select();
}

/* ---------- menu de categorias ---------- */

function openCatMenu(card, item, anchor) {
  // toggle: se o menu deste card já está aberto, só fecha
  const existing = card.querySelector(".cat-menu");
  if (existing) { existing.remove(); card.classList.remove("has-open-menu"); return; }
  document.querySelector(".cat-menu")?.remove();
  const menu = document.createElement("div");
  menu.className = "cat-menu";

  // constrói HTML da seção de subtag (reconstruída ao trocar de categoria)
  function buildSubSection(cat, currentSub) {
    if (!cat) return "";
    const subs = subcatsOf(cat);
    return `<div class="sub-section-inner">
      <div class="cat-sub-head mono">subtag em ${cat}</div>
      ${subs.map(s => `<button class="sub-option${s === currentSub ? " is-current" : ""}" data-sub="${s}">${s}</button>`).join("")}
      ${currentSub ? `<button class="sub-option sub-none" data-sub="">— sem subtag</button>` : ""}
      <div class="cat-new">
        <input type="text" class="sub-input" placeholder="nova subtag…" maxlength="24">
        <button class="sub-create">criar</button>
      </div>
    </div>`;
  }

  const cats = [...new Set([...presentCats(), item.cat].filter(Boolean))];
  menu.innerHTML = `
    <div class="cat-sub-head mono">tag</div>
    ${cats.map(c => `<button class="cat-option${c === item.cat ? " is-current" : ""}" data-cat="${c}">${c}</button>`).join("")}
    <div class="cat-new">
      <input type="text" placeholder="nova tag…" maxlength="24">
      <button class="cat-create">criar</button>
    </div>
    <div class="sub-section">${buildSubSection(item.cat, item.subcat)}</div>`;

  card.classList.add("has-open-menu");

  menu.addEventListener("click", e => {
    const opt = e.target.closest(".cat-option");
    if (opt) {
      const newCat = opt.dataset.cat;
      // Fix 4: trocar tag zera subtag
      setItemSubcat(item, null, card);
      setItemCat(item, newCat, card);
      // atualiza estado visual das opções de categoria
      menu.querySelectorAll(".cat-option").forEach(b =>
        b.classList.toggle("is-current", b.dataset.cat === newCat));
      // Fix 3: mantém menu aberto e reconstrói seção de subtag para a nova tag
      menu.querySelector(".sub-section").innerHTML = buildSubSection(newCat, null);
      rewireSubInput();
      return; // NÃO fecha o menu
    }
    const sub = e.target.closest(".sub-option");
    if (sub) { setItemSubcat(item, sub.dataset.sub, card); closeMenu(); }
  });

  // reconecta eventos do sub-input após rebuild da sub-section
  function rewireSubInput() {
    const si = menu.querySelector(".sub-input");
    if (!si) return;
    const createSub = () => {
      const name = si.value.trim().toLowerCase();
      if (!name) return;
      setItemSubcat(item, name, card);
      closeMenu();
    };
    menu.querySelector(".sub-create").addEventListener("click", createSub);
    si.addEventListener("keydown", e => { if (e.key === "Enter") createSub(); });
  }
  rewireSubInput();

  const input = menu.querySelector('input:not(.sub-input)');
  const create = () => {
    const name = input.value.trim().toLowerCase();
    if (!name) return;
    setItemSubcat(item, null, card); // nova cat via campo → zera subtag
    setItemCat(item, name, card);
    // atualiza e reconstrói
    menu.querySelectorAll(".cat-option").forEach(b =>
      b.classList.toggle("is-current", b.dataset.cat === name));
    menu.querySelector(".sub-section").innerHTML = buildSubSection(name, null);
    rewireSubInput();
    input.value = "";
  };
  menu.querySelector(".cat-create").addEventListener("click", create);
  input.addEventListener("keydown", e => { if (e.key === "Enter") create(); });
  input.addEventListener("blur", () => {
    const name = input.value.trim().toLowerCase();
    if (!name || name === item.cat) return;
    setItemSubcat(item, null, card);
    setItemCat(item, name, card);
    menu.querySelector(".sub-section").innerHTML = buildSubSection(name, null);
    rewireSubInput();
  });

  // porta o menu para o body — evita overflow:hidden e transforms do card
  document.body.appendChild(menu);
  const placeMenu = () => {
    const chip = card.querySelector(".card-cat");
    const r = chip ? chip.getBoundingClientRect() : card.getBoundingClientRect();
    const mh = menu.offsetHeight;
    // horizontal: cabe sempre dentro da viewport
    menu.style.left = Math.max(8, Math.min(r.left, innerWidth - menu.offsetWidth - 8)) + "px";
    // vertical: abaixo do chip; se estourar embaixo, sobe pra cima do chip
    let top = r.bottom + 6;
    if (top + mh > innerHeight - 8 && r.top - 6 - mh > 8) top = r.top - 6 - mh;
    menu.style.top  = Math.max(8, top) + "px";
    menu.style.zIndex = "9999";
  };
  placeMenu();
  window.addEventListener("scroll", placeMenu, { passive: true });
  window.addEventListener("resize", placeMenu);

  const closeMenu = () => {
    menu.remove();
    card.classList.remove("has-open-menu");
    window.removeEventListener("scroll", placeMenu);
    window.removeEventListener("resize", placeMenu);
  };

  input.focus({ preventScroll: true });
  // No celular o teclado sobe e cobre o menu. Como o menu é position:fixed,
  // scrollIntoView nele é no-op — então rolamos a JANELA pra trazer o chip pra
  // cima (placeMenu segue o chip no scroll) e o menu fica acima do teclado.
  if (isTouch) {
    setTimeout(() => {
      placeMenu();
      const mr = menu.getBoundingClientRect();
      const targetBottom = innerHeight * 0.5;   // metade de cima = acima do teclado
      let delta = mr.bottom - targetBottom;      // >0 rola pra baixo (conteúdo sobe)
      const minTop = 64;                         // não deixar o topo do menu sumir
      if (mr.top - delta < minTop) delta = mr.top - minTop;
      if (delta > 0) window.scrollBy({ top: delta, behavior: "smooth" });
    }, 80);
  }

  // fecha ao clicar fora
  setTimeout(() => {
    document.addEventListener("click", function close(e) {
      if (!menu.contains(e.target)) { closeMenu(); document.removeEventListener("click", close); }
    });
  }, 0);
}

// categorias presentes, ranqueadas por quantidade de itens (mais usadas primeiro)
function presentCats() {
  const counts = {};
  currentItems().forEach(i => { if (i.cat) counts[i.cat] = (counts[i.cat] || 0) + 1; });
  return Object.keys(counts).sort((a, b) =>
    counts[b] - counts[a] || a.localeCompare(b));
}

function chipEl(cat, label) {
  const b = document.createElement("button");
  b.className = "chip";
  b.dataset.cat = cat;
  const hasSubs = cat !== "tudo" && cat !== "__trash" && subcatsOf(cat).length > 0;
  b.innerHTML = `${label}${hasSubs ? '<span class="chip-sub-mark" aria-hidden="true">+</span>' : ""}`;
  if (cat === activeCat) b.classList.add("is-active");
  return b;
}

// tags (rolam no mobile) ficam em #filters; "+mais" e lixeira ficam em
// #filterActions (fixos no mobile, quebram em linhas no desktop)
// botão da lixeira (ícone + rótulo); reutilizado no modo normal e no vazio
function buildTrashChip() {
  const trash = document.createElement("button");
  trash.className = "chip chip-trash";
  trash.dataset.cat = "__trash";
  trash.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M10 4h4M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg><span class="trash-label">lixeira</span>`;
  if (activeCat === "__trash") trash.classList.add("is-active");
  return trash;
}

function renderCats() {
  const present = presentCats();
  const filterbar = document.getElementById("filterbar");
  filters.innerHTML = "";
  filterActions.innerHTML = "";

  // nada guardado: sem TUDO / filtros / view. Só a lixeira (centralizada) se
  // houver itens nela — e ela vira um toggle para voltar à tela inicial.
  if (currentItems().length === 0) {
    const hasTrash = loadTrash().length > 0;
    if (hasTrash) filterActions.appendChild(buildTrashChip());
    filterbar.classList.toggle("is-hidden", !hasTrash);
    updateTrashChip();
    return;
  }
  filterbar.classList.remove("is-hidden");

  filters.appendChild(chipEl("tudo", "tudo"));

  // renderiza TODAS as tags; o layout (scroll em 1 linha vs. quebra de linha)
  // é decidido por CSS conforme a classe is-expanded e o viewport
  present.forEach(c => filters.appendChild(chipEl(c, c)));
  filters.classList.toggle("is-expanded", catsExpanded);

  // alternar visualização: timeline (cheia) ↔ compacta
  const view = document.createElement("button");
  view.className = "chip chip-view" + (viewMode === "compact" ? " is-active" : "");
  view.title = viewMode === "compact" ? "visualização: compacta" : "visualização: timeline";
  view.innerHTML = viewMode === "compact"
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="7" rx="1.5"/><rect x="4" y="14" width="16" height="6" rx="1.5"/></svg>`;
  filterActions.appendChild(view);

  // filtros (tipo / período)
  const filt = document.createElement("button");
  filt.className = "chip chip-filter" + (filtersActive() ? " is-active" : "");
  filt.title = "filtrar";
  filt.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 8v6l-4-2v-4z"/></svg>`;
  filterActions.appendChild(filt);

  // "+N" / "menos" — abre/fecha a visão expandida (quebra de linha)
  if (present.length > CAT_CAP) {
    const more = document.createElement("button");
    more.className = "chip chip-more";
    more.textContent = catsExpanded ? "− menos" : `+${present.length - CAT_CAP}`;
    filterActions.appendChild(more);
  }

  // lixeira sempre por último (ícone + rótulo; o rótulo some no mobile via CSS)
  filterActions.appendChild(buildTrashChip());
  updateTrashChip();

  // se a categoria ativa sumiu (sem itens), volta para "tudo"
  if (activeCat !== "tudo" && activeCat !== "__trash" && !present.includes(activeCat)) {
    activeCat = "tudo";
    activeSub = null;
    closeSubDropdown();
    markActiveChip();
  }
}

/* ---------- lixeira ---------- */

function updateTrashChip() {
  const label = document.querySelector(".chip-trash .trash-label");
  if (!label) return;   // sem chip de lixeira no DOM (ex: tela vazia)
  const n = loadTrash().length;
  label.textContent = n ? `lixeira (${n})` : "lixeira";
}

function renderTrash() {
  updateEmptyState();   // na lixeira nunca centraliza como "vazio"
  const trash = loadTrash();
  feed.innerHTML = "";
  if (!trash.length) {
    feed.innerHTML = `<p class="trash-empty mono">lixeira vazia — nada foi excluído ainda.</p>`;
    return;
  }

  const selected = new Set();

  // barra de seleção em massa
  const bar = document.createElement("div");
  bar.className = "trash-bar";
  bar.innerHTML = `
    <label class="trash-selall mono"><input type="checkbox" class="t-all"> selecionar tudo</label>
    <button class="trash-del-sel" disabled>excluir selecionados</button>`;
  feed.appendChild(bar);
  const allCb = bar.querySelector(".t-all");
  const delSel = bar.querySelector(".trash-del-sel");

  const refreshBar = () => {
    delSel.disabled = selected.size === 0;
    delSel.textContent = selected.size ? `excluir selecionados (${selected.size})` : "excluir selecionados";
    allCb.checked = selected.size === trash.length && trash.length > 0;
    allCb.indeterminate = selected.size > 0 && selected.size < trash.length;
  };

  trash.forEach(item => {
    const row = document.createElement("article");
    row.className = "card card-trash";
    row.innerHTML = `
      <div class="card-top">
        <label class="t-check"><input type="checkbox" data-id="${item.id}"></label>
        <span class="card-source source-${item.source}"><span class="source-icon">${SOURCE_ICONS[item.source] || SOURCE_ICONS.web}</span>${sourceLabel(item.source)}</span>
        <div class="card-top-right">
          <button class="card-restore mono" title="devolver ao vautch">↩ restaurar</button>
          <button class="card-purge mono" title="excluir para sempre">🗑 excluir</button>
        </div>
      </div>
      <h2 class="card-title" style="font-size:19px">${item.title || "Sem título"}</h2>
      ${item.url ? `<a class="card-link" href="https://${item.url}" target="_blank" rel="noopener">${item.url.slice(0, 60)}</a>` : ""}`;

    const cb = row.querySelector('input[type="checkbox"]');
    cb.addEventListener("change", () => {
      cb.checked ? selected.add(item.id) : selected.delete(item.id);
      row.classList.toggle("is-selected", cb.checked);
      refreshBar();
    });
    row.querySelector(".card-restore").addEventListener("click", () => {
      restoreItem(item.id);
      row.classList.add("is-leaving");
      setTimeout(() => { renderTrash(); updateTrashChip(); updateCount(); renderCats(); }, 460);
    });
    row.querySelector(".card-purge").addEventListener("click", () => {
      if (!confirm("Excluir este item para sempre? Esta ação não pode ser desfeita.")) return;
      purgeItem(item.id);
      row.classList.add("is-leaving");
      setTimeout(() => { renderTrash(); updateTrashChip(); }, 460);
    });
    feed.appendChild(row);
  });

  allCb.addEventListener("change", () => {
    selected.clear();
    feed.querySelectorAll('.card-trash input[type="checkbox"]').forEach(cb => {
      cb.checked = allCb.checked;
      cb.closest(".card-trash").classList.toggle("is-selected", allCb.checked);
      if (allCb.checked) selected.add(cb.dataset.id);
    });
    refreshBar();
  });

  delSel.addEventListener("click", () => {
    if (!selected.size) return;
    if (!confirm(`Excluir ${selected.size} ${selected.size === 1 ? "item" : "itens"} para sempre? Esta ação não pode ser desfeita.`)) return;
    selected.forEach(id => purgeItem(id));
    renderTrash();
    updateTrashChip();
  });
}

/* ---------- IA real (opcional): Claude classifica pelo significado ---------- */

const APIKEY_KEY = "vault.apikey";

// Pergunta ao Claude Haiku a melhor categoria — entende contexto e siglas
// (LOL = League of Legends) e pode propor uma categoria nova quando nenhuma
// existente serve. Retorna null em qualquer falha (cai na heurística).
async function aiClassify(text, cats) {
  const key = localStorage.getItem(APIKEY_KEY);
  if (!key || !text) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 30,
        messages: [{
          role: "user",
          content: `Classifique este conteúdo salvo de uma rede social na categoria mais específica.\n\nConteúdo: "${text.slice(0, 400)}"\n\nCategorias existentes: ${cats.join(", ")}\n\nRegras: responda APENAS com o nome da categoria, em minúsculas, sem pontuação. Prefira uma categoria existente que seja específica (ex.: um vídeo de League of Legends vai para "lol" se essa categoria existir). Se nenhuma servir bem, proponha UMA categoria nova curta em português (1-2 palavras).`
        }]
      })
    });
    if (!res.ok) return null;
    const json = await res.json();
    const cat = json.content?.[0]?.text?.trim().toLowerCase().replace(/[."']/g, "");
    return cat && cat.length <= 24 ? cat : null;
  } catch {
    return null;
  }
}

// botão "ia real": guarda/remove a chave da API (fica só no seu browser)
const aiToggle = document.getElementById("aiToggle");
const aiState = document.getElementById("aiState");

function refreshAiToggle() {
  const on = !!localStorage.getItem(APIKEY_KEY);
  if (aiState) aiState.textContent = on ? "on" : "off";
  aiToggle.classList.toggle("is-on", on);
}

/* ---------- menu / configurações ---------- */
const menuBtn = document.getElementById("menuBtn");
const menuPanel = document.getElementById("menuPanel");
function setMenu(open) {
  menuPanel.hidden = !open;
  menuBtn.classList.toggle("is-open", open);
  menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  // ancora o cartão ao hambúrguer (o topbar é centralizado e estreito no
  // desktop, então right:18px fixo soltava o menu longe do botão)
  if (open) {
    const r = menuBtn.getBoundingClientRect();
    const card = menuPanel.querySelector(".menu-card");
    card.style.top = `${r.bottom + 8}px`;
    // alinha a borda direita do card à do botão (robusto ao scrollbar-gutter)
    card.style.right = "auto";
    card.style.left = `${Math.max(8, r.right - card.offsetWidth)}px`;
  }
}
menuBtn.addEventListener("click", () => setMenu(menuPanel.hidden));
menuPanel.addEventListener("click", e => { if (e.target === menuPanel) setMenu(false); });

aiToggle.addEventListener("click", () => {
  const current = localStorage.getItem(APIKEY_KEY);
  if (current) {
    if (confirm("Desativar a IA avançada e apagar a chave deste browser?")) {
      localStorage.removeItem(APIKEY_KEY);
    }
  } else {
    const key = prompt("Cole sua chave da API da Anthropic (sk-ant-…).\nEla fica guardada SÓ neste browser e é usada para classificar seus saves com o Claude:");
    if (key && key.trim().startsWith("sk-ant-")) {
      localStorage.setItem(APIKEY_KEY, key.trim());
    } else if (key) {
      alert("Chave inválida — ela começa com sk-ant-");
    }
  }
  refreshAiToggle();
});

/* ---------- entrada de link ---------- */

let busy = false;

function setStatus(msg, withDots = true) {
  status.innerHTML = withDots ? `${msg}<span class="dots"></span>` : msg;
}

// um link é UMA "palavra" com domínio; o resto é nota
function isLikelyUrl(t) {
  return !/\s/.test(t) && /^(https?:\/\/)?[\w-]+(\.[\w-]{2,})+(\/\S*)?(\?\S*)?$/i.test(t);
}

/* ---------- tooltip inteligente de subtag ---------- */

const TIPS_OFF_KEY = "vault.tipsOff";
const TIP_DAY_KEY = "vault.tipDay";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// sugere subtag com parcimônia: no máximo 1x por dia, dispensável de vez,
// e só quando faz sentido (categoria cheia e ainda sem subtags)
function maybeSuggestSubtag(card, item) {
  if (localStorage.getItem(TIPS_OFF_KEY)) return;
  // TODO: reativar o limite de 1x/dia depois dos testes:
  // if (localStorage.getItem(TIP_DAY_KEY) === todayStr()) return;
  if (!item.cat || item.subcat) return;
  const sameCat = currentItems().filter(i => i.cat === item.cat);
  if (sameCat.length < 3) return;               // poucos itens: não atrapalha
  if (subcatsOf(item.cat).length > 0) return;   // já usa subtags: não precisa ensinar
  localStorage.setItem(TIP_DAY_KEY, todayStr());
  setTimeout(() => showTip(card, item), 700);
}

/* posiciona um balão .tip ancorado a um botão, SEMPRE dentro da viewport:
   centraliza no botão, empurra p/ caber na tela, vira pra cima se não couber
   embaixo, e reposiciona a setinha (--arrow-x) pra continuar apontando o botão */
function placeBalloon(tip, anchorEl, gap = 10) {
  const a = anchorEl.getBoundingClientRect();
  const margin = 8;
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  const cx = a.left + a.width / 2;          // centro horizontal do botão
  let left = cx - w / 2;                     // balão centrado no botão
  left = Math.max(margin, Math.min(left, innerWidth - w - margin));
  // vertical: embaixo do botão; se estourar, vira pra cima
  let top = a.bottom + gap;
  const below = top + h <= innerHeight - margin;
  if (!below && a.top - gap - h >= margin) {
    top = a.top - gap - h;
    tip.classList.add("tip-above");
  } else {
    tip.classList.remove("tip-above");
  }
  tip.style.left = left + "px";
  tip.style.top  = top + "px";
  // seta aponta para o centro do botão, relativa à borda esquerda do balão
  let arrowX = cx - left;
  arrowX = Math.max(16, Math.min(arrowX, w - 16));
  tip.style.setProperty("--arrow-x", arrowX + "px");
}

function showTip(card, item) {
  document.querySelector(".tip")?.remove();
  const tip = document.createElement("div");
  tip.className = "tip";
  tip.innerHTML = `
    <p>Você já tem bastante coisa em <strong>${item.cat}</strong>. Que tal uma <strong>subtag</strong> pra organizar melhor?</p>
    <div class="tip-actions">
      <button class="tip-go">criar subtag</button>
      <button class="tip-later">agora não</button>
    </div>
    <button class="tip-off mono">não mostrar dicas</button>`;
  // no body (não no card): cada card tem transform e cria contexto de
  // empilhamento — dentro dele a tooltip ficaria atrás dos cards vizinhos
  document.body.appendChild(tip);
  const place = () => placeBalloon(tip, card.querySelector(".card-cat") || card);
  place();
  addEventListener("scroll", place, { passive: true });
  addEventListener("resize", place);
  requestAnimationFrame(() => tip.classList.add("is-in"));
  const close = () => {
    tip.classList.remove("is-in");
    removeEventListener("scroll", place);
    removeEventListener("resize", place);
    setTimeout(() => tip.remove(), 250);
  };
  tip.querySelector(".tip-go").onclick = () => { close(); openCatMenu(card, item); };
  tip.querySelector(".tip-later").onclick = close;
  tip.querySelector(".tip-off").onclick = () => { localStorage.setItem(TIPS_OFF_KEY, "1"); close(); };
  setTimeout(close, 13000); // some sozinha se ignorada
}

// balão educativo simples (mesmo visual da .tip), ancorado num botão clicado
function showHintBalloon(anchorEl, msg, duration = 6000) {
  if (!anchorEl) return;
  document.querySelector(".tip")?.remove();
  const tip = document.createElement("div");
  tip.className = "tip tip-hint";
  tip.innerHTML = `<p>${msg}</p>`;
  document.body.appendChild(tip);
  const place = () => placeBalloon(tip, anchorEl);
  place();
  addEventListener("scroll", place, { passive: true });
  addEventListener("resize", place);
  requestAnimationFrame(() => tip.classList.add("is-in"));
  const close = () => {
    tip.classList.remove("is-in");
    removeEventListener("scroll", place);
    removeEventListener("resize", place);
    setTimeout(() => tip.remove(), 250);
  };
  tip.addEventListener("click", close);
  setTimeout(close, duration);
}

// textarea: cresce com o texto
function growIntake() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, innerHeight * 0.4)}px`;
}

const intakeField = document.querySelector(".intake-field");

// limpa a busca e volta o ícone para bookmark (após guardar, p. ex.)
function clearSearch() {
  searchQuery = "";
  intakeField.classList.remove("is-typing");
  applyFilter();
}

// estado inicial: TUDO, sem filtros, sem busca, fora da lixeira. Usado pelo
// toggle da lixeira e pelo clique no logo.
function resetToDefault() {
  activeCat = "tudo";
  activeSub = null;
  filterType = "all";
  filterPeriod = "all";
  searchQuery = "";
  input.value = "";
  intakeField.classList.remove("is-typing", "is-link");
  closeSubDropdown();
  setMenu(false);
  buildFeed();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

const wordmarkEl = document.querySelector(".wordmark");
document.querySelectorAll(".wordmark .logo-img").forEach(el => el.addEventListener("click", resetToDefault));

// mobile: a barra fixa some ao rolar pra baixo e volta ao rolar pra cima; e o
// PRÓPRIO logo (mesmo elemento) encolhe via scroll, indo do tamanho grande no
// topo da tela até pequeno, centralizado dentro da barra fixa.
const isMobileView = () => matchMedia("(max-width: 560px)").matches;
const COLLAPSE_RANGE = 90;   // px de scroll para o logo encolher de vez
const MINI_SCALE = 0.4;      // tamanho final do logo (na barra)

const topbarRowEl = document.querySelector('.topbar-row');

function onScrollMobileBar() {
  const y = window.scrollY;
  if (!isMobileView() || document.body.classList.contains("is-empty")) {
    wordmarkEl.style.transform = "";
    topbarRowEl?.classList.remove("bar-solid");
    return;
  }
  const p = Math.min(Math.max(y / COLLAPSE_RANGE, 0), 1);
  const scale = 1 - p * (1 - MINI_SCALE);
  wordmarkEl.style.transform = `scale(${scale})`;
  // barra opaca quando logo está pelo menos 60% colapsado (entrando na barra)
  topbarRowEl?.classList.toggle("bar-solid", p >= 0.6);
}
addEventListener("scroll", onScrollMobileBar, { passive: true });
addEventListener("resize", onScrollMobileBar);

// uma só barra: digitar busca ao vivo; o ícone vira lupa; guardar (botão/Enter) salva
input.addEventListener("input", () => {
  const v = input.value;
  searchQuery = v;
  intakeField.classList.toggle("is-typing", v.trim().length > 0);
  // link → barra de 1 linha (sem quebrar); nota/texto → cresce
  const link = isLikelyUrl(v.trim());
  intakeField.classList.toggle("is-link", link);
  if (link) input.style.height = "";
  else growIntake();
  applyFilter();
});

// toque (celular) → Enter quebra linha; mouse (PC) → Enter guarda
const isTouch = matchMedia("(hover: none) and (pointer: coarse)").matches;

// Enter guarda (PC) · no celular Enter é quebra de linha · Ctrl/Cmd+B = **negrito**
input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey && !isTouch) {
    e.preventDefault();
    form.requestSubmit();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
    e.preventDefault();
    const { selectionStart: a, selectionEnd: b, value: v } = input;
    input.value = v.slice(0, a) + "**" + v.slice(a, b) + "**" + v.slice(b);
    input.setSelectionRange(a + 2, b + 2);
    growIntake();
  }
});

// insere um item novo no topo do feed (notas, prints e links usam isto)
function insertNewItem(newItem, statusMsg) {
  try {
    persist(newItem);
  } catch {
    setStatus("✦ armazenamento local cheio — exclua alguns prints antigos", false);
    setTimeout(() => { status.innerHTML = ""; }, 5000);
    return null;
  }
  const firstMark = ensureTodayMark();
  const card = makeCard(newItem, true);
  firstMark.after(card);
  setStatus(statusMsg, false);
  setTimeout(() => { status.innerHTML = ""; }, 4000);
  updateCount();
  activeCat = "tudo"; activeSub = null; // novo item sempre visível em TUDO
  renderCats();   // a categoria do item novo pode estrear um chip
  markActiveChip();
  applyFilter();
  fitReels();
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => {
    const r = card.getBoundingClientRect();
    puff(r.left + r.width / 2, r.top + 24, 12);
  }, 500);
  maybeSuggestSubtag(card, newItem);
  return card;
}

// nota escrita direto no campo
async function saveNote(text) {
  setStatus("lendo sua nota");
  let cat = await aiClassify(text, allCats());
  if (cat && !allCats().includes(cat)) {
    localStorage.setItem(CATS_KEY, JSON.stringify([...loadCats(), cat]));
  }
  if (!cat) cat = classifyContent(text, loadLearn()).cat;
  insertNewItem({
    id: `v${Date.now()}`,
    source: "nota",
    cat,
    type: "note",
    title: (text.split("\n")[0] || "Nota").slice(0, 60),
    text,
    time: "guardado agora mesmo",
    url: null
  }, `✦ nota guardada em <strong>${cat}</strong>`);
}

// comprime a imagem no navegador antes de guardar: redimensiona até no
// máximo 1600px no maior lado e exporta em WebP (cai pra JPEG se o browser
// não suportar). WebP costuma ficar ~30% menor que JPEG na mesma qualidade.
function compressImage(file, maxSide = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let url = canvas.toDataURL("image/webp", quality);
      if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", quality);
      URL.revokeObjectURL(img.src);
      resolve(url);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// guarda um arquivo de imagem como card de "print"
async function savePrintFromFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  clearSearch();
  setStatus("revelando sua imagem");
  try {
    const dataUrl = await compressImage(file);
    const agora = new Date();
    insertNewItem({
      id: `v${Date.now()}${Math.round(performance.now())}`,
      source: "print",
      cat: "ideias",
      type: "video",          // reusa o card de mídia: imagem + título editável
      title: `Imagem de ${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      body: "",
      image: dataUrl,
      embed: null,
      time: "guardado agora mesmo",
      url: null
    }, "✦ imagem guardada — clique no título para renomear");
  } catch {
    setStatus("não consegui ler essa imagem", false);
    setTimeout(() => { status.innerHTML = ""; }, 3000);
  }
}

// colar (Ctrl+V) no desktop
input.addEventListener("paste", e => {
  const imgItem = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith("image/"));
  if (!imgItem) return;          // colou texto/link: comportamento normal
  e.preventDefault();
  savePrintFromFile(imgItem.getAsFile());
});

// botão de câmera/galeria → input de arquivo (celular abre câmera/rolo; PC abre seletor)
const camBtn = document.getElementById("camBtn");
const fileInput = document.getElementById("fileInput");
camBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async () => {
  for (const f of fileInput.files) await savePrintFromFile(f);
  fileInput.value = ""; // permite re-selecionar o mesmo arquivo
});

form.addEventListener("submit", async e => {
  e.preventDefault();
  const url = input.value.trim();
  if (!url || busy) return;
  busy = true;
  input.value = "";
  growIntake();
  clearSearch(); // ao guardar, sai do modo busca e mostra o feed inteiro

  // não é link? então é uma nota
  if (!isLikelyUrl(url)) {
    await saveNote(url);
    busy = false;
    return;
  }

  const source = detectSource(url);

  setStatus(AI_STEPS[0]);

  // busca metadados reais em paralelo com a "narração" dos passos
  const metaPromise = fetchMetadata(url);
  for (const step of AI_STEPS.slice(1, 3)) {
    await new Promise(r => setTimeout(r, 700));
    setStatus(step);
  }
  const meta = await metaPromise;
  setStatus(AI_STEPS[3]);
  await new Promise(r => setTimeout(r, 400));

  // monta o embed com o URL final resolvido — links /share/ do Facebook
  // viram o endereço canônico; meta traz as dimensões p/ o aspect ratio real
  let embed = buildEmbed(meta?.url || url, meta) || buildEmbed(url, meta);
  let fallbackImage = null;
  let fallbackTitle = null;
  let fallbackBody = null;

  // YouTube com incorporação desativada pelo dono: thumbnail em vez de player quebrado
  const ytm = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
  if (source === "youtube" && meta?.embedDisabled && ytm) {
    embed = null;
    fallbackImage = `https://img.youtube.com/vi/${ytm[1]}/hqdefault.jpg`;
    if (!meta?.title) {
      fallbackTitle = "Vídeo no YouTube";
      fallbackBody = "O dono desativou a incorporação — use “abrir original” para assistir.";
    }
  }

  // classifica pelo conteúdo real (título + descrição), não pelo URL
  const contentText = [meta?.title, meta?.description, meta?.author].filter(Boolean).join(" · ");
  // 1º tenta a IA real (se houver chave); senão, heurística local
  let cat = await aiClassify(contentText, allCats());
  if (cat) {
    if (!allCats().includes(cat)) {
      localStorage.setItem(CATS_KEY, JSON.stringify([...loadCats(), cat]));
    }
  } else {
    cat = classifyContent(contentText, loadLearn()).cat;
  }

  const cleanDesc = cleanDescription(meta?.description);
  // Facebook grupos/conteúdo privado: sem embed e sem título real (foi scrubado como genérico)
  const isFbPrivate = source === "facebook" && !embed && !meta?.title;
  const newItem = {
    id: `v${Date.now()}`,
    source, cat,
    type: "video",
    title: isFbPrivate ? "Grupo ou conteúdo privado" : (fallbackTitle || smartTitle(meta)),
    body: isFbPrivate
      ? "O preview não está disponível. Use 'abrir original' para ver."
      : fallbackBody || (cleanDesc
        ? cleanDesc.slice(0, 150) + (cleanDesc.length > 150 ? "…" : "")
        : ""),
    stats: parseSocialStats(meta?.description) || parseSocialStats(meta?.title),
    author: meta?.author || null,
    embed,
    isPrivate: isFbPrivate || undefined,
    image: isFbPrivate ? null : (fallbackImage || meta?.image || null),
    thumb: null,
    time: "guardado agora mesmo",
    url: url.replace(/^https?:\/\//, "")
  };

  persist(newItem);

  const firstMark = ensureTodayMark();
  const card = makeCard(newItem, true);
  firstMark.after(card);

  setStatus(`✦ guardado em <strong>${cat}</strong>${meta ? "" : " (não consegui ler os detalhes do link)"}`, false);
  setTimeout(() => { status.innerHTML = ""; }, 4000);

  updateCount();
  applyFilter();
  fitReels();
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  // fumacinha do "pouso" — depois que o scroll assenta
  setTimeout(() => {
    const r = card.getBoundingClientRect();
    puff(r.left + r.width / 2, r.top + 24, 12);
  }, 500);
  busy = false;
});

/* ---------- diagnóstico de embed ---------- */

// Gera e baixa um relatório JSON com tudo que preciso para diagnosticar
// por que um embed não está exibindo corretamente.
const REPORT_ENDPOINT = "https://script.google.com/macros/s/AKfycbxdAPBCDcNXvraALRay-AU47k-jMu-94_DEPvwQmmAE98zGzfNSvMMc1uIQ_b7lx9CM/exec";

async function downloadEmbedReport(item, card) {
  const embedBox = card.querySelector(".card-embed");
  const reelCrop = card.querySelector(".reel-crop");
  const iframe = card.querySelector("iframe");

  // item sem a imagem base64 (pode ter MB e não ajuda no diagnóstico)
  const safeItem = { ...item };
  if (safeItem.image && safeItem.image.startsWith("data:")) {
    safeItem.image = "[print local — base64 omitido]";
  }

  const report = {
    vautch_version: "proto-2026-06",
    timestamp: new Date().toISOString(),
    reported_url: item.url ? `https://${item.url}` : null,
    source: item.source,
    embed_html: item.embed || null,
    iframe_src: iframe ? iframe.src : null,
    embed_classes: embedBox ? embedBox.className : null,
    layout: {
      card_width_px: card.clientWidth,
      embed_width_px: embedBox ? embedBox.clientWidth : null,
      embed_height_px: embedBox ? embedBox.clientHeight : null,
      reel_crop_transform: reelCrop ? reelCrop.style.transform : null,
    },
    device: {
      is_touch: isTouch,
      device_pixel_ratio: window.devicePixelRatio,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      user_agent: navigator.userAgent,
    },
    item: safeItem,
  };

  const json = JSON.stringify(report, null, 2);
  setStatus("⏳ enviando relatório…", false);

  try {
    const form = new FormData();
    form.append("data", json);
    const res = await fetch(REPORT_ENDPOINT, { method: "POST", body: form });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();
    if (!result.ok) throw new Error(result.error || "Drive recusou");
    setStatus(`✦ enviado: ${result.file}`, false);
  } catch (err) {
    // rede falhou ou Drive retornou erro: salva localmente como fallback
    console.warn("embed-report fallback:", err);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vautch-report-${(item.source || "post").replace(/\W/g, "")}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    setStatus("⚠ Drive falhou — relatório baixado localmente", false);
  }

  setTimeout(() => { status.innerHTML = ""; }, 4000);
}

/* ---------- Threads auto-height via postMessage ----------
   O iframe do Threads é cross-origin — não dá pra medir o conteúdo diretamente.
   O Threads (assim como Instagram) manda mensagens postMessage com a altura real.
   Escutamos e ajustamos o iframe correspondente. */
window.addEventListener("message", e => {
  if (!e.data) return;
  let d = e.data;
  if (typeof d === "string") { try { d = JSON.parse(d); } catch { return; } }
  // formato do Threads/Instagram: { type:"MEASURE", content:{ height:N } }
  const h = d?.content?.height || d?.height;
  if (!h || h < 50) return;
  document.querySelectorAll(".embed-threads iframe").forEach(frame => {
    try { if (frame.contentWindow === e.source) frame.style.height = h + "px"; } catch {}
  });
});

/* ---------- init ---------- */
applyViewMode();  // restaura modo compacto/timeline salvo
buildFeed();      // já chama renderCats() internamente
initDrag();       // ativa drag-to-reorder no modo compacto
updateTrashChip();
refreshAiToggle();
