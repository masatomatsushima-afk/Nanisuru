-- Nanisuru: 共有プランへのリアクション（ログイン不要）
-- Supabase SQL Editor で実行してください

create table if not exists public.shared_trip_reactions (
  id uuid primary key default gen_random_uuid(),
  shared_plan_id uuid not null references public.shared_trips (id) on delete cascade,
  reaction_type text not null check (
    reaction_type in (
      '行きたい',
      '微妙',
      'ここ良い',
      '変更したい',
      '高そう',
      '楽しそう'
    )
  ),
  created_at timestamptz not null default now()
);

create index if not exists shared_trip_reactions_plan_id_idx
  on public.shared_trip_reactions (shared_plan_id, created_at desc);

create index if not exists shared_trip_reactions_type_idx
  on public.shared_trip_reactions (shared_plan_id, reaction_type);

alter table public.shared_trip_reactions enable row level security;

create policy "shared_trip_reactions_public_read"
  on public.shared_trip_reactions
  for select
  using (true);

create policy "shared_trip_reactions_public_insert"
  on public.shared_trip_reactions
  for insert
  with check (true);
