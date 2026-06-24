"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/core/db/supabase/client";
import { signIn, signUp } from "./actions";
import styles from "./login.module.css";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-8z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2a11 11 0 0 0 0 9.8l3.7-2.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2 7.1l3.7 2.8C6.6 7.3 9.1 5.4 12 5.4z" />
    </svg>
  );
}

export function LoginForm() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLogin = mode === "in";

  // Google OAuth: ativado após configurar o provider no Supabase + Google Cloud.
  const GOOGLE_ENABLED = true;

  async function handleGoogle(): Promise<void> {
    setGoogleBusy(true);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (oauthError) setGoogleBusy(false);
  }

  // Validação client-side instantânea (o server action revalida — defesa em profundidade).
  function guardSubmit(e: React.FormEvent<HTMLFormElement>): void {
    if (isLogin) return;
    const fd = new FormData(e.currentTarget);
    if (fd.get("password") !== fd.get("confirm")) {
      e.preventDefault();
      setError("as senhas não conferem");
    }
  }

  function toggleMode(): void {
    setError(null);
    setMode(isLogin ? "up" : "in");
  }

  return (
    <div className={styles.card}>
      {GOOGLE_ENABLED ? (
        <>
          <button
            type="button"
            className={styles.google}
            onClick={handleGoogle}
            disabled={googleBusy}
          >
            <GoogleIcon />
            {googleBusy ? "abrindo…" : "continuar com Google"}
          </button>

          <div className={styles.divider}>
            <span>ou</span>
          </div>
        </>
      ) : null}

      {error ? <p className={styles.formError}>{error}</p> : null}

      <form
        action={isLogin ? signIn : signUp}
        onSubmit={guardSubmit}
        className={styles.form}
      >
        <label className={styles.label}>
          e-mail
          <input
            className={styles.field}
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="voce@email.com"
          />
        </label>
        <label className={styles.label}>
          senha
          <input
            className={styles.field}
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete={isLogin ? "current-password" : "new-password"}
            placeholder="mínimo 8 caracteres"
          />
        </label>
        {!isLogin ? (
          <label className={styles.label}>
            confirmar senha
            <input
              className={styles.field}
              type="password"
              name="confirm"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="repita a senha"
            />
          </label>
        ) : null}
        <button type="submit" className={styles.submit}>
          {isLogin ? "entrar" : "criar conta"}
        </button>
      </form>

      {isLogin ? (
        <p className={styles.forgot}>
          <Link href="/forgot">esqueci minha senha</Link>
        </p>
      ) : null}

      <p className={styles.toggle}>
        {isLogin ? "ainda não tem conta? " : "já tem conta? "}
        <button type="button" onClick={toggleMode}>
          {isLogin ? "criar agora" : "entrar"}
        </button>
      </p>
    </div>
  );
}
