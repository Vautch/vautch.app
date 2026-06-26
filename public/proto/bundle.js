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

// Limpa a URL de parâmetros de RASTREAMENTO. Estratégia HÍBRIDA (B6):
//   • Plataforma conhecida (IG/YouTube/FB/TikTok/…): ALLOWLIST — mantém só os
//     params funcionais e remove TODO o resto. Robusto a params novos de boost/
//     share da Meta (mibextid, rdid, eav, _rdr, si…) que uma denylist nunca
//     acompanha e que quebram o embed do Facebook (href via plugins/video.php).
//   • Host genérico (web): DENYLIST — preserva o link (params podem ser
//     funcionais, ex.: ?id=123) e tira só rastreadores conhecidos (utm_*, fbclid…).
// Mantém caminho e hash. Não muda a engenharia dos embeds — os IDs já saem por regex.
const TRACKING_PARAMS = new Set(["ig_rid", "igshid", "igsh", "fbclid", "gclid", "gclsrc", "dclid", "mc_cid", "mc_eid", "_gl", "msclkid", "yclid", "twclid", "mibextid", "rdid", "eav", "_rdr", "si"]);
// host (sem www/m/mobile) → params funcionais a PRESERVAR. [] = zera a query.
const PLATFORM_KEEP = [
  ["youtu.be", ["t"]],
  ["youtube.com", ["v", "t", "start", "list", "index"]],
  ["instagram.com", ["img_index"]],   // carrossel
  ["facebook.com", ["v"]],            // watch?v=ID
  ["fb.watch", []],
  ["tiktok.com", []],
  ["vimeo.com", ["h"]],               // hash de vídeo não listado
  ["x.com", []],
  ["twitter.com", []],
  ["threads.net", []],
  ["threads.com", []],
];
function keepSetFor(host) {
  const h = host.replace(/^www\.|^m\.|^mobile\./, "");
  const hit = PLATFORM_KEEP.find(([dom]) => h === dom || h.endsWith("." + dom));
  return hit ? new Set(hit[1]) : null; // null = host genérico (denylist)
}
function stripTracking(raw) {
  if (!raw) return raw;
  try {
    const hasProto = /^https?:\/\//i.test(raw);
    const u = new URL(hasProto ? raw : `https://${raw}`);
    const keep = keepSetFor(u.hostname.toLowerCase());
    [...u.searchParams.keys()].forEach(k => {
      const lk = k.toLowerCase();
      const drop = keep ? !keep.has(lk) : (lk.startsWith("utm_") || TRACKING_PARAMS.has(lk));
      if (drop) u.searchParams.delete(k);
    });
    const out = u.toString().replace(/\?(?=#|$)/, ""); // tira "?" pendente sem query
    return hasProto ? out : out.replace(/^https?:\/\//, "");
  } catch { return raw; }
}

// aspect ratio largura/altura a partir das dimensões da imagem (metadados)
function aspectFromMeta(meta) {
  if (meta && meta.imageW && meta.imageH) return meta.imageW / meta.imageH;
  return null;
}

// Retorna HTML de iframe oficial da plataforma, ou null se não reconhecer.
// `meta` (opcional) traz o URL resolvido (links curtos) e dimensões reais do conteúdo.
function buildEmbed(raw, meta) {
  if (!raw) return null;
  const url = stripTracking(raw.trim());  // tira utm_*/fbclid/… antes de montar

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
  receitas: ["receita", "receitas", "recipe", "cozinha", "ingrediente", "ingredientes", "bolo", "massa", "forno", "airfryer", "lanche", "jantar", "almoço", "sobremesa", "molho", "tempero", "cooking", "food", "comida", "frango", "chocolate", "panela"],
  moda: ["moda", "look", "looks", "outfit", "achados", "shein", "shopee", "roupa", "roupas", "estilo", "fashion", "tendência", "vestido", "calça", "masculina", "feminina", "provador", "haul", "tênis", "sapato", "acessórios"],
  design: ["design", "tipografia", "font", "fonte", "branding", "identidade", "logo", "logotipo", "ui", "ux", "figma", "layout", "paleta", "designer", "wireframe", "mockup"],
  viagem: ["viagem", "roteiro", "destino", "praia", "trilha", "chapada", "hotel", "pousada", "passagem", "travel", "trip", "mochilão", "turismo", "viajar", "férias"],
  música: ["música", "musica", "show", "banda", "álbum", "album", "playlist", "setlist", "song", "music", "festival", "vinil", "spotify", "official video", "official audio", "clipe", "lyrics", "letra", "remaster", "ao vivo", "live session", "acústico", "cover", "feat", "dj "],
  games: ["gameplay", "game", "jogo", "jogos", "gamer", "fps", "moba", "rpg", "steam", "playstation", "xbox", "nintendo", "twitch", "esports", "e-sports", "ranked", "patch notes", "speedrun", "boss", "loot", "indie game", "deadlock", "league of legends", "valorant", "counter-strike", "minecraft", "fortnite"],
  ai: ["ai", "ia", "inteligência artificial", "inteligencia artificial", "machine learning", "deep learning", "chatgpt", "gpt", "claude", "gemini", "llm", "midjourney", "stable diffusion", "openai", "anthropic", "rede neural", "neural", "modelo de linguagem", "agente", "agentes", "copilot", "perplexity"],
  tecnologia: ["tecnologia", "tech", "software", "app", "aplicativo", "programação", "código", "developer", "dev", "javascript", "python", "react", "api", "startup", "gadget", "hardware", "computador", "linux"],
  marketing: ["marketing", "anúncio", "anúncios", "ads", "tráfego", "copywriting", "copy", "funil", "lançamento", "branding", "engajamento", "conversão", "seo", "social media", "audiência"],
  negócios: ["negócio", "negócios", "empreender", "empreendedorismo", "vendas", "venda", "faturamento", "lucro", "cliente", "clientes", "gestão", "produtividade", "liderança", "carreira"],
  finanças: ["finanças", "financeiro", "investir", "investimento", "investimentos", "dinheiro", "renda", "bolsa", "ações", "cripto", "bitcoin", "economia", "juros", "poupança", "dividendos"],
  fitness: ["treino", "academia", "musculação", "exercício", "exercícios", "fit", "fitness", "hipertrofia", "cardio", "corrida", "agachamento", "workout", "gym"],
  saúde: ["saúde", "saude", "bem-estar", "sono", "meditação", "ansiedade", "terapia", "nutrição", "dieta", "vitamina", "mental", "autocuidado"],
  fotografia: ["fotografia", "foto", "fotos", "câmera", "camera", "lente", "lightroom", "fotógrafo", "retrato", "ensaio", "iso", "obturador"],
  arte: ["arte", "ilustração", "ilustrador", "desenho", "pintura", "artista", "galeria", "escultura", "aquarela", "sketch"],
  humor: ["humor", "meme", "memes", "engraçado", "comédia", "piada", "stand-up", "standup"],
  pets: ["pet", "pets", "cachorro", "gato", "filhote", "adestramento", "ração", "veterinário", "animal"],
  carros: ["carro", "carros", "automóvel", "motor", "turbo", "review do carro", "test drive", "suv", "elétrico", "moto"]
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

// Classificador em cascata (pedido do Paulo):
//   1. tenta encaixar nas TAGS QUE O USUÁRIO JÁ TEM (match pelo nome + sinais)
//   2. se nenhuma serve, deixa um sinal de tópico VENCER e cria a tag nova
//   3. se não houver conteúdo legível / nada bate, cai na tag padrão "ideias"
// learned: { tag: [palavras] } aprendidas com as correções (pesam 1.5 vs 1).
// userCats: tags que o usuário já possui (built-in + criadas) — têm prioridade.
//
// Casamento por PALAVRA INTEIRA (não substring): normaliza tudo a espaços e
// procura " palavra " — assim "ai" não casa dentro de "praia"/"email".
function classifyContent(text, learned = {}, userCats = []) {
  if (!text || !text.trim()) return { cat: "ideias", confidence: 0 };
  const t = " " + text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim() + " ";
  const singular = w => w.replace(/s$/, "");
  const has = w => {
    w = w.toLowerCase().trim();
    if (!w) return false;
    if (w.includes(" ")) return t.includes(w);        // frase: substring basta
    return t.includes(" " + w + " ");                 // palavra: fronteira exata
  };
  const sigScore = words => (words || []).reduce((s, w) => s + (has(w) ? 1 : 0), 0);

  let best = { cat: "ideias", score: 0 };
  const bump = (cat, s) => { if (s > best.score) best = { cat, score: s }; };

  // 1) prioriza as tags existentes do usuário (nome literal + sinais + aprendido)
  for (const cat of userCats || []) {
    const name = String(cat).toLowerCase();
    let s = 0;
    if (has(name) || has(singular(name))) s += 2;     // o nome da tag aparece no post
    s += sigScore(CATEGORY_SIGNALS[cat]);
    s += sigScore(learned[cat]) * 1.5;
    if (s > 0) bump(cat, s + 0.5);                    // leve vantagem p/ tag já existente
  }

  // 2) sinais de tópico — se vencerem, a tag (nova) é criada a partir do conteúdo
  for (const [cat, words] of Object.entries(CATEGORY_SIGNALS)) {
    bump(cat, sigScore(words));
  }
  // 3) palavras aprendidas de tags ainda não cobertas
  for (const [cat, words] of Object.entries(learned)) {
    bump(cat, sigScore(words) * 1.5);
  }

  if (best.score === 0) return { cat: "ideias", confidence: 0 };
  return { cat: best.cat, confidence: best.score };
}
// Vault — protótipo de interface
// Feed, filtros, entrada de links com embed real + metadados reais + persistência local.

const feed = document.getElementById("feed");
const filters = document.getElementById("filters");
const filterActions = document.getElementById("filterActions");
const filtersMore = document.getElementById("filtersMore");
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
const ORDER_KEY = "vault.order";     // ordem customizada dos cards no modo compacto
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
  if (card) {
    card.dataset.sub = item.subcat || "";
    const tagsEl = card.querySelector(".card-tags");
    if (tagsEl) {
      // remove sep + subcat antigos sem tocar no .card-cat (que tem listener)
      tagsEl.querySelectorAll(".card-sep, .card-subcat").forEach(el => el.remove());
      if (item.subcat) {
        const sep = document.createElement("span");
        sep.className = "card-sep";
        sep.setAttribute("aria-hidden", "true");
        sep.innerHTML = ICON_CHEVRON;
        const sub = document.createElement("span");
        sub.className = "card-subcat";
        sub.title = item.subcat;
        sub.textContent = truncTag(item.subcat);
        tagsEl.appendChild(sep);
        tagsEl.appendChild(sub);
      }
    }
  }
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
  let { cat } = classifyContent(text, loadLearn(), allCats());
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
      // resiliência: item sem categoria não pode quebrar o feed inteiro
      if (!i.cat) { i.cat = "geral"; migrated = true; }
      // limpa rastreamento (utm_source=ig_web_copy_link, fbclid…) das URLs
      // salvas por versões antigas — deixa "abrir original" e lixeira limpos
      if (i.url) { const c = stripTracking(i.url); if (c !== i.url) { i.url = c; migrated = true; } }
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

/* ---------- F2d: tracking de interação ("esquecidos") ---------- */
// Grava por item QUANDO foi visto pela última vez e quantas vezes, pra o relembre
// puxar os MENOS vistos / mais antigos (em vez de aleatório). Device-local: a chave
// vault.seen NÃO entra na ponte de sync (igual vault.lastSeen). Só itens do usuário
// (ids "v<...>"); seeds são ignorados.
const SEEN_KEY = "vault.seen";
const DWELL_MS = 60000;        // "ficou >1min" olhando o card no viewport

function loadSeen() { return loadJSON(SEEN_KEY, {}); }

function markSeen(id) {
  if (!id || id.startsWith("seed-")) return;
  const seen = loadSeen();
  const rec = seen[id] || { opens: 0, lastSeen: 0 };
  rec.opens = (rec.opens || 0) + 1;
  rec.lastSeen = Date.now();
  seen[id] = rec;
  localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
}

// dwell: marca como visto quando o card fica ≥60% visível por > DWELL_MS.
const _dwellTimers = new WeakMap();
const dwellObserver = new IntersectionObserver(entries => {
  entries.forEach(en => {
    const card = en.target;
    if (en.isIntersecting && en.intersectionRatio >= 0.6) {
      if (!_dwellTimers.has(card)) _dwellTimers.set(card, setTimeout(() => markSeen(card.dataset.id), DWELL_MS));
    } else {
      const t = _dwellTimers.get(card);
      if (t) { clearTimeout(t); _dwellTimers.delete(card); }
    }
  });
}, { threshold: [0, 0.6, 1] });

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

// ícones da UI do card (Figma) — fill currentColor p/ adaptar ao tema
const ICON_EXPAND   = `<svg viewBox="0 0 12 13" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 0.590909V4.13636C12 4.29308 11.9425 4.44338 11.8402 4.5542C11.7379 4.66502 11.5992 4.72727 11.4545 4.72727C11.3099 4.72727 11.1711 4.66502 11.0689 4.5542C10.9666 4.44338 10.9091 4.29308 10.9091 4.13636V2.01722L7.47682 5.73625C7.37447 5.84713 7.23565 5.90942 7.09091 5.90942C6.94617 5.90942 6.80735 5.84713 6.705 5.73625C6.60265 5.62537 6.54515 5.47499 6.54515 5.31818C6.54515 5.16138 6.60265 5.01099 6.705 4.90011L10.138 1.18182H8.18182C8.03715 1.18182 7.89842 1.11956 7.79612 1.00874C7.69383 0.897928 7.63636 0.747628 7.63636 0.590909C7.63636 0.43419 7.69383 0.28389 7.79612 0.173073C7.89842 0.0622564 8.03715 0 8.18182 0H11.4545C11.5992 0 11.7379 0.0622564 11.8402 0.173073C11.9425 0.28389 12 0.43419 12 0.590909ZM4.52318 7.26375L1.09091 10.9828V8.86364C1.09091 8.70692 1.03344 8.55662 0.931149 8.4458C0.828857 8.33498 0.690118 8.27273 0.545455 8.27273C0.400791 8.27273 0.262053 8.33498 0.15976 8.4458C0.0574675 8.55662 0 8.70692 0 8.86364V12.4091C0 12.5658 0.0574675 12.7161 0.15976 12.8269C0.262053 12.9377 0.400791 13 0.545455 13H3.81818C3.96285 13 4.10158 12.9377 4.20388 12.8269C4.30617 12.7161 4.36364 12.5658 4.36364 12.4091C4.36364 12.2524 4.30617 12.1021 4.20388 11.9913C4.10158 11.8804 3.96285 11.8182 3.81818 11.8182H1.86205L5.295 8.09989C5.39735 7.98901 5.45485 7.83862 5.45485 7.68182C5.45485 7.52501 5.39735 7.37463 5.295 7.26375C5.19265 7.15287 5.05384 7.09058 4.90909 7.09058C4.76435 7.09058 4.62553 7.15287 4.52318 7.26375Z"/></svg>`;
const ICON_COMPRESS = `<svg viewBox="0 0 13 13" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12.8268 1.00925L9.10799 4.72736H11.227C11.3837 4.72736 11.534 4.78962 11.6448 4.90043C11.7557 5.01124 11.8179 5.16153 11.8179 5.31824C11.8179 5.47495 11.7557 5.62524 11.6448 5.73606C11.534 5.84687 11.3837 5.90912 11.227 5.90912H7.68176C7.52505 5.90912 7.37475 5.84687 7.26394 5.73606C7.15313 5.62524 7.09088 5.47495 7.09088 5.31824V1.77297C7.09088 1.61626 7.15313 1.46596 7.26394 1.35515C7.37475 1.24434 7.52505 1.18209 7.68176 1.18209C7.83847 1.18209 7.98876 1.24434 8.09957 1.35515C8.21038 1.46596 8.27264 1.61626 8.27264 1.77297V3.89201L11.9907 0.173161C12.1016 0.0622877 12.252 0 12.4088 0C12.5656 0 12.716 0.0622877 12.8268 0.173161C12.9377 0.284034 13 0.43441 13 0.591208C13 0.748006 12.9377 0.898382 12.8268 1.00925ZM5.31824 7.09088H1.77297C1.61626 7.09088 1.46596 7.15313 1.35515 7.26394C1.24434 7.37475 1.18209 7.52505 1.18209 7.68176C1.18209 7.83847 1.24434 7.98876 1.35515 8.09957C1.46596 8.21038 1.61626 8.27264 1.77297 8.27264H3.89201L0.173161 11.9907C0.0622877 12.1016 0 12.252 0 12.4088C0 12.5656 0.0622877 12.716 0.173161 12.8268C0.284034 12.9377 0.43441 13 0.591208 13C0.748006 13 0.898382 12.9377 1.00925 12.8268L4.72736 9.10799V11.227C4.72736 11.3837 4.78962 11.534 4.90043 11.6448C5.01124 11.7557 5.16153 11.8179 5.31824 11.8179C5.47495 11.8179 5.62524 11.7557 5.73606 11.6448C5.84687 11.534 5.90912 11.3837 5.90912 11.227V7.68176C5.90912 7.52505 5.84687 7.37475 5.73606 7.26394C5.62524 7.15313 5.47495 7.09088 5.31824 7.09088Z"/></svg>`;
const ICON_DRAG     = `<svg viewBox="0 0 10 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M3 1.5C3 1.79667 2.91203 2.08668 2.74721 2.33336C2.58238 2.58003 2.34812 2.77229 2.07403 2.88582C1.79994 2.99935 1.49834 3.02906 1.20737 2.97118C0.916394 2.9133 0.64912 2.77044 0.439341 2.56066C0.229562 2.35088 0.0867006 2.08361 0.0288228 1.79264C-0.0290551 1.50166 0.000649922 1.20006 0.114181 0.925976C0.227713 0.651886 0.419972 0.417619 0.666646 0.252797C0.913319 0.0879744 1.20333 0 1.5 0C1.89783 0 2.27936 0.158036 2.56066 0.439341C2.84197 0.720645 3 1.10218 3 1.5ZM8.25 3C8.54667 3 8.83668 2.91203 9.08336 2.74721C9.33003 2.58238 9.52229 2.34811 9.63582 2.07403C9.74935 1.79994 9.77906 1.49834 9.72118 1.20737C9.6633 0.916394 9.52044 0.649119 9.31066 0.439341C9.10088 0.229562 8.83361 0.0867006 8.54264 0.0288228C8.25167 -0.0290551 7.95006 0.000649922 7.67598 0.114181C7.40189 0.227713 7.16762 0.419972 7.0028 0.666646C6.83797 0.913319 6.75 1.20333 6.75 1.5C6.75 1.89783 6.90804 2.27936 7.18934 2.56066C7.47065 2.84197 7.85218 3 8.25 3ZM1.5 6.375C1.20333 6.375 0.913319 6.46297 0.666646 6.6278C0.419972 6.79262 0.227713 7.02689 0.114181 7.30098C0.000649922 7.57506 -0.0290551 7.87666 0.0288228 8.16764C0.0867006 8.45861 0.229562 8.72588 0.439341 8.93566C0.64912 9.14544 0.916394 9.2883 1.20737 9.34618C1.49834 9.40406 1.79994 9.37435 2.07403 9.26082C2.34812 9.14729 2.58238 8.95503 2.74721 8.70836C2.91203 8.46168 3 8.17167 3 7.875C3 7.47718 2.84197 7.09565 2.56066 6.81434C2.27936 6.53304 1.89783 6.375 1.5 6.375ZM8.25 6.375C7.95333 6.375 7.66332 6.46297 7.41665 6.6278C7.16997 6.79262 6.97771 7.02689 6.86418 7.30098C6.75065 7.57506 6.72095 7.87666 6.77882 8.16764C6.8367 8.45861 6.97956 8.72588 7.18934 8.93566C7.39912 9.14544 7.66639 9.2883 7.95737 9.34618C8.24834 9.40406 8.54994 9.37435 8.82403 9.26082C9.09812 9.14729 9.33238 8.95503 9.49721 8.70836C9.66203 8.46168 9.75 8.17167 9.75 7.875C9.75 7.47718 9.59197 7.09565 9.31066 6.81434C9.02936 6.53304 8.64783 6.375 8.25 6.375ZM1.5 12.75C1.20333 12.75 0.913319 12.838 0.666646 13.0028C0.419972 13.1676 0.227713 13.4019 0.114181 13.676C0.000649922 13.9501 -0.0290551 14.2517 0.0288228 14.5426C0.0867006 14.8336 0.229562 15.1009 0.439341 15.3107C0.64912 15.5204 0.916394 15.6633 1.20737 15.7212C1.49834 15.7791 1.79994 15.7494 2.07403 15.6358C2.34812 15.5223 2.58238 15.33 2.74721 15.0834C2.91203 14.8367 3 14.5467 3 14.25C3 13.8522 2.84197 13.4706 2.56066 13.1893C2.27936 12.908 1.89783 12.75 1.5 12.75ZM8.25 12.75C7.95333 12.75 7.66332 12.838 7.41665 13.0028C7.16997 13.1676 6.97771 13.4019 6.86418 13.676C6.75065 13.9501 6.72095 14.2517 6.77882 14.5426C6.8367 14.8336 6.97956 15.1009 7.18934 15.3107C7.39912 15.5204 7.66639 15.6633 7.95737 15.7212C8.24834 15.7791 8.54994 15.7494 8.82403 15.6358C9.09812 15.5223 9.33238 15.33 9.49721 15.0834C9.66203 14.8367 9.75 14.5467 9.75 14.25C9.75 13.8522 9.59197 13.4706 9.31066 13.1893C9.02936 12.908 8.64783 12.75 8.25 12.75Z"/></svg>`;
const ICON_CHEVRON  = `<svg viewBox="0 0 5 9" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M4.87781 4.78942L0.711611 8.88012C0.672902 8.91813 0.626949 8.94827 0.576374 8.96884C0.525799 8.98941 0.471593 9 0.416852 9C0.36211 9 0.307904 8.98941 0.257329 8.96884C0.206755 8.94827 0.160801 8.91813 0.122093 8.88012C0.0833846 8.84211 0.0526795 8.79699 0.0317308 8.74733C0.010782 8.69768 0 8.64445 0 8.5907C0 8.53695 0.010782 8.48373 0.0317308 8.43407C0.0526795 8.38441 0.0833846 8.33929 0.122093 8.30128L3.99406 4.5L0.122093 0.698715C0.043918 0.621957 0 0.51785 0 0.409298C0 0.300745 0.043918 0.196639 0.122093 0.11988C0.200268 0.0431223 0.306296 0 0.416852 0C0.527408 0 0.633436 0.0431223 0.711611 0.11988L4.87781 4.21058C4.91655 4.24857 4.94728 4.29369 4.96824 4.34335C4.98921 4.39301 5 4.44624 5 4.5C5 4.55376 4.98921 4.60699 4.96824 4.65665C4.94728 4.70631 4.91655 4.75143 4.87781 4.78942Z"/></svg>`;
const ICON_EXTERNAL = `<svg viewBox="0 0 10 10" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M8.33333 5.41667V9.16667C8.33333 9.38768 8.24554 9.59964 8.08926 9.75592C7.93297 9.9122 7.72101 10 7.5 10H0.833333C0.61232 10 0.400358 9.9122 0.244078 9.75592C0.0877973 9.59964 0 9.38768 0 9.16667V2.5C0 2.27899 0.0877973 2.06702 0.244078 1.91074C0.400358 1.75446 0.61232 1.66667 0.833333 1.66667H4.58333C4.69384 1.66667 4.79982 1.71057 4.87796 1.78871C4.9561 1.86685 5 1.97283 5 2.08333C5 2.19384 4.9561 2.29982 4.87796 2.37796C4.79982 2.4561 4.69384 2.5 4.58333 2.5H0.833333V9.16667H7.5V5.41667C7.5 5.30616 7.5439 5.20018 7.62204 5.12204C7.70018 5.0439 7.80616 5 7.91667 5C8.02717 5 8.13315 5.0439 8.21129 5.12204C8.28943 5.20018 8.33333 5.30616 8.33333 5.41667ZM10 0.416667C10 0.30616 9.9561 0.200179 9.87796 0.122039C9.79982 0.0438989 9.69384 0 9.58333 0H6.25C6.16754 -0.0000647615 6.08692 0.0243372 6.01834 0.0701166C5.94976 0.115896 5.8963 0.180995 5.86474 0.257171C5.83318 0.333347 5.82493 0.417176 5.84103 0.498045C5.85713 0.578913 5.89687 0.653185 5.95521 0.711458L7.3276 2.08333L5.12187 4.28854C5.04369 4.36672 4.99977 4.47276 4.99977 4.58333C4.99977 4.6939 5.04369 4.79994 5.12187 4.87813C5.20006 4.95631 5.3061 5.00023 5.41667 5.00023C5.52723 5.00023 5.63327 4.95631 5.71146 4.87813L7.91667 2.6724L9.28854 4.04479C9.34681 4.10313 9.42109 4.14287 9.50196 4.15897C9.58282 4.17507 9.66665 4.16682 9.74283 4.13526C9.81901 4.1037 9.8841 4.05024 9.92988 3.98166C9.97566 3.91308 10.0001 3.83246 10 3.75V0.416667Z"/></svg>`;
// estrela do favorito (F3) — fill via CSS (vazada quando off, sólida quando on)
const ICON_STAR     = `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.82l-5.8 3.04 1.11-6.46-4.7-4.58 6.49-.94L12 2.5z"/></svg>`;

// limite de caracteres da tag/subtag dentro do card: generoso, mas com
// reticências p/ nunca empurrar/cobrir os ícones do canto direito (o CSS
// trava a largura como rede de segurança; isto evita strings absurdas)
const TAG_MAX = 26;
function truncTag(s, max = TAG_MAX) {
  s = String(s || "");
  const t = s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
  return escHtml(t); // sempre vai pra innerHTML como texto de tag/subtag
}
function escAttr(s) { return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }
// escape de HTML p/ texto vindo de fonte externa (metadados scrapeados) antes de
// ir pra innerHTML — defesa contra XSS armazenado. Ver ADR 0002.
function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// favicon do site de origem — resolvido automaticamente pelo domínio (não
// hardcode de logo). item.url vem sem protocolo: "instagram.com/p/…"
function domainOf(url) { return String(url || "").replace(/^https?:\/\//, "").split("/")[0]; }
function faviconFor(url) {
  const d = domainOf(url);
  return d ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64` : "";
}

function cardHTML(item) {
  const catName = item.cat || "geral"; // rede de segurança: nunca .replace de undefined
  const cat = `<span class="card-cat cat-${catName.replace(/\s+/g, "-")}" title="${escAttr(catName)} — clique para trocar a tag">${truncTag(catName)}</span>`;
  const sub = item.subcat
    ? `<span class="card-sep" aria-hidden="true">${ICON_CHEVRON}</span><span class="card-subcat" title="${escAttr(item.subcat)}">${truncTag(item.subcat)}</span>`
    : "";
  // alça de drag — filho direto do card p/ ocupar toda a altura na grid compacta
  const dragHandle = `<span class="card-drag" aria-hidden="true">${ICON_DRAG}</span>`;
  // botão expandir/comprimir (só no compacto, via CSS) — ícone inicial = expandir
  const foldBtn = `<button class="card-fold" title="expandir / comprimir" aria-label="expandir ou comprimir">${ICON_EXPAND}</button>`;
  // F3: botão de favorito (estrela) — destaca e prioriza o item no topo do feed
  const favBtn = item.id
    ? `<button class="card-fav-btn${item.fav ? " is-on" : ""}" title="${item.fav ? "remover destaque" : "destacar"}" aria-label="destacar" aria-pressed="${item.fav ? "true" : "false"}">${ICON_STAR}</button>`
    : "";
  const top = `
    <div class="card-top">
      <span class="card-tags">${cat}${sub}</span>
      <span class="card-top-right">${favBtn}${foldBtn}<button class="card-del" title="excluir do vautch" aria-label="excluir">×</button></span>
    </div>`;

  let body = "";
  if (item.type === "note") {
    body = `<div class="note-body" title="${escAttr(item.text || "")}">${renderNote(item.text || "")}</div>`;
  } else if (item.type === "quote") {
    body = `<p class="card-quote" title="${escAttr(item.quote || "")}">${escHtml(item.quote)}</p><p class="card-body" style="margin-top:10px">${escHtml(item.body || "")}</p>`;
  } else if (item.type === "recipe") {
    body = `<h2 class="card-title">${escHtml(item.title)}</h2>
      <ul class="card-list">${(item.list || []).map(i => `<li>${escHtml(i)}</li>`).join("")}</ul>`;
  } else {
    const media = item.isPrivate
      ? `<div class="card-private-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>`
      : item.embed
        ? item.embed
        : item.image
          ? `<div class="card-thumb card-thumb-img"><img src="${escAttr(item.image)}" alt="" loading="lazy"></div>`
          : item.thumb ? `<div class="card-thumb ${item.thumb}"></div>` : "";
    const statParts = item.stats ? [
      item.stats.views    ? `<span title="visualizações">▶ ${item.stats.views}</span>` : "",
      item.stats.likes    ? `<span title="curtidas">♥ ${item.stats.likes}</span>` : "",
      item.stats.comments ? `<span title="comentários">✎ ${item.stats.comments}</span>` : ""
    ].filter(Boolean) : [];
    const stats = statParts.length ? `<div class="card-stats mono">${statParts.join("")}</div>` : "";
    // title= carrega o CONTEÚDO (tooltip do texto truncado no modo compacto, B3);
    // a instrução de ação vai pro aria-label (não compete com a descoberta do texto).
    const editable = item.id
      ? ` contenteditable="false" data-editable="true" aria-label="clique para renomear" title="${escAttr(item.title || "Sem título")}"`
      : "";
    const editableBody = item.id
      ? ` contenteditable="false" data-editable-body="true" aria-label="clique para editar a descrição" title="${escAttr(item.body || "")}"`
      : "";
    // miniatura usada só no modo compacto (poster do vídeo / print salvo)
    const cthumb = item.image
      ? `<div class="card-cthumb"><img src="${escAttr(item.image)}" alt="" loading="lazy"></div>`
      : "";
    body = `${media}${cthumb}
      <h2 class="card-title"${editable}>${escHtml(item.title || "Sem título")}</h2>
      <p class="card-body"${editableBody}>${escHtml(item.body || "")}</p>
      ${stats}`;
  }

  // favicon do site (canto inferior direito, ao lado de "abrir original")
  const fav = item.url
    ? `<img class="card-fav" src="${faviconFor(item.url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'">`
    : "";
  const action = item.type === "note"
    ? `<button class="note-edit card-link">editar</button>`
    : item.url
      ? `<a class="card-link" href="https://${escAttr(item.url)}" target="_blank" rel="noopener"><span class="card-link-ico">${ICON_EXTERNAL}</span>abrir original</a>`
      : "";
  const reportBtn = item.embed
    ? `<button class="card-report" title="reportar problema de visualização" aria-label="reportar">!</button>`
    : "";
  const footer = `
    <div class="card-footer">
      <span class="card-time">${escHtml(relativeTime(item))}</span>
      <div class="card-footer-right">${reportBtn}${action}${fav}</div>
    </div>`;

  return dragHandle + top + body + footer;
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
  const m = String(item.id || "").match(/^v(\d{13})$/); // epoch ms exato (13 díg.)
  return m ? Number(m[1]) : 0;
}

// época canônica do item em ms: o createdAt REAL (ISO, vindo do save ou do banco
// via GET) tem prioridade; senão cai pro epoch embutido no id "v<epoch>"; senão 0.
function itemEpoch(item) {
  if (item && item.createdAt) {
    const t = Date.parse(item.createdAt);
    if (!Number.isNaN(t)) return t;
  }
  return itemTimestamp(item);
}

// data relativa amigável (pt-BR) a partir da época canônica do item.
// Sem data válida → "" (não inventa "agora mesmo").
function relativeTime(item) {
  const ts = itemEpoch(item);
  if (!ts) return "";
  const MIN = 60000, HOUR = 3600000, DAY = 86400000;
  const diff = Math.max(0, Date.now() - ts);
  if (diff < MIN) return "guardado agora mesmo";
  if (diff < HOUR) return `há ${Math.floor(diff / MIN)} min`;
  if (diff < DAY) return `há ${Math.floor(diff / HOUR)} h`;
  if (diff < 2 * DAY) return "ontem";
  if (diff < 7 * DAY) return `há ${Math.floor(diff / DAY)} dias`;
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function makeCard(item, isNew = false) {
  const card = document.createElement("article");
  card.className = "card" + (isNew ? " is-new" : "");
  if (item.embed && item.embed.includes("embed-reel")) {
    card.classList.add("card-reel");
  }
  if (item.type === "note") card.classList.add("card-note");
  card.dataset.cat = item.cat;
  card.dataset.sub = item.subcat || "";
  card.dataset.id = item.id || "";
  // metadados p/ o sistema de filtros (tipo + período)
  card.dataset.type = item.type || "video";
  card.dataset.source = item.source || "";
  card.dataset.ts = itemEpoch(item);
  // texto pesquisável: só o conteúdo significativo (sem rótulos de UI)
  card.dataset.search = [item.title, item.body, item.text, item.quote, item.cat, sourceLabel(item.source), item.author]
    .filter(Boolean).join(" ");
  card.classList.toggle("is-fav", !!item.fav); // F3: destaque do favorito
  card.dataset.fav = item.fav ? "1" : "";
  card.innerHTML = cardHTML(item);

  // ---- EXPAND/COMPRIMIR card individual no modo compacto (animação de height) ----
  const foldBtn = card.querySelector(".card-fold");
  const toggleExpand = () => {
    const savedY = window.scrollY;            // B2: preserva o scroll
    const isExpanded = card.classList.contains("is-expanded");
    const from = card.offsetHeight;
    card.classList.toggle("is-expanded", !isExpanded);
    if (foldBtn) foldBtn.innerHTML = isExpanded ? ICON_EXPAND : ICON_COMPRESS;
    const to = card.offsetHeight;
    // B2: a troca grid→block (.is-expanded) força um reflow que, sem âncora de
    // scroll e com scroll-behavior:smooth, joga a página pro topo. Restaura a
    // posição instantaneamente (behavior auto) antes do paint da animação.
    if (window.scrollY !== savedY) {
      const prev = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, savedY);
      document.documentElement.style.scrollBehavior = prev;
    }
    if (!isExpanded) markSeen(item.id);   // F2d: expandir um card = interação
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
  const expandHandler = e => {
    if (viewMode !== "compact") return;
    if (e.target.closest("button, a, input, textarea, [contenteditable]")) return;
    toggleExpand();
  };
  if (isTouch) {
    card.addEventListener("click", expandHandler);
  } else {
    card.addEventListener("dblclick", expandHandler);
  }
  // botão dedicado de expandir/comprimir (funciona em qualquer dispositivo)
  if (foldBtn) {
    foldBtn.addEventListener("click", e => {
      e.stopPropagation();
      if (viewMode !== "compact") return;
      toggleExpand();
    });
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
        attachClear(ta); // U1: × pra limpar a nota inteira
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

  // F3: favoritar — realça o card na hora e o prioriza no topo no próximo render.
  // Persiste em item.fav (data jsonb, sem migração) via updateSavedField → sync.
  const favBtn = card.querySelector(".card-fav-btn");
  if (favBtn && item.id) {
    favBtn.addEventListener("click", e => {
      e.stopPropagation();
      item.fav = !item.fav;
      card.classList.toggle("is-fav", item.fav);
      card.dataset.fav = item.fav ? "1" : "";
      favBtn.classList.toggle("is-on", item.fav);
      favBtn.setAttribute("aria-pressed", item.fav ? "true" : "false");
      favBtn.title = item.fav ? "remover destaque" : "destacar";
      updateSavedField(item.id, "fav", item.fav);
      if (item.fav) attachFxCanvas(card); else detachFxCanvas(card); // F3
      markSeen(item.id);
    });
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
      // a lixeira vive em #filterActions (não em #filters) — buscar no
      // documento; guarda contra null caso o chip ainda não exista
      const chip = document.querySelector(".chip-trash");
      updateTrashChip();
      chip?.classList.add("is-gulping"); // só pisca em laranja
      setTimeout(() => chip?.classList.remove("is-gulping"), 600);
    }, 430);
    setTimeout(() => { card.remove(); updateCount(); renderCats(); applyFilter(); }, 740);
  });

  // título editável: clique para renomear, Enter/blur salva, Esc cancela
  const title = card.querySelector('[data-editable="true"]');
  if (title && item.id) {
    // .is-editing destrava o truncamento no modo compacto (B3) — sem isso o
    // usuário renomeia "às cegas" dentro de uma linha cortada com reticências.
    title.addEventListener("click", () => { title.contentEditable = "true"; title.classList.add("is-editing"); title.focus(); });
    title.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); title.blur(); }
      if (e.key === "Escape") { title.textContent = item.title; title.blur(); }
    });
    title.addEventListener("blur", () => {
      title.contentEditable = "false";
      title.classList.remove("is-editing");
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
  // F2d: dwell tracking — só itens do usuário (seeds não contam pro "esquecidos")
  if (item.id && !String(item.id).startsWith("seed-")) dwellObserver.observe(card);
  // F3: card favorito ganha a camada de partículas no fundo
  if (item.fav) attachFxCanvas(card);
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
// ordenação canônica ESTÁVEL: mais novo primeiro (época desc), com desempate
// determinístico por id. O desempate é o que conserta o "scramble": itens
// importados em lote têm created_at quase idêntico no banco → sem tie-break a
// ordem do Postgres é instável; o id "v<epoch>" desempata e recupera a cronologia.
function byEpochDesc(a, b) {
  if (!!b.fav !== !!a.fav) return (b.fav ? 1 : 0) - (a.fav ? 1 : 0); // F3: favoritos no topo
  const ea = itemEpoch(a), eb = itemEpoch(b);
  if (eb !== ea) return eb - ea;
  return String(b.id || "").localeCompare(String(a.id || ""));
}

// aplica a ordem manual do usuário (vault.order, salva no drag do modo compacto)
// quando existir; itens fora dela (novos) sobem pro topo por época. Sem ordem
// manual, cai no byEpochDesc puro. Religa o saveOrder, que hoje é órfão no render.
function orderedUserItems(items) {
  const order = loadOrder();
  if (!order.length) return [...items].sort(byEpochDesc);
  const pos = new Map(order.map((id, i) => [id, i]));
  return [...items].sort((a, b) => {
    const pa = pos.has(a.id) ? pos.get(a.id) : -1;
    const pb = pos.has(b.id) ? pos.get(b.id) : -1;
    if (pa === -1 && pb === -1) return byEpochDesc(a, b);
    if (pa === -1) return -1; // novo (fora da ordem salva) → topo
    if (pb === -1) return 1;
    return pa - pb;
  });
}

// + exemplos não excluídos, com a categoria possivelmente corrigida
function currentItems() {
  const deleted = loadDeleted();
  const catOv = loadCatOverrides();
  const subOv = loadSubOverrides();
  const titleOv = loadJSON("vault.titleov", {});
  const bodyOv = loadJSON("vault.bodyov", {});
  const userItems = loadSaved().map(i => ({ ...i, day: "hoje" }));
  const seeds = VAULT_ITEMS
    .map((i, idx) => ({ ...i, id: `seed-${idx}` }))
    .map(i => catOv[i.id] ? { ...i, cat: catOv[i.id] } : i)
    .map(i => subOv[i.id] ? { ...i, subcat: subOv[i.id] } : i)
    .map(i => titleOv[i.id] !== undefined ? { ...i, title: titleOv[i.id] } : i)
    .map(i => bodyOv[i.id] !== undefined ? { ...i, body: bodyOv[i.id] } : i)
    .filter(i => !deleted.includes(i.id));
  return [...orderedUserItems(userItems), ...seeds];
}

// P1: placeholders animados enquanto loadFromServer não resolve. buildFeed()
// faz feed.innerHTML="" ao terminar, então os skeletons somem sem limpeza extra.
function renderSkeletons(n = 6) {
  if (!feed) return;
  const one = `<article class="card skeleton" aria-hidden="true"><div class="sk-thumb"></div><div class="sk-line"></div><div class="sk-line short"></div></article>`;
  feed.innerHTML = one.repeat(n);
}

// ---- P2: render paginado + infinite scroll ----
// Carrega FEED_PAGE itens por vez (inicial + a cada scroll), em vez de criar
// 50+ cards/iframes numa tacada. Reduz drasticamente o custo de render inicial.
const FEED_PAGE = 10;
let _feedItems = [];       // lista ordenada completa (fonte do render)
let _feedRendered = 0;     // quantos cards já estão no DOM
let _feedLastDay = null;   // marcador de dia, preservado entre páginas
let _feedSentinel = null;  // elemento observado no fim do feed
let _feedObserver = null;  // IntersectionObserver do infinite scroll

// renderiza as próximas n entradas de _feedItems (sempre ANTES do sentinel).
function renderPage(n) {
  const slice = _feedItems.slice(_feedRendered, _feedRendered + n);
  let delay = 0;
  for (const item of slice) {
    if (item.day !== _feedLastDay) {
      const mark = document.createElement("div");
      mark.className = "daymark";
      mark.innerHTML = `<span>${item.day}</span>`;
      mark.dataset.day = item.day;
      feed.insertBefore(mark, _feedSentinel);
      _feedLastDay = item.day;
    }
    const card = makeCard(item);
    card.style.animationDelay = `${0.04 + delay * 0.05}s`; // delay resetado por página
    feed.insertBefore(card, _feedSentinel);
    delay++;
  }
  _feedRendered += slice.length;
  if (_feedRendered >= _feedItems.length && _feedSentinel) {
    _feedObserver?.disconnect();
    _feedSentinel.remove();
    _feedSentinel = null;
  }
}

// força renderizar todo o resto — usado quando há filtro/busca ativos ou drag
// (esses casos precisam enxergar TODOS os itens, não só a página atual).
function renderAllRemaining() {
  // só roda no feed paginado normal: se o sentinel não está no DOM (ex.: lixeira
  // fez feed.innerHTML=""), não há feed pra completar — sai sem quebrar o insertBefore.
  if (!_feedSentinel || !_feedSentinel.isConnected) return;
  if (_feedRendered < _feedItems.length) renderPage(_feedItems.length - _feedRendered);
}

// ---- F1/F2: blocos "home" acima do feed ----
const _lastSeenAtLoad = Number(localStorage.getItem("vault.lastSeen") || 0);
let rememberOpen = false; // o carrossel "relembre" é sob demanda (botão na filterbar)

// estamos na visão padrão (sem categoria/subtag/busca/filtro e fora da lixeira)?
function homeView() {
  return activeCat === "tudo" && !activeSub && !searchQuery.trim() && !filtersActive();
}

// representação compacta (SEM iframe) p/ os blocos home: thumb/favicon + título.
// Clicável → maximiza NO APP (data-id; o handler do track resolve o item).
function homeCardHTML(item) {
  // imagem manda no thumb; sem imagem, NOTA mostra o próprio texto (clamp);
  // senão favicon do link; senão o ✦.
  const noteText = (item.type === "note" || item.type === "quote") ? (item.text || item.quote || "") : "";
  let thumb;
  if (item.image) thumb = `<img src="${escAttr(item.image)}" alt="" loading="lazy">`;
  else if (noteText) thumb = `<span class="home-note">${escHtml(noteText)}</span>`;
  else if (item.url) thumb = `<img class="home-favi" src="${faviconFor(item.url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">`;
  else thumb = `<span class="home-ph">✦</span>`;
  const full = item.title || item.text || item.quote || "Sem título";
  return `<button type="button" class="home-card" data-id="${escAttr(item.id || "")}">`
    + `<div class="home-thumb${noteText && !item.image ? " home-thumb-note" : ""}">${thumb}</div>`
    + `<span class="home-card-title" title="${escAttr(full)}">${escHtml(full)}</span></button>`;
}

// drag-to-scroll com o mouse (desktop) — o touch já rola nativo com o dedo.
// O flag `moved` evita que um arraste vire um clique de "maximizar".
function initTrackDrag(track) {
  if (!track) return;
  let startX = 0, startScroll = 0, moved = false;
  const onMove = e => {
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) moved = true;
    track.scrollLeft = startScroll - dx;
  };
  const onUp = () => {
    track.classList.remove("is-grabbing");
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    setTimeout(() => { track._suppressClick = moved; }, 0);
  };
  track.addEventListener("mousedown", e => {
    startX = e.clientX; startScroll = track.scrollLeft; moved = false;
    track.classList.add("is-grabbing");
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });
}

// liga drag + clique-pra-maximizar num bloco home
function wireHomeTrack(sectionEl) {
  const track = sectionEl.querySelector(".home-track");
  if (!track) return;
  initTrackDrag(track);
  track.addEventListener("click", e => {
    if (track._suppressClick) { track._suppressClick = false; return; } // veio de um drag
    const card = e.target.closest(".home-card");
    if (!card || !card.dataset.id) return;
    const saved = loadSaved();
    // F2c: lista navegável = os cards já revelados no track, na ordem exibida
    const ids = [...track.querySelectorAll(".home-card")].map(c => c.dataset.id);
    const list = ids.map(id => saved.find(i => i.id === id)).filter(Boolean);
    const idx = ids.indexOf(card.dataset.id);
    if (list.length) openCardMax(list[Math.max(0, idx)], list, idx);
  });
}

// conteúdo (read-only) de UM card maximizado
function cardMaxInner(item) {
  const media = item.embed
    ? item.embed
    : item.image ? `<div class="card-thumb card-thumb-img"><img src="${escAttr(item.image)}" alt=""></div>` : "";
  const title = item.title ? `<h2 class="card-title">${escHtml(item.title)}</h2>` : "";
  const body = item.type === "note" ? `<div class="note-body">${renderNote(item.text || "")}</div>`
    : item.type === "quote" ? `<p class="card-quote">${escHtml(item.quote || "")}</p>`
    : item.body ? `<p class="card-body">${escHtml(item.body)}</p>` : "";
  const link = item.url
    ? `<a class="card-link" href="https://${escAttr(item.url)}" target="_blank" rel="noopener"><span class="card-link-ico">${ICON_EXTERNAL}</span>abrir original</a>`
    : "";
  return `<article class="card card-max-card${item.fav ? " is-fav" : ""}">${media}${title}${body}<div class="card-max-foot">${link}</div></article>`;
}

// maximiza um item NO APP (overlay), sem ir pro link externo. Read-only.
// F2c: com uma LISTA (ex.: o relembre), permite NAVEGAR arrastando pros lados —
// os vizinhos espiam esmaecidos nas bordas — sem sair do maximizado.
function openCardMax(item, list, index) {
  if (!item) return;
  const items = (Array.isArray(list) && list.length) ? list : [item];
  let idx = (typeof index === "number" && index >= 0) ? index : items.findIndex(i => i && i.id === item.id);
  if (idx < 0) idx = 0;

  const ov = document.createElement("div");
  ov.className = "card-max-overlay" + (items.length > 1 ? " has-deck" : "");
  const slides = items.map(it => `<div class="card-max-slide">${cardMaxInner(it)}</div>`).join("");
  const navBtns = items.length > 1
    ? `<button class="card-max-nav card-max-prev" aria-label="anterior">‹</button>`
      + `<button class="card-max-nav card-max-next" aria-label="próximo">›</button>`
    : "";
  ov.innerHTML = `<button class="card-max-close" aria-label="fechar">×</button>`
    + navBtns
    + `<div class="card-max-viewport"><div class="card-max-deck">${slides}</div></div>`;
  document.body.appendChild(ov);

  const viewport = ov.querySelector(".card-max-viewport");
  const deck = ov.querySelector(".card-max-deck");
  const slideEls = [...deck.querySelectorAll(".card-max-slide")];

  // F3: o efeito de partículas também no card maximizado (favoritos)
  slideEls.forEach((s, i) => { if (items[i] && items[i].fav) attachFxCanvas(s.querySelector(".card-max-card")); });

  // desloca o deck pra centralizar o slide `i` no viewport (vizinhos espiam)
  function centerOffset(i) {
    const s = slideEls[i];
    return viewport.clientWidth / 2 - (s.offsetLeft + s.offsetWidth / 2);
  }
  let baseX = 0;
  const markView = i => { const it = items[i]; if (it) markSeen(it.id); }; // F2d
  function go(i, animate = true) {
    idx = Math.max(0, Math.min(items.length - 1, i));
    baseX = centerOffset(idx);
    deck.style.transition = animate ? "transform .34s cubic-bezier(.2,.85,.25,1)" : "none";
    deck.style.transform = `translateX(${baseX}px)`;
    slideEls.forEach((s, k) => s.classList.toggle("is-active", k === idx));
    ov.querySelector(".card-max-prev")?.classList.toggle("is-disabled", idx === 0);
    ov.querySelector(".card-max-next")?.classList.toggle("is-disabled", idx === items.length - 1);
    if (animate) markView(idx);   // navegação do usuário conta como "visto" (resize não)
    fitReels();
  }

  // arraste horizontal (mouse + touch). Detecta o eixo pra não brigar com o
  // scroll vertical de dentro do slide.
  let startX = 0, startY = 0, dragging = false, moved = false, axis = null;
  function down(x, y) { dragging = true; moved = false; axis = null; startX = x; startY = y; deck.classList.add("is-grabbing"); deck.style.transition = "none"; }
  function move(x, y) {
    if (!dragging) return;
    const dx = x - startX, dy = y - startY;
    if (!axis && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (axis === "y") return;                       // deixa o slide rolar na vertical
    if (Math.abs(dx) > 4) moved = true;
    deck.style.transform = `translateX(${baseX + dx}px)`;
  }
  function up(x) {
    if (!dragging) return;
    dragging = false; deck.classList.remove("is-grabbing");
    const dx = x - startX;
    const TH = Math.min(90, viewport.clientWidth * 0.18);
    if (axis !== "y" && dx <= -TH && idx < items.length - 1) go(idx + 1);
    else if (axis !== "y" && dx >= TH && idx > 0) go(idx - 1);
    else go(idx);
  }
  if (items.length > 1) {
    // arraste em QUALQUER lugar da tela (o overlay cobre tudo) — desktop e mobile.
    // Ignora os controles (setas/fechar/link) pra eles funcionarem no clique.
    ov.addEventListener("mousedown", e => {
      if (e.target.closest("button, a")) return;
      e.preventDefault(); down(e.clientX, e.clientY);
      const mm = ev => move(ev.clientX, ev.clientY);
      const mu = ev => { up(ev.clientX); removeEventListener("mousemove", mm); removeEventListener("mouseup", mu); };
      addEventListener("mousemove", mm); addEventListener("mouseup", mu);
    });
    ov.addEventListener("touchstart", e => down(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    ov.addEventListener("touchmove", e => move(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    ov.addEventListener("touchend", e => up((e.changedTouches[0] || {}).clientX ?? startX));

    // roda do mouse vira navegação LATERAL enquanto o maximizado está aberto
    // (ao fechar, o listener morre junto com o overlay → volta o scroll da timeline).
    let wheelLock = false;
    ov.addEventListener("wheel", e => {
      e.preventDefault();
      if (wheelLock) return;
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(d) < 8) return;
      go(idx + (d > 0 ? 1 : -1));
      wheelLock = true; setTimeout(() => { wheelLock = false; }, 360);
    }, { passive: false });

    ov.querySelector(".card-max-prev").addEventListener("click", () => go(idx - 1));
    ov.querySelector(".card-max-next").addEventListener("click", () => go(idx + 1));
  }

  const esc = ev => {
    if (ev.key === "Escape") close();
    else if (items.length > 1 && ev.key === "ArrowRight") go(idx + 1);
    else if (items.length > 1 && ev.key === "ArrowLeft") go(idx - 1);
  };
  function close() { ov.remove(); removeEventListener("keydown", esc); window.removeEventListener("resize", onResize); }
  const onResize = () => go(idx, false);
  ov.addEventListener("click", e => {
    if (moved) { moved = false; return; }            // um arraste não fecha o overlay
    if (e.target === ov || e.target === viewport || e.target === deck || e.target.closest(".card-max-close")) close();
  });
  addEventListener("keydown", esc);
  window.addEventListener("resize", onResize);

  requestAnimationFrame(() => { go(idx, false); markView(idx); }); // posição + marca o slide inicial
  fitReels();
}

// F1/F1b: "bem-vindo de volta" vira PÍLULA de notificação (não mais o carrossel
// igual ao relembre): texto + "visualizar" (aplica o filtro de período "última
// visita") + × pra fechar. Só aparece se a visita foi há > 2h e há itens novos.
let _morningDismissed = false;

function freshSinceLastSeen() {
  const old = _lastSeenAtLoad;
  if (!(old && Date.now() - old > 2 * 3600000)) return [];
  return loadSaved().filter(i => itemEpoch(i) > old).sort(byEpochDesc);
}

function renderMorningReminder() {
  const el = document.getElementById("morningReminder");
  if (!el) return;
  const fresh = freshSinceLastSeen();
  if (!fresh.length) { el.hidden = true; el.innerHTML = ""; el.classList.remove("morning-pill"); return; }
  const n = fresh.length;
  el.classList.add("morning-pill");
  el.innerHTML = `<span class="pill-dot" aria-hidden="true">✦</span>`
    + `<span class="pill-text"><strong>Bem-vindo de volta:</strong> ${n} ${n === 1 ? "coisa nova" : "coisas novas"} desde a última visita.</span>`
    + `<button type="button" class="pill-view">Visualizar</button>`
    + `<button type="button" class="pill-close" aria-label="fechar">×</button>`;
  if (!el._wired) {
    el._wired = true;
    el.addEventListener("click", e => {
      if (e.target.closest(".pill-view")) showLastVisit();
      else if (e.target.closest(".pill-close")) { _morningDismissed = true; el.hidden = true; }
    });
  }
  el.hidden = !homeView() || _morningDismissed;
}

// F1b: o "visualizar" da pílula liga o filtro de período "última visita" — a
// timeline passa a mostrar só o que foi guardado desde a visita anterior.
function showLastVisit() {
  filterPeriod = "lastvisit";
  _morningDismissed = true;
  renderCats();          // reflete o chip "filtrar" ativo
  applyFilter();         // updateHomeBlocks() esconde a pílula (homeView() = false)
  document.getElementById("feed")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// F2/F2b: carrossel "relembre" — sob demanda (botão). Paginação: carrega 5 e
// puxa +5 ao arrastar/rolar até o fim, máximo 20 (não despeja tudo de uma vez).
const REMEMBER_PAGE = 5;
const REMEMBER_MAX = 20;
let _rememberPool = [];   // candidatos já ordenados (fonte do render)
let _rememberShown = 0;   // quantos cards já estão no track

// F2d: ordem dos candidatos do relembre = os "esquecidos". Antes era aleatório;
// agora prioriza quem você NÃO viu há mais tempo (ou nunca), com desempate pelo
// item mais antigo. Usa o tracking de interação (vault.seen).
function rememberCandidates(all) {
  const seen = loadSeen();
  const lastSeenOf = it => { const r = seen[it.id]; return r && r.lastSeen ? r.lastSeen : 0; };
  return [...all].sort((a, b) => {
    const la = lastSeenOf(a), lb = lastSeenOf(b);
    if (la !== lb) return la - lb;            // menos recentemente visto (0 = nunca) primeiro
    return itemEpoch(a) - itemEpoch(b);       // empate: o mais antigo primeiro
  }).slice(0, REMEMBER_MAX);
}

// adiciona a próxima página de cards ao fim do track (sem recriar os existentes)
function appendRememberPage(track) {
  const slice = _rememberPool.slice(_rememberShown, _rememberShown + REMEMBER_PAGE);
  track.insertAdjacentHTML("beforeend", slice.map(homeCardHTML).join(""));
  _rememberShown += slice.length;
}

function renderRememberCarousel() {
  const el = document.getElementById("rememberCarousel");
  if (!el) return;
  const all = loadSaved();
  if (!rememberOpen || all.length < 5) { el.hidden = true; el.innerHTML = ""; return; }
  _rememberPool = rememberCandidates(all);
  _rememberShown = 0;
  el.innerHTML = `<div class="home-head"><span class="home-title">relembre</span>`
    + `<span class="home-sub">toque num card pra ver aqui</span></div>`
    + `<div class="home-track"></div>`;
  const track = el.querySelector(".home-track");
  appendRememberPage(track);
  wireHomeTrack(el);
  // paginação: ao arrastar/rolar perto do fim, revela mais (até REMEMBER_MAX).
  // o drag (initTrackDrag) mexe em scrollLeft → dispara este mesmo evento.
  track.addEventListener("scroll", () => {
    if (_rememberShown >= _rememberPool.length) return;
    if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 140) appendRememberPage(track);
  }, { passive: true });
  el.hidden = false;
}

// alterna a visibilidade dos blocos: morning segue a home view; remember segue o botão
function updateHomeBlocks() {
  const mr = document.getElementById("morningReminder");
  if (mr) mr.hidden = !homeView() || !mr.innerHTML.trim() || _morningDismissed;
  const rc = document.getElementById("rememberCarousel");
  if (rc) rc.hidden = !rememberOpen || !rc.innerHTML.trim();
}

function buildFeed() {
  if (_feedObserver) _feedObserver.disconnect();
  feed.innerHTML = "";
  _feedLastDay = null;
  _feedRendered = 0;
  _feedItems = currentItems();

  _feedSentinel = document.createElement("div");
  _feedSentinel.className = "feed-sentinel";
  _feedSentinel.setAttribute("aria-hidden", "true");
  feed.appendChild(_feedSentinel);
  _feedObserver = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting) && _feedRendered < _feedItems.length) renderPage(FEED_PAGE);
  }, { rootMargin: "700px 0px" }); // pré-carrega antes de chegar no fim
  _feedObserver.observe(_feedSentinel);

  renderPage(FEED_PAGE);
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
  // mantém o fundo inline do <html> em sincronia com o tema. Esse fundo existe
  // p/ evitar flash branco antes do CSS carregar; se NÃO atualizar aqui, ao
  // trocar de tema ele fica preso na cor antiga e vaza como faixa atrás do body.
  document.documentElement.style.background = (t === "dark" ? "#131316" : "#f4efe6");
}

themeToggle.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
  fxRebuildAll(); // F3: o efeito usa o config do tema ativo (cor/geometria próprias)
});

// default é "light" (primeiro acesso entra em claro). O tema salvo já foi
// aplicado por um script inline no <head>/<body> antes do paint (sem flash);
// aqui só sincronizamos o estado em runtime.
applyTheme(localStorage.getItem(THEME_KEY) || "light");

// devolve as transições depois do 1º paint (ver .theme-init no CSS). Dois rAFs
// cobrem o caso normal; o setTimeout é fallback p/ ambientes onde o rAF não
// dispara (aba sem paint) — senão as transições ficariam travadas pra sempre.
function clearThemeInit() { document.documentElement.classList.remove("theme-init"); }
requestAnimationFrame(() => requestAnimationFrame(clearThemeInit));
setTimeout(clearThemeInit, 120);

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

/* ---------- F3: partículas no FUNDO dos favoritos (2D canvas por card) ----------
   Cada favorito ganha um <canvas> 2D como filho com z-index:-1 → pinta SOBRE o
   fundo do card mas ATRÁS de todo o conteúdo (tag, embed, ícones, título). Canvas
   2D não tem o limite de ~16 contextos do WebGL, então um por card é seguro e um
   favorito não interfere no outro. Tudo controlável pelo painel (vault.fxconfig). */
const FX_KEY = "vault.fxconfig";
// Config por tema. Concentração MÁXIMA no topo, dissipando pra baixo (menos
// quantidade + mais apagado); `feather` suaviza a borda da máscara (nunca as
// shapes); `topLight` clareia a cor em direção ao topo (sem chegar a branco).
// Defaults = valores afinados pelo Paulo nos sliders.
const FX_DEFAULTS = {
  dark:  { on: 1, density: 92, size: 1.4, opacity: 0.27, intensity: 0.22, speed: 2.75, waveScale: 18, zoneTop: 0, zoneHeight: 12, sides: 0, feather: 1, topLight: 0.28, color: "#ff7433" },
  light: { on: 1, density: 91, size: 2.7, opacity: 0.17, intensity: 0.03, speed: 4, waveScale: 1, zoneTop: 0, zoneHeight: 19, sides: 0, feather: 0.65, topLight: 0, color: "#ff7433" },
};
// NÃO usar loadJSON aqui: este módulo roda ANTES de loadJSON inicializar (const,
// mais abaixo) → TDZ travaria o init. Config é POR TEMA (dark/claro), cada um com
// sua cor; o efeito usa sempre o config do tema ativo.
let fxConfigs = (() => {
  const def = { dark: { ...FX_DEFAULTS.dark }, light: { ...FX_DEFAULTS.light } };
  try {
    const s = JSON.parse(localStorage.getItem(FX_KEY) || "{}");
    return { dark: { ...def.dark, ...(s.dark || {}) }, light: { ...def.light, ...(s.light || {}) } };
  } catch { return def; }
})();
function fxTheme() { return document.documentElement.dataset.theme === "dark" ? "dark" : "light"; }
function fxCur() { return fxConfigs[fxTheme()]; }
function fxSave() { localStorage.setItem(FX_KEY, JSON.stringify(fxConfigs)); }
function fxHexToRgb(h) {
  const m = String(h).match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m ? `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}` : "212,73,15";
}
const _fxEntries = new Map();   // card -> { canvas, ctx, pts, w, h, ro }
const _fxVisible = new WeakSet();
let _fxRAF = 0;

const _fxIO = new IntersectionObserver(ents => {
  ents.forEach(e => { if (e.isIntersecting) _fxVisible.add(e.target); else _fxVisible.delete(e.target); });
}, { rootMargin: "120px" });

function fxSmoothstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

// peso do ponto (0..1): MÁXIMO no topo, dissipando pra baixo (suave, com `feather`
// alargando a transição = "blur" da máscara). `sides` adiciona um leve abraço nas
// laterais. fx/fy normalizados (0..1) no card.
function fxWeight(fx, fy, cfg) {
  const top = cfg.zoneTop / 100;
  const reach = Math.max(0.01, cfg.zoneHeight / 100);
  const feather = Math.max(0, cfg.feather ?? 0.3);
  const vy = (fy - top) / reach;                 // 0 no início da zona, 1 no fim
  // vertical: 1 → 0, com a borda suavizada pelo feather (alarga a cauda)
  const vw = vy <= 0 ? 1 : 1 - fxSmoothstep(0, 1 + feather * 2, vy);
  // laterais: leve reforço perto das bordas L/R (também suavizado)
  const sr = (cfg.sides || 0) / 100;
  let sw = 0;
  if (sr > 0.001) sw = Math.max(1 - fxSmoothstep(0, sr * (1 + feather), fx), 1 - fxSmoothstep(0, sr * (1 + feather), 1 - fx));
  return Math.max(0, Math.min(1, Math.max(vw, sw * 0.85)));
}

// grade jitterada; a CONCENTRAÇÃO cai com o peso (thinning probabilístico) → mais
// denso no topo, rareando pra baixo. Guarda o peso `w` (usado no alpha e na cor).
function fxBuildPoints(entry) {
  const { w, h } = entry;
  if (!w || !h) { entry.pts = []; return; }
  const cfg = fxCur();
  const spacing = Math.max(2.6, 16 - (cfg.density / 100) * 13.2); // densidade ↑ → espaçamento ↓
  const cols = Math.max(1, Math.floor(w / spacing));
  const rows = Math.max(1, Math.floor(h / spacing));
  const jit = spacing * 0.3;                     // jitter baixo → quadrados não se empilham
  const pts = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * (w / cols) + (Math.random() - 0.5) * jit;
      const y = (r + 0.5) * (h / rows) + (Math.random() - 0.5) * jit;
      const wt = fxWeight(x / w, y / h, cfg);
      if (wt <= 0.02) continue;                  // fora da zona → nem guarda (perf)
      if (Math.random() > 0.15 + 0.85 * wt) continue; // menos quantidade onde o peso é menor
      pts.push({ x, y, w: wt, ph: Math.random() * Math.PI * 2 });
    }
  }
  entry.pts = pts;
}

