-- Staff panel: who uses MoonlightC, what's happening right now, and what's breaking.
-- Admins only, and only with two-step sign-in (it shows people's emails). Never message content or keys.

create or replace function private.staff_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2';
$$;

create or replace function public.staff_users(q text default '', lim integer default 50, skip integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_ok() then raise exception 'not allowed'; end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb) from (
      select p.id, u.email, p.display_name, p.created_at, u.last_sign_in_at, p.signup_method, p.country, p.is_admin,
             p.onboarded_at is not null as onboarded,
             (select max(e.created_at) from public.events e where e.user_id = p.id) as last_active,
             (select count(*) from public.events e where e.user_id = p.id and e.created_at > now() - interval '30 days') as events_30d,
             (select count(*) from public.events e where e.user_id = p.id and e.name = 'app.error' and e.created_at > now() - interval '7 days') as errors_7d,
             (select count(*) from public.connections c where c.user_id = p.id) as connections,
             (select count(*) from public.chats c where c.user_id = p.id and c.deleted_at is null) as chats,
             (select count(*) from public.devices d where d.user_id = p.id) as devices
      from public.profiles p join auth.users u on u.id = p.id
      where coalesce(q, '') = '' or u.email ilike '%' || q || '%' or p.display_name ilike '%' || q || '%'
      order by p.created_at desc
      limit least(greatest(lim, 1), 200) offset greatest(skip, 0)
    ) x
  );
end;
$$;

create or replace function public.staff_user(uid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_ok() then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'events', (select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc), '[]'::jsonb) from (
                 select name, props, surface, os, browser, country, created_at from public.events
                 where user_id = uid order by created_at desc limit 100) e),
    'devices', (select coalesce(jsonb_agg(to_jsonb(d) order by d.last_seen desc), '[]'::jsonb) from (
                 select name, os, app_version, last_seen, remote_enabled, is_home from public.devices where user_id = uid) d),
    'providers', (select coalesce(jsonb_agg(distinct c.provider_id), '[]'::jsonb) from public.connections c where c.user_id = uid)
  );
end;
$$;

create or replace function public.staff_errors(days integer default 7) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_ok() then raise exception 'not allowed'; end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.count desc), '[]'::jsonb) from (
      select props ->> 'message' as message, count(*) as count, count(distinct coalesce(user_id::text, anon_id)) as people,
             max(created_at) as last_seen, (array_agg(props ->> 'path' order by created_at desc))[1] as path,
             (array_agg(props ->> 'version' order by created_at desc))[1] as version,
             (array_agg(surface order by created_at desc))[1] as surface
      from public.events
      where name = 'app.error' and created_at > now() - make_interval(days => greatest(days, 1))
      group by 1 order by count(*) desc limit 100
    ) x
  );
end;
$$;

create or replace function public.staff_live() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_ok() then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'active', (select coalesce(jsonb_agg(to_jsonb(x) order by x.at desc), '[]'::jsonb) from (
                 select u.email, max(e.created_at) as at, (array_agg(e.surface order by e.created_at desc))[1] as surface
                 from public.events e join auth.users u on u.id = e.user_id
                 where e.created_at > now() - interval '15 minutes' group by u.email) x),
    'pcs_online', (select coalesce(jsonb_agg(to_jsonb(d) order by d.last_seen desc), '[]'::jsonb) from (
                 select d.name, u.email, d.app_version, d.last_seen, d.remote_enabled, d.is_home
                 from public.devices d join auth.users u on u.id = d.user_id
                 where d.last_seen > now() - interval '3 minutes') d),
    'events_last_hour', (select count(*) from public.events where created_at > now() - interval '1 hour'),
    'errors_last_hour', (select count(*) from public.events where name = 'app.error' and created_at > now() - interval '1 hour')
  );
end;
$$;

-- Callable only by signed-in people (and each checks staff access itself).
revoke execute on function public.staff_users(text, integer, integer), public.staff_user(uuid), public.staff_errors(integer), public.staff_live() from public, anon;
grant execute on function public.staff_users(text, integer, integer), public.staff_user(uuid), public.staff_errors(integer), public.staff_live() to authenticated;
revoke execute on function private.staff_ok() from public, anon, authenticated;
