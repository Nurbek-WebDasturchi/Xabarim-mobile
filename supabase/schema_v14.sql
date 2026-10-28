-- v0.9.4: tarix tozalangandan keyin suhbat ro'yxatda qoladi ("Tarix tozalandi" belgisi bilan).
-- schema_v13.sql dan KEYIN Supabase SQL Editor'da ishga tushiring. Qayta ishga tushirsa ham xato bermaydi.
-- Busiz ham ilova ishlaydi, faqat tarix tozalangach suhbat ro'yxatdan yo'qoladi (eski xatti-harakat).

-- keep = true: "Tarixni tozalash" (suhbat ro'yxatda qoladi); keep = false: "Suhbatni o'chirish" (ro'yxatdan ketadi)
alter table public.chat_clears add column if not exists keep boolean not null default false;

drop function if exists public.clear_chat(uuid, boolean);
create or replace function public.clear_chat(p_peer uuid, p_both boolean default false, p_keep boolean default false)
returns void
language plpgsql security definer set search_path = public as $$
declare
  ts timestamptz := clock_timestamp();
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if p_both then
    delete from public.messages
    where room_id is null
      and ((sender = auth.uid() and receiver = p_peer) or (sender = p_peer and receiver = auth.uid()));
  end if;
  insert into public.chat_clears (user_id, peer, cleared_at, keep)
  values (auth.uid(), p_peer, ts, p_keep)
  on conflict (user_id, peer) do update set cleared_at = excluded.cleared_at, keep = excluded.keep;
  -- ikkala tomon uchun tozalansa, suhbatdoshda ham suhbat ro'yxatda qoladi
  if p_both then
    insert into public.chat_clears (user_id, peer, cleared_at, keep)
    values (p_peer, auth.uid(), ts, p_keep)
    on conflict (user_id, peer) do update set cleared_at = excluded.cleared_at, keep = excluded.keep;
  end if;
end $$;
revoke all on function public.clear_chat(uuid, boolean, boolean) from public;
grant execute on function public.clear_chat(uuid, boolean, boolean) to authenticated;

notify pgrst, 'reload schema';
