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
    if (body.response_format && prompt.includes("RECURRING subscriptions")) {
      // Structured output (generateText with Output.array): answer with JSON that matches the schema.
      const elements = [{ service: "Netflix Standard", amount: 15.49, currency: "USD", period: "monthly", lastCharged: "2026-10-01" }];
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ id: "x", object: "chat.completion", created: 0, model: body.model, choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify({ elements }) }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
    }
    if (prompt.startsWith("build:") && body.tools?.some((t) => t.function.name === "write_files") && !toolMsg) {
      res.writeHead(200, { "content-type": "text/event-stream" });
      const app = ["export default function App() {", "  return <h1>Tip calculator</h1>;", "}", ""].join("\n");
      const args = { summary: "Made a tip calculator", files: [{ path: "/App.js", content: app }] };
      const call = { index: 0, id: "call_code", type: "function", function: { name: "write_files", arguments: JSON.stringify(args) } };
      res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta: { role: "assistant", tool_calls: [call] }, finish_reason: null }] })}

`);
      res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] })}

`);
      return res.end(`data: [DONE]

`);
    }
    if (prompt.includes("what's playing") && body.tools?.some((t) => t.function.name === "spotify_now_playing") && !toolMsg) {
      res.writeHead(200, { "content-type": "text/event-stream" });
      const call = { index: 0, id: "call_sp", type: "function", function: { name: "spotify_now_playing", arguments: "{}" } };
      res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta: { role: "assistant", tool_calls: [call] }, finish_reason: null }] })}` + "\n\n");
      res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] })}` + "\n\n");
      return res.end("data: [DONE]\n\n");
    }
    if (prompt.includes("my youtube") && body.tools?.some((t) => t.function.name === "youtube_my_subscriptions") && !toolMsg) {
      res.writeHead(200, { "content-type": "text/event-stream" });
      const call = { index: 0, id: "call_yt", type: "function", function: { name: "youtube_my_subscriptions", arguments: "{}" } };
      res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta: { role: "assistant", tool_calls: [call] }, finish_reason: null }] })}

`);
      res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] })}

`);
      return res.end(`data: [DONE]

`);
    }
    if (prompt.includes("check my email") && body.tools?.some((t) => t.function.name === "gmail_search") && !toolMsg) {
      res.writeHead(200, { "content-type": "text/event-stream" });
      const call = { index: 0, id: "call_mail", type: "function", function: { name: "gmail_search", arguments: JSON.stringify({ query: "newer_than:1d" }) } };
      res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta: { role: "assistant", tool_calls: [call] }, finish_reason: null }] })}

`);
      res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] })}

`);
      return res.end(`data: [DONE]

`);
    }
    if (prompt.includes("use the computer") && body.tools?.some((t) => t.function.name === "computer") && !toolMsg) {
      res.writeHead(200, { "content-type": "text/event-stream" });
      const call = { index: 0, id: "call_pc", type: "function", function: { name: "computer", arguments: JSON.stringify({ action: "screenshot" }) } };
      res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta: { role: "assistant", tool_calls: [call] }, finish_reason: null }] })}

`);
      res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] })}

`);
      return res.end(`data: [DONE]

`);
    }
    const browserCall = prompt.includes("read my tab") ? { name: "browser_read", args: {} } : prompt.includes("click say hi") ? { name: "browser_click", args: { text: "Say hi" } } : prompt.includes("buy it") ? { name: "browser_click", args: { text: "Buy now" } } : undefined;
    const fileCall = browserCall ?? (prompt.includes("list my files") ? { name: "files_list", args: {} } : prompt.includes("save a note") ? { name: "files_write", args: { path: "note.txt", content: "hello from the moon" } } : undefined);
    if (fileCall && body.tools?.some((t) => t.function.name === fileCall.name) && !toolMsg) {
      res.writeHead(200, { "content-type": "text/event-stream" });
      const call = { index: 0, id: "call_files", type: "function", function: { name: fileCall.name, arguments: JSON.stringify(fileCall.args) } };
      res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta: { role: "assistant", tool_calls: [call] }, finish_reason: null }] })}\n\n`);
      res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] })}\n\n`);
      return res.end("data: [DONE]\n\n");
    }
    const skillName = prompt.match(/use skill (\S+)/)?.[1];
    if (skillName && body.tools?.some((t) => t.function.name === "load_skill") && !toolMsg) {
      res.writeHead(200, { "content-type": "text/event-stream" });
      const call = { index: 0, id: "call_skill", type: "function", function: { name: "load_skill", arguments: JSON.stringify({ name: skillName }) } };
      res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta: { role: "assistant", tool_calls: [call] }, finish_reason: null }] })}\n\n`);
      res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] })}\n\n`);
      return res.end("data: [DONE]\n\n");
    }
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
    if (!body.stream) {
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ id: "x", object: "chat.completion", created: 0, model: body.model, choices: [{ index: 0, message: { role: "assistant", content: words.join("") }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: words.length, total_tokens: 10 + words.length } }));
    }
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
