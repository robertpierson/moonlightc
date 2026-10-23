-- Locked chats (hidden behind your PIN in the app): the flag syncs with the chat.
alter table public.chats add column if not exists locked boolean not null default false;
