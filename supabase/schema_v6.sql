-- Public group usernames, discoverable group search, and shareable group links.
-- Run after schema_v5.sql.
alter table rooms add column if not exists username text;

update rooms
set username = coalesce(nullif(trim(both '-' from lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))), ''), 'group') || '-' || id::text
where kind = 'group' and username is null;

create unique index if not exists rooms_username_unique on rooms(username) where username is not null;

drop policy if exists "rooms: read" on rooms;
create policy "rooms: read" on rooms for select to authenticated using (kind in ('community', 'group') or is_member(id));

drop policy if exists "members: join community" on room_members;
create policy "members: join public room" on room_members for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from rooms r where r.id = room_id and r.kind in ('community', 'group')
  ));

create or replace function create_group(p_name text, p_usernames text[]) returns bigint
language plpgsql security definer set search_path = public as $$
declare rid bigint; base_slug text;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  base_slug := coalesce(nullif(trim(both '-' from lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'))), ''), 'group');
  insert into rooms (kind, name, created_by) values ('group', p_name, auth.uid()) returning id into rid;
  update rooms set username = base_slug || '-' || rid::text where id = rid;
  insert into room_members values (rid, auth.uid(), 'owner');
  insert into room_members select rid, id, 'member' from profiles
    where username = any (p_usernames[1:50]) and id <> auth.uid();
  return rid;
end $$;

grant execute on function create_group(text, text[]) to authenticated;
