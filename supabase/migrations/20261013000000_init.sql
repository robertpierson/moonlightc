-- MoonlightC initial schema. Every table has row-level security; users only ever see their own rows.
-- Admin-only data goes through security-definer functions that check profiles.is_admin.

create extension if not exists citext;

-- ---------- Profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  username citext unique check (username ~ '^[a-z0-9_]{3,24}$'),
  age_confirmed boolean not null default false,
  onboarding jsonb not null default '{}'::jsonb,       -- uses, tools, heard_from, distro (answers only)
  onboarded_at timestamptz,
  phone text check (char_length(phone) <= 32),
  signup_method text,
  utm jsonb not null default '{}'::jsonb,
  referrer text,
  country text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "update own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Users can't make themselves admin or rewrite how they signed up.
revoke update on public.profiles from authenticated;
grant update (display_name, username, age_confirmed, onboarding, onboarded_at, phone, utm, referrer, country, updated_at) on public.profiles to authenticated;

-- New sign-ups get a profile automatically.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, signup_method)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), new.raw_app_meta_data ->> 'provider');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- Synced app data ----------
create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,   -- modes, look, favorites, connector configs (never keys or tokens)
  updated_at timestamptz not null default now()
);

create table public.chats (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),
  model jsonb,
  mode_id text,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index chats_user_updated on public.chats (user_id, updated_at desc);

create table public.messages (
  id text not null,
  chat_id uuid not null references public.chats (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  position integer not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  parts jsonb not null,
  metadata jsonb,
  updated_at timestamptz not null default now(),
  primary key (chat_id, id)
);
create index messages_user on public.messages (user_id);

create table public.connections (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_id text not null,
  label text not null,
  base_url text,
  models jsonb not null default '[]'::jsonb,
  key_secret_id uuid,                       -- Supabase Vault secret; decrypted only by the server
  created_at timestamptz not null default now()
);
create index connections_user on public.connections (user_id);

do $$
declare t text;
begin
  foreach t in array array['user_settings', 'chats', 'messages', 'connections'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;
-- Clients may never set the vault pointer directly.
revoke insert, update on public.connections from authenticated;
grant insert (id, user_id, provider_id, label, base_url, models, created_at) on public.connections to authenticated;
grant update (label, base_url, models) on public.connections to authenticated;

-- A message must belong to one of the user's own chats.
create function public.message_chat_owner_check() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.chats c where c.id = new.chat_id and c.user_id = new.user_id) then
    raise exception 'chat not found';
  end if;
  return new;
end $$;
create trigger messages_chat_owner before insert or update on public.messages for each row execute function public.message_chat_owner_check();

-- ---------- Keys in Vault ----------
-- Store or replace a connection's key. Runs as the definer so the secret goes straight into Vault.
create function public.set_connection_key(connection uuid, api_key text) returns void
language plpgsql security definer set search_path = '' as $$
declare sid uuid;
begin
  select key_secret_id into sid from public.connections where id = connection and user_id = (select auth.uid());
  if not found then raise exception 'connection not found'; end if;
  if sid is null then
    sid := vault.create_secret(api_key, 'conn_' || connection::text);
    update public.connections set key_secret_id = sid where id = connection;
  else
    perform vault.update_secret(sid, api_key);
  end if;
end $$;
revoke all on function public.set_connection_key(uuid, text) from public, anon;
grant execute on function public.set_connection_key(uuid, text) to authenticated;

-- Server-only: the chat proxy reads a key for one request. Never callable from the browser.
create function public.get_connection_key(connection uuid, owner uuid) returns text
language sql security definer set search_path = '' as $$
  select s.decrypted_secret from public.connections c join vault.decrypted_secrets s on s.id = c.key_secret_id
  where c.id = connection and c.user_id = owner;
$$;
revoke all on function public.get_connection_key(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_connection_key(uuid, uuid) to service_role;

-- ---------- Analytics (never message contents, prompts, files or keys) ----------
create table public.events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  anon_id text,
  name text not null check (name ~ '^[a-z0-9_.]{1,60}$'),
  props jsonb not null default '{}'::jsonb check (pg_column_size(props) < 4000),
  country text,
  os text,
  browser text,
  surface text check (surface in ('web', 'pwa', 'desktop')),
  created_at timestamptz not null default now()
);
create index events_created on public.events (created_at);
create index events_user on public.events (user_id, created_at);
alter table public.events enable row level security;
create policy "log own events" on public.events for insert to authenticated with check (user_id = (select auth.uid()));
-- No select policy: only admin functions read events.

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.profiles where id = (select auth.uid())), false);
$$;

-- Admin dashboard numbers. Refuses anyone who isn't an admin.
create function public.admin_overview(days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select jsonb_build_object(
    'signups', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'count', n) order by d), '[]'::jsonb)
                from (select date_trunc('day', created_at)::date d, count(*) n from public.profiles
                      where created_at > now() - make_interval(days => days) group by 1) x),
    'users', (select count(*) from public.profiles),
    'dau', (select count(distinct user_id) from public.events where created_at > now() - interval '1 day'),
    'wau', (select count(distinct user_id) from public.events where created_at > now() - interval '7 days'),
    'mau', (select count(distinct user_id) from public.events where created_at > now() - interval '30 days'),
    'activated', (select count(*) from public.profiles p
                  where exists (select 1 from public.connections c where c.user_id = p.id)
                    and exists (select 1 from public.events e where e.user_id = p.id and e.name = 'message.sent')),
    'signup_methods', (select coalesce(jsonb_object_agg(coalesce(signup_method, 'unknown'), n), '{}'::jsonb)
                       from (select signup_method, count(*) n from public.profiles group by 1) x),
    'providers', (select coalesce(jsonb_object_agg(provider_id, n), '{}'::jsonb)
                  from (select provider_id, count(distinct user_id) n from public.connections group by 1) x),
    'top_features', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'count', n) order by n desc), '[]'::jsonb)
                     from (select name, count(*) n from public.events where created_at > now() - make_interval(days => days)
                           group by 1 order by 2 desc limit 15) x),
    'surfaces', (select coalesce(jsonb_object_agg(coalesce(surface, 'web'), n), '{}'::jsonb)
                 from (select surface, count(distinct user_id) n from public.events group by 1) x),
    'heard_from', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb)
                   from (select onboarding ->> 'heard_from' k, count(*) n from public.profiles
                         where onboarding ? 'heard_from' group by 1) x)
  ) into result;
  return result;
end $$;
revoke all on function public.admin_overview(integer) from public, anon;
grant execute on function public.admin_overview(integer) to authenticated;

-- Data export (the user's own data only). Account deletion is done server-side with auth.admin.deleteUser,
-- which cascades through every table above.
create function public.export_my_data() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) - 'is_admin' from public.profiles p where p.id = (select auth.uid())),
    'settings', (select data from public.user_settings where user_id = (select auth.uid())),
    'chats', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from public.chats c where c.user_id = (select auth.uid())),
    'messages', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from public.messages m where m.user_id = (select auth.uid())),
    'connections', (select coalesce(jsonb_agg(to_jsonb(c) - 'key_secret_id'), '[]'::jsonb) from public.connections c where c.user_id = (select auth.uid()))
  );
$$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
