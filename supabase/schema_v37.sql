-- Mention support for messages and post comments. Apply after schema_v36.sql.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('follow', 'like', 'comment', 'xcoin', 'mention'));

create or replace function public.notify_mentions() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare
  content text;
  target record;
  post_owner uuid;
begin
  content := coalesce(new.body, '');
  if tg_table_name = 'post_comments' then
    select author into post_owner from public.posts where id = new.post_id;
    if post_owner is not null and post_owner <> new.user_id then
      insert into public.notifications (recipient, actor, kind, post_id, body)
      values (post_owner, new.user_id, 'comment', new.post_id, left(content, 180));
    end if;
  end if;
  for target in
    select distinct p.id from public.profiles p
    where p.id <> coalesce(new.sender, new.user_id)
      and content ~* ('(^|[^a-zA-Z0-9_])@' || regexp_replace(p.username, '([.\+*?\[\]^$(){}=!<>|:\\-])', '\\\1', 'g') || '([^a-zA-Z0-9_]|$)')
  loop
    insert into public.notifications (recipient, actor, kind, post_id, body)
    values (target.id, coalesce(new.sender, new.user_id), 'mention',
      case when tg_table_name = 'post_comments' then new.post_id else null end,
      case when tg_table_name = 'messages' then left(content, 180) else null end);
  end loop;
  return new;
end $$;

drop trigger if exists notify_post_comment_mentions on public.post_comments;
create trigger notify_post_comment_mentions after insert on public.post_comments
for each row execute function public.notify_mentions();
drop trigger if exists notify_message_mentions on public.messages;
create trigger notify_message_mentions after insert on public.messages
for each row execute function public.notify_mentions();

notify pgrst, 'reload schema';
