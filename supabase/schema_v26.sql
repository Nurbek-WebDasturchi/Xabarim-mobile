-- v0.9.17: notification read state and community member directory.
-- Run in the Supabase SQL Editor after schema_v25.sql.
alter table public.notifications
  add column if not exists read_at timestamptz;

alter table public.notifications
  drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('follow', 'like', 'comment', 'xcoin'));

create or replace function public.community_members(p_room_id bigint)
returns table (user_id uuid, username text, full_name text, avatar_url text)
language sql security definer stable set search_path = public as $$
  select p.id, p.username, p.full_name, p.avatar_url
  from public.room_members m
  join public.profiles p on p.id = m.user_id
  join public.rooms r on r.id = m.room_id
  where m.room_id = p_room_id and r.kind = 'community'
  order by m.room_id, p.username;
$$;
revoke all on function public.community_members(bigint) from public;
grant execute on function public.community_members(bigint) to authenticated;

grant update (read_at) on public.notifications to authenticated;
drop policy if exists "notifications: update own" on public.notifications;
create policy "notifications: update own" on public.notifications
  for update to authenticated using (recipient = auth.uid()) with check (recipient = auth.uid());
