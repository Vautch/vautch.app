import { headers } from "next/headers";

/** Origem real do request (http no localhost, https em produção). Server-only. */
export async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3210";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}
