-- Supabase SQL Editor'da bir marta ishga tushiring
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,30}$'),
  full_name text, avatar_url text,
  bio text check (char_length(bio) <= 160),
  note text check (char_length(note) <= 500),
  last_seen timestamptz default now()
);
create table messages (
  id bigint generated always as identity primary key,
  sender uuid not null default auth.uid() references profiles(id),
  receiver uuid not null references profiles(id),
  body text check (char_length(body) <= 4000),
  file_url text, file_name text, file_type text,
  file_size bigint check (file_size <= 10485760),
  read boolean default false,
  created_at timestamptz default now(),
  check (body is not null or file_url is not null)
);
create index on messages (receiver, created_at desc);
create index on messages (sender, created_at desc);

alter table profiles enable row level security;
alter table messages enable row level security;
create policy "profiles: read"   on profiles for select to authenticated using (true);
create policy "profiles: update own" on profiles for update to authenticated using (id = auth.uid());
create policy "messages: read own" on messages for select to authenticated using (auth.uid() in (sender, receiver));
create policy "messages: send"   on messages for insert to authenticated with check (sender = auth.uid());
create policy "messages: mark read" on messages for update to authenticated using (receiver = auth.uid());

-- Google orqali kirganda profil avtomatik yaratiladi
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, username, full_name, avatar_url)
  values (new.id,
    left(coalesce(nullif(regexp_replace(lower(split_part(new.email,'@',1)),'[^a-z0-9_]','','g'),''),'user'),24) || floor(random()*1000)::int,
    new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Fayllar (max 10 MB)
insert into storage.buckets (id, name, public, file_size_limit) values
  ('avatars','avatars',true,10485760), ('files','files',true,10485760) on conflict do nothing;
create policy "storage: upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars','files') and (storage.foldername(name))[1] = auth.uid()::text);

alter publication supabase_realtime add table messages;
