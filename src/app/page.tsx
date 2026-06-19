export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p
        className="mb-3 text-xs uppercase tracking-[0.3em] text-ink-soft"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        fundação · v0
      </p>
      <h1
        className="text-6xl font-semibold text-ink"
        style={{ fontFamily: "var(--font-display)" }}
      >
        vautch<span className="text-accent">.</span>
      </h1>
      <p className="mt-4 max-w-md text-lg text-ink-soft">
        tudo que você amou, num lugar só.
      </p>
      <p
        className="mt-10 text-xs text-ink-soft"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        scaffold Next.js pronto — porte do protótipo a seguir.
      </p>
    </main>
  );
}
