-- 005_it_fresher_p0.sql
-- Adds: profile IT fields, eligibility on applications, process_stages on applications,
--       practice_sessions table, this_week planner support (derived, no table needed).

-- 1. Extend profiles with IT-fresher fields
alter table profiles
  add column if not exists grad_year       int,
  add column if not exists branch          text,
  add column if not exists aggregate_pct   numeric(5,2),
  add column if not exists active_backlogs int default 0,
  add column if not exists track           text check (track in ('software','data','other'));

-- 2. Extend applications with eligibility result + process stages + elig skipped flag
alter table applications
  add column if not exists eligibility        jsonb,
  add column if not exists eligibility_skipped boolean not null default false,
  add column if not exists process_stages     jsonb;

-- Extend interview_sessions with mode
alter table interview_sessions
  add column if not exists mode text default 'full-round';

-- 3. Practice sessions table (separate from interview_sessions — different shape)
--    Supports self-intro, project-deepdive, hr, full-round modes.
create table if not exists practice_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles on delete cascade,
  application_id  uuid references applications on delete set null,
  mode            text not null check (mode in ('self-intro','project-deepdive','hr','full-round')),
  credit_charged  boolean not null default false,
  transcript      jsonb not null default '[]',
  scorecard       jsonb,
  started_at      timestamptz default now(),
  ended_at        timestamptz
);

-- RLS for practice_sessions
alter table practice_sessions enable row level security;

create policy "Users can manage own practice sessions"
  on practice_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. Self-intro rate limit tracking (5 free per day per user)
--    Uses credit_ledger with reason prefix 'self-intro:' — no extra table needed.
--    Rate check is done server-side by counting credit_ledger rows today with reason like 'self-intro:%'.

-- Index for fast practice session lookup
create index if not exists idx_practice_sessions_user_id on practice_sessions (user_id);
create index if not exists idx_practice_sessions_application_id on practice_sessions (application_id);
