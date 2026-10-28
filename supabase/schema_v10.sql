-- v0.14: note saqlash xatosi, o'qilmagan chatlar soni (nechta odamdan), bildirishnomalar.
-- schema_v9.sql dan KEYIN Supabase SQL Editor'da ishga tushiring. Qayta ishga tushirsa ham xato bermaydi.

-- =====================================================================
-- 1) NOTE BUG: 24 soatdan oshgan eski note qatori jadvalda qoladi. Yangi note upsert qilinganda
--    Postgres mavjud qatorni SELECT siyosati orqali tekshiradi -> "muddati o'tgan" qator ko'rinmay,
--    upsert RLS xatosi bilan yiqiladi. Yechim: o'z note'ingni doim ko'rish + set_note() funksiyasi.
-- =====================================================================
drop policy if exists "notes: read fresh" on public.notes;
create policy "notes: read fresh" on public.notes
  for select to authenticated
  using (created_at > now() - interval '24 hours' or user_id = auth.uid());

create or replace function public.set_note(p_text text)
returns public.notes
language plpgsql security definer set search_path = public as $$
declare
  t text := btrim(coalesce(p_text, ''));
  n public.notes;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if char_length(t) not between 1 and 60 then raise exception 'note must be 1-60 characters'; end if;
  insert into public.notes (user_id, text, created_at)
  values (auth.uid(), t, now())
  on conflict (user_id) do update set text = excluded.text, created_at = now()
  returning * into n;
  return n;
end $$;
revoke all on function public.set_note(text) from public;
grant execute on function public.set_note(text) to authenticated;

-- muddati o'tgan eski note'larni tozalash (bir martalik)
delete from public.notes where created_at < now() - interval '24 hours';

-- =====================================================================
-- 2) O'qilmagan chatlar soni = nechta ODAMDAN xabar kelgan (xabarlar soni emas)
-- =====================================================================
create index if not exists messages_unread_idx on public.messages (receiver) where read = false and room_id is null;

create or replace function public.unread_chat_count()
returns int
language sql stable set search_path = public as $$
  select count(distinct sender)::int
  from public.messages
  where receiver = auth.uid() and read = false and room_id is null
$$;
revoke all on function public.unread_chat_count() from public;
grant execute on function public.unread_chat_count() to authenticated;

-- =====================================================================
-- 3) Bildirishnomalar (follow / like / comment). v5 ishga tushmagan bo'lsa ham to'liq tiklanadi.
--    Takroriy bildirishnoma (tez-tez like/unlike) yuborilmaydi.
-- =====================================================================
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  recipient uuid not null references public.profiles(id) on delete cascade,
  actor uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('follow','like','comment')),
  post_id bigint references public.posts(id) on delete cascade,
  body text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_recipient_created_idx on public.notifications (recipient, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "notifications: read own" on public.notifications;
drop policy if exists "notifications: update own" on public.notifications;
create policy "notifications: read own" on public.notifications for select to authenticated using (recipient = auth.uid());
create policy "notifications: update own" on public.notifications for update to authenticated
  using (recipient = auth.uid()) with check (recipient = auth.uid());
grant select, update on public.notifications to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

create or replace function public.notify_new_follow() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.follower <> new.following
     and not exists (select 1 from notifications
                     where recipient = new.following and actor = new.follower and kind = 'follow' and read_at is null) then
    insert into notifications (recipient, actor, kind) values (new.following, new.follower, 'follow');
  end if;
  return new;
end $$;
drop trigger if exists notify_new_follow on public.follows;
create trigger notify_new_follow after insert on public.follows for each row execute function public.notify_new_follow();

create or replace function public.notify_post_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner_id uuid; actor_id uuid;
begin
  select author into owner_id from posts where id = new.post_id;
  actor_id := new.user_id;
  if owner_id is null or owner_id = actor_id then return new; end if;
  if tg_table_name = 'post_comments' then
    insert into notifications (recipient, actor, kind, post_id, body) values (owner_id, actor_id, 'comment', new.post_id, new.body);
  elsif not exists (select 1 from notifications
                    where recipient = owner_id and actor = actor_id and kind = 'like' and post_id = new.post_id
                      and created_at > now() - interval '1 hour') then
    insert into notifications (recipient, actor, kind, post_id) values (owner_id, actor_id, 'like', new.post_id);
  end if;
  return new;
end $$;
drop trigger if exists notify_post_comment on public.post_comments;
create trigger notify_post_comment after insert on public.post_comments for each row execute function public.notify_post_activity();
drop trigger if exists notify_post_reaction on public.post_reactions;
create trigger notify_post_reaction after insert on public.post_reactions for each row execute function public.notify_post_activity();

notify pgrst, 'reload schema';
