-- Nanisuru: 公開プロフィール & フォロー
-- Supabase SQL Editor で実行してください

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  bio text not null default '',
  style_tags text[] not null default '{}',
  follower_count integer not null default 0,
  following_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_display_name_idx
  on public.user_profiles (display_name);

alter table public.user_profiles enable row level security;

create policy "user_profiles_public_read"
  on public.user_profiles
  for select
  using (true);

create policy "user_profiles_insert_own"
  on public.user_profiles
  for insert
  with check (auth.uid() = user_id);

create policy "user_profiles_update_own"
  on public.user_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.user_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists user_follows_follower_idx
  on public.user_follows (follower_id);

create index if not exists user_follows_following_idx
  on public.user_follows (following_id);

alter table public.user_follows enable row level security;

create policy "user_follows_read"
  on public.user_follows
  for select
  using (true);

create policy "user_follows_insert_own"
  on public.user_follows
  for insert
  with check (auth.uid() = follower_id);

create policy "user_follows_delete_own"
  on public.user_follows
  for delete
  using (auth.uid() = follower_id);

create or replace function public.refresh_user_follow_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_name text;
begin
  if tg_op = 'INSERT' then
    select creator_display_name
    into target_name
    from public.public_plans
    where user_id = new.following_id
    limit 1;

    insert into public.user_profiles (user_id, display_name)
    values (new.following_id, coalesce(target_name, 'Nanisuruユーザー'))
    on conflict (user_id) do nothing;

    insert into public.user_profiles (user_id, display_name)
    values (new.follower_id, 'Nanisuruユーザー')
    on conflict (user_id) do nothing;

    update public.user_profiles
    set follower_count = follower_count + 1, updated_at = now()
    where user_id = new.following_id;

    update public.user_profiles
    set following_count = following_count + 1, updated_at = now()
    where user_id = new.follower_id;

    return new;
  elsif tg_op = 'DELETE' then
    update public.user_profiles
    set follower_count = greatest(follower_count - 1, 0), updated_at = now()
    where user_id = old.following_id;

    update public.user_profiles
    set following_count = greatest(following_count - 1, 0), updated_at = now()
    where user_id = old.follower_id;

    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists user_follows_count_trigger on public.user_follows;
create trigger user_follows_count_trigger
after insert or delete on public.user_follows
for each row execute function public.refresh_user_follow_counts();
