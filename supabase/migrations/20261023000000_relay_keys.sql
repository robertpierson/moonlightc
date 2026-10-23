-- Relay (TURN) keys people bring for remote control on networks that block direct video. The token lives in Vault;
-- only its owner can read it back (their own devices use it). The owner account uses the server's key instead.
create table private.relay_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  key_id text not null,
  secret_id uuid not null
);

create function public.set_relay_key(key_id text, token text) returns void
language plpgsql security definer set search_path = '' as $$
declare sid uuid; me uuid := (select auth.uid());
begin
  if me is null then raise exception 'sign in first'; end if;
  if key_id !~ '^[0-9a-f]{32}$' or token !~ '^[0-9a-f]{64}$' then raise exception 'That doesn''t look like a Cloudflare TURN key.'; end if;
  select r.secret_id into sid from private.relay_keys r where r.user_id = me;
  if not found then
    sid := vault.create_secret(token, 'relay_' || me::text);
    insert into private.relay_keys (user_id, key_id, secret_id) values (me, set_relay_key.key_id, sid);
  else
    perform vault.update_secret(sid, token);
    update private.relay_keys r set key_id = set_relay_key.key_id where r.user_id = me;
  end if;
end $$;

create function public.clear_relay_key() returns void
language plpgsql security definer set search_path = '' as $$
declare sid uuid;
begin
  delete from private.relay_keys r where r.user_id = (select auth.uid()) returning r.secret_id into sid;
  if sid is not null then delete from vault.secrets s where s.id = sid; end if;
end $$;

-- Which key is saved (never the token), for Settings.
create function public.my_relay_key_id() returns text
language sql stable security definer set search_path = '' as $$
  select r.key_id from private.relay_keys r where r.user_id = (select auth.uid());
$$;

-- The key and token, for the server to make short-lived relay passes for this person.
create function public.get_my_relay_key() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('key_id', r.key_id, 'token', s.decrypted_secret)
  from private.relay_keys r join vault.decrypted_secrets s on s.id = r.secret_id
  where r.user_id = (select auth.uid());
$$;

revoke all on function public.set_relay_key(text, text), public.clear_relay_key(), public.my_relay_key_id(), public.get_my_relay_key() from public, anon;
grant execute on function public.set_relay_key(text, text), public.clear_relay_key(), public.my_relay_key_id(), public.get_my_relay_key() to authenticated;
