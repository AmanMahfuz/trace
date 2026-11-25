-- Migration 003: Resume Workspace & Version Snapshots

-- 1. Extend resumes table
alter table if exists resumes
  add column if not exists title text,
  add column if not exists source text check (source in ('uploaded', 'built')) default 'uploaded',
  add column if not exists file_hash text,
  add column if not exists is_default boolean default false,
  add column if not exists parse_status text check (parse_status in ('good', 'needs_review', 'failed')) default 'good',
  add column if not exists parse_warnings jsonb default '[]'::jsonb,
  add column if not exists updated_at timestamptz default now();

create index if not exists idx_resumes_user_hash on resumes (user_id, file_hash);
create index if not exists idx_resumes_is_default on resumes (user_id, is_default);

-- 2. Create resume_versions table for immutability & audit snapshots
create table if not exists resume_versions (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references resumes on delete cascade,
  kind text not null check (kind in ('original', 'edited', 'tailored')),
  application_id uuid references applications on delete set null,
  tree jsonb not null,
  version_number int not null default 1,
  content_hash text,
  created_at timestamptz default now()
);

create index if not exists idx_resume_versions_resume on resume_versions (resume_id, version_number desc);
create index if not exists idx_resume_versions_kind on resume_versions (resume_id, kind);
create index if not exists idx_resume_versions_app on resume_versions (application_id);

-- 3. Add snapshot reference to applications
alter table if exists applications
  add column if not exists resume_version_id uuid references resume_versions(id) on delete set null;

-- 4. Enable RLS on resume_versions
alter table resume_versions enable row level security;

create policy "Users can manage versions of their own resumes"
  on resume_versions for all
  using (
    exists (
      select 1 from resumes where resumes.id = resume_versions.resume_id and resumes.user_id = auth.uid()
    )
  );
