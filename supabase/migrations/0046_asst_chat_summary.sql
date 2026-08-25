-- 0046: assistant memory summaries (assistant upgrade Phase 2)
-- Apply BEFORE deploying code that selects asst_chats.summary
-- (standing lesson: db push before code push — feat-files 2026-08-06).

alter table asst_chats add column if not exists summary text;

-- match_asst_chats gains summary in its return set. The return type changes,
-- so the old function must be dropped first (CREATE OR REPLACE cannot change
-- a function's return type). Atomic within the migration transaction.
drop function if exists match_asst_chats(extensions.vector, float, int);

CREATE FUNCTION match_asst_chats(
  query_embedding extensions.vector(1024),
  match_threshold float DEFAULT 0.5,
  match_count      int   DEFAULT 3
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
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
