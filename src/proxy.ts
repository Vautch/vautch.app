import { type NextRequest } from "next/server";
import { updateSession } from "@/core/db/supabase/middleware";

// Next 16 renomeou "middleware" → "proxy" (mesma função, na borda).
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Tudo, EXCETO estáticos. Crucial: excluir as pastas públicas (/proto, /assets)
    // e extensões de asset (css/js/fontes), senão o middleware redireciona o
    // próprio CSS/JS pro /login quando não há sessão — e a página pública quebra.
    "/((?!_next/static|_next/image|favicon.ico|proto/|assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|mjs|woff|woff2|map)$).*)",
  ],
};
