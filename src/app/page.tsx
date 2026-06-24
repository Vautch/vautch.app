import { redirect } from "next/navigation";

// A raiz manda pra timeline. Se não houver sessão, o middleware (proxy.ts)
// intercepta e redireciona pro /login antes de chegar aqui.
export default function Home() {
  redirect("/app");
}
