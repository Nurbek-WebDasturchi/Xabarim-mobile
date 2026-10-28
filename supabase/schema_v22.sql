-- v0.9.13: XCoin bonus for @ceo and @vip.
alter table public.xcoin_transactions
  drop constraint if exists xcoin_transactions_reason_check;

alter table public.xcoin_transactions
  add constraint xcoin_transactions_reason_check
  check (reason in ('referral', 'referral_signup', 'google_verification', 'premium_purchase', 'admin_grant'));

do $$
declare target record;
begin
  for target in
    select id from public.profiles
    where lower(username) in ('ceo', 'vip')
  loop
    if not exists (
      select 1 from public.xcoin_transactions
      where user_id = target.id and reason = 'admin_grant'
    ) then
      update public.profiles
      set xcoin_balance = xcoin_balance + 50
      where id = target.id;

      insert into public.xcoin_transactions (user_id, amount, reason)
      values (target.id, 50, 'admin_grant');
    end if;
  end loop;
end $$;
