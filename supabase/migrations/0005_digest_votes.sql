-- =============================================================
-- digest_votes: tracks per-user votes on Monday digest items.
-- One row per (chat, voter). Vote can be 'yes' or 'no'.
-- Majority >50% yes → promoted; ≥50% no → dismissed.
-- Items with zero votes are re-queued in the next digest.
-- =============================================================

create table digest_votes (
  id       uuid        primary key default gen_random_uuid(),
  chat_id  uuid        not null references asst_chats(id) on delete cascade,
  voter_id uuid        not null references users(id)      on delete cascade,
  vote     text        not null check (vote in ('yes', 'no')),
  ts       timestamptz not null default now(),
  unique (chat_id, voter_id)
);

-- RLS: voters can read their own votes; service role handles all writes.
alter table digest_votes enable row level security;

create policy "voter reads own votes" on digest_votes
  for select using (voter_id = get_my_id());

create policy "service inserts votes" on digest_votes
  for insert with check (true);

create policy "service updates votes" on digest_votes
  for update using (true);

create index digest_votes_chat_id_idx  on digest_votes (chat_id);
create index digest_votes_voter_id_idx on digest_votes (voter_id);
