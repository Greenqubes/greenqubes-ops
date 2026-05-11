-- Allow authenticated users to delete their own conversations
create policy "asst_chats: own delete"
  on asst_chats for delete
  to authenticated
  using (user_id = get_my_id());
