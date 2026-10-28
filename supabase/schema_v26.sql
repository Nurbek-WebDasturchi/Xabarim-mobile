-- v0.9.17: reliable last-seen updates and realtime chat presence.
-- Run in Supabase SQL Editor after schema_v25.sql.

create or replace function public.touch_presence()
returns timestamptz
language plpgsql
security definer
set search_path = public, auth
as $$
declare seen_at timestamptz;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  update public.profiles
    set last_seen = now()
    where id = auth.uid()
    returning last_seen into seen_at;
  return seen_at;
end;
$$;

revoke all on function public.touch_presence() from public, anon;
grant execute on function public.touch_presence() to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end;
$$;
