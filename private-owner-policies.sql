drop policy if exists "sounds_select_own" on public.sounds;
create policy "sounds_select_own"
  on public.sounds for select
  using (auth.uid() = owner_id and lower(auth.jwt() ->> 'email') = '2213074048@qq.com');

drop policy if exists "sounds_insert_own" on public.sounds;
create policy "sounds_insert_own"
  on public.sounds for insert
  with check (auth.uid() = owner_id and lower(auth.jwt() ->> 'email') = '2213074048@qq.com');

drop policy if exists "sounds_update_own" on public.sounds;
create policy "sounds_update_own"
  on public.sounds for update
  using (auth.uid() = owner_id and lower(auth.jwt() ->> 'email') = '2213074048@qq.com')
  with check (auth.uid() = owner_id and lower(auth.jwt() ->> 'email') = '2213074048@qq.com');

drop policy if exists "sounds_delete_own" on public.sounds;
create policy "sounds_delete_own"
  on public.sounds for delete
  using (auth.uid() = owner_id and lower(auth.jwt() ->> 'email') = '2213074048@qq.com');

drop policy if exists "devices_select_own" on public.user_devices;
create policy "devices_select_own"
  on public.user_devices for select
  using (auth.uid() = owner_id and lower(auth.jwt() ->> 'email') = '2213074048@qq.com');

drop policy if exists "devices_insert_own" on public.user_devices;
create policy "devices_insert_own"
  on public.user_devices for insert
  with check (auth.uid() = owner_id and lower(auth.jwt() ->> 'email') = '2213074048@qq.com');

drop policy if exists "devices_update_own" on public.user_devices;
create policy "devices_update_own"
  on public.user_devices for update
  using (auth.uid() = owner_id and lower(auth.jwt() ->> 'email') = '2213074048@qq.com')
  with check (auth.uid() = owner_id and lower(auth.jwt() ->> 'email') = '2213074048@qq.com');

drop policy if exists "storage_select_own_audio" on storage.objects;
create policy "storage_select_own_audio"
  on storage.objects for select
  using (
    bucket_id = 'sfx-audio'
    and auth.uid()::text = (storage.foldername(name))[1]
    and lower(auth.jwt() ->> 'email') = '2213074048@qq.com'
  );

drop policy if exists "storage_insert_own_audio" on storage.objects;
create policy "storage_insert_own_audio"
  on storage.objects for insert
  with check (
    bucket_id = 'sfx-audio'
    and auth.uid()::text = (storage.foldername(name))[1]
    and lower(auth.jwt() ->> 'email') = '2213074048@qq.com'
  );

drop policy if exists "storage_delete_own_audio" on storage.objects;
create policy "storage_delete_own_audio"
  on storage.objects for delete
  using (
    bucket_id = 'sfx-audio'
    and auth.uid()::text = (storage.foldername(name))[1]
    and lower(auth.jwt() ->> 'email') = '2213074048@qq.com'
  );
