-- schema_v20.sql: Admin panel (ro'yxatdan o'tganlar, vaqti/sanasi, onlayn foydalanuvchilar)
-- Supabase SQL Editor'da ishga tushiring (schema_v19.sql dan keyin).
-- Admin panel: /pages/admin.html
--
-- XAVFSIZLIK: statistika faqat quyidagi funksiyalar orqali olinadi va ularning har biri
-- chaqiruvchi admin ekanini tekshiradi. "admins" jadvalini oddiy foydalanuvchi o'qiy olmaydi.

-- 1) Adminlar ro'yxati
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;      -- policy yo'q => to'g'ridan-to'g'ri hech kim o'qiy olmaydi
revoke all on table public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 2) Umumiy ko'rsatkichlar. "Onlayn" = oxirgi 150 soniyada last_seen yangilangan
--    (ilova last_seen ni har 60 soniyada yangilaydi).
create or replace function public.admin_overview()
returns json language plpgsql stable security definer set search_path = public, auth as $$
declare
  tz   text := 'Asia/Tashkent';
  day0 timestamptz := date_trunc('day', now() at time zone 'Asia/Tashkent') at time zone 'Asia/Tashkent';
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return json_build_object(
    'total',      (select count(*) from public.profiles),
    'online',     (select count(*) from public.profiles where last_seen > now() - interval '150 seconds'),
    'active_24h', (select count(*) from public.profiles where last_seen > now() - interval '24 hours'),
    'new_today',  (select count(*) from public.profiles p join auth.users u on u.id = p.id where u.created_at >= day0),
    'new_7d',     (select count(*) from public.profiles p join auth.users u on u.id = p.id where u.created_at >= now() - interval '7 days'),
    'new_30d',    (select count(*) from public.profiles p join auth.users u on u.id = p.id where u.created_at >= now() - interval '30 days'),
    'server_time', now()
  );
end $$;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

-- 3) Foydalanuvchilar ro'yxati: ro'yxatdan o'tgan sana-vaqt (auth.users.created_at), oxirgi faollik, onlayn holati
create or replace function public.admin_users(
  p_limit int default 50, p_offset int default 0, p_search text default null, p_online_only boolean default false
)
returns table (
  id uuid, username text, full_name text, avatar_url text,
  registered_at timestamptz, last_seen timestamptz, online boolean, total_count bigint
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select p.id, p.username, p.full_name, p.avatar_url,
           u.created_at, p.last_seen,
           coalesce(p.last_seen > now() - interval '150 seconds', false),
           count(*) over ()
    from public.profiles p
    join auth.users u on u.id = p.id
    where (nullif(trim(p_search), '') is null
           or p.username ilike '%' || trim(p_search) || '%'
           or p.full_name ilike '%' || trim(p_search) || '%')
      and (not p_online_only or p.last_seen > now() - interval '150 seconds')
    order by u.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
    offset greatest(coalesce(p_offset, 0), 0);
end $$;
revoke all on function public.admin_users(int, int, text, boolean) from public, anon;
grant execute on function public.admin_users(int, int, text, boolean) to authenticated;

-- 4) Kunlar bo'yicha ro'yxatdan o'tganlar (Toshkent vaqti bilan)
create or replace function public.admin_signups_by_day(p_days int default 14)
returns table (day date, cnt bigint)
language plpgsql stable security definer set search_path = public, auth as $$
declare n int := least(greatest(coalesce(p_days, 14), 1), 90);
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select d::date, coalesce(c.cnt, 0)::bigint
    from generate_series(((now() at time zone 'Asia/Tashkent')::date - (n - 1))::timestamp, (now() at time zone 'Asia/Tashkent')::date::timestamp, interval '1 day') d
    left join (
      select (u.created_at at time zone 'Asia/Tashkent')::date as dd, count(*) as cnt
      from public.profiles p join auth.users u on u.id = p.id
      group by 1
    ) c on c.dd = d::date
    order by 1;
end $$;
revoke all on function public.admin_signups_by_day(int) from public, anon;
grant execute on function public.admin_signups_by_day(int) to authenticated;

notify pgrst, 'reload schema';

-- ======================================================================
-- 5) O'zingizni admin qiling (USERNAME o'rniga o'z username'ingizni yozing) va alohida ishga tushiring:
--
--   insert into public.admins (user_id)
--   select id from public.profiles where username = 'SIZNING_USERNAME'
--   on conflict do nothing;
-- ======================================================================
