import { type NextRequest } from "next/server";
import { updateSession } from "@/core/db/supabase/middleware";

// Next 16 renomeou "middleware" → "proxy" (mesma função, na borda).
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // tudo, exceto estáticos e imagens
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
