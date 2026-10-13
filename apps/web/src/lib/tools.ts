import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { isPublicURL } from "./server-guard";

export type SearchProvider = "tavily" | "exa" | "brave";
export interface SearchKey {
  provider: SearchProvider;
  key: string;
}

interface Result {
  title: string;
  url: string;
  snippet: string;
}

async function search(k: SearchKey, query: string): Promise<Result[]> {
  let res: Response;
  if (k.provider === "tavily") {
    res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${k.key}` },
      body: JSON.stringify({ query, max_results: 6 }),
    });
  } else if (k.provider === "exa") {
    res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": k.key },
      body: JSON.stringify({ query, numResults: 6, contents: { text: { maxCharacters: 1200 } } }),
    });
  } else {
    res = await fetch(`https://api.search.brave.com/res/v1/web/search?count=6&q=${encodeURIComponent(query)}`, {
      headers: { accept: "application/json", "x-subscription-token": k.key },
    });
  }
  if (res.status === 401 || res.status === 403) throw new Error(`Your ${k.provider} search key was rejected. Update it in Models and keys.`);
  if (!res.ok) throw new Error(`Search failed (${res.status}).`);
  const d = (await res.json()) as Record<string, unknown>;
  type Raw = { title?: string; url?: string; content?: string; text?: string; description?: string };
  const raw = (k.provider === "brave" ? ((d.web as { results?: Raw[] })?.results ?? []) : ((d.results as Raw[]) ?? [])) as Raw[];
  return raw.map((r) => ({ title: r.title ?? r.url ?? "", url: r.url ?? "", snippet: (r.content ?? r.text ?? r.description ?? "").slice(0, 1200) }));
}

export function readSearchKey(v: unknown): SearchKey | undefined {
  const k = v as Partial<SearchKey> | undefined;
  if (!k || typeof k.key !== "string" || !k.key.trim() || !["tavily", "exa", "brave"].includes(k.provider as string)) return undefined;
  return { provider: k.provider as SearchProvider, key: k.key.trim() };
}

/** Validates a search key with one real query. */
export async function testSearchKey(k: SearchKey) {
  await search(k, "MoonlightC");
}

const MAX_PAGE_CHARS = 20000;

/** Fetch a public page as plain text. Every hop (including redirects) must be a public https URL. */
export async function fetchPage(url: string): Promise<{ url: string; title: string; text: string }> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    if (!isPublicURL(current)) throw new Error("Only public https:// pages can be fetched.");
    const res = await fetch(current, { redirect: "manual", headers: { "user-agent": "MoonlightC/1.0 (+https://moonlightc.vercel.app)" }, signal: AbortSignal.timeout(15000) });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current).toString();
      continue;
    }
    if (!res.ok) throw new Error(`The page returned ${res.status}.`);
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/|json|xml/.test(type)) throw new Error(`That page isn't text (${type || "unknown type"}).`);
    const body = (await res.text()).slice(0, 2_000_000);
    const title = body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? current;
    return { url: current, title, text: htmlToText(body).slice(0, MAX_PAGE_CHARS) };
  }
  throw new Error("Too many redirects.");
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

export function buildTools(searchKey?: SearchKey): ToolSet {
  const tools: ToolSet = {
    fetch_url: tool({
      description: "Read the text of a public web page. Use it when the user gives a link or you need a page's details.",
      inputSchema: z.object({ url: z.string().describe("Full https:// URL") }),
      execute: async ({ url }) => fetchPage(url),
    }),
  };
  if (searchKey) {
    tools.web_search = tool({
      description: "Search the web for current information. Cite the URLs you use.",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => ({ results: await search(searchKey, query) }),
    });
  }
  return tools;
}
