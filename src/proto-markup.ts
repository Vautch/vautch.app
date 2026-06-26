// Marcação do protótipo, verbatim (extraída de prototype/index.html). NÃO editar à mão.
export const BODY_HTML = `

<div class="grain" aria-hidden="true"></div>

<div class="topbar-row">
    <button class="theme-switch" id="themeToggle" title="alternar tema claro/escuro" aria-label="alternar tema">
      <span class="ts-icon ts-sun"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M5 5l1.4 1.4M17.6 17.6L19 19M3 12h2M19 12h2M5 19l1.4-1.4M17.6 6.4L19 5"/></svg></span>
      <span class="ts-icon ts-moon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 14.2A8 8 0 0 1 9.8 4 7 7 0 1 0 20 14.2z"/></svg></span>
      <span class="ts-knob">
        <svg class="ts-knob-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
        <svg class="ts-knob-moon" viewBox="0 0 24 24" fill="currentColor"><path d="M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5z"/></svg>
      </span>
    </button>
    <button class="menu-btn" id="menuBtn" aria-label="menu" title="menu" aria-expanded="false">
      <span class="menu-lines"><span></span><span></span></span>
    </button>
</div>

<h1 class="wordmark">
  <img class="logo-img logo-light" src="assets/logo/vautch%20logo%20main.svg" alt="vautch" />
  <img class="logo-img logo-dark" src="assets/logo/vautch%20logo%20main-dark-mode.svg" alt="vautch" />
</h1>

<header class="topbar">
  <p class="tagline">tudo que você amou, num lugar só.</p>
</header>

<!-- painel de menu/configurações -->
<div class="menu-panel" id="menuPanel" hidden>
  <div class="menu-card">
    <div class="menu-head mono">conta &amp; ajustes</div>
    <button class="menu-item" id="aiToggle">
      <span>classificação avançada (IA)</span>
      <span class="menu-state" id="aiState">off</span>
    </button>
    <button class="menu-item menu-disabled" disabled>
      <span>seu perfil</span><span class="menu-state">em breve</span>
    </button>
    <button class="menu-item menu-disabled" disabled>
      <span>sincronizar na nuvem</span><span class="menu-state">em breve</span>
    </button>
    <button class="menu-item" id="exportBtn">
      <span>exportar dados</span><span class="menu-state">↓ JSON</span>
    </button>
    <label class="menu-item" id="importLabel" style="cursor:pointer;">
      <span>importar dados</span><span class="menu-state">↑ JSON</span>
      <input type="file" id="importFile" accept=".json" style="display:none;">
    </label>
    <button class="menu-item" id="logoutBtn">
      <span>sair da conta</span><span class="menu-state">→</span>
    </button>
  </div>
</div>

<section class="intake">
  <form class="intake-form" id="intakeForm" autocomplete="off">
    <div class="intake-field" data-mode="save">
      <textarea id="intakeInput" rows="1" placeholder="cole, escreva ou busque…" spellcheck="false"></textarea>
      <button type="button" class="intake-clear" id="intakeClear" title="limpar" aria-label="limpar campo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <button type="button" class="intake-cam" id="camBtn" title="adicionar imagem / foto" aria-label="adicionar imagem">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2L8 4.5h8L17.5 7h2A1.5 1.5 0 0 1 21 8.5v10A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5z"/><circle cx="12" cy="13" r="3.5"/></svg>
      </button>
      <button type="submit" class="intake-btn" id="saveBtn" title="guardar">
        <span class="save-ico ico-book" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4.5L5 20V5a1 1 0 0 1 1-1z"/></svg></span>
        <span class="save-ico ico-find" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></span>
        <span class="save-label">guardar</span>
      </button>
    </div>
  </form>
  <input type="file" id="fileInput" accept="image/*" multiple hidden>
  <div class="intake-status mono" id="intakeStatus" aria-live="polite"></div>
</section>

<div class="topbar-meta mono"></div>

<div class="filterbar" id="filterbar">
  <div class="filters-line">
    <nav class="filters" id="filters">
      <!-- tudo + chips de categoria ranqueados (rolam no mobile) -->
    </nav>
    <div class="filters-more" id="filtersMore">
      <!-- "+N" fixo, na MESMA linha das tags (não rola junto com elas) -->
    </div>
  </div>
  <div class="filter-actions" id="filterActions">
    <!-- view, filtro e lixeira (fixos, não rolam no mobile) -->
  </div>
</div>

<!-- F1: lembrete ao voltar (itens guardados desde a última visita) — fora do #feed
     pra sobreviver ao feed.innerHTML="" do buildFeed; preenchido via JS -->
<section class="home-block morning" id="morningReminder" hidden></section>

<!-- F2: carrossel "relembre" (itens aleatórios, scroll horizontal) -->
<section class="home-block remember" id="rememberCarousel" hidden></section>

<main class="feed" id="feed"></main>

<footer class="endcap">
  <div class="endcap-line"></div>
  <p class="mono">fim do seu arquivo — nada de algoritmo aqui embaixo. ✦</p>
</footer>

`;
