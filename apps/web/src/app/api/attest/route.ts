import { createClient } from "@supabase/supabase-js";
import { attest, claimsOf } from "@/lib/attest";

/** Where this request comes from, signed (used to allow remote control only from chosen places). With a sign-in token,
 *  also who it is and whether it entered its two-step code (for the security level). */
export async function GET(req: Request) {
  const token = /^Bearer (\S+)$/.exec(req.headers.get("authorization") ?? "")?.[1];
  let who: ReturnType<typeof claimsOf>;
  if (token && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    // Only a token Supabase accepts counts (its claims are read after that check).
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const { data } = await sb.auth.getUser(token);
    const c = claimsOf(token);
    if (data.user && c?.uid === data.user.id) who = c;
  }
  return Response.json(attest(req.headers, who), { headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization", "cache-control": "no-store" } });
}

export const OPTIONS = () => new Response(null, { headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization" } });
