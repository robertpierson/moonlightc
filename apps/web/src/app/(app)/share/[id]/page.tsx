import type { Metadata } from "next";
import { Suspense } from "react";
import { SharedChat } from "./shared-chat";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Link previews (Discord, iMessage, ...) show the chat's title. Shared chats stay out of search engines.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  let title = "Shared chat";
  if (URL && KEY && /^[A-Za-z0-9_-]{16,32}$/.test(id)) {
    const r = await fetch(`${URL}/rest/v1/rpc/get_shared_chat`, { method: "POST", headers: { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json" }, body: JSON.stringify({ share: id }) }).catch(() => undefined);
    const d = r?.ok ? ((await r.json()) as { title?: string } | null) : null;
    if (d?.title) title = d.title;
  }
  return { title: `${title} · MoonlightC`, description: "A chat shared from MoonlightC.", openGraph: { title, description: "A chat shared from MoonlightC.", siteName: "MoonlightC" }, robots: { index: false, follow: false } };
}

export default function Page() {
  return (
    <Suspense>
      <SharedChat />
    </Suspense>
  );
}
