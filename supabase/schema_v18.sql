-- schema_v18.sql: Global lenta (hamma postlar) ishlashi uchun
-- Supabase SQL Editor'da ishga tushiring (schema_v17.sql dan keyin).

-- 1) "authenticated" roli postlar va profillarni o'qiy olsin
grant select on table public.posts to authenticated;
grant select on table public.profiles to authenticated;

-- 2) postlarni hamma (kirgan) foydalanuvchi o'qiy oladi
alter table public.posts enable row level security;
drop policy if exists "posts: read" on public.posts;
create policy "posts: read" on public.posts
  for select to authenticated using (true);

-- 3) Global lenta funksiyasi: hamma postlarni qaytaradi
create or replace function public.global_posts(p_limit int default 50)
returns setof public.posts
language sql stable security definer set search_path = public as $$
  select p.*
  from public.posts p
  order by p.created_at desc
  limit least(coalesce(p_limit, 50), 100)
$$;
revoke all on function public.global_posts(int) from public;
grant execute on function public.global_posts(int) to authenticated;

notify pgrst, 'reload schema';
