-- Live sync: devices hear about changes to their own chats, settings and connections right away
-- (row-level security still decides who gets which change).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.chats, public.user_settings, public.connections;
  end if;
end $$;
