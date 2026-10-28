-- v0.5 sxemasidan KEYIN ishga tushiring (Guruhlar, Jamiyatlar, Note, Postlar, username+parol)

-- 1) Guruh / jamiyat xonalari
create table rooms (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('group','community')),
  name text not null check (char_length(name) between 2 and 60),
  description text check (char_length(description) <= 200),
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz default now()
);
create table room_members (
  room_id bigint references rooms(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text default 'member',
  primary key (room_id, user_id)
);
alter table messages alter column receiver drop not null;
alter table messages add column room_id bigint references rooms(id) on delete cascade;
alter table messages add constraint msg_target check ((receiver is not null) <> (room_id is not null));
create index on messages (room_id, created_at desc);

create function is_member(r bigint) returns boolean language sql security definer stable set search_path = public as
$$ select exists (select 1 from room_members where room_id = r and user_id = auth.uid()) $$;

alter table rooms enable row level security;
alter table room_members enable row level security;
create policy "rooms: read"  on rooms for select to authenticated using (kind = 'community' or is_member(id));
create policy "members: read" on room_members for select to authenticated using (user_id = auth.uid() or is_member(room_id));
create policy "members: join community" on room_members for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from rooms r where r.id = room_id and r.kind = 'community'));
create policy "members: leave" on room_members for delete to authenticated using (user_id = auth.uid());

drop policy "messages: read own" on messages;
drop policy "messages: send" on messages;
create policy "messages: read" on messages for select to authenticated
  using (auth.uid() in (sender, receiver) or (room_id is not null and is_member(room_id)));
create policy "messages: send" on messages for insert to authenticated
  with check (sender = auth.uid() and (room_id is null or is_member(room_id)));

-- guruh yaratish (egasi + username'lar bo'yicha a'zolar, 50 tagacha)
create function create_group(p_name text, p_usernames text[]) returns bigint language plpgsql security definer set search_path = public as $$
declare rid bigint;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  insert into rooms (kind, name, created_by) values ('group', p_name, auth.uid()) returning id into rid;
  insert into room_members values (rid, auth.uid(), 'owner');
  insert into room_members select rid, id, 'member' from profiles
    where username = any (p_usernames[1:50]) and id <> auth.uid();
  return rid;
end $$;

-- 2) Note (Instagram kabi, 24 soat)
create table notes (
  user_id uuid primary key default auth.uid() references profiles(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 60),
  created_at timestamptz default now()
);
alter table notes enable row level security;
create policy "notes: read fresh" on notes for select to authenticated using (created_at > now() - interval '24 hours');
create policy "notes: write own"  on notes for insert to authenticated with check (user_id = auth.uid());
create policy "notes: update own" on notes for update to authenticated using (user_id = auth.uid());
create policy "notes: delete own" on notes for delete to authenticated using (user_id = auth.uid());

-- 3) Postlar (matn va/yoki rasm)
create table posts (
  id bigint generated always as identity primary key,
  author uuid not null default auth.uid() references profiles(id) on delete cascade,
  body text check (char_length(body) <= 2000),
  image_url text,
  created_at timestamptz default now(),
  check (body is not null or image_url is not null)
);
create index on posts (created_at desc);
alter table posts enable row level security;
create policy "posts: read"   on posts for select to authenticated using (true);
create policy "posts: create" on posts for insert to authenticated with check (author = auth.uid());
create policy "posts: delete" on posts for delete to authenticated using (author = auth.uid());

-- 4) Ro'yhatdan o'tishda tanlangan username ishlatiladi (Google bo'lsa avtomatik)
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, username, full_name, avatar_url)
  values (new.id,
    coalesce(nullif(new.raw_user_meta_data->>'username',''),
      left(coalesce(nullif(regexp_replace(lower(split_part(new.email,'@',1)),'[^a-z0-9_]','','g'),''),'user'),24) || floor(random()*1000)::int),
    new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end $$;

-- 5) Tayyor jamiyatlar (xohlagancha qo'shing)
insert into rooms (kind, name, description, created_by) values
  ('community','Dasturchilar','Dasturchilar jamiyati: kod, loyihalar, ish',null),
  ('community','Medik xodimlar','Shifokorlar, hamshiralar va tibbiyot talabalari',null),
  ('community','O''qituvchilar','Ustozlar va pedagoglar',null),
  ('community','Talabalar','Talabalar hayoti va o''qish',null),
  ('community','Tadbirkorlar','Biznes va startaplar',null),
  ('community','Dizaynerlar','UI/UX, grafika, tasvir',null);
