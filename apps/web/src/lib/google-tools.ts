import { jsonSchema, tool, type ToolSet } from "ai";

const API = process.env.MOONC_TEST_GOOGLE_API ?? "https://www.googleapis.com";

async function g<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init?.headers } });
  if (res.status === 401) throw new Error("Google needs you to reconnect. Open Connections and connect Google again.");
  if (res.status === 403) throw new Error("Google didn't allow that. Reconnect Google and allow access to Gmail, Calendar and Drive.");
  if (!res.ok) throw new Error(`Google returned ${res.status}.`);
  return res.json() as Promise<T>;
}

type Header = { name: string; value: string };
type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };

function plainText(p: Part): string {
  if (p.mimeType === "text/plain" && p.body?.data) return Buffer.from(p.body.data, "base64url").toString("utf8");
  for (const c of p.parts ?? []) {
    const t = plainText(c);
    if (t) return t;
  }
  if (p.mimeType === "text/html" && p.body?.data) return Buffer.from(p.body.data, "base64url").toString("utf8").replace(/<[^>]+>/g, " ");
  return "";
}

const header = (hs: Header[] | undefined, name: string) => hs?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

/** Gmail, Calendar and Drive tools for one signed-in Google account. Creating events asks the user first. */
export function googleTools(token: string): { tools: ToolSet; approval: Record<string, "user-approval"> } {
  const tools: ToolSet = {
    gmail_search: tool({
      description: "Search the user's Gmail with Gmail search syntax (for example: newer_than:1d, from:alice, is:unread). Returns sender, subject, date and a snippet.",
      inputSchema: jsonSchema<{ query: string; max?: number }>({ type: "object", properties: { query: { type: "string" }, max: { type: "number" } }, required: ["query"] }),
      execute: async ({ query, max }) => {
        const list = await g<{ messages?: { id: string }[] }>(token, `/gmail/v1/users/me/messages?maxResults=${Math.min(25, max ?? 10)}&q=${encodeURIComponent(query)}`);
        const msgs = await Promise.all(
          (list.messages ?? []).map((m) =>
            g<{ id: string; snippet: string; payload?: { headers?: Header[] } }>(token, `/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`),
          ),
        );
        return msgs.map((m) => ({ id: m.id, from: header(m.payload?.headers, "From"), subject: header(m.payload?.headers, "Subject"), date: header(m.payload?.headers, "Date"), snippet: m.snippet }));
      },
    }),
    gmail_read: tool({
      description: "Read one Gmail message by id (from gmail_search).",
      inputSchema: jsonSchema<{ id: string }>({ type: "object", properties: { id: { type: "string" } }, required: ["id"] }),
      execute: async ({ id }) => {
        const m = await g<{ payload: Part & { headers?: Header[] } }>(token, `/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`);
        return { from: header(m.payload.headers, "From"), subject: header(m.payload.headers, "Subject"), date: header(m.payload.headers, "Date"), body: plainText(m.payload).slice(0, 20000) };
      },
    }),
    calendar_events: tool({
      description: "List upcoming events on the user's main Google Calendar.",
      inputSchema: jsonSchema<{ days?: number }>({ type: "object", properties: { days: { type: "number", description: "How many days ahead (default 7)" } } }),
      execute: async ({ days }) => {
        const now = new Date();
        const until = new Date(now.getTime() + Math.min(60, days ?? 7) * 86_400_000);
        const d = await g<{ items?: { summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; location?: string; htmlLink?: string }[] }>(
          token,
          `/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=50&timeMin=${now.toISOString()}&timeMax=${until.toISOString()}`,
        );
        return (d.items ?? []).map((e) => ({ title: e.summary, start: e.start?.dateTime ?? e.start?.date, end: e.end?.dateTime ?? e.end?.date, location: e.location, link: e.htmlLink }));
      },
    }),
    calendar_create: tool({
      description: "Create an event on the user's main Google Calendar. Times are ISO 8601 with time zone offset.",
      inputSchema: jsonSchema<{ title: string; start: string; end: string; description?: string }>({
        type: "object",
        properties: { title: { type: "string" }, start: { type: "string" }, end: { type: "string" }, description: { type: "string" } },
        required: ["title", "start", "end"],
      }),
      execute: async ({ title, start, end, description }) => {
        const e = await g<{ htmlLink: string }>(token, "/calendar/v3/calendars/primary/events", {
          method: "POST",
          body: JSON.stringify({ summary: title, description, start: { dateTime: start }, end: { dateTime: end } }),
        });
        return { created: true, link: e.htmlLink };
      },
    }),
    drive_search: tool({
      description: "Find files in the user's Google Drive by words they contain or their name.",
      inputSchema: jsonSchema<{ query: string }>({ type: "object", properties: { query: { type: "string" } }, required: ["query"] }),
      execute: async ({ query }) => {
        const q = `fullText contains '${query.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}' and trashed = false`;
        const d = await g<{ files?: { name: string; mimeType: string; modifiedTime: string; webViewLink: string }[] }>(
          token,
          `/drive/v3/files?pageSize=15&fields=files(name,mimeType,modifiedTime,webViewLink)&q=${encodeURIComponent(q)}`,
        );
        return d.files ?? [];
      },
    }),
  };
  return { tools, approval: { calendar_create: "user-approval" } };
}
