import { NextResponse } from "next/server";
import { createClient } from "@/core/db/supabase/server";

/**
 * Troca o "code" (vindo da confirmação de e-mail ou do OAuth Google) por
 * uma sessão em cookie httpOnly. Ver ADR 0002.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // code presente mas troca falhou — caso clássico: link aberto em OUTRO
    // dispositivo (o verifier PKCE fica no aparelho que iniciou). O e-mail já
    // foi confirmado pelo Supabase; só falta logar aqui. Mensagem amigável.
    return NextResponse.redirect(`${origin}/login?message=link-ok`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
