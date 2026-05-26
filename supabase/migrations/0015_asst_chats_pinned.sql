-- Add pinned column to asst_chats for conversation pinning feature
-- Max 5 pinned conversations per user
ALTER TABLE asst_chats
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS asst_chats_pinned_ts_idx
  ON asst_chats (user_id, pinned DESC, ts DESC);
