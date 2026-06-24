import { NextResponse } from "next/server";
import { createClient } from "@/core/db/supabase/server";

/** Logout: encerra a sessão e limpa o cookie httpOnly. Redireciona pro login. */
export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/login`, { status: 303 });
}
