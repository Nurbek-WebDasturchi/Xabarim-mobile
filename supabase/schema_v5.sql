-- Post replies/reactions and in-app notifications. Run after schema_v4.sql.
alter table messages add column if not exists reply_to bigint references messages(id) on delete set null;

create table if not exists post_comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_created_idx on post_comments(post_id, created_at);
alter table post_comments enable row level security;
drop policy if exists "post_comments: read" on post_comments;
drop policy if exists "post_comments: create" on post_comments;
create policy "post_comments: read" on post_comments for select to authenticated using (true);
create policy "post_comments: create" on post_comments for insert to authenticated with check (user_id = auth.uid());

create table if not exists post_reactions (
  post_id bigint not null references posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) <= 16),
  created_at timestamptz not null default now(),
  primary key(post_id, user_id)
);
alter table post_reactions enable row level security;
drop policy if exists "post_reactions: read" on post_reactions;
drop policy if exists "post_reactions: insert own" on post_reactions;
drop policy if exists "post_reactions: update own" on post_reactions;
drop policy if exists "post_reactions: delete own" on post_reactions;
create policy "post_reactions: read" on post_reactions for select to authenticated using (true);
create policy "post_reactions: insert own" on post_reactions for insert to authenticated with check (user_id = auth.uid());
create policy "post_reactions: update own" on post_reactions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "post_reactions: delete own" on post_reactions for delete to authenticated using (user_id = auth.uid());

create table if not exists notifications (
  id bigint generated always as identity primary key,
  recipient uuid not null references profiles(id) on delete cascade,
  actor uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('follow','like','comment')),
  post_id bigint references posts(id) on delete cascade,
  body text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_recipient_created_idx on notifications(recipient, created_at desc);
alter table notifications enable row level security;
drop policy if exists "notifications: read own" on notifications;
drop policy if exists "notifications: update own" on notifications;
create policy "notifications: read own" on notifications for select to authenticated using (recipient = auth.uid());
create policy "notifications: update own" on notifications for update to authenticated using (recipient = auth.uid()) with check (recipient = auth.uid());

-- Publish notification inserts to Supabase Realtime when the standard publication exists.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

create or replace function notify_new_follow() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.follower <> new.following then insert into notifications(recipient, actor, kind) values(new.following, new.follower, 'follow'); end if;
  return new;
end $$;
drop trigger if exists notify_new_follow on follows;
create trigger notify_new_follow after insert on follows for each row execute function notify_new_follow();

create or replace function notify_post_activity() returns trigger language plpgsql security definer set search_path = public as $$
declare owner_id uuid; actor_id uuid;
begin
  select author into owner_id from posts where id = new.post_id;
  actor_id := new.user_id;
  if owner_id is not null and owner_id <> actor_id then
    if tg_table_name = 'post_comments' then
      insert into notifications(recipient, actor, kind, post_id, body) values(owner_id, actor_id, 'comment', new.post_id, new.body);
    else
      insert into notifications(recipient, actor, kind, post_id) values(owner_id, actor_id, 'like', new.post_id);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists notify_post_comment on post_comments;
create trigger notify_post_comment after insert on post_comments for each row execute function notify_post_activity();
drop trigger if exists notify_post_reaction on post_reactions;
create trigger notify_post_reaction after insert on post_reactions for each row execute function notify_post_activity();

grant select, insert on post_comments to authenticated;
grant select, insert, update, delete on post_reactions to authenticated;
grant select, update on notifications to authenticated;
