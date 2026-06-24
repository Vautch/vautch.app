"use client";

import { useState } from "react";
import styles from "../login/login.module.css";
import { updatePassword } from "./actions";

export function ResetForm() {
  const [error, setError] = useState<string | null>(null);

  function guardSubmit(e: React.FormEvent<HTMLFormElement>): void {
    const fd = new FormData(e.currentTarget);
    if (fd.get("password") !== fd.get("confirm")) {
      e.preventDefault();
      setError("as senhas não conferem");
    }
  }

  return (
    <div className={styles.card}>
      {error ? <p className={styles.formError}>{error}</p> : null}
      <form action={updatePassword} onSubmit={guardSubmit} className={styles.form}>
        <label className={styles.label}>
          nova senha
          <input
            className={styles.field}
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="mínimo 8 caracteres"
          />
        </label>
        <label className={styles.label}>
          confirmar nova senha
          <input
            className={styles.field}
            type="password"
            name="confirm"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="repita a nova senha"
          />
        </label>
        <button type="submit" className={styles.submit}>
          salvar nova senha
        </button>
      </form>
    </div>
  );
}
