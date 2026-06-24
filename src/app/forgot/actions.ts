"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/core/db/supabase/server";
import { getOrigin } from "@/lib/origin";

/**
 * Envia o e-mail de recuperação. O link leva pro /auth/callback (troca o code
 * por uma sessão de recuperação) e segue pro /reset-password pra definir a nova.
 * Não revela se o e-mail existe (resposta sempre "enviado") — anti-enumeração.
 */
export async function requestReset(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const origin = await getOrigin();

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  redirect("/forgot?message=sent");
}
