-- =============================================================
-- Greenqubes ops platform — schema
-- =============================================================

-- pgvector: enables the vector column type used for embeddings.
-- Installed in the extensions schema (Supabase default).
create extension if not exists vector with schema extensions;

-- Custom enum types
create type user_role    as enum ('sales', 'scheduler', 'installer');
create type job_status   as enum ('scheduled', 'pending', 'awaiting_approval', 'completed');
create type file_kind    as enum ('photo', 'voice', 'do', 'attachment', 'completion');
create type message_kind as enum ('text', 'voice');
create type punctuality  as enum ('strict', 'flexible');

-- =============================================================
-- users
-- Linked to Supabase Auth via auth_id. Provisioned by admin only
-- (no self-signup). Role is the single source of truth for RLS.
-- =============================================================
create table users (
  id               uuid        primary key default gen_random_uuid(),
  auth_id          uuid        unique references auth.users(id) on delete set null,
  name             text        not null,
  role             user_role   not null,
  telegram_chat_id text,
  lang             text        not null default 'en' check (lang in ('en', 'zh', 'bn')),
  phone            text,
  visibility       text[]      not null default array['public-internal'],
  created_at       timestamptz not null default now()
);

-- =============================================================
-- jobs
-- Core scheduling record. Commercial fields are in job_financials
-- (separate table) so RLS can block installer access at DB level.
-- =============================================================
create table jobs (
  id                      uuid        primary key default gen_random_uuid(),
  status                  job_status  not null default 'pending',
  date                    date        not null,
  time_start              time,
  time_end                time,
  client                  text        not null,
  location                text        not null,
  description             text,
  client_poc_name         text,
  client_poc_phone        text,
  sales_poc_id            uuid        references users(id) on delete set null,
  production_ready        boolean     not null default false,
  do_issued               boolean     not null default false,
  punctuality             punctuality not null default 'strict',
  production_instructions text,
  notes                   text,
  approved_by             uuid        references users(id) on delete set null,
  approved_at             timestamptz,
  completed_at            timestamptz,
  -- scheduler can waive the photo requirement before marking complete
  completion_override     boolean     not null default false,
  visibility              text[]      not null default array['public-internal'],
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- =============================================================
-- job_financials
-- Kept separate from jobs so RLS can restrict to sales/scheduler only.
-- Installers have zero visibility into this table — no row is returned,
-- not even a NULL row. Enforced at DB layer, not in app code.
-- =============================================================
create table job_financials (
  job_id        uuid         primary key references jobs(id) on delete cascade,
  quote_amount  numeric(12,2),
  supplier_cost numeric(12,2),
  margin_notes  text,
  visibility    text[]       not null default array['role:sales', 'role:scheduler']
);

-- =============================================================
-- job_assignees  (M:N: installers ↔ jobs)
-- =============================================================
create table job_assignees (
  job_id  uuid not null references jobs(id)  on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (job_id, user_id)
);

-- =============================================================
-- files  (photos, voice notes, DOs, attachments, completion shots)
-- =============================================================
create table files (
  id          uuid      primary key default gen_random_uuid(),
  job_id      uuid      references jobs(id)   on delete cascade,
  kind        file_kind not null,
  r2_key      text      not null,
  uploader_id uuid      references users(id)  on delete set null,
  visibility  text[]    not null default array['public-internal'],
  ts          timestamptz not null default now()
);

-- =============================================================
-- messages  (job chat thread — text and voice notes)
-- =============================================================
create table messages (
  id        uuid         primary key default gen_random_uuid(),
  job_id    uuid         not null references jobs(id)   on delete cascade,
  author_id uuid         references users(id) on delete set null,
  kind      message_kind not null default 'text',
  content   text,
  voice_url text,
  visibility text[]      not null default array['public-internal'],
  ts        timestamptz  not null default now(),
  constraint messages_content_check check (
    (kind = 'text'  and content   is not null) or
    (kind = 'voice' and voice_url is not null)
  )
);

-- =============================================================
-- asst_chats  (AI assistant conversation sessions)
-- Default visibility is empty (private to owner). The auto-classifier
-- widens this after each conversation ends.
-- =============================================================
create table asst_chats (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references users(id) on delete cascade,
  msgs       jsonb       not null default '[]',
  embedding  extensions.vector(1024),
  topic      text,
  entities   text[],
  tags       text[],
  importance smallint    check (importance between 1 and 5),
  visibility text[]      not null default array[]::text[],
  ts         timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================
-- kb_chunks  (Obsidian vault → chunked + embedded, nightly sync)
-- source_path + chunk_index uniquely identifies a chunk so upserts
-- from the sync script are idempotent.
-- =============================================================
create table kb_chunks (
  id          uuid        primary key default gen_random_uuid(),
  source_path text        not null,
  chunk_index smallint    not null default 0,
  content     text        not null,
  embedding   extensions.vector(1024),
  tags        text[],
  visibility  text[]      not null default array['public-internal'],
  updated_at  timestamptz not null default now(),
  unique (source_path, chunk_index)
);

-- =============================================================
-- events  (append-only audit log)
-- Written exclusively via service-role server-side code.
-- No UPDATE or DELETE — ever.
-- =============================================================
create table events (
  id           uuid        primary key default gen_random_uuid(),
  actor_id     uuid        references users(id) on delete set null,
  kind         text        not null,
  target_id    uuid,
  target_table text,
  payload      jsonb,
  visibility   text[]      not null default array['role:scheduler'],
  ts           timestamptz not null default now()
);

-- =============================================================
-- updated_at trigger (jobs, asst_chats, kb_chunks)
-- =============================================================
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger jobs_updated_at
  before update on jobs
  for each row execute function touch_updated_at();

create trigger asst_chats_updated_at
  before update on asst_chats
  for each row execute function touch_updated_at();

create trigger kb_chunks_updated_at
  before update on kb_chunks
  for each row execute function touch_updated_at();
