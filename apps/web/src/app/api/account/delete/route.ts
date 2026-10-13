import { accountsEnabled, serverSupabase } from "@/lib/supabase/server";

// Deletes the signed-in person's own account (the database function only ever deletes the caller).
export async function POST() {
  if (!accountsEnabled) return new Response(null, { status: 404 });
  const sb = await serverSupabase();
  const { data } = await sb.auth.getUser();
  if (!data.user) return Response.json({ error: "You're signed out. Sign in again first." }, { status: 401 });
  const { error } = await sb.rpc("delete_my_account");
  if (error) return Response.json({ error: "Couldn't delete the account. Try again." }, { status: 500 });
  await sb.auth.signOut().catch(() => {});
  return Response.json({ deleted: true });
}
