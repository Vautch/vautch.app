import { LoginForm } from "./login-form";
import { ThemeToggle } from "./theme-toggle";
import styles from "./login.module.css";

type SearchParams = Promise<{ error?: string; message?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  return (
    <main className={styles.wrap}>
      <ThemeToggle />
      <div className={styles.brand}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="logo-img logo-light"
          src="/assets/logo/vautch%20logo%20main.svg"
          alt="vautch"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="logo-img logo-dark"
          src="/assets/logo/vautch%20logo%20main-dark-mode.svg"
          alt="vautch"
        />
        <p className={styles.tagline}>tudo que você amou, num lugar só.</p>
      </div>

      {sp.error ? (
        <p className={styles.error}>{decodeURIComponent(sp.error)}</p>
      ) : null}
      {sp.message === "check-email" ? (
        <p className={styles.message}>
          Conta criada. Confirme pelo link que enviamos no seu e-mail para
          entrar.
        </p>
      ) : null}

      <LoginForm />
    </main>
  );
}
