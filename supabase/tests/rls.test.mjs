// Runs the real migrations in Postgres (PGlite) with small stand-ins for Supabase's auth and Vault, then checks that
// row-level security keeps users apart and admin data private.
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import assert from "node:assert/strict";
import fs from "node:fs";
import { before, test } from "node:test";

const STUBS = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
create schema vault;
create table vault.secrets (id uuid primary key default gen_random_uuid(), secret text, name text);
create function vault.create_secret(s text, n text) returns uuid language sql as $$ insert into vault.secrets (secret, name) values (s, n) returning id $$;
create function vault.update_secret(i uuid, s text) returns void language sql as $$ update vault.secrets set secret = s where id = i $$;
create view vault.decrypted_secrets as select id, secret as decrypted_secret from vault.secrets;
revoke all on schema vault from public;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
let db;

async function as(user, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ""}', false); set role ${user ? "authenticated" : "service_role"};`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role;");
  }
}

before(async () => {
  db = new PGlite({ extensions: { citext } });
  await db.exec(STUBS);
  for (const f of fs.readdirSync(new URL("../migrations", import.meta.url)).sort()) {
    await db.exec(fs.readFileSync(new URL(`../migrations/${f}`, import.meta.url), "utf8"));
  }
  await db.query(`insert into auth.users (id, raw_user_meta_data, raw_app_meta_data) values ($1, '{"full_name":"Ann"}', '{"provider":"google"}'), ($2, '{}', '{"provider":"email"}')`, [A, B]);
});

test("sign-up creates a profile with the sign-in method", async () => {
  const { rows } = await as(null, "select display_name, signup_method from public.profiles where id = $1", [A]);
  assert.deepEqual(rows[0], { display_name: "Ann", signup_method: "google" });
});

test("users see only their own profile and can't make themselves admin", async () => {
  assert.equal((await as(A, "select id from public.profiles")).rows.length, 1);
  await as(A, "update public.profiles set display_name = 'Ann B' where id = $1", [A]);
  await assert.rejects(as(A, "update public.profiles set is_admin = true where id = $1", [A]), /permission denied/);
  const r = await as(A, "update public.profiles set display_name = 'hacked' where id = $1", [B]);
  assert.equal(r.affectedRows, 0);
});

test("chats and messages are private, and messages can't be planted in someone else's chat", async () => {
  const chatA = "10000000-0000-0000-0000-000000000001";
  await as(A, "insert into public.chats (id, user_id, title) values ($1, $2, 'mine')", [chatA, A]);
  await as(A, "insert into public.messages (id, chat_id, user_id, position, role, parts) values ('m1', $1, $2, 0, 'user', '[]')", [chatA, A]);
  assert.equal((await as(B, "select * from public.chats")).rows.length, 0);
  assert.equal((await as(B, "select * from public.messages")).rows.length, 0);
  await assert.rejects(as(B, "insert into public.chats (id, user_id) values (gen_random_uuid(), $1)", [A]), /row-level security/);
  await assert.rejects(as(B, "insert into public.messages (id, chat_id, user_id, position, role, parts) values ('x', $1, $2, 1, 'user', '[]')", [chatA, B]), /chat not found/);
});

test("API keys go to Vault and only the server can read them back", async () => {
  const conn = "20000000-0000-0000-0000-000000000001";
  await as(A, "insert into public.connections (id, user_id, provider_id, label) values ($1, $2, 'openai', 'OpenAI')", [conn, A]);
  await assert.rejects(as(A, "update public.connections set key_secret_id = gen_random_uuid() where id = $1", [conn]), /permission denied/);
  await as(A, "select public.set_connection_key($1, 'sk-secret')", [conn]);
  await assert.rejects(as(B, "select public.set_connection_key($1, 'sk-evil')", [conn]), /connection not found/);
  await assert.rejects(as(A, "select public.get_connection_key($1, $2)", [conn, A]), /permission denied/);
  await assert.rejects(as(A, "select * from vault.decrypted_secrets"), /permission denied/);
  const { rows } = await as(null, "select public.get_connection_key($1, $2) k", [conn, A]);
  assert.equal(rows[0].k, "sk-secret");
  assert.equal((await as(null, "select public.get_connection_key($1, $2) k", [conn, B])).rows[0].k, null);
});

