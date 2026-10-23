-- Relay minutes per person per month, so relay use stays inside Cloudflare's free amount (the app stops handing out
-- relay passes past 200 hours in a month).
create table private.relay_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  month date not null,
  minutes integer not null default 0,
  primary key (user_id, month)
);

create function public.add_relay_minute() returns void
language sql security definer set search_path = '' as $$
  insert into private.relay_usage (user_id, month, minutes)
  select auth.uid(), date_trunc('month', now())::date, 1 where auth.uid() is not null
  on conflict (user_id, month) do update set minutes = private.relay_usage.minutes + 1;
$$;

create function public.relay_minutes_this_month() returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce((select u.minutes from private.relay_usage u where u.user_id = auth.uid() and u.month = date_trunc('month', now())::date), 0);
$$;

revoke all on function public.add_relay_minute(), public.relay_minutes_this_month() from public, anon;
grant execute on function public.add_relay_minute(), public.relay_minutes_this_month() to authenticated;
