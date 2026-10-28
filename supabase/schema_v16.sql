-- v0.9.9: large media forwarding via server-side Storage copy.
-- Run after schema_v15.sql in Supabase SQL Editor. Idempotent.
-- A user can copy only files referenced by messages they are already allowed to read.
drop policy if exists "storage: copy files from visible messages" on storage.objects;
create policy "storage: copy files from visible messages"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'files'
    and exists (
      select 1
      from public.messages m
      where split_part(m.file_url, '/object/public/files/', 2) = storage.objects.name
    )
  );

notify pgrst, 'reload schema';
