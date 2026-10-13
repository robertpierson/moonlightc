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
    const last = body.messages.findLast((m) => m.role === "user");
    let prompt = typeof last.content === "string" ? last.content : last.content.map((p) => p.text ?? "").join("");
    const slow = prompt.includes("slow");
    const toolMsg = body.messages.at(-1).role === "tool" ? body.messages.at(-1) : undefined;
    const url = prompt.match(/read (https:\/\/\S+)/)?.[1];
    const py = prompt.match(/python: (.+)/)?.[1];
    const add = prompt.match(/add (\d+) (\d+)/);
    const rememberFact = prompt.match(/remember that (.+)/)?.[1];
    if (rememberFact && body.tools?.some((t) => t.function.name === "save_memory") && !toolMsg) {
      res.writeHead(200, { "content-type": "text/event-stream" });
      const call = { index: 0, id: "call_mem", type: "function", function: { name: "save_memory", arguments: JSON.stringify({ fact: rememberFact }) } };
      res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta: { role: "assistant", tool_calls: [call] }, finish_reason: null }] })}

`);
      res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] })}

`);
      return res.end(`data: [DONE]

`);
    }
    const conv = prompt.match(/convert ([\d.]+) (\w+) to (\w+)/);
    const convTool = body.tools?.find((t) => t.function.name.endsWith("__convert_units"))?.function.name;
    const addTool = conv && convTool ? convTool : body.tools?.find((t) => t.function.name.endsWith("__add"))?.function.name;
    const args = conv && convTool ? { value: Number(conv[1]), from: conv[2], to: conv[3] } : add && { a: Number(add[1]), b: Number(add[2]) };
    if (addTool && args && !toolMsg) {
      res.writeHead(200, { "content-type": "text/event-stream" });
      const call = { index: 0, id: "call_add", type: "function", function: { name: addTool, arguments: JSON.stringify(args) } };
      res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta: { role: "assistant", tool_calls: [call] }, finish_reason: null }] })}

`);
      res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] })}

`);
      return res.end(`data: [DONE]

`);
    }
    if (body.tools && (url || py) && !toolMsg) {
      res.writeHead(200, { "content-type": "text/event-stream" });
      const fn = url ? { name: "fetch_url", arguments: JSON.stringify({ url }) } : { name: "run_python", arguments: JSON.stringify({ code: py }) };
      const call = { index: 0, id: "call_1", type: "function", function: fn };
      res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta: { role: "assistant", tool_calls: [call] }, finish_reason: null }] })}

`);
      res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] })}

`);
      return res.end(`data: [DONE]

`);
    }
    const sys = body.messages.find((m) => m.role === "system");
    const prefix = sys ? `[sys: ${sys.content}] ` : "";
    if (toolMsg) prompt = "Tool says: " + String(toolMsg.content).slice(0, 300);
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
