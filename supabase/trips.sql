-- Nanisuru: ログインユーザーの保存プラン（trips）
-- Supabase SQL Editor で実行してください

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists trips_user_id_created_at_idx
  on public.trips (user_id, created_at desc);

alter table public.trips enable row level security;

create policy "trips_select_own"
  on public.trips
  for select
  using (auth.uid() = user_id);

create policy "trips_insert_own"
  on public.trips
  for insert
  with check (auth.uid() = user_id);

create policy "trips_delete_own"
  on public.trips
  for delete
  using (auth.uid() = user_id);
