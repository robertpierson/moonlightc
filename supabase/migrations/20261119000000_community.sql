-- Community: friends, direct messages, and the library of things people make (themes, modes, commands, setups, mods).

-- ---------- Friends ----------
-- People are found by their exact username only: there is no list of everyone to browse.
create or replace function public.find_person(u text)
returns table (id uuid, username text, display_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username::text, p.display_name
  from public.profiles p
  where p.username = u::extensions.citext and p.id <> (select auth.uid())
  limit 1
$$;

-- a asked b. Writes only through the functions below.
create table public.friendships (
  a uuid not null references auth.users on delete cascade,
  b uuid not null references auth.users on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  blocked_by uuid,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a <> b)
);
create unique index friendships_pair on public.friendships (least(a, b), greatest(a, b));
create index friendships_b on public.friendships (b);
alter table public.friendships enable row level security;
create policy "see your own" on public.friendships for select to authenticated
  using ((select auth.uid()) in (a, b) and (status <> 'blocked' or blocked_by = (select auth.uid())));
revoke insert, update, delete on public.friendships from anon, authenticated;

create or replace function public.are_friends(x uuid, y uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  -- Only about yourself: nobody can check whether two other people are friends.
  select (select auth.uid()) in (x, y) and exists (select 1 from public.friendships f where f.status = 'accepted' and ((f.a = x and f.b = y) or (f.a = y and f.b = x)))
$$;

-- Ask someone (by username) to be friends. If they already asked you, you're friends now.
create or replace function public.request_friend(u text)
returns text language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); them uuid; row public.friendships;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  select p.id into them from public.profiles p where p.username = u::extensions.citext;
  if them is null or them = me then raise exception 'No one has that username.'; end if;
  select * into row from public.friendships where (a = me and b = them) or (a = them and b = me);
  if row.status = 'blocked' then raise exception 'No one has that username.'; end if;
  if row.status = 'accepted' then return 'friends'; end if;
  if row.a = them then
    update public.friendships set status = 'accepted' where a = them and b = me;
    return 'friends';
  end if;
  if row.a = me then return 'asked'; end if;
  if (select count(*) from public.friendships where a = me and status = 'pending' and created_at > now() - interval '1 day') >= 30 then
    raise exception 'That''s a lot of requests today. Try again tomorrow.';
  end if;
  insert into public.friendships (a, b) values (me, them);
  return 'asked';
end $$;

