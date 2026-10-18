-- "Connect to my PCs without the two-step code": off by default. Turning it on needs two-step sign-in once;
-- then any of your signed-in devices may use your PCs' channels. Turning it off works from any session.
create table if not exists private.quick_access (user_id uuid primary key references auth.users (id) on delete cascade, enabled_at timestamptz not null default now());

create or replace function public.set_quick_access(enabled boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if enabled then
    if coalesce((select auth.jwt()) ->> 'aal', '') <> 'aal2' then raise exception 'two-step sign-in needed'; end if;
    insert into private.quick_access (user_id) values ((select auth.uid())) on conflict do nothing;
  else
    delete from private.quick_access where user_id = (select auth.uid());
  end if;
  return enabled;
end;
$$;

create or replace function public.quick_access_on() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.quick_access where user_id = (select auth.uid()));
$$;

create or replace function public.can_use_device_channel(topic text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
          or exists (select 1 from private.quick_access q where q.user_id = (select auth.uid())))
     and exists (select 1 from public.devices d where 'device:' || d.id::text = topic and d.user_id = (select auth.uid()));
$$;

revoke all on function public.set_quick_access(boolean), public.quick_access_on() from public, anon;
grant execute on function public.set_quick_access(boolean), public.quick_access_on() to authenticated;
