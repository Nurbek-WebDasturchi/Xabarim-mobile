-- Native Expo push tokens for the WebView Android/iOS shell.
-- Run after the latest schema migration in Supabase SQL Editor.

create table if not exists public.push_devices (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null,
  platform text not null default 'android',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create index if not exists push_devices_user_idx on public.push_devices(user_id);
alter table public.push_devices enable row level security;

-- The server uses the service role after validating the user's Supabase access token.
-- No browser client policy is granted for this table.
revoke all on public.push_devices from anon, authenticated;

notify pgrst, 'reload schema';
