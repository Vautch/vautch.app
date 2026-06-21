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
          href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/proto/style.css" />
        {/* aplica o tema salvo ANTES do paint pra não piscar (light→dark) no
            refresh. beforeInteractive injeta no HTML antes da hidratação;
            seta no <html> (sempre existe). Default: light no 1º acesso. */}
        <Script id="vautch-theme" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('vault.theme')||'light';var r=document.documentElement;r.dataset.theme=t;r.style.background=(t==='dark'?'#131316':'#f4efe6');r.classList.add('theme-init');}catch(e){}})()`}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
