"use client";

import { canTranscribe } from "@moonc/core";
import { AudioLines } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { silenceCheck, utterance } from "@/lib/voice";
import { desktop } from "@/lib/desktop";
import { useStore } from "@/lib/store";

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
 * browser's own speech services; in the desktop app it records and transcribes with the user's OpenAI/Groq key
 * instead (shown only where one of these works).
 */
export function TalkButton({ busy, replyId, replyText, onSay }: { busy: boolean; replyId?: string; replyText: () => string; onSay: (text: string) => void }) {
  const [on, setOn] = useState(false);
  const [phase, setPhase] = useState<"listening" | "thinking" | "speaking">("listening");
  const rec = useRef<{ abort(): void } | undefined>(undefined);
  const spoken = useRef(replyId);
  const say = useRef(onSay);
  const text = useRef(replyText);
  const whisper = useStore((s) => s.connections.find((c) => canTranscribe(c.providerId)));
  const key = useRef(whisper);
  useEffect(() => {
    say.current = onSay;
    text.current = replyText;
    key.current = whisper;
  }, [onSay, replyText, whisper]);
  // The desktop app has the speech objects but no speech service behind them, so there it needs a Whisper key.
  const supported = typeof speechSynthesis !== "undefined" && (desktop() ? !!whisper : !!Recognizer());

  useEffect(() => {
    if (!on || !supported) return; // also stops listening if the Whisper key is removed mid-talk
    let stopped = false;
    const listen = () => {
      if (stopped) return;
      if (desktop()) return void record();
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
    // Desktop: record until a short pause after speaking (or 30 s), then transcribe like voice typing does.
    const record = async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        if (stopped) return;
        toast.error("Allow the microphone to talk.");
        return setOn(false);
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      const audio = new AudioContext();
      const analyser = audio.createAnalyser();
      audio.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const recorder = new MediaRecorder(stream);
      const end = () => recorder.state !== "inactive" && recorder.stop();
      const chunks: Blob[] = [];
      const started = performance.now();
      let lastSpeech: number | undefined;
      const timer = setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        const h = silenceCheck(samples, performance.now() - started, lastSpeech);
        lastSpeech = h.lastSpeech;
        if (h.stop) end();
      }, 100);
      rec.current = { abort: end };
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        // Let go of the mic between turns.
        clearInterval(timer);
        stream.getTracks().forEach((t) => t.stop());
        void audio.close();
        if (stopped) return;
        if (lastSpeech === undefined) return listen(); // nothing said: keep listening
        setPhase("thinking");
        const form = new FormData();
        form.set("audio", new Blob(chunks, { type: recorder.mimeType }), "speech.webm");
        form.set("connection", JSON.stringify({ providerId: key.current?.providerId, apiKey: key.current?.apiKey }));
        const res = await fetch("/api/transcribe", { method: "POST", body: form }).catch(() => null);
        const data = (await res?.json().catch(() => ({}))) as { text?: string; error?: string } | undefined;
        if (stopped) return;
        // A bad key or no connection would fail every turn: say so once and stop.
        if (!res?.ok) {
          toast.error(data?.error ?? "Couldn't transcribe that. Try again.");
          return setOn(false);
        }
        const said = data?.text?.trim();
        if (said) say.current(said);
        else listen(); // nothing understood: keep listening
      };
      recorder.start();
      setPhase("listening");
    };
    if (busy) {
      // The AI is answering: wait for it.
    } else if (replyId && replyId !== spoken.current) {
      // The new reply, read aloud; then listen again.
      spoken.current = replyId;
      const u = utterance(speakable(text.current()));
      u.onstart = () => setPhase("speaking");
      u.onend = u.onerror = () => listen();
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } else listen();
    return () => {
      stopped = true;
      rec.current?.abort();
    };
  }, [on, supported, busy, replyId]);

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
