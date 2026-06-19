import { createBrowserClient } from "@supabase/ssr";

/** Client Supabase para o browser. Usa o anon key (público, seguro com RLS ligado). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
