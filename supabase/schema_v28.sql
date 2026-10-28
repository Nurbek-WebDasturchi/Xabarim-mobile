-- v0.9.19: allow authenticated users to read public community messages without joining.
-- Run in Supabase SQL Editor after schema_v27.sql.

drop policy if exists "messages: read" on public.messages;
drop policy if exists "messages: read own" on public.messages;

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
          or exists (
            select 1 from public.rooms r
            where r.id = messages.room_id and r.kind = 'community'
          )
        )
      )
    )
  );

notify pgrst, 'reload schema';
