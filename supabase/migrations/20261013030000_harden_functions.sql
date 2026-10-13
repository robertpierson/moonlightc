-- Internal helpers aren't part of the API: the trigger runs on sign-up, is_admin runs inside admin functions.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon, authenticated;
-- Keep extensions out of the API schema.
create schema if not exists extensions;
alter extension citext set schema extensions;
