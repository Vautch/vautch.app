import { ThemeToggle } from "../login/theme-toggle";
import styles from "../login/login.module.css";
import { ResetForm } from "./reset-form";

type SearchParams = Promise<{ error?: string }>;

export default async function ResetPasswordPage({
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
        <img className="logo-img logo-light" src="/assets/logo/vautch%20logo%20main.svg" alt="vautch" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo-img logo-dark" src="/assets/logo/vautch%20logo%20main-dark-mode.svg" alt="vautch" />
        <p className={styles.tagline}>defina sua nova senha</p>
      </div>

      {sp.error ? (
        <p className={styles.error}>{decodeURIComponent(sp.error)}</p>
      ) : null}

      <ResetForm />
    </main>
  );
}
