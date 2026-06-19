import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Mantém a sessão fresca a cada request (cookies httpOnly — ADR 0002).
 * Validação de authn só em rota privada. Se o Supabase ainda não estiver
 * configurado (sem env), não bloqueia — deixa o scaffold rodável.
 */
export async function updateSession(request: NextRequest) {
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
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANTE: não rodar lógica entre createServerClient e getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Rotas privadas (ativar quando /app e /login existirem):
  // if (!user && request.nextUrl.pathname.startsWith("/app")) {
  //   const redirect = request.nextUrl.clone();
  //   redirect.pathname = "/login";
  //   return NextResponse.redirect(redirect);
  // }
  void user;

  return response;
}
