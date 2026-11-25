-- Migration 004: Resume Drafts for No-Resume Fresher Flow

create table if not exists resume_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  current_step int not null default 0,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_resume_drafts_user on resume_drafts (user_id, updated_at desc);

-- RLS
alter table resume_drafts enable row level security;

create policy "Users can manage their own resume drafts"
  on resume_drafts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
