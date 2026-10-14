-- Devices and remote control. A desktop app registers itself; remote sessions run over a private Realtime
-- channel "device:<id>" that only the owner can join, and only with two-step sign-in (aal2) on both ends.

create table public.devices (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) <= 80),
  os text check (char_length(os) <= 20),
  remote_enabled boolean not null default false,
  local_models jsonb not null default '[]'::jsonb,
  app_version text,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index devices_user on public.devices (user_id);
alter table public.devices enable row level security;
create policy "own devices" on public.devices for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Realtime: only the device's owner, signed in with two-step sign-in, may listen or send on its channel.
create function public.can_use_device_channel(topic text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
     and exists (select 1 from public.devices d where 'device:' || d.id::text = topic and d.user_id = (select auth.uid()));
$$;
revoke all on function public.can_use_device_channel(text) from public, anon;
grant execute on function public.can_use_device_channel(text) to authenticated;

create policy "device channel: read" on realtime.messages for select to authenticated
  using (realtime.topic() like 'device:%' and public.can_use_device_channel(realtime.topic()));
create policy "device channel: send" on realtime.messages for insert to authenticated
  with check (realtime.topic() like 'device:%' and public.can_use_device_channel(realtime.topic()));
