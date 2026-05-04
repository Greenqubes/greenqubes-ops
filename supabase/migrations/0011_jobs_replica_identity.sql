-- Jobs table was added to the realtime publication in 0010 but REPLICA IDENTITY
-- FULL was never set. Without it Postgres only sends the primary key in UPDATE
-- events, so the Realtime engine can't evaluate the RLS policy and drops them.
-- Same fix already applied to messages + files in 0009.
alter table jobs replica identity full;
