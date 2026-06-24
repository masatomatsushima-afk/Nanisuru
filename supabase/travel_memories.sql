-- Nanisuru: ユーザーの旅行メモリー（好み・嗜好）
-- Supabase SQL Editor で実行してください

create table if not exists public.travel_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (
    category in (
      'food',
      'travel_style',
      'budget',
      'activities',
      'dislikes',
      'companion',
      'destinations'
    )
  ),
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists travel_memories_user_id_idx
  on public.travel_memories (user_id, updated_at desc);

create index if not exists travel_memories_user_category_idx
  on public.travel_memories (user_id, category);

alter table public.travel_memories enable row level security;

create policy "travel_memories_select_own"
  on public.travel_memories
  for select
  using (auth.uid() = user_id);

create policy "travel_memories_insert_own"
  on public.travel_memories
  for insert
  with check (auth.uid() = user_id);

create policy "travel_memories_update_own"
  on public.travel_memories
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "travel_memories_delete_own"
  on public.travel_memories
  for delete
  using (auth.uid() = user_id);
