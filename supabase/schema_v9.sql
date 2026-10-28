-- v0.13: let a group owner delete their group. Run after schema_v8.sql.
create or replace function public.delete_group(p_room bigint)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if not exists (
    select 1 from public.rooms r
    join public.room_members m on m.room_id = r.id
    where r.id = p_room and r.kind = 'group'
      and m.user_id = auth.uid() and m.role = 'owner'
  ) then raise exception 'only group owner can delete this group'; end if;
  delete from public.rooms where id = p_room and kind = 'group';
end $$;
revoke all on function public.delete_group(bigint) from public;
grant execute on function public.delete_group(bigint) to authenticated;
