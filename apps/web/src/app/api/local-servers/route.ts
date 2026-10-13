import { connection } from "next/server";

// Desktop app only: which OpenAI-compatible servers are running on this computer (LM Studio, llama.cpp).
const KNOWN = [
  { id: "lmstudio", name: "LM Studio", baseURL: "http://127.0.0.1:1234/v1" },
  { id: "llamacpp", name: "llama.cpp server", baseURL: "http://127.0.0.1:8080/v1" },
];

export async function GET() {
  await connection(); // probe at request time, never at build time
  if (process.env.MOONC_DESKTOP !== "1") return Response.json({ servers: [] });
  const found = await Promise.all(
    KNOWN.map(async (s) => {
      const ok = await fetch(`${s.baseURL}/models`, { signal: AbortSignal.timeout(800) })
        .then((r) => r.ok)
        .catch(() => false);
      return ok ? s : null;
    }),
  );
  return Response.json({ servers: found.filter(Boolean) });
}
