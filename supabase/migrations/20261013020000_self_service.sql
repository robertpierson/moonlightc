-- Self-service account deletion and anonymous download counts, so the web server needs no secret key.

-- Deletes the caller's own account; every table cascades from auth.users.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = (select auth.uid());
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Counts a click on a download button (no user, no personal data).
create function public.log_download(os text) returns void
language sql security definer set search_path = '' as $$
  insert into public.events (name, os, surface)
  select 'download', os, 'web' where os in ('windows', 'mac', 'linux', 'android', 'ios', 'chromeos');
$$;
revoke all on function public.log_download(text) from public;
grant execute on function public.log_download(text) to anon, authenticated;
