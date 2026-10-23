"use client";

import { AudioLines } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Recognition = { start(): void; abort(): void; onstart: (() => void) | null; lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };
const Recognizer = () =>
  typeof window === "undefined" ? undefined : ((window as unknown as Record<string, new () => Recognition>).SpeechRecognition ?? (window as unknown as Record<string, new () => Recognition>).webkitSpeechRecognition);

// Reading a reply aloud: code and markdown symbols aren't spoken.
const speakable = (t: string) =>
  t
    .replace(/```[\s\S]*?```/g, " (code in the chat) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_#>|~]/g, "")
    .slice(0, 4000);

/**
 * Talk: hands-free conversation. You speak, it sends; the reply is read aloud; then it listens again. Uses the
 * browser's own speech services (shown only where they exist).
 */
export function TalkButton({ busy, replyId, replyText, onSay }: { busy: boolean; replyId?: string; replyText: () => string; onSay: (text: string) => void }) {
  const [on, setOn] = useState(false);
  const [phase, setPhase] = useState<"listening" | "thinking" | "speaking">("listening");
  const rec = useRef<Recognition | undefined>(undefined);
  const spoken = useRef(replyId);
  const say = useRef(onSay);
  const text = useRef(replyText);
  useEffect(() => {
    say.current = onSay;
    text.current = replyText;
  }, [onSay, replyText]);
  const supported = !!Recognizer() && typeof speechSynthesis !== "undefined";

  useEffect(() => {
    if (!on) return;
    let stopped = false;
    const listen = () => {
      if (stopped) return;
      const R = Recognizer()!;
      const r = new R();
      rec.current = r;
      r.lang = navigator.language || "en-US";
      r.interimResults = false;
      r.continuous = false;
      let heard = "";
      r.onresult = (e) => (heard = Array.from(e.results, (x) => x[0]?.transcript ?? "").join(" ").trim());
      r.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          toast.error("Allow the microphone to talk.");
          setOn(false);
        }
      };
      r.onend = () => {
        if (stopped) return;
        if (heard) {
          setPhase("thinking");
          say.current(heard);
        } else setTimeout(listen, 250); // nothing said yet: keep listening
      };
      r.onstart = () => setPhase("listening");
      try {
        r.start();
      } catch {}
    };
    if (busy) {
      // The AI is answering: wait for it.
    } else if (replyId && replyId !== spoken.current) {
      // The new reply, read aloud; then listen again.
      spoken.current = replyId;
      const u = new SpeechSynthesisUtterance(speakable(text.current()));
      u.onstart = () => setPhase("speaking");
      u.onend = u.onerror = () => listen();
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } else listen();
    return () => {
      stopped = true;
      rec.current?.abort();
    };
  }, [on, busy, replyId]);

  useEffect(() => {
    if (on) return;
    rec.current?.abort();
    speechSynthesis?.cancel?.();
  }, [on]);

  if (!supported) return null;
  return (
    <Button
      type="button"
      variant={on ? "secondary" : "ghost"}
      size={on ? "sm" : "icon-sm"}
      aria-pressed={on}
      aria-label={on ? "Stop talking" : "Talk (hands-free)"}
      title="Talk: speak, hear the reply, keep going"
      onClick={() => {
        spoken.current = replyId; // don't read out what was already there
        setOn((v) => !v);
      }}
    >
      <AudioLines className={on ? "animate-pulse" : undefined} />
      {on && <span className="text-xs">{busy || phase === "thinking" ? "Thinking…" : phase === "speaking" ? "Speaking…" : "Listening…"}</span>}
    </Button>
  );
}
