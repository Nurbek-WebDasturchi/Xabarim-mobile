-- v0.9.12: XCoin, taklif havolalari, Google tasdiqlash va Xabarim Premium.
-- schema_v20.sql dan keyin Supabase SQL Editor'da bir marta ishga tushiring.

alter table public.profiles
  add column if not exists xcoin_balance integer not null default 0 check (xcoin_balance >= 0),
  add column if not exists google_verified boolean not null default false,
  add column if not exists premium boolean not null default false,
  add column if not exists referral_code text;

update public.profiles
set referral_code = lower(substr(replace(id::text, '-', ''), 1, 10))
where referral_code is null;

alter table public.profiles
  alter column referral_code set not null;
create unique index if not exists profiles_referral_code_key on public.profiles (referral_code);

create table if not exists public.referrals (
  referred_id uuid primary key references public.profiles(id) on delete cascade,
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (referred_id <> referrer_id)
);

create table if not exists public.xcoin_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount <> 0),
  reason text not null check (reason in ('referral', 'referral_signup', 'google_verification', 'premium_purchase')),
  created_at timestamptz not null default now()
);

alter table public.referrals enable row level security;
alter table public.xcoin_transactions enable row level security;
create policy "referrals: read involved" on public.referrals for select to authenticated
  using (referrer_id = auth.uid() or referred_id = auth.uid());
create policy "xcoin transactions: read own" on public.xcoin_transactions for select to authenticated
  using (user_id = auth.uid());
grant select on public.referrals, public.xcoin_transactions to authenticated;

-- Profil trigger'i ro'yxatdan o'tishdagi referral kodini xavfsiz tekshiradi.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
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
end $$;

-- Faqat Supabase OAuth'dagi haqiqiy gmail.com Google identity tasdiqlanadi.
create or replace function public.verify_google_account()
returns public.profiles language plpgsql security definer set search_path = public, auth as $$
declare result public.profiles;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if not exists (
    select 1 from auth.identities i
    where i.user_id = auth.uid()
      and i.provider = 'google'
      and lower(coalesce(i.identity_data->>'email', '')) like '%@gmail.com'
  ) then
    raise exception 'GOOGLE_GMAIL_REQUIRED';
  end if;
  update public.profiles
  set google_verified = true,
      xcoin_balance = xcoin_balance + case when google_verified then 0 else 10 end
  where id = auth.uid()
  returning * into result;
  if result.id is null then raise exception 'profile not found'; end if;
  if result.xcoin_balance >= 10 and not exists (
    select 1 from public.xcoin_transactions where user_id = auth.uid() and reason = 'google_verification'
  ) then
    insert into public.xcoin_transactions (user_id, amount, reason)
      values (auth.uid(), 10, 'google_verification');
  end if;
  return result;
end $$;

create or replace function public.buy_xabarim_premium()
returns public.profiles language plpgsql security definer set search_path = public, auth as $$
declare result public.profiles;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  update public.profiles
  set xcoin_balance = xcoin_balance - 50, premium = true
  where id = auth.uid() and premium = false and xcoin_balance >= 50
  returning * into result;
  if result.id is null then
    raise exception 'PREMIUM_REQUIRES_50_XCOIN';
  end if;
  insert into public.xcoin_transactions (user_id, amount, reason)
    values (auth.uid(), -50, 'premium_purchase');
  return result;
end $$;

revoke update on public.profiles from authenticated;
grant update (username, full_name, avatar_url, bio) on public.profiles to authenticated;
grant execute on function public.verify_google_account(), public.buy_xabarim_premium() to authenticated;
