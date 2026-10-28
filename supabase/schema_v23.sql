-- v0.9.14: safely reset Gmail verification when a user replaces their Google identity.
-- Verification bonus is lifetime-once and cannot be earned again after changing Gmail.
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
      xcoin_balance = xcoin_balance + case when not exists (
        select 1 from public.xcoin_transactions
        where user_id = auth.uid() and reason = 'google_verification'
      ) then 10 else 0 end
  where id = auth.uid()
  returning * into result;
  if result.id is null then raise exception 'profile not found'; end if;

  if not exists (
    select 1 from public.xcoin_transactions
    where user_id = auth.uid() and reason = 'google_verification'
  ) then
    insert into public.xcoin_transactions (user_id, amount, reason)
      values (auth.uid(), 10, 'google_verification');
  end if;
  return result;
end $$;

create or replace function public.reset_google_verification()
returns public.profiles language plpgsql security definer set search_path = public, auth as $$
declare result public.profiles;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if exists (
    select 1 from auth.identities i
    where i.user_id = auth.uid() and i.provider = 'google'
  ) then
    raise exception 'GOOGLE_IDENTITY_STILL_LINKED';
  end if;
  update public.profiles set google_verified = false
  where id = auth.uid()
  returning * into result;
  if result.id is null then raise exception 'profile not found'; end if;
  return result;
end $$;

grant execute on function public.verify_google_account(), public.reset_google_verification() to authenticated;
