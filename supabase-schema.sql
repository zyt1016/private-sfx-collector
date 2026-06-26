-- Cloud SFX Collector schema
-- Run this in Supabase SQL Editor after creating a project.

create extension if not exists pgcrypto;

create table if not exists public.sounds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  original_name text not null,
  category text not null default '未分类',
  project text not null default '网页收集',
  tags text[] not null default '{}',
  notes text not null default '',
  favorite boolean not null default false,
  storage_path text not null,
  mime_type text not null default 'audio/mpeg',
  size_bytes bigint not null default 0,
  duration_seconds numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sounds_owner_created_idx
  on public.sounds(owner_id, created_at desc);

create index if not exists sounds_owner_category_idx
  on public.sounds(owner_id, category);

create index if not exists sounds_owner_project_idx
  on public.sounds(owner_id, project);

alter table public.sounds enable row level security;

drop policy if exists "sounds_select_own" on public.sounds;
create policy "sounds_select_own"
  on public.sounds for select
  using (auth.uid() = owner_id);

drop policy if exists "sounds_insert_own" on public.sounds;
create policy "sounds_insert_own"
  on public.sounds for insert
  with check (auth.uid() = owner_id);

drop policy if exists "sounds_update_own" on public.sounds;
create policy "sounds_update_own"
  on public.sounds for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "sounds_delete_own" on public.sounds;
create policy "sounds_delete_own"
  on public.sounds for delete
  using (auth.uid() = owner_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sounds_set_updated_at on public.sounds;
create trigger sounds_set_updated_at
before update on public.sounds
for each row execute function public.set_updated_at();

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  name text not null default '未命名设备',
  user_agent text not null default '',
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, device_id)
);

create index if not exists user_devices_owner_last_seen_idx
  on public.user_devices(owner_id, last_seen_at desc);

alter table public.user_devices enable row level security;

drop policy if exists "devices_select_own" on public.user_devices;
create policy "devices_select_own"
  on public.user_devices for select
  using (auth.uid() = owner_id);

drop policy if exists "devices_insert_own" on public.user_devices;
create policy "devices_insert_own"
  on public.user_devices for insert
  with check (auth.uid() = owner_id);

drop policy if exists "devices_update_own" on public.user_devices;
create policy "devices_update_own"
  on public.user_devices for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "devices_delete_own" on public.user_devices;
create policy "devices_delete_own"
  on public.user_devices for delete
  using (auth.uid() = owner_id);

drop trigger if exists user_devices_set_updated_at on public.user_devices;
create trigger user_devices_set_updated_at
before update on public.user_devices
for each row execute function public.set_updated_at();

-- Storage setup:
-- 1. In Supabase Dashboard > Storage, create a private bucket named: sfx-audio
-- 2. Then run the policies below.

insert into storage.buckets (id, name, public)
values ('sfx-audio', 'sfx-audio', false)
on conflict (id) do nothing;

drop policy if exists "audio_select_own_folder" on storage.objects;
create policy "audio_select_own_folder"
  on storage.objects for select
  using (
    bucket_id = 'sfx-audio'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "audio_insert_own_folder" on storage.objects;
create policy "audio_insert_own_folder"
  on storage.objects for insert
  with check (
    bucket_id = 'sfx-audio'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "audio_update_own_folder" on storage.objects;
create policy "audio_update_own_folder"
  on storage.objects for update
  using (
    bucket_id = 'sfx-audio'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "audio_delete_own_folder" on storage.objects;
create policy "audio_delete_own_folder"
  on storage.objects for delete
  using (
    bucket_id = 'sfx-audio'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
