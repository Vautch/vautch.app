"use client";

import styles from "./login.module.css";

/**
 * Toggle de tema na tela de login — usa o MESMO switch do /app (marcação e
 * classes .theme-switch do /proto/style.css, que já carrega aqui). Design idêntico.
 * onClick espelha o applyTheme() do protótipo: data-theme + background + localStorage
 * (anti-flash já vem do script beforeInteractive no layout — ADR 0003).
 */
export function ThemeToggle() {
  function toggle(): void {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    root.style.background = next === "dark" ? "#131316" : "#f4efe6";
    try {
      localStorage.setItem("vault.theme", next);
    } catch {
      // storage bloqueado (modo privado) — só não persiste, sem quebrar
    }
  }

  return (
    <div className={styles.themeSwitchWrap}>
      <button
        type="button"
        className="theme-switch"
        onClick={toggle}
        title="alternar tema claro/escuro"
        aria-label="alternar tema"
      >
        <span className="ts-icon ts-sun">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 3v2M12 19v2M5 5l1.4 1.4M17.6 17.6L19 19M3 12h2M19 12h2M5 19l1.4-1.4M17.6 6.4L19 5" />
          </svg>
        </span>
        <span className="ts-icon ts-moon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 14.2A8 8 0 0 1 9.8 4 7 7 0 1 0 20 14.2z" />
          </svg>
        </span>
        <span className="ts-knob">
          <svg className="ts-knob-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="12" cy="12" r="4.5" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
          <svg className="ts-knob-moon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5z" />
          </svg>
        </span>
      </button>
    </div>
  );
}
