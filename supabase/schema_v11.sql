-- Xabarim support inbox. Run after schema_v10.sql.
-- Users can submit their own questions, but cannot read submissions. The future admin panel
-- should read this table through a trusted server using the service role, never from the browser.

create table if not exists public.support_questions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question text not null check (char_length(btrim(question)) between 5 and 3000),
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  admin_reply text,
  created_at timestamptz not null default now(),
  replied_at timestamptz
);

create index if not exists support_questions_status_created_idx
  on public.support_questions (status, created_at desc);

alter table public.support_questions enable row level security;
drop policy if exists "support questions: submit own" on public.support_questions;
create policy "support questions: submit own" on public.support_questions
  for insert to authenticated
  with check (user_id = auth.uid());

revoke all on public.support_questions from anon, authenticated;
grant insert (user_id, question) on public.support_questions to authenticated;

notify pgrst, 'reload schema';
