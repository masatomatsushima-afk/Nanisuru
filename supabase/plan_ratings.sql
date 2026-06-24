-- Nanisuru: プラン評価・フィードバック
-- Supabase SQL Editor で実行してください

create table if not exists public.plan_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  stars smallint not null check (stars between 1 and 5),
  feedback_tags text[] not null default '{}',
  plan_source text not null check (plan_source in ('home', 'imafima', 'best-day')),
  plan_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists plan_ratings_user_id_idx
  on public.plan_ratings (user_id, created_at desc);

create index if not exists plan_ratings_trip_id_idx
  on public.plan_ratings (trip_id)
  where trip_id is not null;

alter table public.plan_ratings enable row level security;

create policy "plan_ratings_select_own"
  on public.plan_ratings
  for select
  using (auth.uid() = user_id);

create policy "plan_ratings_insert_own"
  on public.plan_ratings
  for insert
  with check (auth.uid() = user_id);

create policy "plan_ratings_update_own"
  on public.plan_ratings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "plan_ratings_delete_own"
  on public.plan_ratings
  for delete
  using (auth.uid() = user_id);
