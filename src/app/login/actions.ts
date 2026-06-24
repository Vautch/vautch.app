"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/core/db/supabase/server";
import { getOrigin } from "@/lib/origin";

/** Login email/senha. Sessão vai pra cookie httpOnly (via @supabase/ssr). */
export async function signIn(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/app");
}

/** Signup email/senha. Com confirmação de e-mail ligada, não cria sessão na hora. */
export async function signUp(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) {
    redirect(`/login?error=${encodeURIComponent("as senhas não conferem")}`);
  }

  const origin = await getOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  if (data.session) {
    redirect("/app"); // confirmação desligada → já entra
  }
  redirect("/login?message=check-email"); // confirmação ligada → checar e-mail
}
