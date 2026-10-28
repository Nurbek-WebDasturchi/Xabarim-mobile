-- v0.12: restore API grants and policies for notes/posts, and ensure the
-- community_counts RPC exists. Run after schema_v7.sql in Supabase SQL Editor.

-- The client uses the authenticated PostgREST role. Explicit grants make the
-- intended API access clear even on projects with customized default grants.
grant select, insert, update, delete on table public.notes to authenticated;
grant select, insert, delete on table public.posts to authenticated;
grant usage, select on sequence public.posts_id_seq to authenticated;

alter table public.notes enable row level security;
drop policy if exists "notes: read fresh" on public.notes;
drop policy if exists "notes: write own" on public.notes;
drop policy if exists "notes: update own" on public.notes;
drop policy if exists "notes: delete own" on public.notes;
create policy "notes: read fresh" on public.notes
  for select to authenticated
  using (created_at > now() - interval '24 hours');
create policy "notes: write own" on public.notes
  for insert to authenticated
  with check (user_id = auth.uid());
create policy "notes: update own" on public.notes
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "notes: delete own" on public.notes
  for delete to authenticated
  using (user_id = auth.uid());

alter table public.posts enable row level security;
drop policy if exists "posts: read" on public.posts;
drop policy if exists "posts: create" on public.posts;
drop policy if exists "posts: delete" on public.posts;
create policy "posts: read" on public.posts
  for select to authenticated using (true);
create policy "posts: create" on public.posts
  for insert to authenticated with check (author = auth.uid());
create policy "posts: delete" on public.posts
  for delete to authenticated using (author = auth.uid());

create or replace function public.community_counts()
returns table (room_id bigint, members int)
language sql security definer stable set search_path = public as $$
  select r.id, count(m.user_id)::int
  from public.rooms r
  left join public.room_members m on m.room_id = r.id
  where r.kind = 'community'
  group by r.id
$$;
revoke all on function public.community_counts() from public;
grant execute on function public.community_counts() to authenticated;

-- Supabase PostgREST normally notices schema changes automatically; this also
-- requests a schema-cache refresh immediately after the migration.
notify pgrst, 'reload schema';
