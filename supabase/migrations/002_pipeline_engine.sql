-- 002_pipeline_engine.sql: Engine Pipeline Tables, Step Claim RPC & Transaction Functions

create table if not exists pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  status text check (status in ('pending', 'running', 'completed', 'failed')) default 'pending',
  current_step text,
  context jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists pipeline_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references pipeline_runs on delete cascade,
  step_name text not null,
  step_order int not null default 0,
  status text check (status in ('pending', 'running', 'completed', 'failed')) default 'pending',
  input jsonb,
  output jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_pipeline_steps_run_status on pipeline_steps (run_id, status, step_order);
create index if not exists idx_pipeline_runs_user_status on pipeline_runs (user_id, status);

-- Enable RLS
alter table pipeline_runs enable row level security;
alter table pipeline_steps enable row level security;

drop policy if exists own_pipeline_runs on pipeline_runs;
create policy own_pipeline_runs on pipeline_runs for all using (user_id = auth.uid());

drop policy if exists own_pipeline_steps on pipeline_steps;
create policy own_pipeline_steps on pipeline_steps for all using (
  exists (select 1 from pipeline_runs where pipeline_runs.id = pipeline_steps.run_id and pipeline_runs.user_id = auth.uid())
);

-- Atomically claim the next pending step using FOR UPDATE SKIP LOCKED
create or replace function public.claim_next_pipeline_step(p_run_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_step record;
begin
  select *
  into v_step
  from pipeline_steps
  where run_id = p_run_id
    and status = 'pending'
  order by step_order asc, created_at asc
  limit 1
  for update skip locked;

  if v_step.id is null then
    return null;
  end if;

  update pipeline_steps
  set status = 'running',
      started_at = now()
  where id = v_step.id;

  update pipeline_runs
  set status = 'running',
      current_step = v_step.step_name,
      updated_at = now()
  where id = p_run_id;

  return row_to_json(v_step);
end;
$$;

-- Complete step and update run status
create or replace function public.complete_pipeline_step(
  p_step_id uuid,
  p_output jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_run_id uuid;
  v_has_more boolean;
begin
  update pipeline_steps
  set status = 'completed',
      output = p_output,
      completed_at = now()
  where id = p_step_id
  returning run_id into v_run_id;

  select exists (
    select 1 from pipeline_steps where run_id = v_run_id and status = 'pending'
  ) into v_has_more;

  if not v_has_more then
    update pipeline_runs
    set status = 'completed',
        updated_at = now()
    where id = v_run_id;
  else
    update pipeline_runs
    set updated_at = now()
    where id = v_run_id;
  end if;

  return jsonb_build_object('run_id', v_run_id, 'has_more', v_has_more);
end;
$$;

-- Fail step and mark run failed
create or replace function public.fail_pipeline_step(
  p_step_id uuid,
  p_error text
)
returns void
language plpgsql
security definer
as $$
declare
  v_run_id uuid;
begin
  update pipeline_steps
  set status = 'failed',
      error = p_error,
      completed_at = now()
  where id = p_step_id
  returning run_id into v_run_id;

  update pipeline_runs
  set status = 'failed',
      updated_at = now()
  where id = v_run_id;
end;
$$;

-- Atomic transactional credit deduction with idempotency guard
create or replace function public.deduct_interview_credit(
  p_user_id uuid,
  p_application_id uuid,
  p_reason text default 'Voice practice session'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_credits int;
  v_existing_session_id uuid;
begin
  -- Idempotency check: recent session started within 15 seconds for this application
  select id into v_existing_session_id
  from interview_sessions
  where user_id = p_user_id
    and application_id = p_application_id
    and started_at > now() - interval '15 seconds'
  order by started_at desc
  limit 1;

  if v_existing_session_id is not null then
    return jsonb_build_object('success', true, 'charged', false, 'existingSessionId', v_existing_session_id);
  end if;

  -- Row-level lock on user profile
  select credits into v_credits
  from profiles
  where id = p_user_id
  for update;

  if v_credits is null or v_credits < 1 then
    return jsonb_build_object('success', false, 'charged', false, 'error', 'INSUFFICIENT_CREDITS');
  end if;

  update profiles
  set credits = credits - 1
  where id = p_user_id;

  insert into credit_ledger (user_id, delta, reason)
  values (p_user_id, -1, p_reason || ' for application: ' || p_application_id::text);

  return jsonb_build_object('success', true, 'charged', true, 'creditsRemaining', v_credits - 1);
end;
$$;

-- Recover stalled runs (>5 minutes in 'running' state with no progress)
create or replace function public.recover_stalled_pipeline_runs()
returns int
language plpgsql
security definer
as $$
declare
  v_recovered int := 0;
begin
  -- Reset steps that have been running for more than 5 minutes
  update pipeline_steps
  set status = 'pending',
      started_at = null
  where status = 'running'
    and started_at < now() - interval '5 minutes';

  -- Update runs to pending so engine-advance or cron can pick them back up
  with stalled as (
    update pipeline_runs
    set status = 'pending',
        updated_at = now()
    where status = 'running'
      and updated_at < now() - interval '5 minutes'
    returning id
  )
  select count(*) into v_recovered from stalled;

  return v_recovered;
end;
$$;
