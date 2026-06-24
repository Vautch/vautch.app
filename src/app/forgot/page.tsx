import Link from "next/link";
import { ThemeToggle } from "../login/theme-toggle";
import styles from "../login/login.module.css";
import { requestReset } from "./actions";

type SearchParams = Promise<{ message?: string }>;

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const sent = sp.message === "sent";

  return (
    <main className={styles.wrap}>
      <ThemeToggle />
      <div className={styles.brand}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo-img logo-light" src="/assets/logo/vautch%20logo%20main.svg" alt="vautch" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo-img logo-dark" src="/assets/logo/vautch%20logo%20main-dark-mode.svg" alt="vautch" />
        <p className={styles.tagline}>recuperar acesso à sua conta</p>
      </div>

      <div className={styles.card}>
        {sent ? (
          <p className={styles.message}>
            Se existir uma conta com esse e-mail, enviamos um link para redefinir
            a senha. Confira sua caixa de entrada.
          </p>
        ) : (
          <form action={requestReset} className={styles.form}>
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
            <button type="submit" className={styles.submit}>
              enviar link de recuperação
            </button>
          </form>
        )}

        <p className={styles.toggle}>
          <Link href="/login">voltar pro login</Link>
        </p>
      </div>
    </main>
  );
}
