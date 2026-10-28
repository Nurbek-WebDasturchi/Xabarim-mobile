-- v0.9.1: "suhbatdosh uchun ham o'chirish" (tarix/suhbat) va xabarni faqat o'zim uchun o'chirish.
-- schema_v12.sql dan KEYIN Supabase SQL Editor'da ishga tushiring. Qayta ishga tushirsa ham xato bermaydi.

-- =====================================================================
-- 1) Xabarni faqat o'zim uchun yashirish ("delete for me")
-- =====================================================================
create table if not exists public.message_hides (
  user_id    uuid   not null default auth.uid() references public.profiles(id) on delete cascade,
  message_id bigint not null references public.messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);
alter table public.message_hides enable row level security;
drop policy if exists "message_hides: read own" on public.message_hides;
drop policy if exists "message_hides: add own" on public.message_hides;
create policy "message_hides: read own" on public.message_hides for select to authenticated using (user_id = auth.uid());
create policy "message_hides: add own"  on public.message_hides for insert to authenticated with check (user_id = auth.uid());
grant select, insert on public.message_hides to authenticated;

-- =====================================================================
-- 2) Suhbat tarixini tozalash: p_both = true bo'lsa ikkala tomondagi xabarlar ham o'chadi
-- =====================================================================
drop function if exists public.clear_chat(uuid);
create or replace function public.clear_chat(p_peer uuid, p_both boolean default false)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if p_both then
    delete from public.messages
    where room_id is null
      and ((sender = auth.uid() and receiver = p_peer) or (sender = p_peer and receiver = auth.uid()));
  end if;
  insert into public.chat_clears (user_id, peer, cleared_at)
  values (auth.uid(), p_peer, clock_timestamp())
  on conflict (user_id, peer) do update set cleared_at = clock_timestamp();
end $$;
revoke all on function public.clear_chat(uuid, boolean) from public;
grant execute on function public.clear_chat(uuid, boolean) to authenticated;

-- =====================================================================
-- 3) Xabarlarni o'qish: v12 qoidasi + o'zim yashirgan xabarlar ko'rinmaydi
-- =====================================================================
drop policy if exists "messages: read" on public.messages;
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
      or (room_id is not null and (sender = auth.uid() or public.is_member(room_id)))
    )
  );

notify pgrst, 'reload schema';
