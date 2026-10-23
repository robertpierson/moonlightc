"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { accountsEnabled, supabase } from "@/lib/supabase/client";

const Markdown = dynamic(() => import("@/components/chat/markdown"), { ssr: false, loading: () => <div className="h-5" /> });

type Shared = { title: string; created_at: string; messages: { role: "user" | "assistant"; text: string }[] };

/** A chat someone shared: read-only. */
export function SharedChat() {
  const { id } = useParams<{ id: string }>();
  const [chat, setChat] = useState<Shared | null>();
  useEffect(() => {
    if (!accountsEnabled) return void Promise.resolve().then(() => setChat(null));
    supabase()
      .rpc("get_shared_chat", { share: id })
      .then(({ data }) => setChat((data as Shared | null) ?? null), () => setChat(null));
  }, [id]);
  return (
    <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      {chat === undefined ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : chat === null ? (
        <p>This shared chat doesn&apos;t exist anymore. Its owner may have stopped sharing it.</p>
      ) : (
        <>
          <header className="grid gap-1">
            <h1 className="text-2xl font-semibold">{chat.title}</h1>
            <p className="text-sm text-muted-foreground">Shared {new Date(chat.created_at).toLocaleDateString()} · read-only</p>
          </header>
          {chat.messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="max-w-[85%] justify-self-end rounded-2xl bg-muted px-4 py-2 whitespace-pre-wrap">
                {m.text}
              </div>
            ) : (
              <div key={i} className="min-w-0">
                <Markdown text={m.text} streaming={false} />
              </div>
            ),
          )}
        </>
      )}
      <footer className="border-t pt-4 text-sm text-muted-foreground">
        Made with{" "}
        <Link className="underline" href="/">
          MoonlightC
        </Link>
        .
      </footer>
    </main>
  );
}
