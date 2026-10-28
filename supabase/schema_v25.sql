-- v0.9.16: one-time @ceo XCoin grant and incoming-transfer notifications.
-- Run in Supabase SQL Editor after schema_v24.sql.

alter table public.xcoin_transactions
  drop constraint if exists xcoin_transactions_reason_check;
alter table public.xcoin_transactions
  add constraint xcoin_transactions_reason_check
  check (reason in (
    'referral', 'referral_signup', 'google_verification', 'premium_purchase',
    'admin_grant', 'admin_grant_uzb', 'admin_grant_ceo_1000',
    'transfer_sent', 'transfer_received'
  ));

alter table public.notifications
  drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('follow', 'like', 'comment', 'xcoin'));

do $$
declare target_id uuid;
begin
  select id into target_id from public.profiles where lower(username) = 'ceo';
  if target_id is null then raise exception 'PROFILE_CEO_NOT_FOUND'; end if;

  if not exists (
    select 1 from public.xcoin_transactions
    where user_id = target_id and reason = 'admin_grant_ceo_1000'
  ) then
    update public.profiles set xcoin_balance = xcoin_balance + 1000 where id = target_id;
    insert into public.xcoin_transactions (user_id, amount, reason)
      values (target_id, 1000, 'admin_grant_ceo_1000');
    insert into public.notifications (recipient, actor, kind, body)
      values (target_id, target_id, 'xcoin', '1000');
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
  insert into public.notifications (recipient, actor, kind, body)
    values (receiver_id, sender_id, 'xcoin', p_amount::text);

  select * into result from public.profiles where id = sender_id;
  return result;
end $$;

revoke all on function public.send_xcoin(text, integer) from public, anon;
grant execute on function public.send_xcoin(text, integer) to authenticated;

notify pgrst, 'reload schema';
