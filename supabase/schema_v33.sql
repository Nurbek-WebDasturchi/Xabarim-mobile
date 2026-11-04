-- mobile v4
-- Non-members can read only the latest five messages in a community.
-- Members retain full history; group room policies remain unchanged.
drop policy if exists "messages: read" on public.messages;
drop policy if exists "messages: read own" on public.messages;

create or replace function public.can_read_room_message(p_room bigint, p_message bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.rooms r
    where r.id = p_room
      and r.kind = 'community'
      and p_message in (
        select recent.id
        from public.messages recent
        where recent.room_id = p_room
        order by recent.created_at desc, recent.id desc
        limit 5
      )
  );
$$;
revoke all on function public.can_read_room_message(bigint, bigint) from public;
grant execute on function public.can_read_room_message(bigint, bigint) to authenticated;

create policy "messages: read" on public.messages
  for select to authenticated
  using (
    not exists (
      select 1 from public.message_hides h
      where h.user_id = auth.uid() and h.message_id = messages.id
    )
    and (
      (
        room_id is null
        and auth.uid() in (sender, receiver)
        and not exists (
          select 1 from public.chat_clears c
          where c.user_id = auth.uid()
            and c.peer = case when messages.sender = auth.uid() then messages.receiver else messages.sender end
            and messages.created_at <= c.cleared_at
        )
      )
      or (
        room_id is not null
        and (
          sender = auth.uid()
          or public.is_member(room_id)
          or public.can_read_room_message(room_id, id)
        )
      )
    )
  );

notify pgrst, 'reload schema';

create or replace function public.community_message_counts()
returns table (room_id bigint, message_count bigint)
language sql stable security definer set search_path = public as $$
  select m.room_id, count(*)::bigint
  from public.messages m
  join public.rooms r on r.id = m.room_id and r.kind = 'community'
  group by m.room_id;
$$;
revoke all on function public.community_message_counts() from public;
grant execute on function public.community_message_counts() to authenticated;
notify pgrst, 'reload schema';
