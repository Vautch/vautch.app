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
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
