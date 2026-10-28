-- v0.7.1: jamiyatlarda a'zolar soni
-- schema_v2.sql'dan KEYIN Supabase SQL Editor'da ishga tushiring.
-- room_members'ga RLS tufayli foydalanuvchi faqat o'z qatorlarini ko'radi,
-- shuning uchun sonni security definer funksiya orqali beramiz.
create or replace function community_counts()
returns table (room_id bigint, members int)
language sql security definer stable set search_path = public as $$
  select r.id, count(m.user_id)::int
  from rooms r
  left join room_members m on m.room_id = r.id
  where r.kind = 'community'
  group by r.id
$$;
revoke all on function community_counts() from public;
grant execute on function community_counts() to authenticated;