function fxResize(card, entry) {
  const rect = card.getBoundingClientRect();
  const w = Math.round(rect.width), h = Math.round(rect.height);
  if (!w || !h) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  entry.w = w; entry.h = h;
  entry.canvas.width = Math.round(w * dpr); entry.canvas.height = Math.round(h * dpr);
  entry.canvas.style.width = w + "px"; entry.canvas.style.height = h + "px";
  entry.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fxBuildPoints(entry);
}

function fxRebuildAll() { _fxEntries.forEach((en, card) => fxResize(card, en)); }

function attachFxCanvas(card) {
  if (!card || _fxEntries.has(card)) return;
  const canvas = document.createElement("canvas");
  canvas.className = "fav-fx";
  canvas.setAttribute("aria-hidden", "true");
  card.insertBefore(canvas, card.firstChild);
  const entry = { canvas, ctx: canvas.getContext("2d"), pts: [], w: 0, h: 0, ro: null };
  _fxEntries.set(card, entry);
  fxResize(card, entry);
  // o card pode ainda não ter layout (makeCard cria antes de inserir no feed) →
  // rebuild no próximo frame garante medir o tamanho real, sem depender só do RO.
  requestAnimationFrame(() => { if (_fxEntries.has(card)) fxResize(card, entry); });
  entry.ro = new ResizeObserver(() => fxResize(card, entry));
  entry.ro.observe(card);
  _fxIO.observe(card);
  fxEnsureLoop();
}

