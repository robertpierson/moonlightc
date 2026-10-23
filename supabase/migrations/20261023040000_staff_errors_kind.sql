-- Errors now carry a safe "kind" (type and code location, or a category) instead of text; older rows had "message".
create or replace function public.staff_errors(days integer default 7) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_ok() then raise exception 'not allowed'; end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.count desc), '[]'::jsonb) from (
      select coalesce(props ->> 'kind', props ->> 'message', 'unknown') as message, count(*) as count, count(distinct coalesce(user_id::text, anon_id)) as people,
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
