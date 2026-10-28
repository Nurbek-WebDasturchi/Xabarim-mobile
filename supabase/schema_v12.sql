-- v0.9.0: xabarni o'chirish, bloklash, do'stlar (contacts), suhbat tarixini tozalash.
-- schema_v11.sql dan KEYIN Supabase SQL Editor'da ishga tushiring. Qayta ishga tushirsa ham xato bermaydi.

-- =====================================================================
-- 1) Xabarni o'chirish
--    - chat: faqat o'zim yuborgan xabarni (hamma uchun) o'chiraman
--    - guruh: o'zimning xabarimni; guruh egasi esa guruhdagi istalgan xabarni
--    - jamiyat: faqat o'zimning xabarimni
-- =====================================================================
create or replace function public.is_room_owner(r bigint)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.room_members
    where room_id = r and user_id = auth.uid() and role = 'owner'
  )
$$;
revoke all on function public.is_room_owner(bigint) from public;
grant execute on function public.is_room_owner(bigint) to authenticated;

drop policy if exists "messages: delete" on public.messages;
create policy "messages: delete" on public.messages
  for delete to authenticated
  using (sender = auth.uid() or (room_id is not null and public.is_room_owner(room_id)));
grant delete on public.messages to authenticated;

-- xabar bilan yuborilgan faylni o'zim o'chira olishim uchun (xotira tejaladi)
drop policy if exists "storage: delete own files" on storage.objects;
create policy "storage: delete own files" on storage.objects
  for delete to authenticated
  using (bucket_id in ('avatars', 'files') and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- 2) Bloklash. Bloklangan juftlik o'rtasida (ikki tomonga ham) yangi xabar yuborib bo'lmaydi.
--    Guruh va jamiyat xabarlariga ta'sir qilmaydi.
-- =====================================================================
create table if not exists public.blocks (
  blocker    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  blocked    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.blocks enable row level security;
drop policy if exists "blocks: read own" on public.blocks;
drop policy if exists "blocks: block" on public.blocks;
drop policy if exists "blocks: unblock" on public.blocks;
create policy "blocks: read own" on public.blocks for select to authenticated using (blocker = auth.uid());
create policy "blocks: block"    on public.blocks for insert to authenticated with check (blocker = auth.uid());
create policy "blocks: unblock"  on public.blocks for delete to authenticated using (blocker = auth.uid());
grant select, insert, delete on public.blocks to authenticated;

-- RLS qoidasi ichida ishlatiladi: ikkinchi tomon meni bloklaganini ham ko'ra olishi kerak (security definer)
create or replace function public.chat_blocked(p_other uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker = auth.uid() and blocked = p_other)
       or (blocker = p_other and blocked = auth.uid())
  )
$$;
revoke all on function public.chat_blocked(uuid) from public;
grant execute on function public.chat_blocked(uuid) to authenticated;

drop policy if exists "messages: send" on public.messages;
create policy "messages: send" on public.messages
  for insert to authenticated
  with check (
    sender = auth.uid()
    and (
      (room_id is not null and public.is_member(room_id))
      or (room_id is null and not public.chat_blocked(receiver))
    )
  );

-- =====================================================================
-- 3) Suhbat tarixini tozalash / suhbatni o'chirish (faqat o'zim uchun; suhbatdoshda xabarlar qoladi)
--    Tozalash vaqtigacha bo'lgan xabarlar RLS orqali yashiriladi, shuning uchun
--    chatlar ro'yxati, o'qilmaganlar soni va xabarlar so'rovi o'zi to'g'ri ishlaydi.
-- =====================================================================
create table if not exists public.chat_clears (
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  peer       uuid not null references public.profiles(id) on delete cascade,
  cleared_at timestamptz not null default now(),
  primary key (user_id, peer)
);
alter table public.chat_clears enable row level security;
drop policy if exists "chat_clears: read own" on public.chat_clears;
create policy "chat_clears: read own" on public.chat_clears for select to authenticated using (user_id = auth.uid());
grant select on public.chat_clears to authenticated;

create or replace function public.clear_chat(p_peer uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  insert into public.chat_clears (user_id, peer, cleared_at)
  values (auth.uid(), p_peer, clock_timestamp())
  on conflict (user_id, peer) do update set cleared_at = clock_timestamp();
end $$;
revoke all on function public.clear_chat(uuid) from public;
grant execute on function public.clear_chat(uuid) to authenticated;

-- xabarlarni o'qish: guruh/jamiyat xabarlari avvalgidek; shaxsiy chatda tozalangan qismi ko'rinmaydi
drop policy if exists "messages: read" on public.messages;
drop policy if exists "messages: read own" on public.messages;
create policy "messages: read" on public.messages
  for select to authenticated
  using (
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
  );

-- =====================================================================
-- 4) Do'stlar (contacts kabi: bir tomonlama ro'yxat, so'rov/tasdiq yo'q)
-- =====================================================================
create table if not exists public.friends (
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  friend_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
create index if not exists friends_user_idx on public.friends (user_id, created_at desc);
alter table public.friends enable row level security;
drop policy if exists "friends: read own" on public.friends;
drop policy if exists "friends: add" on public.friends;
drop policy if exists "friends: remove" on public.friends;
create policy "friends: read own" on public.friends for select to authenticated using (user_id = auth.uid());
create policy "friends: add"      on public.friends for insert to authenticated with check (user_id = auth.uid());
create policy "friends: remove"   on public.friends for delete to authenticated using (user_id = auth.uid());
grant select, insert, delete on public.friends to authenticated;

-- mening do'stlarim profillari, ism bo'yicha tartiblangan
create or replace function public.friend_list()
returns setof public.profiles
language sql stable set search_path = public as $$
  select p.*
  from public.friends f
  join public.profiles p on p.id = f.friend_id
  where f.user_id = auth.uid()
  order by lower(coalesce(nullif(p.full_name, ''), p.username))
$$;
revoke all on function public.friend_list() from public;
grant execute on function public.friend_list() to authenticated;

notify pgrst, 'reload schema';
