import { NextResponse } from "next/server";
import { createClient } from "@/core/db/supabase/server";

type Item = Record<string, unknown> & { id?: unknown };
type Row = { user_id: string; id: string; data: Item; deleted_at: string | null };

/**
 * Camada de dados da timeline. O bundle (client) chama estas rotas; a auth é
 * 100% server-side (cookie httpOnly) e o RLS garante que cada um só toca os
 * próprios itens (auth.uid() = user_id). Ver ADR 0002 / 0004.
 *
 * Modelo: o item completo do bundle vai em `data` (jsonb); `deleted_at`
 * separa timeline de lixeira; `created_at` é a data real (default no banco).
 */

/** Lista os itens do usuário, separados em ativos e lixeira. */
export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("items")
    .select("id, data, deleted_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items: Item[] = [];
  const trash: Item[] = [];
  for (const row of data ?? []) {
    const item: Item = { ...(row.data as Item), id: row.id };
    if (row.deleted_at) trash.push(item);
    else items.push(item);
  }
  return NextResponse.json({ items, trash });
}

/** Sincroniza o estado completo (reconciliação full-state: upsert + apaga sumidos). */
export async function PUT(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json()) as { items?: Item[]; trash?: Item[] };
  const items = Array.isArray(body.items) ? body.items : [];
  const trash = Array.isArray(body.trash) ? body.trash : [];

  const toRow = (it: Item, deleted: string | null): Row => ({
    user_id: user.id,
    id: String(it.id),
    data: it,
    deleted_at: deleted,
  });
  const rows: Row[] = [
    ...items.map((it) => toRow(it, null)),
    ...trash.map((it) => toRow(it, new Date().toISOString())),
  ];

  // upsert preserva created_at (não incluído → default no insert, intocado no update)
  if (rows.length) {
    const { error } = await supabase.from("items").upsert(rows, { onConflict: "user_id,id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // reconciliação: apaga linhas que sumiram do client (RLS limita ao próprio user)
  const keep = new Set(rows.map((r) => r.id));
  const { data: existing } = await supabase.from("items").select("id");
  const toDelete = (existing ?? []).map((r) => r.id as string).filter((id) => !keep.has(id));
  if (toDelete.length) {
    await supabase.from("items").delete().in("id", toDelete);
  }

  return NextResponse.json({ ok: true, count: rows.length });
}
