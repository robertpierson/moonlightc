-- Security levels for reaching your PCs (Settings > Account). Lowering it needs two-step sign-in; raising never does.
--   0 Password only: any signed-in session reaches your PCs, files and terminal included.
--   1 Balanced: the screen with your password; files and terminal need two-step sign-in (checked by the PC).
--   2 Strict (default): everything on your PCs needs two-step sign-in.
--   3 Maximum: a two-step code entered in the last 15 minutes for every remote session (checked by the PC).
-- Replaces "Connect to my PCs without the code" (that was level 0).
create table if not exists private.security_levels (
  user_id uuid primary key references auth.users (id) on delete cascade,
  level smallint not null check (level between 0 and 3),
  updated_at timestamptz not null default now()
);
insert into private.security_levels (user_id, level) select user_id, 0 from private.quick_access on conflict do nothing;

create or replace function public.security_level() returns int
language sql stable security definer set search_path = '' as $$
  select coalesce((select level from private.security_levels where user_id = (select auth.uid())), 2);
$$;

create or replace function public.set_security_level(l int) returns int
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'sign in first'; end if;
  if l is null or l not between 0 and 3 then raise exception 'unknown security level'; end if;
  if l < public.security_level() and coalesce((select auth.jwt()) ->> 'aal', '') <> 'aal2' then
    raise exception 'two-step sign-in needed to lower the security level';
  end if;
  insert into private.security_levels (user_id, level) values ((select auth.uid()), l)
    on conflict (user_id) do update set level = excluded.level, updated_at = now();
  return l;
end;
$$;

-- Older apps still call these.
create or replace function public.quick_access_on() returns boolean
language sql stable security definer set search_path = '' as $$ select public.security_level() <= 1; $$;
create or replace function public.set_quick_access(enabled boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform public.set_security_level(case when enabled then 0 else 2 end);
  return enabled;
end;
$$;

create or replace function public.can_use_device_channel(topic text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2' or public.security_level() <= 1)
     and exists (select 1 from public.devices d where 'device:' || d.id::text = topic and d.user_id = (select auth.uid()));
$$;

revoke all on function public.security_level(), public.set_security_level(int) from public, anon;
grant execute on function public.security_level(), public.set_security_level(int) to authenticated;
