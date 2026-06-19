import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Vautch — seu cantinho da internet",
  description: "tudo que você amou, num lugar só.",
};

// Port verbatim do protótipo: fontes da marca + CSS do protótipo via <link>,
// servidos estaticamente (idênticos ao original). Tailwind não é usado nesta fase.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&family=Spline+Sans+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/proto/style.css" />
        {/* aplica o tema salvo ANTES do paint pra não piscar (light→dark) no
            refresh. beforeInteractive injeta no HTML antes da hidratação;
            seta no <html> (sempre existe). Default: light no 1º acesso. */}
        <Script id="vautch-theme" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('vault.theme')||'light';document.documentElement.dataset.theme=t}catch(e){}})()`}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
