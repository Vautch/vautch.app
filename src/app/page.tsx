"use client";

import Script from "next/script";
import { BODY_HTML } from "@/proto-markup";

/**
 * Port verbatim do protótipo: a marcação exata do <body> + o bundle (data.js +
 * app.js) carregado após interativo. Fidelidade 100% — refactor p/ componentes
 * React vem na fase seguinte. Ver docs/decisions/0001-embeds-spec.md.
 */
export default function Home() {
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
