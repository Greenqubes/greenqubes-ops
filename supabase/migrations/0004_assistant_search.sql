-- pgvector similarity search functions for the AI assistant
-- Apply: npx supabase db push
--
-- SECURITY INVOKER means the caller's RLS policies apply automatically,
-- so visibility filtering is handled by the existing RLS rules on each table.
-- SET search_path includes extensions so the vector type and <=> operator resolve.

CREATE OR REPLACE FUNCTION match_kb_chunks(
  query_embedding extensions.vector(1024),
  match_threshold float DEFAULT 0.5,
  match_count      int   DEFAULT 5
)
RETURNS TABLE (
  id          text,
  source_path text,
  content     text,
  tags        text[],
  similarity  float
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, extensions
AS $$
  SELECT
    id::text,
    source_path,
    content,
    tags,
    1 - (embedding <=> query_embedding) AS similarity
  FROM kb_chunks
  WHERE embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION match_asst_chats(
  query_embedding extensions.vector(1024),
  match_threshold float DEFAULT 0.5,
  match_count      int   DEFAULT 3
)
RETURNS TABLE (
  id         text,
  topic      text,
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
