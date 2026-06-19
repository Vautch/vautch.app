/**
 * Modelo de domínio do item salvo no Vautch. Camada PURA (zero imports de Next/React)
 * — compartilhável com extensão de browser e app Capacitor. Ver docs/system-design.md.
 * Derivado do protótipo (../prototype/js/data.js).
 */

export type Platform =
  | "instagram"
  | "facebook"
  | "youtube"
  | "tiktok"
  | "twitter"
  | "threads"
  | "vimeo"
  | "web"
  | "nota"
  | "print";

export type ItemType = "video" | "recipe" | "quote" | "note" | "image" | "link";

export interface Item {
  id: string;
  userId: string; // dono — base do RLS (auth.uid() = user_id)
  source: Platform;
  type: ItemType;
  cat: string; // categoria (tag)
  subcat?: string | null; // subtag opcional
  title?: string | null;
  body?: string | null;
  quote?: string | null; // type: "quote"
  list?: string[] | null; // type: "recipe"
  thumb?: string | null;
  image?: string | null; // mídia (print/upload) — WebP, EXIF removido
  embed?: string | null; // HTML do iframe resolvido (ver 0001-embeds-spec.md)
  url?: string | null; // link original
  createdAt: string; // ISO timestamp
}
