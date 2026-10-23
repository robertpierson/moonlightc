-- Share a chat: a read-only copy of its text (no files), readable by anyone who has the link. Only its owner can
-- see the list, delete it, or make new ones.
create table public.shared_chats (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{16,32}$'),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) <= 200),
  messages jsonb not null check (jsonb_typeof(messages) = 'array' and octet_length(messages::text) <= 1500000),
  created_at timestamptz not null default now()
);
alter table public.shared_chats enable row level security;
create policy "own shared chats" on public.shared_chats for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- The public page reads one shared chat by its link id (and never the list).
create function public.get_shared_chat(share text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('title', c.title, 'messages', c.messages, 'created_at', c.created_at)
  from public.shared_chats c where c.id = share;
$$;
revoke all on function public.get_shared_chat(text) from public;
grant execute on function public.get_shared_chat(text) to anon, authenticated;