create or replace function public.answer_friend(other uuid, accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if accept then
    update public.friendships set status = 'accepted' where a = other and b = auth.uid() and status = 'pending';
  else
    delete from public.friendships where a = other and b = auth.uid() and status = 'pending';
  end if;
end $$;

-- Unfriend, cancel a request, or unblock someone you blocked.
create or replace function public.remove_friend(other uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.friendships f
  where ((f.a = auth.uid() and f.b = other) or (f.a = other and f.b = auth.uid()))
    and (f.status <> 'blocked' or f.blocked_by = auth.uid())
$$;

-- Block: they can't message you or ask again, and they're gone from your list.
create or replace function public.block_person(other uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null or other = me then return; end if;
  -- They already blocked you: nothing more to do (and their block stays).
  if exists (select 1 from public.friendships where a = other and b = me and status = 'blocked') then return; end if;
  delete from public.friendships where (a = me and b = other) or (a = other and b = me);
  insert into public.friendships (a, b, status, blocked_by) values (me, other, 'blocked', me);
end $$;

-- Your friends and requests, with their names.
create or replace function public.my_friends()
returns table (id uuid, username text, display_name text, status text, incoming boolean, since timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username::text, p.display_name, f.status, f.b = auth.uid(), f.created_at
  from public.friendships f
  join public.profiles p on p.id = case when f.a = auth.uid() then f.b else f.a end
  where auth.uid() in (f.a, f.b) and (f.status <> 'blocked' or f.blocked_by = auth.uid())
$$;

-- ---------- Direct messages ----------
create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null default auth.uid() references auth.users on delete cascade,
  recipient uuid not null references auth.users on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  kind text not null default 'text' check (kind in ('text', 'ai')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index direct_messages_pair on public.direct_messages (least(sender, recipient), greatest(sender, recipient), created_at desc);
create index direct_messages_recipient on public.direct_messages (recipient, created_at desc);
alter table public.direct_messages enable row level security;
create policy "the two people" on public.direct_messages for select to authenticated
  using ((select auth.uid()) in (sender, recipient));
create policy "send to friends" on public.direct_messages for insert to authenticated
  with check (sender = (select auth.uid()) and public.are_friends(sender, recipient));
create policy "mark read" on public.direct_messages for update to authenticated
  using (recipient = (select auth.uid())) with check (recipient = (select auth.uid()));
create policy "unsend" on public.direct_messages for delete to authenticated
  using (sender = (select auth.uid()));
revoke insert, update, delete on public.direct_messages from anon;
revoke update on public.direct_messages from authenticated;
grant update (read_at) on public.direct_messages to authenticated;

-- 30 messages a minute per person is plenty for a chat and stops floods.
create or replace function public.dm_rate()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.direct_messages where sender = new.sender and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Slow down a little: too many messages in a minute.';
  end if;
  new.created_at := now();
  new.read_at := null;
  return new;
end $$;
create trigger direct_messages_rate before insert on public.direct_messages for each row execute function public.dm_rate();
alter publication supabase_realtime add table public.direct_messages;

-- ---------- Library ----------
create table public.creations (
  id uuid primary key default gen_random_uuid(),
  author uuid not null default auth.uid() references auth.users on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 40),
  kind text not null check (kind in ('theme', 'mode', 'command', 'setup', 'mod')),
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 300),
  payload jsonb not null check (octet_length(payload::text) < 300000),
  installs integer not null default 0,
  reports integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index creations_browse on public.creations (kind, installs desc, created_at desc) where not hidden;
create index creations_author on public.creations (author);
alter table public.creations enable row level security;
create policy "anyone browses" on public.creations for select to anon, authenticated
  using (not hidden or author = (select auth.uid()));
create policy "share your own" on public.creations for insert to authenticated
  with check (author = (select auth.uid()));
create policy "edit your own" on public.creations for update to authenticated
  using (author = (select auth.uid())) with check (author = (select auth.uid()));
create policy "remove your own" on public.creations for delete to authenticated
  using (author = (select auth.uid()));
revoke insert, update on public.creations from anon, authenticated;
grant insert (author_name, kind, name, description, payload) on public.creations to authenticated;
grant update (author_name, name, description, payload, updated_at) on public.creations to authenticated;

create or replace function public.creations_limits()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.creations where author = new.author and created_at > now() - interval '1 day') >= 20 then
    raise exception 'That''s a lot of sharing for one day. Try again tomorrow.';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger creations_limits before insert or update on public.creations for each row execute function public.creations_limits();

create table public.creation_installs (
  user_id uuid not null references auth.users on delete cascade,
  creation uuid not null references public.creations on delete cascade,
  primary key (user_id, creation)
);
alter table public.creation_installs enable row level security;
create table public.creation_reports (
  user_id uuid not null references auth.users on delete cascade,
  creation uuid not null references public.creations on delete cascade,
  reason text not null default '' check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  primary key (user_id, creation)
);
alter table public.creation_reports enable row level security;
create policy "staff read reports" on public.creation_reports for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin));

-- Counted once per person.
create or replace function public.count_install(c uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.creation_installs values (auth.uid(), c) on conflict do nothing;
  if found then update public.creations set installs = installs + 1 where id = c; end if;
end $$;

-- Three reports hide it until staff look.
create or replace function public.report_creation(c uuid, why text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  insert into public.creation_reports (user_id, creation, reason) values (auth.uid(), c, left(coalesce(why, ''), 300)) on conflict do nothing;
  if found then
    update public.creations set reports = reports + 1, hidden = hidden or reports + 1 >= 3 where id = c;
  end if;
end $$;

revoke execute on function public.find_person(text), public.request_friend(text), public.answer_friend(uuid, boolean), public.remove_friend(uuid), public.block_person(uuid), public.my_friends(), public.count_install(uuid), public.report_creation(uuid, text), public.are_friends(uuid, uuid) from anon, public;
grant execute on function public.find_person(text), public.request_friend(text), public.answer_friend(uuid, boolean), public.remove_friend(uuid), public.block_person(uuid), public.my_friends(), public.count_install(uuid), public.report_creation(uuid, text), public.are_friends(uuid, uuid) to authenticated;
revoke execute on function public.dm_rate(), public.creations_limits() from anon, authenticated, public;
alter publication supabase_realtime add table public.friendships;
