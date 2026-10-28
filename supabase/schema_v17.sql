-- schema_v17.sql: fayl/video limiti 10 MB -> 100 MB
-- schema_v16.sql dan keyin Supabase SQL Editor'da ishga tushiring.

-- 1) "files" bucket limiti
update storage.buckets set file_size_limit = 104857600 where id = 'files';

-- 2) messages.file_size cheklovi
alter table messages drop constraint if exists messages_file_size_check;
alter table messages add constraint messages_file_size_check
  check (file_size is null or file_size <= 104857600);

notify pgrst, 'reload schema';

-- ESLATMA: Supabase Free rejasida global limit 50 MB. 100 MB uchun Dashboard ->
-- Storage -> Settings -> "Upload file size limit" ni 100 MB qiling (Pro reja kerak).
