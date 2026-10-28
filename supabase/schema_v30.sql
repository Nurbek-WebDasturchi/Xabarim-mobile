-- Run after schema_v29.sql. Community members may leave in the client;
-- user bans are unique per reporter and target and handled atomically here.
create table if not exists public.user_bans (
  id bigint generated always as identity primary key,
  target uuid not null references public.profiles(id) on delete cascade,
  reporter uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('spam', 'abuse', 'inappropriate', 'other')),
  details text check (char_length(details) <= 500),
  created_at timestamptz not null default now(),
  unique (target, reporter),
  check (target <> reporter)
);
alter table public.user_bans enable row level security;
revoke all on public.user_bans from anon, authenticated;

create or replace function public.ban_user(
  p_target uuid,
  p_reason text,
  p_details text default null,
  p_language text default 'uz'
)
returns table (ban_count integer, account_deleted boolean)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  reporter_id uuid := auth.uid();
  service_id uuid;
  target_name text;
  total integer;
  lang text := case when lower(p_language) in ('uz','ru','en') then lower(p_language) else 'uz' end;
  warning text;
begin
  if reporter_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_target is null or p_target = reporter_id then raise exception 'INVALID_TARGET'; end if;
  if p_reason not in ('spam', 'abuse', 'inappropriate', 'other') then raise exception 'INVALID_REASON'; end if;

  -- Serialize reports for each target so the fifth distinct ban cannot be missed.
  select coalesce(nullif(p.full_name, ''), p.username) into target_name
  from public.profiles p where p.id = p_target for update;
  if target_name is null then raise exception 'TARGET_NOT_FOUND'; end if;

  select p.id into service_id from public.profiles p
  where p.official is true and lower(p.username) = 'xabarim'
  order by p.id limit 1;
  if service_id is null then raise exception 'XABARIM_SERVICE_ACCOUNT_REQUIRED'; end if;
  if p_target = service_id then raise exception 'OFFICIAL_ACCOUNT_PROTECTED'; end if;

  insert into public.user_bans (target, reporter, reason, details)
  values (p_target, reporter_id, p_reason, nullif(left(trim(coalesce(p_details, '')), 500), ''))
  on conflict (target, reporter) do nothing;
  if not found then raise exception 'ALREADY_REPORTED'; end if;

  select count(*)::integer into total from public.user_bans b where b.target = p_target;
  if total >= 5 then
    update public.rooms set created_by = null where created_by = p_target;
    -- Both sender and receiver have restrictive message foreign keys.
    delete from public.messages where sender = p_target or receiver = p_target;
    delete from auth.users where id = p_target;
    return query select total, true;
    return;
  end if;

  warning := case lang
    when 'en' then 'Hello, ' || target_name || '. Xabarim received a report about your account. Please review the community rules and keep conversations respectful. This is warning ' || total || ' of 5.'
    when 'ru' then 'Здравствуйте, ' || target_name || '. Xabarim получил жалобу на ваш аккаунт. Пожалуйста, ознакомьтесь с правилами сообщества и общайтесь уважительно. Это предупреждение ' || total || ' из 5.'
    else 'Salom, ' || target_name || '. Xabarim akkauntingiz haqida shikoyat oldi. Iltimos, hamjamiyat qoidalarini ko‘rib chiqing va suhbatda hurmatni saqlang. Bu 5 tadan ' || total || '-ogohlantirish.'
  end;
  insert into public.messages (sender, receiver, body, created_at, read)
  values (service_id, p_target, warning, now(), false);

  return query select total, false;
end;
$$;
revoke all on function public.ban_user(uuid, text, text, text) from public, anon;
grant execute on function public.ban_user(uuid, text, text, text) to authenticated;
