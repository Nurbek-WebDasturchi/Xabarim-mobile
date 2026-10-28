-- v0.8: Obunachilar (follow), xabar holati (yuborildi / yetkazildi / ko'rildi), note va post lentalari
-- schema.sql -> schema_v2.sql -> schema_v3.sql dan KEYIN Supabase SQL Editor'da bir marta ishga tushiring.
-- Qayta ishga tushirsangiz ham xato bermaydi (idempotent).

-- =====================================================================
-- 1) Obunachilar (Instagram kabi: kim kimga obuna)
-- =====================================================================
create table if not exists follows (
  follower   uuid not null default auth.uid() references profiles(id) on delete cascade,
  following  uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, following),
  check (follower <> following)
);
create index if not exists follows_following_idx on follows (following, created_at desc);
create index if not exists follows_follower_idx  on follows (follower,  created_at desc);

alter table follows enable row level security;
drop policy if exists "follows: read"     on follows;
drop policy if exists "follows: follow"   on follows;
drop policy if exists "follows: unfollow" on follows;
-- obunachilar soni va ro'yxati hamma uchun ochiq (Instagram'dagi ochiq akkaunt kabi)
create policy "follows: read"     on follows for select to authenticated using (true);
create policy "follows: follow"   on follows for insert to authenticated with check (follower = auth.uid());
create policy "follows: unfollow" on follows for delete to authenticated using (follower = auth.uid());

-- Profil uchun hammasi bir so'rovda: obunachilar soni, obunalar soni, men obunamanmi, u menga obunami
create or replace function follow_stats(p_user uuid)
returns table (followers_count int, following_count int, i_follow boolean, follows_me boolean)
language sql stable set search_path = public as $$
  select
    (select count(*) from follows where following = p_user)::int,
    (select count(*) from follows where follower  = p_user)::int,
    exists (select 1 from follows where follower = auth.uid() and following = p_user),
    exists (select 1 from follows where follower = p_user and following = auth.uid())
$$;

-- p_kind = 'followers' (obunachilari) yoki 'following' (obunalari); eng yangisi birinchi
create or replace function follow_list(p_user uuid, p_kind text, p_limit int default 200)
returns setof profiles
language sql stable set search_path = public as $$
  select p.*
  from follows f
  join profiles p on p.id = case when p_kind = 'followers' then f.follower else f.following end
  where case when p_kind = 'followers' then f.following else f.follower end = p_user
  order by f.created_at desc
  limit least(coalesce(p_limit, 200), 500)
$$;

-- =====================================================================
-- 2) Note lentasi: o'zim + obuna bo'lganlarim + suhbatdoshlarim (24 soat ichidagilar)
--    Ko'p obunachi bo'lsa ham bitta so'rov bilan keladi (URL uzun bo'lib ketmaydi)
-- =====================================================================
create or replace function feed_notes()
returns setof notes
language sql stable set search_path = public as $$
  select n.*
  from notes n
  where n.created_at > now() - interval '24 hours'
    and (
      n.user_id = auth.uid()
      or n.user_id in (select following from follows where follower = auth.uid())
      or n.user_id in (
        select distinct case when m.sender = auth.uid() then m.receiver else m.sender end
        from messages m
        where m.room_id is null and auth.uid() in (m.sender, m.receiver)
      )
    )
  order by (n.user_id = auth.uid()) desc, n.created_at desc
  limit 80
$$;

-- Post lentasi: faqat obuna bo'lganlarim (va o'zimning) postlarim
create or replace function feed_posts(p_limit int default 50)
returns setof posts
language sql stable set search_path = public as $$
  select p.*
  from posts p
  where p.author = auth.uid()
     or p.author in (select following from follows where follower = auth.uid())
  order by p.created_at desc
  limit least(coalesce(p_limit, 50), 100)
$$;

-- =====================================================================
-- 3) Xabar holati: yuborildi -> yetkazildi -> ko'rildi
-- =====================================================================
alter table messages add column if not exists delivered_at timestamptz;
alter table messages add column if not exists read_at      timestamptz;

-- Qabul qiluvchi xabarning faqat holat ustunlarini o'zgartira oladi (matn / fayl / jo'natuvchi o'zgarmaydi).
-- SQL Editor (auth.uid() = null) uchun cheklov yo'q.
create or replace function messages_status_guard()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and
     (new.sender, new.receiver, new.room_id, new.body, new.file_url, new.file_name, new.file_type, new.file_size, new.created_at)
     is distinct from
     (old.sender, old.receiver, old.room_id, old.body, old.file_url, old.file_name, old.file_type, old.file_size, old.created_at)
  then
    raise exception 'messages: faqat holat (delivered/read) o''zgartiriladi';
  end if;

  new.read := coalesce(old.read, false) or coalesce(new.read, false);        -- "ko'rildi" qaytmaydi
  if new.read and old.read_at is null then
    new.read_at := coalesce(new.read_at, now());
  else
    new.read_at := old.read_at;
  end if;
  new.delivered_at := coalesce(old.delivered_at, new.delivered_at,
                               case when new.read then coalesce(new.read_at, now()) end);
  return new;
end $$;

drop trigger if exists messages_status_guard on messages;
create trigger messages_status_guard before update on messages
  for each row execute function messages_status_guard();

-- Eski o'qilgan xabarlar uchun vaqt (trigger delivered_at ni ham to'ldiradi)
update messages set read_at = created_at where read and read_at is null and receiver is not null;

-- =====================================================================
-- 4) Ruxsatlar
-- =====================================================================
revoke all on function follow_stats(uuid)           from public;
revoke all on function follow_list(uuid, text, int) from public;
revoke all on function feed_notes()                 from public;
revoke all on function feed_posts(int)              from public;
grant execute on function follow_stats(uuid)           to authenticated;
grant execute on function follow_list(uuid, text, int) to authenticated;
grant execute on function feed_notes()                 to authenticated;
grant execute on function feed_posts(int)              to authenticated;
