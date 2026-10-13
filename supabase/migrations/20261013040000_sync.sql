-- Cross-device sync: chats keep their project and mode (chat/cowork); people can read back their own keys on a
-- new device; admins are set from a private allow-list (kept out of this repo).

alter table public.chats add column project_id text, add column workspace text check (workspace in ('cowork'));
alter table public.connections add column extra jsonb not null default '{}'::jsonb;
grant insert (extra) , update (extra) on public.connections to authenticated;

-- Your own key, for your own signed-in session (same trust as keeping it in this browser).
create function public.get_my_connection_key(connection uuid) returns text
language sql stable security definer set search_path = '' as $$
  select s.decrypted_secret from public.connections c join vault.decrypted_secrets s on s.id = c.key_secret_id
  where c.id = connection and c.user_id = (select auth.uid());
$$;
revoke all on function public.get_my_connection_key(uuid) from public, anon;
grant execute on function public.get_my_connection_key(uuid) to authenticated;

-- Owner accounts become admins when they sign up. The list itself is filled in directly, never committed.
create schema if not exists private;
create table if not exists private.admin_emails (email text primary key);
revoke all on schema private from public, anon, authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, signup_method, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_app_meta_data ->> 'provider',
    exists (select 1 from private.admin_emails a where lower(a.email) = lower(new.email))
  );
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
