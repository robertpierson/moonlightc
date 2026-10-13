import { jsonSchema, tool, type ToolSet } from "ai";

// Tools for signed-in Spotify, Slack and Discord accounts. Sending a Slack message always asks first.

const SPOTIFY = process.env.MOONC_TEST_SPOTIFY_API ?? "https://api.spotify.com";

async function call<T>(url: string, token: string, name: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init?.headers } });
  if (res.status === 401) throw new Error(`${name} needs you to reconnect (Connections).`);
  if (res.status === 204) return {} as T;
  if (!res.ok) throw new Error(`${name} returned ${res.status}.`);
  const d = (await res.json()) as T & { ok?: boolean; error?: string };
  if (d.ok === false) throw new Error(`${name}: ${d.error}`);
  return d;
}

export function spotifyTools(token: string): ToolSet {
  const s = <T>(path: string, init?: RequestInit) => call<T>(`${SPOTIFY}/v1${path}`, token, "Spotify", init);
  type Track = { name: string; uri: string; artists: { name: string }[]; album?: { name: string } };
  const track = (t: Track) => ({ title: t.name, artists: t.artists.map((a) => a.name).join(", "), album: t.album?.name, uri: t.uri });
  return {
    spotify_now_playing: tool({
      description: "What the user is listening to on Spotify right now.",
      inputSchema: jsonSchema<Record<string, never>>({ type: "object", properties: {} }),
      execute: async () => {
        const d = await s<{ item?: Track; is_playing?: boolean }>("/me/player/currently-playing");
        return d.item ? { playing: d.is_playing, ...track(d.item) } : { playing: false };
      },
    }),
    spotify_search: tool({
      description: "Search Spotify for songs.",
      inputSchema: jsonSchema<{ query: string }>({ type: "object", properties: { query: { type: "string" } }, required: ["query"] }),
      execute: async ({ query }) => (await s<{ tracks: { items: Track[] } }>(`/search?type=track&limit=10&q=${encodeURIComponent(query)}`)).tracks.items.map(track),
    }),
    spotify_play: tool({
      description: "Play songs on the user's active Spotify device (uris from spotify_search), or resume if none are given.",
      inputSchema: jsonSchema<{ uris?: string[] }>({ type: "object", properties: { uris: { type: "array", items: { type: "string" } } } }),
      execute: async ({ uris }) => {
        await s("/me/player/play", { method: "PUT", body: JSON.stringify(uris?.length ? { uris: uris.slice(0, 50) } : {}) });
        return { ok: true };
      },
    }),
    spotify_pause: tool({
      description: "Pause Spotify playback.",
      inputSchema: jsonSchema<Record<string, never>>({ type: "object", properties: {} }),
      execute: async () => {
        await s("/me/player/pause", { method: "PUT" });
        return { ok: true };
      },
    }),
    spotify_my_playlists: tool({
      description: "List the user's Spotify playlists.",
      inputSchema: jsonSchema<Record<string, never>>({ type: "object", properties: {} }),
      execute: async () => (await s<{ items: { name: string; tracks?: { total: number }; external_urls?: { spotify?: string } }[] }>("/me/playlists?limit=50")).items.map((p) => ({ name: p.name, songs: p.tracks?.total, url: p.external_urls?.spotify })),
    }),
  };
}

