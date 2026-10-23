-- Listing your shared links (and deleting them with your account) looks up by owner.
create index if not exists shared_chats_user_id_idx on public.shared_chats (user_id);
