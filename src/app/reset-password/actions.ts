"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/core/db/supabase/server";

/**
 * Define a nova senha. Só funciona com a sessão de recuperação ativa (criada
 * pelo /auth/callback ao abrir o link do e-mail). updateUser exige sessão válida.
 */
export async function updatePassword(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) {
    redirect(`/reset-password?error=${encodeURIComponent("as senhas não conferem")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/app");
}
