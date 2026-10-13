// Minimal OpenAI-compatible provider for end-to-end tests. "slow" in the prompt streams for ~10s so Stop can be tested.
import { createServer } from "node:http";

const port = Number(process.env.MOCK_PORT ?? 4010);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/v1/models") {
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ data: [{ id: "mock-fast" }, { id: "mock-other" }] }));
  }
  if (req.method === "POST" && req.url === "/v1/chat/completions") {
    let raw = "";
    for await (const c of req) raw += c;
    const body = JSON.parse(raw);
    const last = body.messages.at(-1);
    const prompt = typeof last.content === "string" ? last.content : last.content.map((p) => p.text ?? "").join("");
    const slow = prompt.includes("slow");
    const sys = body.messages.find((m) => m.role === "system");
    const prefix = sys ? `[sys: ${sys.content}] ` : "";
    const words = slow ? Array.from({ length: 100 }, (_, i) => `word${i} `) : [prefix + "Echo", " from ", body.model, ": ", prompt];
    res.writeHead(200, { "content-type": "text/event-stream" });
    const chunk = (delta, finish = null) =>
      res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`);
    chunk({ role: "assistant", content: "" });
    for (const w of words) {
      if (res.destroyed) return;
      chunk({ content: w });
      await sleep(slow ? 100 : 5);
    }
    chunk({}, "stop");
    res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: body.model, choices: [], usage: { prompt_tokens: 10, completion_tokens: words.length, total_tokens: 10 + words.length } })}\n\n`);
    return res.end("data: [DONE]\n\n");
  }
  res.statusCode = 404;
  res.end();
}).listen(port, "127.0.0.1");
