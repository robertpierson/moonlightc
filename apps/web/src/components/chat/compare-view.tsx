"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUp, Plus, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { findModel, type ModelRef } from "@/lib/store";
import { Message } from "./message";
import { ModelPicker } from "./model-picker";

function Column({ model, turns, onModel, onRemove, onStatus }: {
  model?: ModelRef;
  turns: string[];
  onModel: (r: ModelRef) => void;
  onRemove?: () => void;
  onStatus: (busy: boolean) => void;
}) {
  const [transport] = useState(() => new DefaultChatTransport({ api: "/api/chat" }));
  const { messages, sendMessage, status, stop, error } = useChat({ transport });
  const sent = useRef(0);
  const busy = status === "streaming" || status === "submitted";

  useEffect(() => onStatus(busy), [busy, onStatus]);

  useEffect(() => {
    if (turns.length <= sent.current) return;
    sent.current = turns.length;
    const found = findModel(model);
    if (!found) return;
    const { apiKey, providerId, baseURL } = found.conn;
    sendMessage({ text: turns[turns.length - 1] }, { body: { connection: { apiKey, providerId, baseURL }, modelId: found.model.id } });
  }, [turns, model, sendMessage]);

  useEffect(() => {
    const stopAll = () => stop();
    window.addEventListener("moonc:compare-stop", stopAll);
    return () => window.removeEventListener("moonc:compare-stop", stopAll);
  }, [stop]);

  return (
    <section aria-label="Compare column" className="flex min-h-0 w-[85vw] shrink-0 snap-start flex-col rounded-xl border sm:w-auto sm:flex-1">
      <div className="flex items-center border-b p-1">
        <ModelPicker value={model} onChange={onModel} />
        {onRemove && (
          <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Remove this model" onClick={onRemove}>
            <X />
          </Button>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
        {messages.map((m, i) => (
          <Message key={m.id} message={m} streaming={busy && i === messages.length - 1} isLast={false} />
        ))}
        {error && <p role="alert" className="text-sm text-destructive">{error.message}</p>}
      </div>
    </section>
  );
}

export function CompareView({ initial }: { initial?: ModelRef }) {
  const [models, setModels] = useState<(ModelRef | undefined)[]>([initial, undefined]);
  const [turns, setTurns] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  const anyBusy = Object.values(busy).some(Boolean);
  const ready = models.every((m) => findModel(m));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || anyBusy || !ready) return;
    setTurns((t) => [...t, input.trim()]);
    setInput("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 snap-x gap-2 overflow-x-auto p-2">
        {models.map((m, i) => (
          <Column
            key={i}
            model={m}
            turns={turns}
            onModel={(r) => setModels((ms) => ms.map((x, j) => (j === i ? r : x)))}
            onRemove={models.length > 2 ? () => setModels((ms) => ms.filter((_, j) => j !== i)) : undefined}
            onStatus={(b) => setBusy((s) => (s[i] === b ? s : { ...s, [i]: b }))}
          />
        ))}
      </div>
      <form onSubmit={submit} className="mx-auto flex w-full max-w-3xl items-end gap-2 px-4 pb-4">
        {models.length < 4 && turns.length === 0 && (
          <Button type="button" variant="outline" onClick={() => setModels((ms) => [...ms, undefined])}>
            <Plus /> Add model
          </Button>
        )}
        <Textarea
          aria-label="Prompt for all models"
          placeholder={ready ? "Send one prompt to every model…" : "Pick a model in every column"}
          value={input}
          rows={1}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
          }}
          className="max-h-40 min-h-10 resize-none"
        />
        {anyBusy ? (
          <Button type="button" size="icon-lg" aria-label="Stop all" onClick={() => window.dispatchEvent(new Event("moonc:compare-stop"))}>
            <Square className="fill-current" />
          </Button>
        ) : (
          <Button type="submit" size="icon-lg" aria-label="Send to all models" disabled={!input.trim() || !ready}>
            <ArrowUp />
          </Button>
        )}
      </form>
    </div>
  );
}
