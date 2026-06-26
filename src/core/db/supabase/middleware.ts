import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hardenCookie } from "./cookie-options";

/**
 * Mantém a sessão fresca a cada request (cookies httpOnly — ADR 0002).
 * Validação de authn só em rota privada. Se o Supabase ainda não estiver
 * configurado (sem env), não bloqueia — deixa o scaffold rodável.
 */
export async function updateSession(request: NextRequest) {
  // BYPASS DE LOGIN — APENAS LOCAL (dev). Gate DUPLO: só ativa se NODE_ENV não for
  // "production" (a Vercel sempre roda production → gate fecha) E se a flag
  // DEV_AUTH_BYPASS=1 existir, que só vive em `.env.local` (gitignored, nunca na
  // Vercel). Em produção é IMPOSSÍVEL de ligar. Deixa /app abrir sem sessão pra
  // testar a UI localmente (o RLS continua protegendo os dados — sem sessão, o
  // /api/items devolve 401 e o feed usa o cache/import local).
  if (process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS === "1") {
    return NextResponse.next({ request });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, hardenCookie(options)),
        );
      },
    },
  });

  // IMPORTANTE: não rodar lógica entre createServerClient e getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/login" || path === "/forgot" || path.startsWith("/auth");

  // Sem sessão em rota privada → manda pro login.
  if (!user && !isPublic) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    return NextResponse.redirect(redirect);
  }

  // Já logado tentando ver o login → manda pro app.
  if (user && path === "/login") {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/app";
    return NextResponse.redirect(redirect);
  }

  return response;
}
