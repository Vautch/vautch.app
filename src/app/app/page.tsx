"use client";

import Script from "next/script";
import { BODY_HTML } from "@/proto-markup";

/**
 * Timeline do Vautch (rota privada — protegida pelo middleware/proxy).
 * Port verbatim do protótipo: marcação do <body> + bundle (data.js + app.js)
 * carregado após interativo. Refactor p/ componentes React vem depois.
 * Ver docs/decisions/0001-embeds-spec.md.
 */
export default function AppPage() {
  return (
    <>
      <div
        style={{ display: "contents" }}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: BODY_HTML }}
      />
      <Script src="/proto/bundle.js" strategy="afterInteractive" />
    </>
  );
}
