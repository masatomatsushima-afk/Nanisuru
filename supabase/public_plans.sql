-- Nanisuru: コミュニティ公開プラン（発見タブ）
-- Supabase SQL Editor で実行してください

create table if not exists public.public_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_trip_id uuid references public.trips (id) on delete set null,
  title text not null,
  description text not null default '',
  category text not null check (
    category in ('デート', '友達', '一人', '家族', '旅行', 'グルメ')
  ),
  tags text[] not null default '{}',
  visibility text not null default 'public' check (
    visibility in ('public', 'unlisted', 'private')
  ),
  creator_display_name text not null,
  payload jsonb not null,
  like_count integer not null default 0,
  save_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists public_plans_visibility_created_at_idx
  on public.public_plans (visibility, created_at desc);

create index if not exists public_plans_visibility_like_count_idx
  on public.public_plans (visibility, like_count desc);

create index if not exists public_plans_category_idx
  on public.public_plans (category);

create index if not exists public_plans_tags_idx
  on public.public_plans using gin (tags);

create index if not exists public_plans_user_source_trip_idx
  on public.public_plans (user_id, source_trip_id);

create table if not exists public.public_plan_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  public_plan_id uuid not null references public.public_plans (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, public_plan_id)
);

create index if not exists public_plan_likes_plan_id_idx
  on public.public_plan_likes (public_plan_id);

create table if not exists public.public_plan_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  public_plan_id uuid not null references public.public_plans (id) on delete cascade,
  saved_trip_id uuid references public.trips (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, public_plan_id)
);

create index if not exists public_plan_saves_plan_id_idx
  on public.public_plan_saves (public_plan_id);

-- like_count / save_count を自動更新
create or replace function public.refresh_public_plan_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.public_plans
    set like_count = like_count + 1, updated_at = now()
    where id = new.public_plan_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.public_plans
    set like_count = greatest(like_count - 1, 0), updated_at = now()
    where id = old.public_plan_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists public_plan_likes_count_trigger on public.public_plan_likes;
create trigger public_plan_likes_count_trigger
after insert or delete on public.public_plan_likes
for each row execute function public.refresh_public_plan_like_count();

create or replace function public.refresh_public_plan_save_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.public_plans
    set save_count = save_count + 1, updated_at = now()
    where id = new.public_plan_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.public_plans
    set save_count = greatest(save_count - 1, 0), updated_at = now()
    where id = old.public_plan_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists public_plan_saves_count_trigger on public.public_plan_saves;
create trigger public_plan_saves_count_trigger
after insert or delete on public.public_plan_saves
for each row execute function public.refresh_public_plan_save_count();

alter table public.public_plans enable row level security;
alter table public.public_plan_likes enable row level security;
alter table public.public_plan_saves enable row level security;

create policy "public_plans_read_discoverable"
  on public.public_plans
  for select
  using (
    visibility in ('public', 'unlisted')
    or auth.uid() = user_id
  );

create policy "public_plans_insert_own"
  on public.public_plans
  for insert
  with check (auth.uid() = user_id);

create policy "public_plans_update_own"
  on public.public_plans
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "public_plans_delete_own"
  on public.public_plans
  for delete
  using (auth.uid() = user_id);

create policy "public_plan_likes_read"
  on public.public_plan_likes
  for select
  using (true);

create policy "public_plan_likes_insert_own"
  on public.public_plan_likes
  for insert
  with check (auth.uid() = user_id);

create policy "public_plan_likes_delete_own"
  on public.public_plan_likes
  for delete
  using (auth.uid() = user_id);

create policy "public_plan_saves_read_own"
  on public.public_plan_saves
  for select
  using (auth.uid() = user_id);

create policy "public_plan_saves_insert_own"
  on public.public_plan_saves
  for insert
  with check (auth.uid() = user_id);

create policy "public_plan_saves_delete_own"
  on public.public_plan_saves
  for delete
  using (auth.uid() = user_id);
