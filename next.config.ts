import type { NextConfig } from "next";

// CSP — frame-src libera SÓ os domínios dos embeds (ver docs/decisions/0001-embeds-spec.md).
// script/style ainda permissivos p/ não quebrar o Next; endurecer com nonces antes do launch (ADR 0002).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://api.microlink.io",
  "frame-src https://www.instagram.com https://www.youtube.com https://www.youtube-nocookie.com https://platform.twitter.com https://www.threads.net https://www.facebook.com https://www.tiktok.com https://player.vimeo.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // não expõe o código .tsx no DevTools em produção (ADR 0002)
  productionBrowserSourceMaps: false,
  // fixa a raiz neste app (evita o Next eleger o lockfile do repo externo)
  turbopack: { root: import.meta.dirname },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
