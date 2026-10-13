import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const accountsEnabled = !!(URL && KEY);

/** Supabase as the signed-in visitor (row-level security applies). */
export async function serverSupabase() {
  const store = await cookies();
  return createServerClient(URL, KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Server components can't set cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}
