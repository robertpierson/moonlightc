import { accountsEnabled, adminSupabase, serverSupabase } from "@/lib/supabase/server";

// Deletes the signed-in person's own account. Every table references auth.users with "on delete cascade".
export async function POST() {
  if (!accountsEnabled) return new Response(null, { status: 404 });
  const { data } = await (await serverSupabase()).auth.getUser();
  if (!data.user) return Response.json({ error: "You're signed out. Sign in again first." }, { status: 401 });
  try {
    const { error } = await adminSupabase().auth.admin.deleteUser(data.user.id);
    if (error) throw error;
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't delete the account." }, { status: 500 });
  }
  return Response.json({ deleted: true });
}
