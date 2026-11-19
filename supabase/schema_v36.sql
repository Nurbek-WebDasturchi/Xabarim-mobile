-- Xabarim native post media storage. Apply after schema_v35.sql.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-media', 'post-media', true, 52428800, array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "post media upload own" on storage.objects;
create policy "post media upload own" on storage.objects for insert to authenticated
with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "post media read visible posts" on storage.objects;
create policy "post media read visible posts" on storage.objects for select to authenticated
using (
  bucket_id = 'post-media' and exists (
    select 1 from public.posts p join public.profiles owner on owner.id = p.author
    where p.image_url like '%/object/public/post-media/' || storage.objects.name
      and (owner.id = auth.uid() or not owner.is_private or exists (
        select 1 from public.follows f where f.follower = auth.uid() and f.following = owner.id
      ))
  )
);

drop policy if exists "post media delete own" on storage.objects;
create policy "post media delete own" on storage.objects for delete to authenticated
using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';
