-- v0.9.7: xabarni uzatish (muallif belgisi bilan). Saqlangan xabarlar uchun migratsiya KERAK EMAS.
-- schema_v14.sql dan KEYIN Supabase SQL Editor'da ishga tushiring. Qayta ishga tushirsa ham xato bermaydi.
-- Busiz ham uzatish ishlaydi, lekin "Muallif bilan" tanlansa ham xabar muallif belgisisiz boradi.

alter table public.messages add column if not exists fwd_from uuid;   -- asl muallif (profiles.id), qasddan FK emas
alter table public.messages add column if not exists fwd_name text;   -- asl muallif ismi (uzatilgan paytdagi)
alter table public.messages add column if not exists fwd_src  text;   -- guruhdan uzatilgan bo'lsa, guruh nomi

notify pgrst, 'reload schema';
