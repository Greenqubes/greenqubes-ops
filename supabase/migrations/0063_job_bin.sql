-- 0063_job_bin.sql — the job bin (spec 2026-09-28-job-bin-design.md).
--
-- A deleted job becomes ONE sealed row here: the job plus its 11 linked
-- tables as jsonb. The live job is then deleted exactly as before, so no
-- screen, cron or bot can ever see a binned job. R2 objects stay until the
-- bin empties (cron /api/cron/bin-empty).
--
-- Both tables are RLS-enabled with NO policies: only the service client
-- (server routes that apply src/lib/utils/bin-rules.ts) reads or writes them.

create table job_bin (
  id               uuid primary key default gen_random_uuid(),
  job_id           uuid not null unique,
  title            text,
  client           text,
  job_date         date,
  status_at_delete text not null,
  deleted_by       uuid references users(id) on delete set null,
  deleted_at       timestamptz not null default now(),
  sharer_ids       uuid[] not null default '{}',
  r2_keys          text[] not null default '{}',
  snapshot         jsonb not null
);
create index job_bin_deleted_at_idx on job_bin(deleted_at);
alter table job_bin enable row level security;

create table app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id) on delete set null
);
alter table app_settings enable row level security;
insert into app_settings (key, value) values ('bin_retention', '"3m"')
  on conflict (key) do nothing;

-- Insert snapshot rows into a table using ONLY the columns that exist now.
-- A column dropped since deletion is ignored; one added since takes its
-- default (it is simply not named in the insert).
create or replace function bin_insert_rows(p_table text, p_rows jsonb)
returns void
language plpgsql security definer
set search_path = public
as $$
declare cols text;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    return;
  end if;
  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
    into cols
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = p_table
     and exists (select 1 from jsonb_array_elements(p_rows) r where r ? c.column_name);
  if cols is null then return; end if;
  execute format(
    'insert into %I (%s) select %s from jsonb_populate_recordset(null::%I, $1)',
    p_table, cols, cols, p_table)
  using p_rows;
end $$;

-- Restore = one function call = one transaction: any failure rolls back every
-- insert, so half a job never lands on the schedule. The caller has already
-- run prepareRestore (removed people dropped/blanked) and checked permission.
create or replace function restore_job_snapshot(p_bin_id uuid, p_snapshot jsonb)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_job   jsonb := p_snapshot->'job';
  v_id    uuid  := (v_job->>'id')::uuid;
  t       text;
begin
  if not exists (select 1 from job_bin where id = p_bin_id) then
    raise exception 'bin entry % no longer exists', p_bin_id;
  end if;
  if exists (select 1 from jobs where id = v_id) then
    raise exception 'job % already exists', v_id;
  end if;

  perform bin_insert_rows('jobs', jsonb_build_array(v_job));

  -- Three BEFORE INSERT triggers rewrote columns the job must keep:
  -- stamp_scheduled_at (now() → the job would lose its FCFS place),
  -- stamp_r2_folder, stamp_jobs_created_by. Put the snapshot's values back.
  -- (scheduled_at's trigger is UPDATE OF status only, so this does not refire.)
  update jobs set
    scheduled_at = (v_job->>'scheduled_at')::timestamptz,
    r2_folder    = v_job->>'r2_folder',
    created_by   = (v_job->>'created_by')::uuid,
    created_at   = (v_job->>'created_at')::timestamptz
  where id = v_id;

  foreach t in array array[
    'job_financials', 'job_assignees', 'job_coordinators', 'job_designers',
    'job_external_contacts', 'attachment_buckets', 'files', 'messages',
    'job_tasks', 'design_scores', 'job_chat_state'
  ] loop
    perform bin_insert_rows(t, p_snapshot->'children'->t);
  end loop;

  delete from job_bin where id = p_bin_id;
  return v_id;
end $$;

revoke all on function bin_insert_rows(text, jsonb)      from public, anon, authenticated;
revoke all on function restore_job_snapshot(uuid, jsonb) from public, anon, authenticated;
