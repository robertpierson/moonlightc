// A stand-in AI for recording the website's demo video: OpenAI-compatible, with written sample answers, so the real
// app can be filmed without paying an AI company. Port 4011. Not used by the app itself.
import { createServer } from "node:http";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TRIP = `Here's a 3-day Chicago plan that keeps costs low.

**Day 1: Downtown**
- Millennium Park and Cloud Gate, both free
- Walk the Riverwalk at sunset
- Deep-dish pizza in River North

**Day 2: The lakefront**
- Lincoln Park Zoo, also free
- Rent a bike for the Lakefront Trail
- North Avenue Beach for the skyline view

**Day 3: Neighborhoods**
- Wicker Park murals and vintage shops
- Lunch in Chinatown

Getting around: a Ventra day pass covers every train and bus.`;

const PACK = `Here's your packing list for Chicago:

- [ ] Comfortable walking shoes
- [ ] A light jacket for the wind off the lake
- [ ] Refillable water bottle
- [ ] Phone charger and a small power bank
- [ ] Ventra card or the Ventra app
- [ ] Sunglasses for the beach day`;

const APP = `import { useState } from "react";

export default function App() {
  const [bill, setBill] = useState(64);
  const [tip, setTip] = useState(18);
  const [people, setPeople] = useState(2);
  const each = (bill * (1 + tip / 100)) / Math.max(1, people);
  const box = { font: "16px system-ui", padding: "10px 12px", borderRadius: 10, border: "1px solid #d5dbe6", width: "100%" };
  return (
    <main style={{ font: "16px system-ui", color: "#0f1830", maxWidth: 360, margin: "48px auto", padding: 28, borderRadius: 20, background: "linear-gradient(180deg,#fff,#eef1f6)", boxShadow: "0 20px 50px -20px rgba(15,24,48,.35)" }}>
      <h1 style={{ margin: "0 0 20px", fontSize: 26, fontWeight: 600 }}>Tip calculator</h1>
      <label>Bill<input style={box} type="number" value={bill} onChange={(e) => setBill(+e.target.value)} /></label>
      <p style={{ margin: "16px 0 8px" }}>Tip: {tip}%</p>
      <div style={{ display: "flex", gap: 8 }}>
        {[15, 18, 20, 25].map((t) => (
          <button key={t} onClick={() => setTip(t)} style={{ flex: 1, padding: 10, borderRadius: 999, border: 0, font: "inherit", background: t === tip ? "#1a2747" : "#e3e7ee", color: t === tip ? "#fff" : "#0f1830" }}>{t}%</button>
        ))}
      </div>
      <label style={{ display: "block", marginTop: 16 }}>People<input style={box} type="number" min="1" value={people} onChange={(e) => setPeople(+e.target.value)} /></label>
      <p style={{ marginTop: 24, fontSize: 34, fontWeight: 600 }}>\${each.toFixed(2)} <span style={{ fontSize: 15, fontWeight: 400, color: "#56607a" }}>each</span></p>
    </main>
  );
}
`;

const send = (res, body, delta, finish = null) =>
  res.write(`data: ${JSON.stringify({ id: "demo", object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`);

createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/v1/models") {
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ data: [{ id: "claude" }, { id: "gpt" }, { id: "gemini" }] }));
  }
  if (req.method !== "POST" || req.url !== "/v1/chat/completions") return (res.statusCode = 404), res.end();
  let raw = "";
  for await (const c of req) raw += c;
  const body = JSON.parse(raw);
  const last = body.messages.findLast((m) => m.role === "user");
  const prompt = typeof last.content === "string" ? last.content : last.content.map((p) => p.text ?? "").join("");
  const afterTool = body.messages.at(-1).role === "tool";

  if (!body.stream) {
    // Chat titles and summaries.
    const text = /chicago|trip/i.test(prompt) ? "Chicago trip on a budget" : /tip/i.test(prompt) ? "Tip calculator" : "New chat";
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ id: "demo", object: "chat.completion", created: 0, model: body.model, choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
  }

  res.writeHead(200, { "content-type": "text/event-stream" });
  if (/tip calculator/i.test(prompt) && body.tools?.some((t) => t.function.name === "write_files") && !afterTool) {
    await sleep(700);
    const args = { summary: "Built a tip calculator", files: [{ path: "/App.js", content: APP }] };
    send(res, body, { role: "assistant", tool_calls: [{ index: 0, id: "call_demo", type: "function", function: { name: "write_files", arguments: JSON.stringify(args) } }] });
    send(res, body, {}, "tool_calls");
    return res.end("data: [DONE]\n\n");
  }
  const text = afterTool
    ? "Done. Type the bill, pick a tip and split it between people. Open Preview to try it."
    : /pack/i.test(prompt)
      ? PACK
      : /chicago|trip/i.test(prompt)
        ? TRIP
        : "Happy to help. What would you like to do next?";
  send(res, body, { role: "assistant", content: "" });
  await sleep(600); // a moment of "thinking"
  // Stream a few characters at a time, like a fast model.
  for (let i = 0; i < text.length; i += 4) {
    if (res.destroyed) return;
    send(res, body, { content: text.slice(i, i + 4) });
    await sleep(14);
  }
  send(res, body, {}, "stop");
  res.write(`data: ${JSON.stringify({ id: "demo", object: "chat.completion.chunk", created: 0, model: body.model, choices: [], usage: { prompt_tokens: 40, completion_tokens: Math.round(text.length / 4), total_tokens: 40 + Math.round(text.length / 4) } })}\n\n`);
  res.end("data: [DONE]\n\n");
}).listen(4011, "127.0.0.1", () => console.log("demo AI on 4011"));
