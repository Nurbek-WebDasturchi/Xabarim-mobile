-- User-selected group usernames, group reports, and group member/invite UI support.
-- Run after schema_v6.sql.

create unique index if not exists rooms_username_lower_unique
  on rooms(lower(username)) where username is not null;

drop function if exists create_group(text, text[]);
create or replace function create_group(p_name text, p_username text, p_usernames text[]) returns bigint
language plpgsql security definer set search_path = public as $$
declare rid bigint; clean_username text;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  clean_username := lower(regexp_replace(trim(both '@' from trim(p_username)), '^@+', ''));
  if clean_username !~ '^[a-z0-9_]{3,30}$' then raise exception 'invalid group username'; end if;
  insert into rooms (kind, name, username, created_by)
    values ('group', p_name, clean_username, auth.uid()) returning id into rid;
  insert into room_members values (rid, auth.uid(), 'owner');
  insert into room_members select rid, id, 'member' from profiles
    where username = any (p_usernames[1:50]) and id <> auth.uid();
  return rid;
end $$;
grant execute on function create_group(text, text, text[]) to authenticated;

create table if not exists group_reports (
  id bigint generated always as identity primary key,
  room_id bigint not null references rooms(id) on delete cascade,
  reporter uuid not null default auth.uid() references profiles(id) on delete cascade,
  reason text not null check (reason in ('spam','abuse','inappropriate','other')),
  details text check (char_length(details) <= 500),
  created_at timestamptz not null default now(),
  unique(room_id, reporter)
);
alter table group_reports enable row level security;
drop policy if exists "group_reports: insert own" on group_reports;
create policy "group_reports: insert own" on group_reports for insert to authenticated
  with check (reporter = auth.uid() and exists (select 1 from rooms where rooms.id = room_id and rooms.kind = 'group'));
grant insert on group_reports to authenticated;
