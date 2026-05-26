-- Drop the cross-read policy so every user (including scheduler and admin)
-- only sees their own assistant chat history.
DROP POLICY IF EXISTS "asst_chats: scheduler reads all" ON asst_chats;
