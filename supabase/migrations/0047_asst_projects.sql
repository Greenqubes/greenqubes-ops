-- 0047: assistant projects (assistant upgrade Phase 4)
-- Apply BEFORE deploying code that selects asst_chats.project_id
-- (standing lesson: db push before code push).

create table asst_projects (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references users(id) on delete cascade,
  name         text        not null,
  instructions text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table asst_projects enable row level security;

create policy "asst_projects: own select" on asst_projects
  for select to authenticated using (user_id = get_my_id());
create policy "asst_projects: own insert" on asst_projects
  for insert to authenticated with check (user_id = get_my_id());
create policy "asst_projects: own update" on asst_projects
  for update to authenticated using (user_id = get_my_id());
create policy "asst_projects: own delete" on asst_projects
  for delete to authenticated using (user_id = get_my_id());

-- Deleting a project releases its chats back to the general history list —
-- it never deletes conversations (spec).
alter table asst_chats
  add column if not exists project_id uuid references asst_projects(id) on delete set null;

create index asst_chats_project_idx on asst_chats(project_id)
  where project_id is not null;

-- Project reference files: R2 objects under asst-projects/{userId}/{projectId}/
-- tracked here — never `files` rows (they belong to no job).
create table asst_project_files (
  id         uuid        primary key default gen_random_uuid(),
  project_id uuid        not null references asst_projects(id) on delete cascade,
  name       text        not null,
  r2_key     text        not null,
  mime       text        not null,
  size       bigint      not null,
  created_at timestamptz not null default now()
);

create index asst_project_files_project_idx on asst_project_files(project_id);

alter table asst_project_files enable row level security;

create policy "asst_project_files: own via project" on asst_project_files
  for all to authenticated
  using (exists (
    select 1 from asst_projects p
    where p.id = project_id and p.user_id = get_my_id()
  ))
  with check (exists (
    select 1 from asst_projects p
    where p.id = project_id and p.user_id = get_my_id()
  ));

-- match_asst_chats gains an optional project filter (linked memory: sibling
-- chats in a project recall each other first). The parameter list changes, so
-- the old function must be dropped first (0046 lesson: CREATE OR REPLACE
-- cannot change a signature). Callers pass named args, so the deployed code
-- (which omits project_filter) keeps working — deploy-order safe.
drop function if exists match_asst_chats(extensions.vector, float, int);

CREATE FUNCTION match_asst_chats(
  query_embedding extensions.vector(1024),
  match_threshold float DEFAULT 0.5,
  match_count      int   DEFAULT 3,
  project_filter   uuid  DEFAULT NULL
)
RETURNS TABLE (
  id         text,
  topic      text,
  summary    text,
  msgs       jsonb,
  tags       text[],
  importance int,
  similarity float
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, extensions
AS $$
  SELECT
    id::text,
    topic,
    summary,
    msgs::jsonb,
    tags,
    importance::int,
    1 - (embedding <=> query_embedding) AS similarity
  FROM asst_chats
  WHERE embedding IS NOT NULL
    AND (project_filter IS NULL OR project_id = project_filter)
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
