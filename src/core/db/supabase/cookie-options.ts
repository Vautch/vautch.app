import type { CookieOptions } from "@supabase/ssr";

/**
 * Endurece os cookies de sessão (ADR 0002): httpOnly + Secure + SameSite=Lax.
 *
 * O @supabase/ssr, por padrão, NÃO marca o auth-token como httpOnly — porque o
 * client de browser deles lê o cookie. No Vautch toda autenticação passa pelo
 * SERVIDOR (server actions, route handlers, middleware), então forçamos httpOnly:
 * o JavaScript do browser não consegue ler o token → XSS não rouba a sessão.
 *
 * `secure` só em produção (no localhost http, secure:true impediria o cookie de
 * ser setado).
 */
export function hardenCookie(options: CookieOptions): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  };
}
