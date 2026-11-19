"use client";

import { ArrowLeft, Ban, Check, Loader2, MoreHorizontal, Send, Sparkles, UserMinus, UserPlus, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { answerFriend, askFriend, blockPerson, removeFriend, useConversation, useFriends, useUnread, type Friend } from "@/lib/friends";
import { askInChat } from "@/lib/summarize";
import { supabase, useUser } from "@/lib/supabase/client";

const nameOf = (f: Pick<Friend, "display_name" | "username">) => f.display_name || `@${f.username}`;
const err = (e: unknown) => toast.error(e instanceof Error ? e.message : String(e));

/** Friends: add people by username, then chat with them. Bring the AI in with "Ask AI". */
export function Friends({ onSignIn }: { onSignIn: () => void }) {
  const user = useUser();
  const { list, reload } = useFriends();
  const unread = useUnread();
  const [open, setOpen] = useState<string>();
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<string | null>();
  useEffect(() => {
    if (!user) return;
    supabase()
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setMine((data?.username as string | null) ?? null));
  }, [user]);

  if (user === undefined) return <Loader2 className="m-6 size-5 animate-spin" aria-label="Loading" />;
  if (!user)
    return (
      <div className="grid flex-1 place-content-center justify-items-center gap-3 p-6 text-center">
        <Users className="size-8" />
        <h2 className="text-lg font-semibold">Chat with your friends</h2>
        <p className="max-w-sm text-sm text-muted-foreground">Sign in, add friends by their username, and talk here. Bring the AI into any chat with Ask AI.</p>
        <Button onClick={onSignIn}>Sign in</Button>
      </div>
    );

  const friends = (list ?? []).filter((f) => f.status === "accepted");
  const incoming = (list ?? []).filter((f) => f.status === "pending" && f.incoming);
  const outgoing = (list ?? []).filter((f) => f.status === "pending" && !f.incoming);
  const blocked = (list ?? []).filter((f) => f.status === "blocked");
  const current = friends.find((f) => f.id === open);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await askFriend(handle);
      toast.success(r === "friends" ? `You and @${handle.replace(/^@/, "")} are friends now.` : `Request sent to @${handle.replace(/^@/, "")}.`);
      setHandle("");
      await reload();
    } catch (e) {
      err(e);
    }
    setBusy(false);
  };
  const run = (fn: () => Promise<unknown>, done?: string) => async () => {
    try {
      await fn();
      if (done) toast.success(done);
      await reload();
    } catch (e) {
      err(e);
    }
  };

  return (
    <div className="flex min-h-0 flex-1">
      <aside className={`min-h-0 w-full flex-col gap-4 overflow-y-auto border-r p-4 md:flex md:w-80 ${current ? "hidden" : "flex"}`}>
        <div>
          <h2 className="text-lg font-semibold">Friends</h2>
          {mine && (
            <p className="text-sm text-muted-foreground">
              Your username is <span className="font-medium text-foreground">@{mine}</span>. Share it so friends can add you.
            </p>
          )}
        </div>
        <form onSubmit={add} className="flex gap-2">
          <Input aria-label="Friend's username" placeholder="Their username" value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={25} />
          <Button type="submit" disabled={busy || !handle.trim()}>
            <UserPlus /> Add
          </Button>
        </form>

        {incoming.length > 0 && (
          <section aria-labelledby="req-h" className="grid gap-1.5">
            <h3 id="req-h" className="text-xs font-medium text-muted-foreground">
              Asked to be your friend
            </h3>
            {incoming.map((f) => (
              <div key={f.id} className="flex items-center gap-1 rounded-lg border p-2 pl-3 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {nameOf(f)} <span className="text-muted-foreground">@{f.username}</span>
                </span>
                <Button size="icon-sm" aria-label={`Accept ${nameOf(f)}`} onClick={run(() => answerFriend(f.id, true), `You and ${nameOf(f)} are friends now.`)}>
                  <Check />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label={`Decline ${nameOf(f)}`} onClick={run(() => answerFriend(f.id, false))}>
                  <X />
                </Button>
              </div>
            ))}
          </section>
        )}

        <section aria-labelledby="fr-h" className="grid gap-0.5">
          <h3 id="fr-h" className="text-xs font-medium text-muted-foreground">
            Your friends
          </h3>
          {list === undefined ? (
            <Loader2 className="size-4 animate-spin" aria-label="Loading friends" />
          ) : friends.length ? (
            friends.map((f) => (
              <button key={f.id} aria-current={open === f.id ? "page" : undefined} onClick={() => setOpen(f.id)} className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent aria-[current=page]:bg-accent">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">{nameOf(f).replace("@", "").slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1 truncate">{nameOf(f)}</span>
                {unread[f.id] ? (
                  <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground" aria-label={`${unread[f.id]} unread`}>
                    {unread[f.id]}
                  </span>
                ) : null}
              </button>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No friends yet. Type a friend&apos;s username above to add them.</p>
          )}
        </section>

        {outgoing.length > 0 && (
          <section aria-labelledby="out-h" className="grid gap-1">
            <h3 id="out-h" className="text-xs font-medium text-muted-foreground">
              Waiting for them to accept
            </h3>
            {outgoing.map((f) => (
              <div key={f.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">@{f.username}</span>
                <Button size="xs" variant="ghost" onClick={run(() => removeFriend(f.id))}>
                  Cancel
                </Button>
              </div>
            ))}
          </section>
        )}
        {blocked.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-xs text-muted-foreground">Blocked ({blocked.length})</summary>
            {blocked.map((f) => (
              <div key={f.id} className="mt-1 flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">@{f.username}</span>
                <Button size="xs" variant="ghost" onClick={run(() => removeFriend(f.id), `Unblocked @${f.username}.`)}>
                  Unblock
                </Button>
              </div>
            ))}
          </details>
        )}
      </aside>

      {current ? (
        <Conversation key={current.id} friend={current} onBack={() => setOpen(undefined)} onGone={() => (setOpen(undefined), reload())} />
      ) : (
        <div className="hidden flex-1 place-content-center p-6 text-center text-sm text-muted-foreground md:grid">{friends.length ? "Pick a friend to chat." : "Add a friend to start chatting."}</div>
      )}
    </div>
  );
}

function Conversation({ friend, onBack, onGone }: { friend: Friend; onBack: () => void; onGone: () => void }) {
  const { messages, send, unsend, me } = useConversation(friend.id);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [messages.length]);

  const submit = async () => {
    const t = text;
    setText("");
    try {
      await send(t);
    } catch (e) {
      setText(t);
      err(e);
    }
  };
  // Your own AI model answers; both of you see it, labeled as AI.
  const ask = async () => {
    setThinking(true);
    try {
      const recent = [...messages.slice(-12).map((m) => `${m.kind === "ai" ? "AI" : m.sender === me ? "Me" : nameOf(friend)}: ${m.body}`), ...(text.trim() ? [`Me: ${text.trim()}`] : [])].join("\n");
      if (!recent) throw new Error("Write a question first, then press Ask AI.");
      if (text.trim()) await send(text);
      setText("");
      await send(await askInChat(recent), "ai");
    } catch (e) {
      err(e);
    }
    setThinking(false);
  };

  return (
    <section aria-label={`Chat with ${nameOf(friend)}`} className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <Button size="icon-sm" variant="ghost" className="md:hidden" aria-label="Back to friends" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <span className="min-w-0 flex-1 truncate font-medium">
          {nameOf(friend)} <span className="text-sm font-normal text-muted-foreground">@{friend.username}</span>
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="More">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => confirm(`Remove ${nameOf(friend)} from your friends?`) && removeFriend(friend.id).then(onGone, err)}>
              <UserMinus /> Remove friend
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => confirm(`Block ${nameOf(friend)}? They won't be able to message you or add you again.`) && blockPerson(friend.id).then(onGone, err)}>
              <Ban /> Block
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto grid max-w-2xl gap-2">
          {!messages.length && <p className="text-center text-sm text-muted-foreground">Say hi to {nameOf(friend)}. Press Ask AI to bring the AI into the chat.</p>}
          {messages.map((m) => {
            const mineMsg = m.sender === me;
            return (
              <div key={m.id} className={`group flex items-end gap-1 ${mineMsg ? "flex-row-reverse" : ""}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.kind === "ai" ? "border bg-card" : mineMsg ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                  {m.kind === "ai" && (
                    <span className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Sparkles className="size-3" /> AI, asked by {mineMsg ? "you" : nameOf(friend)}
                    </span>
                  )}
                  {m.body}
                </div>
                {mineMsg && (
                  <Button size="icon-xs" variant="ghost" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" aria-label="Unsend" onClick={() => unsend(m.id).catch(err)}>
                    <X />
                  </Button>
                )}
              </div>
            );
          })}
          <div ref={end} />
        </div>
      </div>
      <form
        className="mx-auto flex w-full max-w-2xl items-end gap-2 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Textarea
          aria-label={`Message ${nameOf(friend)}`}
          placeholder={`Message ${nameOf(friend)}`}
          value={text}
          maxLength={4000}
          rows={1}
          className="max-h-40 min-h-10 resize-none"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (text.trim()) submit();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={ask} disabled={thinking} title="Sends the last few messages to your own AI model; its answer shows here for both of you">
          {thinking ? <Loader2 className="animate-spin" /> : <Sparkles />} Ask AI
        </Button>
        <Button type="submit" size="icon" aria-label="Send" disabled={!text.trim()}>
          <Send />
        </Button>
      </form>
    </section>
  );
}
