-- Nanisuru: 旅行プラン共有テーブル
-- Supabase SQL Editor で実行してください

create table if not exists public.shared_trips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists shared_trips_created_at_idx on public.shared_trips (created_at desc);

alter table public.shared_trips enable row level security;

create policy "shared_trips_public_read"
  on public.shared_trips
  for select
  using (true);

create policy "shared_trips_public_insert"
  on public.shared_trips
  for insert
  with check (true);
