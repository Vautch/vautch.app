-- ============================================================
-- VAUTCH — MIGRATION 0001 — schema inicial + RLS (Fase 0)
-- ============================================================
-- Rodar no Supabase: Dashboard → SQL Editor → cola tudo → Run.
-- Idempotente (IF NOT EXISTS / DROP IF EXISTS) — pode rodar de novo sem quebrar.
--
-- Princípio (ADR 0002): default-deny. RLS ligado em TODA tabela.
-- auth.uid() = user_id em cada SELECT/INSERT/UPDATE/DELETE.
-- Mesmo que alguém pesque a publishable key no DevTools, só acessa o
-- próprio user_id — nunca dados de outro usuário.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILES — espelha auth.users (dados públicos do app)
--    Senha/hash NUNCA chegam aqui — ficam só em auth.users (GoTrue).
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. ITEMS — a timeline cronológica
--    Design jsonb: o item completo do bundle vive em `data` (source, cat,
--    subcat, type, title, body, embed, url, stats, author, image, thumb…).
--    Colunas promovidas só pro que o banco precisa operar. Robusto p/
--    "salvar qualquer coisa" — nunca perde campo; filtragem é client-side.
--    `id` é TEXTO (id gerado pelo client: v<ts>, seed-N…). PK composta
--    (user_id, id) evita colisão entre usuários. Ver ADR 0004.
-- ------------------------------------------------------------
create table if not exists public.items (
  user_id     uuid not null references auth.users(id) on delete cascade,
  id          text not null,
  data        jsonb not null,             -- item completo do bundle
  deleted_at  timestamptz,                -- soft delete (lixeira). null = ativo
  created_at  timestamptz not null default now(),  -- data REAL (destrava lembrete matinal)
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);

-- ------------------------------------------------------------
-- 3. ÍNDICE — scroll cronológico rápido (timeline ativa, lixeira fora)
-- ------------------------------------------------------------
create index if not exists idx_items_user_created
  on public.items (user_id, created_at desc)
  where deleted_at is null;

-- ============================================================
-- 3b. GRANTS — acesso de TABELA por role
--   anon  → NADA (fica 100% bloqueado, nem chega no RLS)
--   authenticated → CRUD (o RLS por cima limita aos próprios dados)
--   Necessário porque este projeto não concede privilégios automaticamente
--   a tabelas criadas via SQL — sem isso, o usuário logado leva "permission denied".
-- ============================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.items    to authenticated;
revoke all on public.profiles from anon;
revoke all on public.items    from anon;

-- ============================================================
-- 4. ROW LEVEL SECURITY — default-deny
-- ============================================================
alter table public.profiles enable row level security;
alter table public.items    enable row level security;

-- PROFILES — cada um só o próprio
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check ((select auth.uid()) = id);

-- ITEMS — cada um só os próprios (4 operações)
drop policy if exists "items_select_own" on public.items;
create policy "items_select_own" on public.items
  for select using ((select auth.uid()) = user_id);

drop policy if exists "items_insert_own" on public.items;
create policy "items_insert_own" on public.items
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "items_update_own" on public.items;
create policy "items_update_own" on public.items
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "items_delete_own" on public.items;
create policy "items_delete_own" on public.items
  for delete using ((select auth.uid()) = user_id);

-- ============================================================
-- 5. TRIGGER — cria profile automaticamente no signup
--    SECURITY DEFINER + search_path travado (anti-hijack).
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 6. updated_at automático
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists items_touch_updated on public.items;
create trigger items_touch_updated
  before update on public.items
  for each row execute function public.touch_updated_at();

-- ============================================================
-- 7. STORAGE — bucket privado de mídia (RLS por pasta user_id)
--    Caminho dos arquivos: {user_id}/{nome}.webp
-- ============================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

drop policy if exists "media_insert_own" on storage.objects;
create policy "media_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media'
    and (select auth.uid())::text = (storage.foldername(name))[1]);

drop policy if exists "media_select_own" on storage.objects;
create policy "media_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'media'
    and (select auth.uid())::text = (storage.foldername(name))[1]);

drop policy if exists "media_update_own" on storage.objects;
create policy "media_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'media'
    and (select auth.uid())::text = (storage.foldername(name))[1]);

drop policy if exists "media_delete_own" on storage.objects;
create policy "media_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media'
    and (select auth.uid())::text = (storage.foldername(name))[1]);

-- ============================================================
-- FIM — RLS default-deny ativo. Nenhum dado cruza entre usuários.
-- ============================================================
