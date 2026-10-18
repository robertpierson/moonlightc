import { attest } from "@/lib/attest";

/** Where this request comes from, signed (used to allow remote control only from chosen places). */
export function GET(req: Request) {
  return Response.json(attest(req.headers), { headers: { "access-control-allow-origin": "*", "cache-control": "no-store" } });
}
