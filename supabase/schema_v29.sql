-- v0.9.20: one-month Premium, official Xabarim welcome chat, and note reactions.
-- Run in Supabase SQL Editor after schema_v28.sql.

-- Fail before changing anything if the real Auth-backed service account is missing.
do $$
begin
  if not exists (select 1 from public.profiles where lower(username) = 'xabarim') then
    raise exception 'Create the official @xabarim account in Xabarim first, then rerun schema_v29.sql';
  end if;
end $$;

alter table public.profiles
  add column if not exists premium_started_at timestamptz,
  add column if not exists premium_until timestamptz,
  add column if not exists premium_welcome_at timestamptz,
  add column if not exists official boolean not null default false;

-- Existing lifetime Premium accounts receive one month from this migration.
update public.profiles
set premium_started_at = coalesce(premium_started_at, now()),
    premium_until = coalesce(premium_until, now() + interval '1 month')
where premium is true and premium_until is null;

update public.profiles
set official = true,
    full_name = 'Xabarim',
    premium = false,
    premium_started_at = null,
    premium_until = null
where lower(username) = 'xabarim';

-- Notify existing Premium subscribers once. The marker makes this safe to rerun.
with service as (
  select id from public.profiles where official order by username limit 1
), eligible as (
  update public.profiles p
  set premium_welcome_at = now()
  where p.premium is true
    and p.premium_until > now()
    and p.premium_welcome_at is null
    and p.official is false
  returning p.id, p.full_name, p.username, p.premium_until
)
insert into public.messages (sender, receiver, body, created_at, read)
select service.id,
       eligible.id,
       'Salom, ' || coalesce(nullif(eligible.full_name, ''), eligible.username) ||
       '! 🎉 Xabarim Premium obunangiz faollashtirildi. U ' ||
       to_char(eligible.premium_until at time zone 'Asia/Tashkent', 'DD.MM.YYYY') ||
       ' gacha amal qiladi. Savolingiz bo‘lsa, shu chatga yozavering — yordam beramiz! 💜',
       now(),
       false
from service cross join eligible;

create or replace function public.buy_xabarim_premium()
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  buyer_id uuid := auth.uid();
  service_id uuid;
  result public.profiles;
  expiry timestamptz;
begin
  if buyer_id is null then raise exception 'auth required'; end if;

  select id into service_id from public.profiles where official is true limit 1;
  if service_id is null then raise exception 'XABARIM_SERVICE_ACCOUNT_REQUIRED'; end if;

  select * into result from public.profiles where id = buyer_id for update;
  if result.id is null then raise exception 'profile not found'; end if;
  if result.premium_until > now() then raise exception 'PREMIUM_ALREADY_ACTIVE'; end if;
  if result.xcoin_balance < 50 then raise exception 'PREMIUM_REQUIRES_50_XCOIN'; end if;

  expiry := greatest(coalesce(result.premium_until, now()), now()) + interval '1 month';
  update public.profiles
  set xcoin_balance = xcoin_balance - 50,
      premium = true,
      premium_started_at = now(),
      premium_until = expiry,
      premium_welcome_at = now()
  where id = buyer_id
  returning * into result;

  insert into public.xcoin_transactions (user_id, amount, reason)
  values (buyer_id, -50, 'premium_purchase');

  insert into public.messages (sender, receiver, body, created_at, read)
  values (
    service_id,
    buyer_id,
    'Salom, ' || coalesce(nullif(result.full_name, ''), result.username) ||
    '! 🎉 Xabarim Premium obunangiz faollashtirildi. U ' ||
    to_char(expiry at time zone 'Asia/Tashkent', 'DD.MM.YYYY') ||
    ' gacha amal qiladi. Savolingiz bo‘lsa, shu chatga yozavering — yordam beramiz! 💜',
    now(),
    false
  );
  return result;
end;
$$;
revoke all on function public.buy_xabarim_premium() from public, anon;
grant execute on function public.buy_xabarim_premium() to authenticated;

create table if not exists public.note_reactions (
  note_user uuid not null references public.notes(user_id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '🔥', '😂', '🥰', '👏', '👍')),
  created_at timestamptz not null default now(),
  primary key (note_user, user_id)
);
create index if not exists note_reactions_note_idx on public.note_reactions(note_user);
alter table public.note_reactions enable row level security;
drop policy if exists "note reactions: read fresh" on public.note_reactions;
drop policy if exists "note reactions: add own" on public.note_reactions;
drop policy if exists "note reactions: update own" on public.note_reactions;
drop policy if exists "note reactions: delete own" on public.note_reactions;
create policy "note reactions: read fresh" on public.note_reactions
  for select to authenticated using (
    exists (select 1 from public.notes n where n.user_id = note_user and n.created_at > now() - interval '24 hours')
  );
create policy "note reactions: add own" on public.note_reactions
  for insert to authenticated with check (
    user_id = auth.uid() and note_user <> auth.uid()
    and exists (select 1 from public.notes n where n.user_id = note_user and n.created_at > now() - interval '24 hours')
  );
create policy "note reactions: update own" on public.note_reactions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "note reactions: delete own" on public.note_reactions
  for delete to authenticated using (user_id = auth.uid());
grant select, insert, update, delete on public.note_reactions to authenticated;

create or replace function public.set_note(p_text text)
returns public.notes
language plpgsql security definer set search_path = public as $$
declare
  t text := btrim(coalesce(p_text, ''));
  n public.notes;
  previous_text text;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if char_length(t) not between 1 and 60 then raise exception 'note must be 1-60 characters'; end if;
  select text into previous_text from public.notes where user_id = auth.uid();
  insert into public.notes (user_id, text, created_at)
  values (auth.uid(), t, now())
  on conflict (user_id) do update set text = excluded.text, created_at = now()
  returning * into n;
  if previous_text is distinct from t then
    delete from public.note_reactions where note_user = auth.uid();
  end if;
  return n;
end;
$$;
revoke all on function public.set_note(text) from public;
grant execute on function public.set_note(text) to authenticated;

notify pgrst, 'reload schema';
