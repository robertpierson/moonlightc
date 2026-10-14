import { updateNow } from "./store";

// Talks to Ollama's own API on this computer. Only used inside the desktop app.
const API = "http://127.0.0.1:11434";

export interface LocalModel {
  name: string;
  size: number;
  modified_at: string;
}

export async function listLocal(): Promise<LocalModel[]> {
  const res = await fetch(`${API}/api/tags`);
  if (!res.ok) throw new Error("Ollama isn't answering. Start it and try again.");
  return ((await res.json()) as { models: LocalModel[] }).models;
}

/** Download a model. Ollama keeps partial downloads, so pulling again after a pause resumes where it stopped. */
export async function pull(name: string, onProgress: (pct: number, status: string) => void, signal: AbortSignal) {
  const res = await fetch(`${API}/api/pull`, { method: "POST", body: JSON.stringify({ model: name, stream: true }), signal });
  if (!res.ok || !res.body) throw new Error(`Couldn't start downloading ${name}.`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const msg = JSON.parse(line) as { status?: string; total?: number; completed?: number; error?: string };
      if (msg.error) throw new Error(msg.error);
      onProgress(msg.total ? Math.round(((msg.completed ?? 0) / msg.total) * 100) : 0, msg.status ?? "");
    }
  }
}

export async function remove(name: string) {
  const res = await fetch(`${API}/api/delete`, { method: "DELETE", body: JSON.stringify({ model: name }) });
  if (!res.ok) throw new Error(`Couldn't delete ${name}.`);
}

/** Keep the "Ollama" entry in the model picker in step with what's installed. */
export async function syncOllamaConnection() {
  const models = (await listLocal()).map((m) => ({ id: m.name, name: m.name }));
  updateNow((s) => {
    const existing = s.connections.find((c) => c.providerId === "ollama");
    if (!models.length) return { ...s, connections: s.connections.filter((c) => c.providerId !== "ollama") };
    if (existing) return { ...s, connections: s.connections.map((c) => (c === existing ? { ...c, models } : c)) };
    const conn = { id: "ollama-local", providerId: "ollama", apiKey: "", label: "On this computer (Ollama)", models, addedAt: Date.now() };
    return { ...s, connections: [...s.connections, conn], lastModel: s.lastModel ?? { connectionId: conn.id, modelId: models[0].id } };
  });
}
