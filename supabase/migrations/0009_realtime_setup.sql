-- Permanently encode realtime requirements for messages + files.
-- These were applied manually in session 17 and not in any migration,
-- so they may have been lost. This migration makes them durable.

-- Add tables to supabase_realtime publication (idempotent via DO block)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'files'
  ) then
    alter publication supabase_realtime add table files;
  end if;
end $$;

-- Full row payload so job_id and all columns are present in realtime events
alter table messages replica identity full;
alter table files    replica identity full;
