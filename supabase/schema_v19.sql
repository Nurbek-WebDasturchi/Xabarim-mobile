-- schema_v19.sql: xabarlarga reaksiya (animatsiyali stikerlar)
-- Supabase SQL Editor'da ishga tushiring (schema_v18.sql dan keyin).
-- Ovozli xabar uchun alohida migratsiya kerak emas (oddiy fayl sifatida "files" bucket'ga yuklanadi).

create table if not exists public.message_reactions (
  message_id bigint not null references public.messages(id) on delete cascade,
  user_id    uuid   not null default auth.uid() references public.profiles(id) on delete cascade,
  emoji      text   not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)   -- bir odam bir xabarga bitta reaksiya
);
create index if not exists message_reactions_message_idx on public.message_reactions (message_id);

alter table public.message_reactions enable row level security;
grant select, insert, update, delete on table public.message_reactions to authenticated;

-- Reaksiyani faqat o'sha xabarni ko'ra oladigan odam ko'radi (messages jadvalidagi RLS qoidalari amal qiladi)
drop policy if exists "message_reactions: read" on public.message_reactions;
create policy "message_reactions: read" on public.message_reactions
  for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_reactions.message_id));

drop policy if exists "message_reactions: insert" on public.message_reactions;
create policy "message_reactions: insert" on public.message_reactions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.messages m where m.id = message_reactions.message_id)
  );

drop policy if exists "message_reactions: update own" on public.message_reactions;
create policy "message_reactions: update own" on public.message_reactions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "message_reactions: delete own" on public.message_reactions;
create policy "message_reactions: delete own" on public.message_reactions
  for delete to authenticated
  using (user_id = auth.uid());

-- Realtime: reaksiya boshqa odamda ham darhol ko'rinadi
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;

notify pgrst, 'reload schema';