export function slackTools(token: string): { tools: ToolSet; approval: Record<string, "user-approval"> } {
  const api = <T>(method: string, params: Record<string, string> = {}, post?: object) =>
    call<T>(`https://slack.com/api/${method}${post ? "" : `?${new URLSearchParams(params)}`}`, token, "Slack", post ? { method: "POST", body: JSON.stringify(post) } : undefined);
  return {
    tools: {
      slack_channels: tool({
        description: "List Slack channels the user can see.",
        inputSchema: jsonSchema<Record<string, never>>({ type: "object", properties: {} }),
        execute: async () => (await api<{ channels: { id: string; name: string; num_members?: number }[] }>("conversations.list", { types: "public_channel,private_channel", limit: "200", exclude_archived: "true" })).channels.map((c) => ({ id: c.id, name: c.name, members: c.num_members })),
      }),
      slack_read_channel: tool({
        description: "Read the latest messages in a Slack channel (by id from slack_channels).",
        inputSchema: jsonSchema<{ channel: string; limit?: number }>({ type: "object", properties: { channel: { type: "string" }, limit: { type: "number" } }, required: ["channel"] }),
        execute: async ({ channel, limit }) => (await api<{ messages: { user?: string; text: string; ts: string }[] }>("conversations.history", { channel, limit: String(Math.min(50, limit ?? 20)) })).messages.map((m) => ({ user: m.user, text: m.text.slice(0, 2000), time: new Date(Number(m.ts) * 1000).toISOString() })),
      }),
      slack_search: tool({
        description: "Search the user's Slack messages.",
        inputSchema: jsonSchema<{ query: string }>({ type: "object", properties: { query: { type: "string" } }, required: ["query"] }),
        execute: async ({ query }) => (await api<{ messages: { matches: { text: string; channel: { name: string }; username?: string; permalink: string }[] } }>("search.messages", { query, count: "15" })).messages.matches.map((m) => ({ channel: m.channel.name, from: m.username, text: m.text.slice(0, 1000), link: m.permalink })),
      }),
      slack_send_message: tool({
        description: "Send a Slack message as the user to a channel (by id).",
        inputSchema: jsonSchema<{ channel: string; text: string }>({ type: "object", properties: { channel: { type: "string" }, text: { type: "string" } }, required: ["channel", "text"] }),
        execute: async ({ channel, text }) => {
          await api("chat.postMessage", {}, { channel, text: text.slice(0, 4000) });
          return { sent: true };
        },
      }),
    },
    approval: { slack_send_message: "user-approval" },
  };
}

const X_API = process.env.MOONC_TEST_X_API ?? "https://api.x.com";

/** X (Twitter) with the user's own API bearer token (the X API is paid, so it's bring-your-own-key). */
export function xTools(token: string): ToolSet {
  return {
    x_search: tool({
      description: "Search recent public posts on X (Twitter) from the last 7 days. Supports X search operators like from:name.",
      inputSchema: jsonSchema<{ query: string }>({ type: "object", properties: { query: { type: "string" } }, required: ["query"] }),
      execute: async ({ query }) => {
        const d = await call<{ data?: { id: string; text: string; author_id: string; created_at?: string }[]; includes?: { users?: { id: string; username: string }[] } }>(
          `${X_API}/2/tweets/search/recent?max_results=20&tweet.fields=created_at,author_id&expansions=author_id&user.fields=username&query=${encodeURIComponent(query)}`,
          token,
          "X",
        );
        const users = new Map((d.includes?.users ?? []).map((u) => [u.id, u.username]));
        return (d.data ?? []).map((t) => ({ from: users.get(t.author_id), text: t.text, time: t.created_at, url: `https://x.com/i/status/${t.id}` }));
      },
    }),
  };
}

export async function checkXToken(token: string) {
  const res = await fetch(`${X_API}/2/tweets/search/recent?max_results=10&query=moon`, { headers: { authorization: `Bearer ${token}` } }).catch(() => null);
  if (!res) throw new Error("Couldn't reach X. Check your internet connection.");
  if (res.status === 401 || res.status === 403) throw new Error("X rejected this token. Copy the Bearer Token from your app in the X developer portal.");
  if (res.status === 429) throw new Error("X says this token has used up its plan's requests. Try later or upgrade your X API plan.");
  if (!res.ok) throw new Error(`X returned ${res.status}.`);
}

export function discordTools(token: string): ToolSet {
  return {
    discord_my_servers: tool({
      description: "List the Discord servers the user is in.",
      inputSchema: jsonSchema<Record<string, never>>({ type: "object", properties: {} }),
      execute: async () => (await call<{ name: string; owner: boolean }[]>("https://discord.com/api/users/@me/guilds", token, "Discord")).map((g) => ({ name: g.name, owner: g.owner })),
    }),
  };
}
