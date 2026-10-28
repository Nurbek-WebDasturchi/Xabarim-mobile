-- v0.9.15: one-time @uzb bonus and safe XCoin transfers.
-- Run in Supabase SQL Editor after schema_v23.sql.

alter table public.xcoin_transactions
  drop constraint if exists xcoin_transactions_reason_check;

alter table public.xcoin_transactions
  add constraint xcoin_transactions_reason_check
  check (reason in (
    'referral', 'referral_signup', 'google_verification', 'premium_purchase',
    'admin_grant', 'admin_grant_uzb', 'transfer_sent', 'transfer_received'
  ));

do $$
declare target_id uuid;
begin
  select id into target_id from public.profiles where lower(username) = 'uzb';
  if target_id is null then
    raise exception 'PROFILE_UZB_NOT_FOUND';
  end if;
  if target_id is not null and not exists (
    select 1 from public.xcoin_transactions
    where user_id = target_id and reason = 'admin_grant_uzb'
  ) then
    update public.profiles set xcoin_balance = xcoin_balance + 100 where id = target_id;
    insert into public.xcoin_transactions (user_id, amount, reason)
    values (target_id, 100, 'admin_grant_uzb');
  end if;
end $$;

create or replace function public.send_xcoin(p_receiver_username text, p_amount integer)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  sender_id uuid := auth.uid();
  receiver_id uuid;
  sender_balance integer;
  result public.profiles;
begin
  if sender_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'XCOIN_INVALID_AMOUNT'; end if;

  select id into receiver_id
  from public.profiles
  where lower(username) = lower(trim(both '@' from coalesce(p_receiver_username, '')));
  if receiver_id is null then raise exception 'XCOIN_RECIPIENT_NOT_FOUND'; end if;
  if receiver_id = sender_id then raise exception 'XCOIN_SELF_TRANSFER'; end if;

  -- Lock both rows in a stable order so concurrent transfers cannot overspend or deadlock.
  perform id from public.profiles
  where id in (sender_id, receiver_id)
  order by id
  for update;

  select xcoin_balance into sender_balance from public.profiles where id = sender_id;
  if sender_balance is null or sender_balance < p_amount then
    raise exception 'XCOIN_INSUFFICIENT';
  end if;

  update public.profiles set xcoin_balance = xcoin_balance - p_amount where id = sender_id;
  update public.profiles set xcoin_balance = xcoin_balance + p_amount where id = receiver_id;
  insert into public.xcoin_transactions (user_id, amount, reason) values
    (sender_id, -p_amount, 'transfer_sent'),
    (receiver_id, p_amount, 'transfer_received');

  select * into result from public.profiles where id = sender_id;
  return result;
end $$;

revoke all on function public.send_xcoin(text, integer) from public, anon;
grant execute on function public.send_xcoin(text, integer) to authenticated;