test("analytics: users can log their own events but read none; admin numbers need an admin", async () => {
  await as(A, "insert into public.events (user_id, name, surface) values ($1, 'message.sent', 'web')", [A]);
  await assert.rejects(as(A, "insert into public.events (user_id, name) values ($1, 'x')", [B]), /row-level security/);
  assert.equal((await as(A, "select * from public.events")).rows.length, 0);
  await assert.rejects(as(A, "select public.admin_overview()"), /not allowed/);
  await as(null, "update public.profiles set is_admin = true where id = $1", [A]);
  const o = (await as(A, "select public.admin_overview() o")).rows[0].o;
  assert.equal(o.users, 2);
  assert.equal(o.activated, 1);
  assert.equal(o.signup_methods.google, 1);
  assert.deepEqual(Object.keys(o.retention).sort(), ["d1", "d30", "d7"]);
});

test("admin numbers include onboarding answers, downloads by OS and local vs cloud chats", async () => {
  await as(A, `update public.profiles set onboarding = '{"uses":["Coding","Writing"],"tools":["Claude"],"heard_from":"YouTube"}' where id = $1`, [A]);
  await as(A, `insert into public.events (user_id, name, props) values ($1, 'message.sent', '{"where":"local"}')`, [A]);
  await as(null, "insert into public.events (name, os, props) values ('download', 'windows', '{}')");
  const o = (await as(A, "select public.admin_overview() o")).rows[0].o;
  assert.deepEqual(o.uses, { Coding: 1, Writing: 1 });
  assert.equal(o.tools.Claude, 1);
  assert.equal(o.heard_from.YouTube, 1);
  assert.equal(o.downloads.windows, 1);
  assert.equal(o.local_vs_cloud.local, 1);
});

test("export returns only the caller's data", async () => {
  const e = (await as(B, "select public.export_my_data() e")).rows[0].e;
  assert.equal(e.profile.id, B);
  assert.equal(e.chats.length, 0);
  assert.equal(e.profile.is_admin, undefined);
});

test("deleting a user removes everything they own", async () => {
  await db.query("delete from auth.users where id = $1", [A]); // Supabase's auth service does this on account deletion
  assert.equal((await db.query("select count(*)::int n from public.profiles where id = $1", [A])).rows[0].n, 0);
  for (const t of ["chats", "messages", "connections", "user_settings"]) {
    assert.equal((await db.query(`select count(*)::int n from public.${t} where user_id = $1`, [A])).rows[0].n, 0, t);
  }
  assert.equal((await db.query("select count(*)::int n from public.profiles where id = $1", [B])).rows[0].n, 1);
});

test("people can delete their own account (and nothing else); anyone can count a download", async () => {
  const C = "00000000-0000-0000-0000-00000000000c";
  await db.query("insert into auth.users (id) values ($1)", [C]);
  await as(C, "insert into public.chats (id, user_id, title) values (gen_random_uuid(), $1, 'bye')", [C]);
  await assert.rejects(as(null, "select public.delete_my_account()"), /not signed in|permission denied/);
  await as(C, "select public.delete_my_account()");
  assert.equal((await db.query("select count(*)::int n from auth.users where id = $1", [C])).rows[0].n, 0);
  assert.equal((await as(null, "select count(*)::int n from public.chats where user_id = $1", [C])).rows[0].n, 0);
  assert.equal((await db.query("select count(*)::int n from auth.users where id = $1", [B])).rows[0].n, 1); // others untouched
  await db.exec("set role anon;");
  await db.query("select public.log_download('mac')");
  await db.query("select public.log_download('<script>')");
  await db.exec("reset role;");
  assert.equal((await as(null, "select count(*)::int n from public.events where name = 'download' and os = 'mac'")).rows[0].n, 1);
  assert.equal((await as(null, "select count(*)::int n from public.events where os = '<script>'")).rows[0].n, 0);
});

test("owner emails on the private list become admins at sign-up; keys come back only to their owner", async () => {
  const O = "00000000-0000-0000-0000-0000000000a1";
  await db.query("insert into private.admin_emails values ('Owner@Example.com')");
  await db.query("insert into auth.users (id, email) values ($1, 'owner@example.com')", [O]);
  assert.equal((await as(null, "select is_admin from public.profiles where id = $1", [O])).rows[0].is_admin, true);
  await assert.rejects(as(O, "select * from private.admin_emails"), /permission denied/);

  const conn = "00000000-0000-0000-0000-0000000000c1";
  await as(O, "insert into public.connections (id, user_id, provider_id, label) values ($1, $2, 'openai', 'OpenAI')", [conn, O]);
  await as(O, "select public.set_connection_key($1, 'sk-owner')", [conn]);
  assert.equal((await as(O, "select public.get_my_connection_key($1) k", [conn])).rows[0].k, "sk-owner");
  assert.equal((await as(B, "select public.get_my_connection_key($1) k", [conn])).rows[0].k, null);
});
