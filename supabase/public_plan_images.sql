-- Nanisuru: 公開プラン画像
-- Supabase SQL Editor で実行してください

create table if not exists public.public_plan_images (
  id uuid primary key default gen_random_uuid(),
  public_plan_id uuid not null references public.public_plans (id) on delete cascade,
  image_url text not null,
  storage_path text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  unique (public_plan_id, order_index)
);

create index if not exists public_plan_images_plan_id_idx
  on public.public_plan_images (public_plan_id, order_index asc);

alter table public.public_plan_images enable row level security;

create policy "public_plan_images_read_public_plans"
  on public.public_plan_images
  for select
  using (
    exists (
      select 1
      from public.public_plans plan
      where plan.id = public_plan_id
        and (
          plan.visibility in ('public', 'unlisted')
          or plan.user_id = auth.uid()
        )
    )
  );

create policy "public_plan_images_insert_own"
  on public.public_plan_images
  for insert
  with check (
    exists (
      select 1
      from public.public_plans plan
      where plan.id = public_plan_id
        and plan.user_id = auth.uid()
    )
  );

create policy "public_plan_images_update_own"
  on public.public_plan_images
  for update
  using (
    exists (
      select 1
      from public.public_plans plan
      where plan.id = public_plan_id
        and plan.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.public_plans plan
      where plan.id = public_plan_id
        and plan.user_id = auth.uid()
    )
  );

create policy "public_plan_images_delete_own"
  on public.public_plan_images
  for delete
  using (
    exists (
      select 1
      from public.public_plans plan
      where plan.id = public_plan_id
        and plan.user_id = auth.uid()
    )
  );

-- Storage bucket（公開プラン画像のみ）
insert into storage.buckets (id, name, public)
values ('public-plan-images', 'public-plan-images', true)
on conflict (id) do update set public = excluded.public;

create policy "public_plan_images_storage_read"
  on storage.objects
  for select
  using (bucket_id = 'public-plan-images');

create policy "public_plan_images_storage_insert_own"
  on storage.objects
  for insert
  with check (
    bucket_id = 'public-plan-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "public_plan_images_storage_update_own"
  on storage.objects
  for update
  using (
    bucket_id = 'public-plan-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'public-plan-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "public_plan_images_storage_delete_own"
  on storage.objects
  for delete
  using (
    bucket_id = 'public-plan-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