function detachFxCanvas(card) {
  const e = _fxEntries.get(card);
  if (!e) return;
  e.ro?.disconnect();
  _fxIO.unobserve(card);
  _fxVisible.delete(card);
  e.canvas.remove();
  _fxEntries.delete(card);
}

function fxDraw(tMs) {
  const t = tMs / 1000;
  const cfg = fxCur();
  const { size, opacity, intensity, speed, waveScale, on } = cfg;
  const topLight = Math.max(0, Math.min(1, cfg.topLight ?? 0));
  const rgb = fxHexToRgb(cfg.color).split(",").map(Number);
  const half = size / 2;
  for (const card of [..._fxEntries.keys()]) {
    const e = _fxEntries.get(card);
    if (!card.isConnected) { detachFxCanvas(card); continue; }   // card saiu do DOM (rebuild)
    const ctx = e.ctx;
    ctx.clearRect(0, 0, e.w, e.h);
    ctx.shadowBlur = 0; ctx.shadowColor = "transparent";         // shapes SEMPRE nítidas
    // PERF: só desenha favoritos DENTRO da viewport (offscreen = não processa)
    if (!on || !_fxVisible.has(card) || !e.pts.length) continue;
    for (const p of e.pts) {
      const nx = p.x / e.w;
      const wave = Math.sin(t * speed + nx * waveScale + (p.y / e.h) * waveScale * 0.5 + p.ph);
      let lit = 0.5 + 0.5 * wave;
      lit = Math.pow(lit, 1 + intensity * 4);     // intensidade afia o acende/apaga
      const a = opacity * lit * p.w;              // p.w = peso (concentração/opacidade caem pra baixo)
      if (a < 0.015) continue;
      // cor clareia em direção ao topo (peso alto), sem chegar a branco (teto 0.85)
      const k = Math.min(0.85, topLight * p.w);
      const cr = (rgb[0] + (255 - rgb[0]) * k) | 0;
      const cg = (rgb[1] + (255 - rgb[1]) * k) | 0;
      const cb = (rgb[2] + (255 - rgb[2]) * k) | 0;
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${a.toFixed(3)})`;
      ctx.fillRect(p.x - half, p.y - half, size, size);   // QUADRADINHOS nítidos
    }
  }
  _fxRAF = _fxEntries.size ? requestAnimationFrame(fxDraw) : 0;
}

function fxEnsureLoop() {
  if (!_fxRAF && _fxEntries.size) _fxRAF = requestAnimationFrame(fxDraw);
}

// painel de controle (tuning) — DOIS conjuntos (modo escuro / claro), com cor.
// Persistido em vault.fxconfig. Ferramenta de ajuste: esconder antes de produção.
function buildFxPanel() {
  if (document.getElementById("fxPanel")) return;
  const fields = [
    ["on", "ligado", 0, 1, 1], ["density", "densidade", 10, 100, 1],
    ["size", "tamanho", 0.5, 8, 0.1], ["opacity", "opacidade", 0, 1, 0.01],
    ["intensity", "intensidade", 0, 1, 0.01], ["speed", "velocidade", 0, 4, 0.05],
    ["waveScale", "onda (escala)", 1, 24, 0.5], ["zoneTop", "zona: topo %", 0, 60, 1],
    ["zoneHeight", "zona: altura %", 2, 100, 1], ["sides", "laterais %", 0, 50, 1],
    ["feather", "suavizar borda", 0, 1, 0.01], ["topLight", "clarear topo", 0, 1, 0.01],
  ];
  let editMode = fxTheme();   // qual config estamos ajustando (default = tema atual)
  const wrap = document.createElement("div");
  wrap.id = "fxPanel";
  wrap.innerHTML = `<button class="fx-toggle" title="ajustar o efeito dos favoritos">✦ fx</button>
    <div class="fx-body" hidden>
      <div class="fx-head mono">efeito dos favoritos</div>
      <div class="fx-tabs">
        <button class="fx-tab" data-mode="dark">🌙 escuro</button>
        <button class="fx-tab" data-mode="light">☀️ claro</button>
      </div>
      <label class="fx-row fx-color"><span>cor</span><input type="color" data-fx="color"></label>
      ${fields.map(([k, l, mn, mx, st]) => `<label class="fx-row"><span>${l} <em data-fxval="${k}"></em></span>
        <input type="range" data-fx="${k}" min="${mn}" max="${mx}" step="${st}"></label>`).join("")}
      <div class="fx-acts"><button class="fx-reset">padrão deste tema</button><button class="fx-copy">copiar JSON</button></div>
    </div>`;
  document.body.appendChild(wrap);
  const body = wrap.querySelector(".fx-body");

  const refresh = () => {
    const cfg = fxConfigs[editMode];
    wrap.querySelectorAll(".fx-tab").forEach(t => t.classList.toggle("is-active", t.dataset.mode === editMode));
    wrap.querySelectorAll("[data-fx]").forEach(i => {
      const k = i.dataset.fx;
      i.value = cfg[k];
      const em = wrap.querySelector(`[data-fxval="${k}"]`);
      if (em) em.textContent = cfg[k];
    });
  };
  refresh();

  wrap.querySelector(".fx-toggle").addEventListener("click", () => { body.hidden = !body.hidden; });
  wrap.querySelectorAll(".fx-tab").forEach(t => t.addEventListener("click", () => { editMode = t.dataset.mode; refresh(); }));
  wrap.addEventListener("input", e => {
    const inp = e.target.closest("[data-fx]"); if (!inp) return;
    const k = inp.dataset.fx;
    const v = inp.type === "color" ? inp.value : parseFloat(inp.value);
    fxConfigs[editMode][k] = v;
    const em = wrap.querySelector(`[data-fxval="${k}"]`);
    if (em) em.textContent = v;
    fxSave();
    if (editMode === fxTheme() && (k === "density" || k === "zoneTop" || k === "zoneHeight" || k === "sides" || k === "feather")) fxRebuildAll();
    fxEnsureLoop();
  });
  wrap.querySelector(".fx-reset").addEventListener("click", () => {
    fxConfigs[editMode] = { ...FX_DEFAULTS[editMode] };
    fxSave(); refresh();
    if (editMode === fxTheme()) fxRebuildAll();
    fxEnsureLoop();
  });
  wrap.querySelector(".fx-copy").addEventListener("click", () => {
    navigator.clipboard?.writeText(JSON.stringify(fxConfigs));
    showToast("valores do efeito (dark+claro) copiados");
  });
}


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
  // P2: com filtro/busca ativos, renderiza TODO o resto antes de filtrar — senão
  // o filtro só enxergaria a página já carregada e esconderia matches ainda não
  // renderizados. Sem filtro, a paginação segue intacta (ganho no load inicial).
  // Na lixeira (__trash) NÃO renderiza — o #feed é a view da lixeira, não o feed paginado.
  if (activeCat !== "__trash" && (q || activeCat !== "tudo" || activeSub || filtersActive() || filterFav)) renderAllRemaining();
  const cards = feed.querySelectorAll(".card");
  cards.forEach(c => {
    const byCat = activeCat !== "tudo" && c.dataset.cat !== activeCat;
    const bySub = activeSub && (c.dataset.sub || "") !== activeSub;
    const byText = q && !matchesSearch(c.dataset.search || c.textContent, q);
    const byType = !passesType(c);
    const byPeriod = !passesPeriod(c);
    const byFav = filterFav && !c.classList.contains("is-fav"); // botão prioridade
    c.classList.toggle("is-hidden", byCat || bySub || byText || byType || byPeriod || byFav);
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
  updateHomeBlocks(); // F1/F2: blocos home só na visão padrão
}

let catsExpanded = false;        // "mais" revela todas as categorias
const CAT_CAP = 4;               // quantas categorias mostrar antes do "mais"

// ---- modo de visualização + filtros (tipo / período) ----
const VIEW_KEY = "vault.view";
let viewMode = localStorage.getItem(VIEW_KEY) || "full"; // "full" | "compact"
let filterType = "all";          // all | video | note | image
let filterPeriod = "all";        // all | today | week | month
let filterFav = false;           // botão de prioridade: mostra só os favoritos

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

  // anima os cards NÃO arrastados deslizando da posição antiga (A) até a nova
  // (B) via Web Animations API. WAAPI roda independente de CSS transition/inline
  // transform — então não briga com o rotate decorativo nem "pisca". Cancela a
  // animação anterior antes de medir p/ lidar com arrastes rápidos (interrupção).
  function flipOthers(before) {
    feed.querySelectorAll(".card.is-draggable").forEach(c => {
      if (c === dragging) return;
      const prev = before.get(c);   // topo VISUAL antes do reorder (snapAll já lê o visual)
      if (prev === undefined) return;
      c.getAnimations().forEach(a => a.cancel());      // remove anim em curso → vai pro layout base
      const dy = prev - c.getBoundingClientRect().top; // de onde estava → onde está agora
      if (Math.abs(dy) < 1) return;
      c.animate(
        [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0px)" }],
        { duration: 300, easing: EASE }
      );
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
    // P2: garante TODOS os cards no DOM antes de reordenar, senão saveOrder
    // gravaria só a ordem da página visível (cards abaixo entram no fim, sem
    // mexer no card sendo arrastado nem nos de cima — rect capturado depois).
    renderAllRemaining();
    dragging = card;
    lastOver = null;
    // marca o feed em "reordenamento": o CSS então zera a rotação decorativa
    // (nth-child) e o hover dos outros cards, deixando o transform do FLIP como
    // ÚNICO transform — sem isso o card alvo reverte pro rotate e "salta".
    document.body.classList.add("is-reordering");
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
    const card = dragging;
    // posição visual ATUAL do card (ele está em position:fixed seguindo o cursor)
    const fromR = card.getBoundingClientRect();
    // mede os outros antes do "encaixe" (não devem se mover, o placeholder já
    // guardava o espaço — mas medimos por segurança)
    const before = snapAll();
    // coloca o card já no lugar FINAL do fluxo e remove TODO estilo de arraste:
    // a partir daqui ele é um card estático normal — sem fixed→estático = sem pisca
    card.classList.remove("is-dragging");
    Object.assign(card.style, {
      position: "", left: "", top: "", width: "",
      zIndex: "", boxShadow: "", transform: "",
      transformOrigin: "", transition: "", margin: "",
    });
    feed.insertBefore(card, placeholder);
    placeholder.remove(); placeholder = null;
    // onde ele caiu no fluxo natural
    const toR = card.getBoundingClientRect();
    const dx = fromR.left - toR.left;
    const dy = fromR.top  - toR.top;
    // FLIP no próprio card via WAAPI: parte de onde a mão soltou (translate +
    // scale do arraste) e desliza até o lugar (identidade). Como ele já está em
    // fluxo e o WAAPI é só uma sobreposição que termina sem fill, NÃO há salto
    // fixed→estático: nada de reset, nada de piscada.
    const restShadow = getComputedStyle(card).boxShadow;
    card.getAnimations().forEach(a => a.cancel());
    card.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(1.02)`, boxShadow: "0 18px 44px rgba(0,0,0,.4)", zIndex: 800 },
        { transform: "translate(0px, 0px) scale(1)", boxShadow: restShadow, zIndex: 800 }
      ],
      { duration: 300, easing: EASE }
    );
    // os outros deslizam para o novo lugar no mesmo tempo
    flipOthers(before);
    const order = [...feed.querySelectorAll(".card")].map(c => c.dataset.id).filter(Boolean);
    saveOrder(order);
    dragging = null; lastOver = null;
    // rotação decorativa volta suave (.card tem transition: transform .35s)
    setTimeout(() => document.body.classList.remove("is-reordering"), 300);
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
    document.body.classList.remove("is-reordering");
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
  // F1b: "última visita" é um corte ABSOLUTO (desde a visita anterior), não uma
  // janela relativa como hoje/7d/30d.
  if (filterPeriod === "lastvisit") return ts > _lastSeenAtLoad;
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
  const rem = e.target.closest(".chip-remember");
  if (rem) {
    rememberOpen = !rememberOpen;
    renderRememberCarousel();
    rem.classList.toggle("is-active", rememberOpen);
    if (rememberOpen) document.getElementById("rememberCarousel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  const prio = e.target.closest(".chip-prio");
  if (prio) { filterFav = !filterFav; prio.classList.toggle("is-active", filterFav); applyFilter(); return; }
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
filtersMore.addEventListener("click", onFilterClick);

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
        ${subs.map(s => `<div class="dd-sub-row" data-sub="${escAttr(s)}">
            <button class="sub-opt${activeSub === s ? " is-active" : ""}" data-sub="${escAttr(s)}">${escHtml(s)}</button>
            <button class="dd-mini" data-act="edit-sub" title="editar">✎</button>
            <button class="dd-mini dd-danger" data-act="del-sub" title="excluir subtag">${TRASH_ICO}</button>
          </div>`).join("")}
      </div>` : "";
    dd.innerHTML = `<div class="dd-head-row">
        <button class="dd-head-name${!activeSub ? " is-active" : ""}" data-act="all">${escHtml(cat)}</button>
        <button class="dd-mini" data-act="edit-cat" title="editar">✎</button>
        <button class="dd-mini dd-danger" data-act="del-cat" title="excluir tag">${TRASH_ICO}</button>
      </div>${subsHTML}`;
  };
  render();

  // edit inline: só ✓ salvar e ✕ cancelar (excluir ficou na linha inicial)
  const showEdit = (rowEl, val, onSave) => {
    const el = document.createElement("div");
    el.className = "dd-edit-row";
    el.innerHTML = `<input class="dd-edit-inp" value="${escAttr(val)}" maxlength="24" spellcheck="false">
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
  // FILT/F1b: "última visita" como período — só quando há uma visita anterior real
  if (_lastSeenAtLoad > 0) PERIODS.push(["lastvisit", "última visita"]);

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
      <div class="cat-sub-head mono">subtag em ${escHtml(cat)}</div>
      ${subs.map(s => `<button class="sub-option${s === currentSub ? " is-current" : ""}" data-sub="${escAttr(s)}">${escHtml(s)}</button>`).join("")}
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
    ${cats.map(c => `<button class="cat-option${c === item.cat ? " is-current" : ""}" data-cat="${escAttr(c)}">${escHtml(c)}</button>`).join("")}
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
  b.innerHTML = `${escHtml(label)}${hasSubs ? '<span class="chip-sub-mark" aria-hidden="true">+</span>' : ""}`;
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
  trash.innerHTML = `<svg viewBox="0 0 18 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M17.25 3H13.5V2.25C13.5 1.65326 13.2629 1.08097 12.841 0.65901C12.419 0.237053 11.8467 0 11.25 0H6.75C6.15326 0 5.58097 0.237053 5.15901 0.65901C4.73705 1.08097 4.5 1.65326 4.5 2.25V3H0.75C0.551088 3 0.360322 3.07902 0.21967 3.21967C0.0790178 3.36032 0 3.55109 0 3.75C0 3.94891 0.0790178 4.13968 0.21967 4.28033C0.360322 4.42098 0.551088 4.5 0.75 4.5H1.5V18C1.5 18.3978 1.65804 18.7794 1.93934 19.0607C2.22064 19.342 2.60218 19.5 3 19.5H15C15.3978 19.5 15.7794 19.342 16.0607 19.0607C16.342 18.7794 16.5 18.3978 16.5 18V4.5H17.25C17.4489 4.5 17.6397 4.42098 17.7803 4.28033C17.921 4.13968 18 3.94891 18 3.75C18 3.55109 17.921 3.36032 17.7803 3.21967C17.6397 3.07902 17.4489 3 17.25 3ZM6 2.25C6 2.05109 6.07902 1.86032 6.21967 1.71967C6.36032 1.57902 6.55109 1.5 6.75 1.5H11.25C11.4489 1.5 11.6397 1.57902 11.7803 1.71967C11.921 1.86032 12 2.05109 12 2.25V3H6V2.25ZM15 18H3V4.5H15V18ZM7.5 8.25V14.25C7.5 14.4489 7.42098 14.6397 7.28033 14.7803C7.13968 14.921 6.94891 15 6.75 15C6.55109 15 6.36032 14.921 6.21967 14.7803C6.07902 14.6397 6 14.4489 6 14.25V8.25C6 8.05109 6.07902 7.86032 6.21967 7.71967C6.36032 7.57902 6.55109 7.5 6.75 7.5C6.94891 7.5 7.13968 7.57902 7.28033 7.71967C7.42098 7.86032 7.5 8.05109 7.5 8.25ZM12 8.25V14.25C12 14.4489 11.921 14.6397 11.7803 14.7803C11.6397 14.921 11.4489 15 11.25 15C11.0511 15 10.8603 14.921 10.7197 14.7803C10.579 14.6397 10.5 14.4489 10.5 14.25V8.25C10.5 8.05109 10.579 7.86032 10.7197 7.71967C10.8603 7.57902 11.0511 7.5 11.25 7.5C11.4489 7.5 11.6397 7.57902 11.7803 7.71967C11.921 7.86032 12 8.05109 12 8.25Z"/></svg><span class="trash-label">lixeira</span>`;
  if (activeCat === "__trash") trash.classList.add("is-active");
  return trash;
}

function renderCats() {
  const present = presentCats();
  const filterbar = document.getElementById("filterbar");
  filters.innerHTML = "";
  filterActions.innerHTML = "";
  filtersMore.innerHTML = "";

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

  // "relembre" (F2) — antes do compacto; abre/fecha o carrossel sob demanda
  const remember = document.createElement("button");
  remember.className = "chip chip-remember" + (rememberOpen ? " is-active" : "");
  remember.title = "relembre";
  remember.innerHTML = `<svg viewBox="0 0 19 18" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M10.5 4.50003V8.57534L13.8863 10.6069C14.0568 10.7093 14.1797 10.8753 14.2279 11.0684C14.2761 11.2614 14.2456 11.4657 14.1431 11.6363C14.0407 11.8068 13.8747 11.9297 13.6816 11.9779C13.4886 12.0261 13.2843 11.9956 13.1138 11.8932L9.36375 9.64315C9.25276 9.57647 9.16093 9.48219 9.09718 9.36949C9.03344 9.25679 8.99996 9.12951 9 9.00003V4.50003C9 4.30112 9.07902 4.11035 9.21967 3.9697C9.36032 3.82905 9.55109 3.75003 9.75 3.75003C9.94891 3.75003 10.1397 3.82905 10.2803 3.9697C10.421 4.11035 10.5 4.30112 10.5 4.50003ZM9.75 2.77605e-05C8.56687 -0.00291932 7.3949 0.22881 6.30193 0.681803C5.20895 1.1348 4.21667 1.80006 3.3825 2.63909C2.70094 3.32909 2.09531 3.99284 1.5 4.68753V3.00003C1.5 2.80112 1.42098 2.61035 1.28033 2.4697C1.13968 2.32905 0.948912 2.25003 0.75 2.25003C0.551088 2.25003 0.360322 2.32905 0.21967 2.4697C0.0790176 2.61035 0 2.80112 0 3.00003V6.75003C0 6.94894 0.0790176 7.13971 0.21967 7.28036C0.360322 7.42101 0.551088 7.50003 0.75 7.50003H4.5C4.69891 7.50003 4.88968 7.42101 5.03033 7.28036C5.17098 7.13971 5.25 6.94894 5.25 6.75003C5.25 6.55112 5.17098 6.36035 5.03033 6.2197C4.88968 6.07905 4.69891 6.00003 4.5 6.00003H2.34375C3.01406 5.21065 3.68156 4.46722 4.44281 3.69659C5.48518 2.65423 6.8116 1.94216 8.25635 1.64935C9.70109 1.35654 11.2001 1.49598 12.566 2.05023C13.932 2.60449 15.1043 3.54899 15.9366 4.76572C16.7688 5.98245 17.224 7.41745 17.2453 8.89142C17.2666 10.3654 16.8531 11.813 16.0564 13.0532C15.2598 14.2935 14.1152 15.2716 12.7659 15.8651C11.4165 16.4586 9.92221 16.6414 8.46959 16.3905C7.01698 16.1396 5.67052 15.4662 4.59844 14.4544C4.52679 14.3867 4.4425 14.3338 4.35039 14.2986C4.25828 14.2635 4.16015 14.2468 4.0616 14.2496C3.96305 14.2524 3.86602 14.2746 3.77604 14.3149C3.68606 14.3551 3.6049 14.4128 3.53719 14.4844C3.46947 14.5561 3.41654 14.6403 3.3814 14.7325C3.34626 14.8246 3.32961 14.9227 3.3324 15.0212C3.33518 15.1198 3.35735 15.2168 3.39764 15.3068C3.43792 15.3968 3.49554 15.4779 3.56719 15.5457C4.63542 16.5537 5.93414 17.285 7.35 17.6757C8.76587 18.0665 10.2558 18.1047 11.6899 17.7872C13.1239 17.4696 14.4585 16.8059 15.577 15.854C16.6956 14.9021 17.5642 13.6909 18.107 12.3261C18.6498 10.9613 18.8503 9.48439 18.6911 8.02426C18.5318 6.56414 18.0177 5.16517 17.1934 3.94947C16.3692 2.73376 15.2599 1.73825 13.9625 1.04982C12.665 0.361401 11.2188 0.000983756 9.75 2.77605e-05Z"/></svg>`;
  filterActions.appendChild(remember);

  // prioridade (★) — botão-filtro: mostra só os favoritos
  const prio = document.createElement("button");
  prio.className = "chip chip-prio" + (filterFav ? " is-active" : "");
  prio.title = "prioridade (favoritos)";
  prio.innerHTML = ICON_STAR;
  filterActions.appendChild(prio);

  // alternar visualização: timeline (cheia) ↔ compacta
  const view = document.createElement("button");
  view.className = "chip chip-view" + (viewMode === "compact" ? " is-active" : "");
  view.title = viewMode === "compact" ? "visualização: compacta" : "visualização: timeline";
  view.innerHTML = viewMode === "compact"
    ? `<svg viewBox="0 0 18 15" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M16.5 8.25H1.5C1.10218 8.25 0.720644 8.40804 0.43934 8.68934C0.158035 8.97064 0 9.35218 0 9.75V13.5C0 13.8978 0.158035 14.2794 0.43934 14.5607C0.720644 14.842 1.10218 15 1.5 15H16.5C16.8978 15 17.2794 14.842 17.5607 14.5607C17.842 14.2794 18 13.8978 18 13.5V9.75C18 9.35218 17.842 8.97064 17.5607 8.68934C17.2794 8.40804 16.8978 8.25 16.5 8.25ZM16.5 13.5H1.5V9.75H16.5V13.5ZM16.5 0H1.5C1.10218 0 0.720644 0.158035 0.43934 0.43934C0.158035 0.720644 0 1.10218 0 1.5V5.25C0 5.64782 0.158035 6.02936 0.43934 6.31066C0.720644 6.59196 1.10218 6.75 1.5 6.75H16.5C16.8978 6.75 17.2794 6.59196 17.5607 6.31066C17.842 6.02936 18 5.64782 18 5.25V1.5C18 1.10218 17.842 0.720644 17.5607 0.43934C17.2794 0.158035 16.8978 0 16.5 0ZM16.5 5.25H1.5V1.5H16.5V5.25Z"/></svg>`
    : `<svg viewBox="0 0 14 21" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M11.25 0H2.25C1.65326 0 1.08097 0.237053 0.65901 0.65901C0.237053 1.08097 0 1.65326 0 2.25V18.75C0 19.3467 0.237053 19.919 0.65901 20.341C1.08097 20.7629 1.65326 21 2.25 21H11.25C11.8467 21 12.419 20.7629 12.841 20.341C13.2629 19.919 13.5 19.3467 13.5 18.75V2.25C13.5 1.65326 13.2629 1.08097 12.841 0.65901C12.419 0.237053 11.8467 0 11.25 0ZM12 18.75C12 18.9489 11.921 19.1397 11.7803 19.2803C11.6397 19.421 11.4489 19.5 11.25 19.5H2.25C2.05109 19.5 1.86032 19.421 1.71967 19.2803C1.57902 19.1397 1.5 18.9489 1.5 18.75V2.25C1.5 2.05109 1.57902 1.86032 1.71967 1.71967C1.86032 1.57902 2.05109 1.5 2.25 1.5H11.25C11.4489 1.5 11.6397 1.57902 11.7803 1.71967C11.921 1.86032 12 2.05109 12 2.25V18.75ZM10.5 3.75C10.5 3.94891 10.421 4.13968 10.2803 4.28033C10.1397 4.42098 9.94891 4.5 9.75 4.5H3.75C3.55109 4.5 3.36032 4.42098 3.21967 4.28033C3.07902 4.13968 3 3.94891 3 3.75C3 3.55109 3.07902 3.36032 3.21967 3.21967C3.36032 3.07902 3.55109 3 3.75 3H9.75C9.94891 3 10.1397 3.07902 10.2803 3.21967C10.421 3.36032 10.5 3.55109 10.5 3.75Z"/></svg>`;
  filterActions.appendChild(view);

  // filtros (tipo / período)
  const filt = document.createElement("button");
  filt.className = "chip chip-filter" + (filtersActive() ? " is-active" : "");
  filt.title = "filtrar";
  filt.innerHTML = `<svg viewBox="0 0 18 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M0.75 3.75588H3.84375C4.00898 4.40119 4.38428 4.97316 4.91048 5.38161C5.43669 5.79006 6.08387 6.01176 6.75 6.01176C7.41613 6.01176 8.06331 5.79006 8.58952 5.38161C9.11572 4.97316 9.49102 4.40119 9.65625 3.75588H17.25C17.4489 3.75588 17.6397 3.67686 17.7803 3.53621C17.921 3.39556 18 3.20479 18 3.00588C18 2.80697 17.921 2.6162 17.7803 2.47555C17.6397 2.3349 17.4489 2.25588 17.25 2.25588H9.65625C9.49102 1.61057 9.11572 1.0386 8.58952 0.630153C8.06331 0.221702 7.41613 0 6.75 0C6.08387 0 5.43669 0.221702 4.91048 0.630153C4.38428 1.0386 4.00898 1.61057 3.84375 2.25588H0.75C0.551088 2.25588 0.360322 2.3349 0.21967 2.47555C0.0790178 2.6162 0 2.80697 0 3.00588C0 3.20479 0.0790178 3.39556 0.21967 3.53621C0.360322 3.67686 0.551088 3.75588 0.75 3.75588ZM6.75 1.50588C7.04667 1.50588 7.33668 1.59386 7.58336 1.75868C7.83003 1.9235 8.02229 2.15777 8.13582 2.43186C8.24935 2.70595 8.27906 3.00755 8.22118 3.29852C8.1633 3.58949 8.02044 3.85676 7.81066 4.06654C7.60088 4.27632 7.33361 4.41918 7.04264 4.47706C6.75166 4.53494 6.45006 4.50523 6.17598 4.3917C5.90189 4.27817 5.66762 4.08591 5.5028 3.83924C5.33797 3.59256 5.25 3.30255 5.25 3.00588C5.25 2.60806 5.40804 2.22653 5.68934 1.94522C5.97064 1.66392 6.35218 1.50588 6.75 1.50588ZM17.25 11.2559H15.6562C15.491 10.6106 15.1157 10.0386 14.5895 9.63015C14.0633 9.2217 13.4161 9 12.75 9C12.0839 9 11.4367 9.2217 10.9105 9.63015C10.3843 10.0386 10.009 10.6106 9.84375 11.2559H0.75C0.551088 11.2559 0.360322 11.3349 0.21967 11.4756C0.0790178 11.6162 0 11.807 0 12.0059C0 12.2048 0.0790178 12.3956 0.21967 12.5362C0.360322 12.6769 0.551088 12.7559 0.75 12.7559H9.84375C10.009 13.4012 10.3843 13.9732 10.9105 14.3816C11.4367 14.7901 12.0839 15.0118 12.75 15.0118C13.4161 15.0118 14.0633 14.7901 14.5895 14.3816C15.1157 13.9732 15.491 13.4012 15.6562 12.7559H17.25C17.4489 12.7559 17.6397 12.6769 17.7803 12.5362C17.921 12.3956 18 12.2048 18 12.0059C18 11.807 17.921 11.6162 17.7803 11.4756C17.6397 11.3349 17.4489 11.2559 17.25 11.2559ZM12.75 13.5059C12.4533 13.5059 12.1633 13.4179 11.9166 13.2531C11.67 13.0883 11.4777 12.854 11.3642 12.5799C11.2506 12.3058 11.2209 12.0042 11.2788 11.7132C11.3367 11.4223 11.4796 11.155 11.6893 10.9452C11.8991 10.7354 12.1664 10.5926 12.4574 10.5347C12.7483 10.4768 13.0499 10.5065 13.324 10.6201C13.5981 10.7336 13.8324 10.9259 13.9972 11.1725C14.162 11.4192 14.25 11.7092 14.25 12.0059C14.25 12.4037 14.092 12.7852 13.8107 13.0665C13.5294 13.3478 13.1478 13.5059 12.75 13.5059Z"/></svg>`;
  filterActions.appendChild(filt);

  // "+N" / "−": calculado pela viewport (quantas pílulas ficaram escondidas no
  // overflow). Fica em #filtersMore — sempre no MESMO lugar (não se move ao
  // alternar). Ver updateMoreChip().
  updateMoreChip();

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

// quantas pílulas de tag ficaram FORA da área visível do container (escondidas
// pelo overflow — à direita no mobile que rola, ou abaixo da 1ª linha no
// desktop que corta). É a base do "+N": muda conforme a viewport.
function countHiddenChips() {
  const chips = [...filters.querySelectorAll(".chip")];
  if (!chips.length) return 0;
  const cr = filters.getBoundingClientRect();
  // mede por LINHA (não pela altura do container): no desktop a 1ª linha é a
  // visível e o que quebrou pra baixo está escondido; no mobile (nowrap) tudo
  // fica na 1ª linha e o escondido sai pela direita. Medir pela linha evita o
  // bug de contar 0 enquanto o max-height ainda está animando ao recolher.
  const firstTop = chips[0].getBoundingClientRect().top;
  let n = 0;
  chips.forEach(c => {
    const r = c.getBoundingClientRect();
    const belowFirstRow = r.top > firstTop + 4;     // quebrou pra linha de baixo (desktop)
    const offRight = r.right > cr.right + 1;          // saiu pela direita (mobile rolável)
    const offLeft  = r.left < cr.left - 1;
    if (belowFirstRow || offRight || offLeft) n++;
  });
  return n;
}

// "+N" (recolhido) ou "−" (expandido), sempre em #filtersMore — mesmo lugar.
// Recolhido: só aparece se houver pílulas escondidas (senão some, ex: desktop
// com espaço de sobra). Expandido: vira "−" e fica no mesmo lugar.
function updateMoreChip() {
  filtersMore.innerHTML = "";
  if (activeCat === "__trash" || currentItems().length === 0) return;
  if (catsExpanded) {
    const less = document.createElement("button");
    less.className = "chip chip-more chip-less";
    less.textContent = "−";
    less.title = "mostrar menos";
    less.setAttribute("aria-label", "mostrar menos tags");
    filtersMore.appendChild(less);
    return;
  }
  const hidden = countHiddenChips();
  if (hidden <= 0) return;
  const more = document.createElement("button");
  more.className = "chip chip-more";
  more.textContent = `+${hidden}`;
  more.title = "mostrar todas as tags";
  filtersMore.appendChild(more);
}

// recalcula o "+N" quando a viewport muda (mais/menos pílulas cabem na linha)
let moreResizeRAF = 0;
addEventListener("resize", () => {
  cancelAnimationFrame(moreResizeRAF);
  moreResizeRAF = requestAnimationFrame(updateMoreChip);
});

/* ---------- lixeira ---------- */

function updateTrashChip() {
  const label = document.querySelector(".chip-trash .trash-label");
  if (!label) return;   // sem chip de lixeira no DOM (ex: tela vazia)
  const n = loadTrash().length;
  label.textContent = n ? `lixeira (${n})` : "lixeira";
}

function renderTrash() {
  updateEmptyState();   // na lixeira nunca centraliza como "vazio"
  updateHomeBlocks();   // F1/F2: esconde os blocos home na lixeira
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
        <label class="t-check"><input type="checkbox" data-id="${escAttr(item.id)}"></label>
        <span class="card-source source-${escAttr(item.source)}"><span class="source-icon">${SOURCE_ICONS[item.source] || SOURCE_ICONS.web}</span>${escHtml(sourceLabel(item.source))}</span>
        <div class="card-top-right">
          <button class="card-restore mono" title="devolver ao vautch">↩ restaurar</button>
          <button class="card-purge mono" title="excluir para sempre">🗑 excluir</button>
        </div>
      </div>
      <h2 class="card-title" style="font-size:19px">${escHtml(item.title || "Sem título")}</h2>
      ${item.url ? `<a class="card-link" href="https://${escAttr(item.url)}" target="_blank" rel="noopener">${escHtml(item.url.slice(0, 60))}</a>` : ""}`;

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

// U1: adiciona um botão × de limpar a um input/textarea dinâmico. O × aparece
// só quando há conteúdo; ao clicar, zera o campo e dispara "input" (pra que
// listeners existentes reajam) sem roubar o foco no mousedown.
function attachClear(el) {
  if (!el || el._hasClear) return;
  el._hasClear = true;
  const wrap = document.createElement("span");
  wrap.className = "field-clear-wrap";
  el.parentNode.insertBefore(wrap, el);
  wrap.appendChild(el);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "field-clear";
  btn.setAttribute("aria-label", "limpar");
  btn.textContent = "×";
  wrap.appendChild(btn);
  const sync = () => wrap.classList.toggle("has-value", String(el.value).trim().length > 0);
  el.addEventListener("input", sync);
  btn.addEventListener("mousedown", e => e.preventDefault());
  btn.addEventListener("click", () => {
    el.value = "";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus();
  });
  sync();
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

// U1: botão × do campo principal. Reusa clearSearch()/growIntake() e o is-typing
// que o CSS usa pra mostrar/esconder o ×. mousedown preventDefault evita perder
// o foco antes do click no celular.
const intakeClear = document.getElementById("intakeClear");
intakeClear?.addEventListener("mousedown", e => e.preventDefault());
intakeClear?.addEventListener("click", () => {
  input.value = "";
  clearSearch();
  intakeField.classList.remove("is-link");
  input.style.height = "";
  growIntake();
  input.focus();
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

// se o usuário está vendo a LIXEIRA, volta pro feed normal antes de inserir um
// item novo. Sem isso, o card vivo (com embed) seria injetado no DOM da lixeira
// e a paginação ficaria stale (sentinel destacado → insertBefore quebra). Como
// o buildFeed roda ANTES do persist, o item novo não duplica.
function exitTrashView() {
  if (activeCat !== "__trash") return;
  activeCat = "tudo";
  activeSub = null;
  buildFeed();
  markActiveChip();
}

// insere um item novo no topo do feed (notas, prints e links usam isto)
function insertNewItem(newItem, statusMsg) {
  exitTrashView();
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
  if (!cat) cat = classifyContent(text, loadLearn(), allCats()).cat;
  // tag nova (criada a partir do conteúdo) entra na lista do usuário
  if (cat && !allCats().includes(cat)) {
    localStorage.setItem(CATS_KEY, JSON.stringify([...loadCats(), cat]));
  }
  insertNewItem({
    id: `v${Date.now()}`,
    source: "nota",
    cat,
    type: "note",
    title: (text.split("\n")[0] || "Nota").slice(0, 60),
    text,
    createdAt: new Date().toISOString(),
    url: null
  }, `✦ nota guardada em <strong>${escHtml(cat)}</strong>`);
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
      createdAt: new Date().toISOString(),
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

  // monta o embed PREFERINDO o link que o usuário colou (preserva /reel/, /p/ etc.).
  // O Microlink (meta.url) às vezes canonicaliza um reel pra /p/, e embed de reel
  // via /p/ o Instagram rejeita ("link broken"). Só cai pro meta.url quando o link
  // do usuário não rende embed (ex.: link curto vm./vt.tiktok, fb.watch).
  let embed = buildEmbed(url, meta) || buildEmbed(meta?.url, meta);
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

  // Fallback genérico (B6): link social reconhecido mas SEM embed (anúncio/boost
  // que o player recusa, formato não suportado). A imagem do preview já entra via
  // meta.image (linha do `image:` abaixo); aqui só garantimos uma MENSAGEM clara
  // quando não há nem título, evitando um card "vazio" sem explicação.
  const SOCIAL_SOURCES = ["instagram", "facebook", "youtube", "tiktok", "twitter", "threads", "vimeo"];
  if (!embed && SOCIAL_SOURCES.includes(source) && !meta?.title) {
    fallbackTitle = fallbackTitle || "Visualização indisponível";
    fallbackBody = fallbackBody || "Não consegui incorporar este link — toque em “abrir original” para ver.";
  }

  // classifica pelo conteúdo real (título + descrição), não pelo URL
  const contentText = [meta?.title, meta?.description, meta?.author].filter(Boolean).join(" · ");
  // 1º tenta a IA real (se houver chave); senão, heurística local em cascata
  let cat = await aiClassify(contentText, allCats());
  if (!cat) cat = classifyContent(contentText, loadLearn(), allCats()).cat;
  // tag nova (criada a partir do conteúdo) entra na lista do usuário
  if (cat && !allCats().includes(cat)) {
    localStorage.setItem(CATS_KEY, JSON.stringify([...loadCats(), cat]));
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
    createdAt: new Date().toISOString(),
    url: stripTracking(url).replace(/^https?:\/\//, "")
  };

  exitTrashView(); // volta pro feed normal se estava na lixeira (antes do persist)
  persist(newItem);

  const firstMark = ensureTodayMark();
  const card = makeCard(newItem, true);
  firstMark.after(card);

  setStatus(`✦ guardado em <strong>${escHtml(cat)}</strong>${meta ? "" : " (não consegui ler os detalhes do link)"}`, false);
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

/* ---------- Export / Import ---------- */
document.getElementById("exportBtn").addEventListener("click", () => {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    items: loadJSON(STORAGE_KEY, []),
    trash: loadJSON(TRASH_KEY, []),
    cats: loadCats(),
    catOverrides: loadCatOverrides(),
    subOverrides: loadSubOverrides(),
    order: loadOrder(),
    learn: loadLearn(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "vautch-export-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById("importFile").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.version || !Array.isArray(data.items)) {
        alert("Arquivo inválido — não parece ser um export do Vautch.");
        return;
      }
      const existing = loadJSON(STORAGE_KEY, []);
      const existingIds = new Set(existing.map(i => i.id));
      const newItems = data.items.filter(i => !existingIds.has(i.id));
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, ...newItems]));
      if (Array.isArray(data.trash)) {
        const existingTrash = loadJSON(TRASH_KEY, []);
        const trashIds = new Set(existingTrash.map(i => i.id));
        localStorage.setItem(TRASH_KEY, JSON.stringify([...existingTrash, ...data.trash.filter(i => !trashIds.has(i.id))]));
      }
      if (Array.isArray(data.cats)) {
        localStorage.setItem(CATS_KEY, JSON.stringify([...new Set([...loadCats(), ...data.cats])]));
      }
      // sobe pro Supabase ANTES do reload — senão o loadFromServer no init
      // recarregaria o estado antigo do servidor e apagaria o que foi importado.
      await syncToServer();
      alert(`Importação concluída: ${newItems.length} itens novos adicionados (${data.items.length - newItems.length} duplicatas ignoradas).`);
      location.reload();
    } catch {
      alert("Erro ao ler o arquivo. Verifique se é um JSON válido.");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

// Logout — limpa o cache local (anti-vazamento entre contas no mesmo browser,
// ADR 0002) e POST /auth/signout (server limpa o cookie httpOnly e redireciona).
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TRASH_KEY);
    } catch {}
    const f = document.createElement("form");
    f.method = "POST";
    f.action = "/auth/signout";
    document.body.appendChild(f);
    f.submit();
  });
}

/* ---------- Supabase sync bridge (Etapa 4) ----------
   O bundle continua trabalhando sobre o localStorage (síncrono, UI instantânea).
   Esta ponte: (1) ao abrir, carrega os itens DESTE usuário do Supabase pro cache;
   (2) a cada escrita em vault.items/vault.trash, sincroniza pro servidor (debounce);
   (3) o logout acima limpa o cache. RLS garante isolamento real no banco. */
let _applyingRemote = false;
let _loadedOk = false; // trava: só sincroniza após um load bem-sucedido (anti perda de dados)
let _syncTimer = null;
const _origSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function (key, value) {
  _origSetItem(key, value);
  if (!_applyingRemote && (key === STORAGE_KEY || key === TRASH_KEY)) {
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(syncToServer, 800);
  }
};

async function syncToServer() {
  // se o load inicial falhou, NÃO empurra o cache (a reconciliação full-state
  // poderia apagar os itens do servidor). Espera um load bom primeiro.
  if (!_loadedOk) return;
  try {
    const items = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const trash = JSON.parse(localStorage.getItem(TRASH_KEY) || "[]");
    await fetch("/api/items", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, trash }),
    });
  } catch {
    // offline / falha de rede: fica no cache local e sincroniza na próxima escrita
  }
}

async function loadFromServer() {
  try {
    const r = await fetch("/api/items");
    if (!r.ok) return;
    const { items, trash } = await r.json();
    _applyingRemote = true;
    _origSetItem(STORAGE_KEY, JSON.stringify(items || []));
    _origSetItem(TRASH_KEY, JSON.stringify(trash || []));
    _applyingRemote = false;
    _loadedOk = true; // libera o sync só agora (temos o estado real do servidor)
  } catch {
    // offline: usa o que estiver no cache local; sync continua travado (sem apagar nada)
  }
}

/* ---------- init ---------- */
(async () => {
  renderSkeletons();       // P1: placeholders enquanto o servidor não responde
  await loadFromServer();  // popula o cache com os dados DESTE usuário (RLS)
  applyViewMode();         // restaura modo compacto/timeline salvo
  buildFeed();             // já chama renderCats() internamente
  renderMorningReminder(); // F1: lembrete de itens da última visita
  renderRememberCarousel();// F2: carrossel "relembre"
  initDrag();              // ativa drag-to-reorder no modo compacto
  updateTrashChip();
  refreshAiToggle();
  // F3: painel de ajuste é função SUPER-USER (escondido por padrão). Abre com
  // Ctrl+Shift+F (ou se vault.su já estiver ligado). Espaço p/ mais ferramentas su.
  if (localStorage.getItem("vault.su") === "1") buildFxPanel();
  addEventListener("keydown", e => {
    if (e.ctrlKey && e.shiftKey && (e.key === "F" || e.key === "f")) {
      e.preventDefault();
      if (localStorage.getItem("vault.su") === "1") { localStorage.removeItem("vault.su"); document.getElementById("fxPanel")?.remove(); }
      else { localStorage.setItem("vault.su", "1"); buildFxPanel(); }
    }
  });
  // garante que os favoritos do load inicial meçam o tamanho real (pós-layout)
  requestAnimationFrame(() => requestAnimationFrame(fxRebuildAll));
  setTimeout(fxRebuildAll, 400);
  document.documentElement.classList.add("app-ready"); // libera o endcap (anti-flash)
  localStorage.setItem("vault.lastSeen", String(Date.now())); // marca esta visita (F1)
})();
