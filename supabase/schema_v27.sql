-- v0.9.18: 1 XCoin referral rewards and verified 5 XCoin Telegram task.
-- Run in Supabase SQL Editor after schema_v26.sql.

-- Existing installations created the signup trigger in schema_v21.sql,
-- so replace it here to apply the new referral amounts to future signups.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_profile public.profiles;
  referrer uuid;
  referral text := lower(trim(coalesce(new.raw_user_meta_data->>'referral_code', '')));
begin
  insert into public.profiles (id, username, full_name, avatar_url, referral_code)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'username',''),
      left(coalesce(nullif(regexp_replace(lower(split_part(new.email,'@',1)),'[^a-z0-9_]','','g'),''),'user'),24) || floor(random()*1000)::int),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    lower(substr(replace(new.id::text, '-', ''), 1, 10))
  ) returning * into new_profile;

  if referral <> '' then
    select id into referrer from public.profiles where referral_code = referral;
    if referrer is not null and referrer <> new.id then
      insert into public.referrals (referred_id, referrer_id) values (new.id, referrer)
        on conflict (referred_id) do nothing;
      if found then
        update public.profiles set xcoin_balance = xcoin_balance + 1 where id in (new.id, referrer);
        insert into public.xcoin_transactions (user_id, amount, reason) values
          (new.id, 1, 'referral_signup'), (referrer, 1, 'referral');
      end if;
    end if;
  end if;
  return new;
end;
$$;

create table if not exists public.telegram_reward_claims (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  claimed_at timestamptz not null default now()
);
alter table public.telegram_reward_claims enable row level security;
revoke all on public.telegram_reward_claims from public, anon, authenticated;

alter table public.profiles add column if not exists telegram_linked boolean not null default false;
create table if not exists public.telegram_account_links (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  telegram_id bigint not null unique
);
alter table public.telegram_account_links enable row level security;
revoke all on public.telegram_account_links from public, anon, authenticated;
grant select on public.telegram_account_links to service_role;

create or replace function public.link_telegram_account(p_user_id uuid, p_telegram_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public, auth
as $$
declare linked_id bigint;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  insert into public.telegram_account_links (user_id, telegram_id)
    values (p_user_id, p_telegram_id)
    on conflict (user_id) do update set telegram_id = excluded.telegram_id
      where telegram_account_links.telegram_id = excluded.telegram_id
    returning telegram_id into linked_id;
  if linked_id is null then raise exception 'TELEGRAM_ACCOUNT_ALREADY_LINKED'; end if;
  update public.profiles set telegram_linked = true where id = p_user_id;
  return linked_id;
exception when unique_violation then
  raise exception 'TELEGRAM_ACCOUNT_ALREADY_LINKED';
end;
$$;
revoke all on function public.link_telegram_account(uuid, bigint) from public, anon, authenticated;
grant execute on function public.link_telegram_account(uuid, bigint) to service_role;

alter table public.xcoin_transactions
  drop constraint if exists xcoin_transactions_reason_check;
alter table public.xcoin_transactions
  add constraint xcoin_transactions_reason_check
  check (reason in (
    'referral', 'referral_signup', 'google_verification', 'premium_purchase',
    'admin_grant', 'admin_grant_uzb', 'admin_grant_ceo_1000',
    'transfer_sent', 'transfer_received', 'telegram_join'
  ));

create or replace function public.claim_telegram_reward(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare new_balance integer;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  insert into public.telegram_reward_claims (user_id)
    values (p_user_id) on conflict (user_id) do nothing;
  if not found then raise exception 'TELEGRAM_REWARD_ALREADY_CLAIMED'; end if;
  update public.profiles set xcoin_balance = xcoin_balance + 5
    where id = p_user_id returning xcoin_balance into new_balance;
  if new_balance is null then raise exception 'profile not found'; end if;
  insert into public.xcoin_transactions (user_id, amount, reason)
    values (p_user_id, 5, 'telegram_join');
  return new_balance;
end;
$$;

revoke all on function public.claim_telegram_reward(uuid) from public, anon, authenticated;
grant execute on function public.claim_telegram_reward(uuid) to service_role;
