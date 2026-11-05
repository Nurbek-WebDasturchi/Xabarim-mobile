-- Instagram-style public/private accounts and follow requests.
alter table public.profiles add column if not exists is_private boolean not null default false;

create table if not exists public.follow_requests (
  id bigint generated always as identity primary key,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (requester_id, target_id),
  check (requester_id <> target_id)
);
create index if not exists follow_requests_target_idx on public.follow_requests (target_id, created_at desc);
alter table public.follow_requests enable row level security;
drop policy if exists "follow requests: read participants" on public.follow_requests;
drop policy if exists "follow requests: create" on public.follow_requests;
drop policy if exists "follow requests: cancel own" on public.follow_requests;
create policy "follow requests: read participants" on public.follow_requests for select to authenticated
  using (requester_id = auth.uid() or target_id = auth.uid());
create policy "follow requests: create" on public.follow_requests for insert to authenticated
  with check (requester_id = auth.uid() and exists (select 1 from public.profiles p where p.id = target_id and p.is_private));
create policy "follow requests: cancel own" on public.follow_requests for delete to authenticated
  using (requester_id = auth.uid());

-- Ensure direct follow inserts cannot bypass a private account's approval.
drop policy if exists "follows: follow" on public.follows;
create policy "follows: follow" on public.follows for insert to authenticated with check (
  follower = auth.uid() and exists (select 1 from public.profiles p where p.id = following and not p.is_private)
);

create or replace function public.decide_follow_request(p_request bigint, p_accept boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare req public.follow_requests%rowtype;
begin
  select * into req from public.follow_requests where id = p_request and target_id = auth.uid() for update;
  if not found then return false; end if;
  if p_accept then
    insert into public.follows (follower, following) values (req.requester_id, req.target_id) on conflict do nothing;
  end if;
  delete from public.follow_requests where id = req.id;
  return true;
end;
$$;
revoke all on function public.decide_follow_request(bigint, boolean) from public;
grant execute on function public.decide_follow_request(bigint, boolean) to authenticated;
notify pgrst, 'reload schema';

-- Only owners, accepted followers and public-account visitors can read profile details.
drop policy if exists "profiles: read" on public.profiles;
create policy "profiles: read" on public.profiles for select to authenticated using (
  id = auth.uid() or not is_private or exists (
    select 1 from public.follows f where f.follower = auth.uid() and f.following = profiles.id
  )
);

-- Hide private-account posts and notes until a follow request is accepted.
create or replace function public.global_posts(p_limit int default 50)
returns setof public.posts language sql stable security definer set search_path = public as $$
  select p.* from public.posts p join public.profiles owner on owner.id = p.author
  where not owner.is_private or owner.id = auth.uid() or exists (
    select 1 from public.follows f where f.follower = auth.uid() and f.following = owner.id
  )
  order by p.created_at desc limit least(coalesce(p_limit, 50), 100)
$$;

drop policy if exists "posts: read" on public.posts;
drop policy if exists "posts: read all" on public.posts;
create policy "posts: read" on public.posts for select to authenticated using (
  author = auth.uid() or exists (select 1 from public.profiles owner where owner.id = posts.author and (
    not owner.is_private or exists (select 1 from public.follows f where f.follower = auth.uid() and f.following = owner.id)
  ))
);

drop policy if exists "notes: read" on public.notes;
drop policy if exists "notes: read all" on public.notes;
drop policy if exists "notes: read fresh" on public.notes;
create policy "notes: read" on public.notes for select to authenticated using (
  user_id = auth.uid() or (created_at > now() - interval '24 hours' and exists (
    select 1 from public.profiles owner where owner.id = notes.user_id and (
      not owner.is_private or exists (select 1 from public.follows f where f.follower = auth.uid() and f.following = owner.id)
    )
  ))
);

-- Private-account followers only may view or start direct chats with that account.
drop policy if exists "messages: read" on public.messages;
drop policy if exists "messages: read own" on public.messages;
create policy "messages: read" on public.messages for select to authenticated using (
  not exists (select 1 from public.message_hides h where h.user_id = auth.uid() and h.message_id = messages.id)
  and (room_id is not null and (sender = auth.uid() or public.is_member(room_id) or exists (select 1 from public.rooms r where r.id = messages.room_id and r.kind = 'community'))
  or room_id is null and auth.uid() in (sender, receiver) and exists (
    select 1 from public.profiles owner where owner.id = case when messages.sender = auth.uid() then messages.receiver else messages.sender end
      and (not owner.is_private or exists (select 1 from public.follows f where f.follower = case when messages.sender = auth.uid() then messages.receiver else messages.sender end and f.following = owner.id))
  ) and not exists (select 1 from public.chat_clears c where c.user_id = auth.uid() and c.peer = case when messages.sender = auth.uid() then messages.receiver else messages.sender end and messages.created_at <= c.cleared_at))
);
drop policy if exists "messages: send" on public.messages;
create policy "messages: send" on public.messages for insert to authenticated with check (
  sender = auth.uid() and ((room_id is not null and public.is_member(room_id)) or (room_id is null and not public.chat_blocked(receiver) and exists (
    select 1 from public.profiles owner where owner.id = receiver and (not owner.is_private or exists (select 1 from public.follows f where f.follower = auth.uid() and f.following = owner.id))
  )))
);

create or replace function public.feed_notes()
returns setof public.notes language sql stable security definer set search_path = public as $$
  select n.* from public.notes n join public.profiles owner on owner.id = n.user_id
  where n.created_at > now() - interval '24 hours'
    and (n.user_id = auth.uid() or not owner.is_private or exists (
      select 1 from public.follows f where f.follower = auth.uid() and f.following = owner.id
    ))
  order by (n.user_id = auth.uid()) desc, n.created_at desc limit 80
$$;
revoke all on function public.global_posts(int) from public;
revoke all on function public.feed_notes() from public;
grant execute on function public.global_posts(int) to authenticated;
grant execute on function public.feed_notes() to authenticated;
notify pgrst, 'reload schema';
