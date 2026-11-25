-- Trace MVP 001_init.sql
create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  target_niche text check (target_niche in ('it','management','other')) default 'it',
  credits int not null default 3,
  created_at timestamptz default now()
);

create table if not exists resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  storage_path text not null,
  parsed jsonb not null,
  created_at timestamptz default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  source_url text,
  raw_text text not null,
  title text, 
  company text, 
  location text,
  jd_hash text not null,
  date_posted timestamptz, 
  valid_through timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_jobs_jd_hash on jobs (jd_hash);

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  resume_id uuid not null references resumes,
  job_id uuid not null references jobs,
  tailored jsonb,
  odds jsonb,
  ghost jsonb,
  suggestions jsonb,
  status text default 'saved' check (status in ('saved','applied','closed')),
  outcome text check (outcome in ('applied','interview','rejected','ghosted','offer','interview_no_offer')),
  outcome_at timestamptz,
  autopsy jsonb,
  created_at timestamptz default now()
);

create table if not exists interview_sessions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  transcript jsonb not null default '[]',
  metrics jsonb, 
  scorecard jsonb,
  started_at timestamptz default now(), 
  ended_at timestamptz
);

create table if not exists credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  delta int not null, 
  reason text not null,
  created_at timestamptz default now()
);

create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz default now()
);

create table if not exists ai_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid, 
  task text, 
  tier text, 
  model text,
  latency_ms int, 
  used_fallback boolean default false, 
  ok boolean default true, 
  error text,
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, credits, target_niche)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    3,
    'it'
  )
  on conflict (id) do nothing;
  return new;
exception
  when others then
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Enable RLS
alter table profiles enable row level security;
alter table resumes enable row level security;
alter table jobs enable row level security;
alter table applications enable row level security;
alter table interview_sessions enable row level security;
alter table credit_ledger enable row level security;
alter table waitlist enable row level security;

-- Policies
drop policy if exists own_profile on profiles;
create policy own_profile on profiles for all using (id = auth.uid());

drop policy if exists own_resumes on resumes;
create policy own_resumes on resumes for all using (user_id = auth.uid());

drop policy if exists own_jobs on jobs;
create policy own_jobs on jobs for all using (user_id = auth.uid());

drop policy if exists own_apps on applications;
create policy own_apps on applications for all using (user_id = auth.uid());

drop policy if exists own_sessions on interview_sessions;
create policy own_sessions on interview_sessions for all using (user_id = auth.uid());

drop policy if exists own_ledger on credit_ledger;
create policy own_ledger on credit_ledger for select using (user_id = auth.uid());

drop policy if exists insert_waitlist on waitlist;
create policy insert_waitlist on waitlist for insert with check (true);

-- Ensure resumes-raw private storage bucket exists
insert into storage.buckets (id, name, public)
values ('resumes-raw', 'resumes-raw', false)
on conflict (id) do nothing;

drop policy if exists "own_resume_files" on storage.objects;
create policy "own_resume_files" on storage.objects for all
using (bucket_id = 'resumes-raw' and (storage.foldername(name))[1] = auth.uid()::text);
