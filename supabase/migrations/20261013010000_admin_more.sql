-- More numbers for /admin: retention (D1/D7/D30), onboarding answers, downloads by OS, and local vs cloud chats.
create or replace function public.admin_overview(days integer default 30) returns jsonb
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
    'retention', (select coalesce(jsonb_object_agg('d' || k, jsonb_build_object('eligible', eligible, 'retained', retained)), '{}'::jsonb)
                  from (select k,
                               count(*) filter (where p.created_at <= now() - make_interval(days => k)) eligible,
                               count(*) filter (where p.created_at <= now() - make_interval(days => k) and exists (
                                 select 1 from public.events e where e.user_id = p.id
                                   and e.created_at >= p.created_at + make_interval(days => k)
                                   and e.created_at < p.created_at + make_interval(days => k + 1))) retained
                        from public.profiles p cross join (values (1), (7), (30)) v(k)
                        group by k) x),
    'signup_methods', (select coalesce(jsonb_object_agg(coalesce(signup_method, 'unknown'), n), '{}'::jsonb)
                       from (select signup_method, count(*) n from public.profiles group by 1) x),
    'providers', (select coalesce(jsonb_object_agg(provider_id, n), '{}'::jsonb)
                  from (select provider_id, count(distinct user_id) n from public.connections group by 1) x),
    'top_features', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'count', n) order by n desc), '[]'::jsonb)
                     from (select name, count(*) n from public.events where created_at > now() - make_interval(days => days)
                           group by 1 order by 2 desc limit 15) x),
    'surfaces', (select coalesce(jsonb_object_agg(coalesce(surface, 'web'), n), '{}'::jsonb)
                 from (select surface, count(distinct user_id) n from public.events where user_id is not null group by 1) x),
    'local_vs_cloud', (select coalesce(jsonb_object_agg(coalesce(w, 'cloud'), n), '{}'::jsonb)
                       from (select props ->> 'where' w, count(*) n from public.events where name = 'message.sent'
                             and created_at > now() - make_interval(days => days) group by 1) x),
    'downloads', (select coalesce(jsonb_object_agg(coalesce(os, 'unknown'), n), '{}'::jsonb)
                  from (select os, count(*) n from public.events where name = 'download' group by 1) x),
    'heard_from', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb)
                   from (select onboarding ->> 'heard_from' k, count(*) n from public.profiles
                         where onboarding ? 'heard_from' group by 1) x),
    'uses', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb)
             from (select u k, count(*) n from public.profiles, jsonb_array_elements_text(coalesce(onboarding -> 'uses', '[]')) u group by 1) x),
    'tools', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb)
              from (select t k, count(*) n from public.profiles, jsonb_array_elements_text(coalesce(onboarding -> 'tools', '[]')) t group by 1) x)
  ) into result;
  return result;
end $$;
revoke all on function public.admin_overview(integer) from public, anon;
grant execute on function public.admin_overview(integer) to authenticated;
