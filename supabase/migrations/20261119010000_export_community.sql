-- "Download my data" includes friends, messages you sent or got, and what you shared in Community.
create or replace function public.export_my_data()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) - 'is_admin' from public.profiles p where p.id = (select auth.uid())),
    'settings', (select data from public.user_settings where user_id = (select auth.uid())),
    'chats', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from public.chats c where c.user_id = (select auth.uid())),
    'messages', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from public.messages m where m.user_id = (select auth.uid())),
    'connections', (select coalesce(jsonb_agg(to_jsonb(c) - 'key_secret_id'), '[]'::jsonb) from public.connections c where c.user_id = (select auth.uid())),
    'friends', (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) from public.friendships f where (select auth.uid()) in (f.a, f.b) and (f.status <> 'blocked' or f.blocked_by = (select auth.uid()))),
    'direct_messages', (select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) from public.direct_messages d where (select auth.uid()) in (d.sender, d.recipient)),
    'shared_in_community', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from public.creations c where c.author = (select auth.uid()))
  );
$$;
