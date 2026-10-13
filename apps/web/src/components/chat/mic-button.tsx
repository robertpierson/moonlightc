"use client";

import { canTranscribe } from "@moonc/core";
import { Loader2, Mic, Square } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

type Recognition = { start(): void; stop(): void; lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: (e: { error: string }) => void };
const browserRecognition = () =>
  typeof window === "undefined" ? undefined : ((window as unknown as Record<string, new () => Recognition>).SpeechRecognition ?? (window as unknown as Record<string, new () => Recognition>).webkitSpeechRecognition);

/** Voice typing: Whisper with the user's OpenAI/Groq key, else the browser's built-in speech service, else hidden. */
export function MicButton({ onText }: { onText: (text: string) => void }) {
  const whisper = useStore((s) => s.connections.find((c) => canTranscribe(c.providerId)));
  const [state, setState] = useState<"idle" | "recording" | "working">("idle");
  const stopFn = useRef<() => void>(undefined);
  const Native = browserRecognition();
  if (!whisper && !Native) return null;

  async function start() {
    if (whisper) {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        return toast.error("Microphone access was blocked. Allow it in your browser's site settings, then try again.");
      }
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState("working");
        const form = new FormData();
        form.set("audio", new Blob(chunks, { type: rec.mimeType }), "speech.webm");
        form.set("connection", JSON.stringify({ providerId: whisper.providerId, apiKey: whisper.apiKey }));
        const res = await fetch("/api/transcribe", { method: "POST", body: form }).catch(() => null);
        const data = (await res?.json().catch(() => ({}))) as { text?: string; error?: string } | undefined;
        setState("idle");
        if (!res?.ok || !data?.text) return toast.error(data?.error ?? "Couldn't transcribe that. Try again.");
        onText(data.text.trim());
      };
      rec.start();
      stopFn.current = () => rec.stop();
      setState("recording");
      return;
    }
    const r = new Native!();
    r.lang = navigator.language;
    r.interimResults = false;
    r.onresult = (e) => onText(Array.from(e.results).map((x) => x[0].transcript).join(" "));
    r.onerror = (e) => e.error !== "aborted" && toast.error(e.error === "not-allowed" ? "Microphone access was blocked. Allow it in your browser's site settings." : "Voice typing stopped. Try again.");
    r.onend = () => setState("idle");
    r.start();
    stopFn.current = () => r.stop();
    setState("recording");
  }

  return (
    <Button
      type="button"
      variant={state === "recording" ? "destructive" : "ghost"}
      size="icon-sm"
      aria-label={state === "recording" ? "Stop recording" : "Voice typing"}
      title={whisper ? `Voice typing with ${whisper.label} Whisper` : "Voice typing with your browser's speech service"}
      disabled={state === "working"}
      onClick={() => (state === "recording" ? stopFn.current?.() : start())}
    >
      {state === "working" ? <Loader2 className="animate-spin" /> : state === "recording" ? <Square className="fill-current" /> : <Mic />}
    </Button>
  );
}
