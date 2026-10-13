import { getProvider, languageModel, ProviderError } from "@moonc/core";
import { generateText, Output } from "ai";
import { z } from "zod";
import { readConnection } from "@/lib/server-guard";

const API = process.env.MOONC_TEST_GOOGLE_API ?? "https://www.googleapis.com";
const QUERY = 'newer_than:400d (subject:(receipt OR invoice OR subscription OR renewal OR renew OR membership OR "your plan" OR "payment confirmation" OR "order confirmation") OR "auto-renew" OR "next billing")';

type Header = { name: string; value: string };

// Finds subscriptions in the user's Gmail receipts (only when they ask). Reads sender, subject, date and the short
// Gmail snippet, then asks the user's own model to list recurring charges. Nothing is stored on the server.
export async function POST(req: Request) {
  let provider = "The model";
  try {
    const body = await req.json();
    const token = String(body.google?.accessToken ?? "");
    if (!token) throw new ProviderError("Connect Google first.");
    const c = readConnection(body.connection);
    provider = getProvider(c.providerId).name;

    const gmail = async <T,>(path: string) => {
      const res = await fetch(`${API}/gmail/v1/users/me${path}`, { headers: { authorization: `Bearer ${token}` } });
      if (res.status === 401) throw new ProviderError("Google needs you to reconnect (Connections).");
      if (!res.ok) throw new ProviderError(`Gmail returned ${res.status}.`);
      return res.json() as Promise<T>;
    };
    const list = await gmail<{ messages?: { id: string }[] }>(`/messages?maxResults=80&q=${encodeURIComponent(QUERY)}`);
    const emails = await Promise.all(
      (list.messages ?? []).map((m) =>
        gmail<{ snippet: string; payload?: { headers?: Header[] } }>(`/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`).then((d) => {
          const h = (n: string) => d.payload?.headers?.find((x) => x.name.toLowerCase() === n)?.value ?? "";
          return `From: ${h("from")}\nDate: ${h("date")}\nSubject: ${h("subject")}\n${d.snippet}`;
        }),
      ),
    );
    if (!emails.length) return Response.json({ subscriptions: [], scanned: 0 });

    const { output } = await generateText({
      model: languageModel(c, String(body.modelId)),
      output: Output.array({
        element: z.object({
          service: z.string().describe("Product name, e.g. Netflix Standard"),
          amount: z.number().describe("Price per period, as a number"),
          currency: z.string().describe("ISO code like USD"),
          period: z.enum(["weekly", "monthly", "yearly"]),
          lastCharged: z.string().optional().describe("YYYY-MM-DD of the latest charge seen"),
          nextRenewal: z.string().optional().describe("YYYY-MM-DD if an email states it"),
          manageUrl: z.string().optional().describe("https link to manage or cancel, only if present in an email"),
        }),
      }),
      prompt: `These are short summaries of a person's receipt-like emails. List only RECURRING subscriptions (not one-time purchases), one entry per service, using the most recent price. Today is ${new Date().toISOString().slice(0, 10)}. If unsure whether something recurs, leave it out.\n\n${emails.join("\n\n---\n\n").slice(0, 60000)}`,
      abortSignal: req.signal,
    });
    return Response.json({ subscriptions: output ?? [], scanned: emails.length });
  } catch (e) {
    const message = e instanceof ProviderError ? e.message : `${provider} couldn't read the receipts: ${e instanceof Error ? e.message.slice(0, 200) : "unknown error"}`;
    return Response.json({ error: message }, { status: 400 });
  }
}
