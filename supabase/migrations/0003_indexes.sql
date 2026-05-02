-- =============================================================
-- Greenqubes ops platform — indexes
-- Apply after 0002_rls.sql
-- =============================================================
--
-- pgvector IVFFlat notes:
--   lists = rough sqrt(expected row count), start conservative.
--   Rebuild with higher lists value once tables have real data.
--   Queries must set: SET ivfflat.probes = 10 (or higher for recall).
-- =============================================================

-- jobs: primary filter axes for schedule views
create index jobs_date_idx          on jobs (date);
create index jobs_status_idx        on jobs (status);
create index jobs_date_status_idx   on jobs (date, status);
create index jobs_sales_poc_idx     on jobs (sales_poc_id);

-- job_assignees: installer dashboard (what am I assigned to?)
create index job_assignees_user_id_idx on job_assignees (user_id);

-- messages: chat thread loads (ordered)
create index messages_job_id_ts_idx on messages (job_id, ts);

-- files: job file galleries
create index files_job_id_idx       on files (job_id);
create index files_job_id_kind_idx  on files (job_id, kind);

-- asst_chats: user history + Monday digest query (importance >= 4)
create index asst_chats_user_id_idx    on asst_chats (user_id);
create index asst_chats_updated_at_idx on asst_chats (updated_at desc);
create index asst_chats_importance_idx on asst_chats (importance)
  where importance >= 4;

-- asst_chats tags: used by auto-classifier queries
create index asst_chats_tags_idx on asst_chats using gin (tags);

-- kb_chunks: obsidian sync upsert lookups + tag filtering
create index kb_chunks_source_path_idx on kb_chunks (source_path);
create index kb_chunks_tags_idx        on kb_chunks using gin (tags);

-- events: audit log pagination + target lookups
create index events_ts_idx        on events (ts desc);
create index events_actor_id_idx  on events (actor_id);
create index events_target_id_idx on events (target_id);

-- pgvector: approximate nearest-neighbor search (cosine similarity)
create index kb_chunks_embedding_idx on kb_chunks
  using ivfflat (embedding extensions.vector_cosine_ops)
  with (lists = 100);

create index asst_chats_embedding_idx on asst_chats
  using ivfflat (embedding extensions.vector_cosine_ops)
  with (lists = 100);
