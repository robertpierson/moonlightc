import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { _electron as electron, expect, test } from "@playwright/test";

let app;
let page;
const grantDir = fs.mkdtempSync(path.join(os.tmpdir(), "moonc-share-"));
fs.writeFileSync(path.join(grantDir, "hello.txt"), "hi");
const userData = fs.mkdtempSync(path.join(os.tmpdir(), "moonc-e2e-"));
const launch = () => electron.launch({ args: ["."], env: { ...process.env, MOONC_E2E_AUTO_APPROVE: "1", MOONC_E2E_USER_DATA: userData, MOONC_E2E_GRANT_DIR: grantDir, MISTRAL_API_KEY: "test-mistral-key-0000111122223333" }, cwd: new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1") });
test.beforeAll(async () => {
  app = await launch();
  page = await app.firstWindow();
  await page.waitForURL(/127\.0\.0\.1:\d+\/app/);
});
test.afterAll(async () => {
  await app?.evaluate(({ app }) => app.quit());
});

test("opens the app from its own local server with the desktop bridge", async () => {
  await expect(page.getByLabel("Message", { exact: true })).toBeVisible();
  const info = await page.evaluate(() => ({ platform: window.moonc?.platform, version: window.moonc?.version, node: typeof window.require }));
  expect(info.platform).toBe(process.platform);
  expect(info.version).toMatch(/\d+\.\d+\.\d+/);
  expect(info.node).toBe("undefined"); // no Node.js in pages
});

test("reads hardware", async () => {
  const hw = await page.evaluate(() => window.moonc.hardware());
  expect(hw.ramGB).toBeGreaterThan(0);
  expect(hw.cores).toBeGreaterThan(0);
});

test("runs a real terminal", async () => {
  const cmd = process.platform === "win32" ? 'echo ("moon-ok-" + 6*7)' : "echo moon-ok-$((6*7))";
  const out = await page.evaluate(
    (cmd) =>
      new Promise(async (resolve) => {
        let buf = "";
        const t = await window.moonc.terminals.create({ cols: 80, rows: 24 });
        window.moonc.terminals.onData(t.id, (d) => {
          buf += d;
          if (buf.includes("moon-ok-42")) {
            window.moonc.terminals.kill(t.id);
            resolve(buf);
          }
        });
        window.moonc.terminals.write(t.id, "echo moon-ok-$((6*7))\r");
      }),
  );
  expect(out).toContain("moon-ok-42");
});

test("pages can call the local API", async () => {
  const status = await page.evaluate(() => fetch("/api/models", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).then((r) => r.status));
  expect(status).toBe(400); // same-origin call reaches the handler (bad body)
});

// Local models lives in Settings.
async function openLocalModels() {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("navigation", { name: "Settings" }).getByRole("button", { name: "Local models" }).click();
}

test("desktop sections: local models, terminal, projects", async () => {
  await openLocalModels();
  await expect(page.getByRole("heading", { name: "Local models" })).toBeVisible();
  await expect(page.getByText(/This computer: .* GB memory/)).toBeVisible({ timeout: 15000 });
  // Terminal and local projects live in Code.
  await page.getByRole("group", { name: "Mode" }).getByRole("button", { name: "Code" }).click();
  await page.getByRole("button", { name: "Terminal" }).click();
  await expect(page.getByTestId("terminal").first()).toBeVisible();
  await page.getByRole("button", { name: "Local projects" }).click();
  await expect(page.getByRole("button", { name: "Allow AI tool folders" })).toBeVisible();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(page.getByLabel("Message", { exact: true })).toBeVisible();
});

test("keys are kept in the OS keychain, not in page storage", async () => {
  await page.evaluate(async () => {
    await window.moonc.secrets.set("key:test-conn", "sk-secret-value");
  });
  expect(await page.evaluate(() => window.moonc.secrets.get("key:test-conn"))).toBe("sk-secret-value");
  await page.evaluate(() => window.moonc.secrets.set("key:test-conn", null));
  expect(await page.evaluate(() => window.moonc.secrets.get("key:test-conn"))).toBeNull();
});

test("gate: download a local model with one click and chat with it (no cloud involved)", async () => {
  test.setTimeout(10 * 60_000);
  test.skip(!(await page.evaluate(() => window.moonc.ollama.status())).running, "Ollama isn't running on this machine");
  await openLocalModels();
  // Use the Hugging Face search + one-click download path with a tiny model to keep the test fast.
  await page.getByLabel("Search Hugging Face models").fill("SmolLM2-135M-Instruct-GGUF");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const row = page.getByRole("list", { name: "Hugging Face results" }).getByRole("listitem").filter({ hasText: /SmolLM2-135M-Instruct-GGUF/i }).first();
  const name = (await row.locator("span").first().innerText()).trim();
  if (await row.getByRole("button", { name: "Download" }).isVisible()) await row.getByRole("button", { name: "Download" }).click();
  await expect(row.getByText("Installed")).toBeVisible({ timeout: 9 * 60_000 });

  const installed = page.getByRole("list", { name: "Installed models" }).getByRole("listitem").filter({ hasText: `hf.co/${name}` }).first();
  await installed.getByRole("button", { name: "Chat" }).click();
  await expect(page.getByRole("combobox", { name: "Choose model" })).toContainText(name.split("/")[1].slice(0, 10));
  await page.getByLabel("Message", { exact: true }).fill("Say hello in five words.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator('[data-role="assistant"]').last()).toHaveText(/\w+/, { timeout: 120_000 });
  await expect(page.getByRole("button", { name: "Send message" })).toBeVisible({ timeout: 120_000 });
});

test("gate: Claude Code opens in the built-in terminal (if installed)", async () => {
  const tools = await page.evaluate(() => window.moonc.terminals.tools());
  test.skip(!tools.find((t) => t.id === "claude")?.installed, "Claude Code isn't installed on this machine");
  await page.getByRole("group", { name: "Mode" }).getByRole("button", { name: "Code" }).click();
  await page.getByRole("button", { name: "Terminal" }).click();
  await page.getByRole("main").getByRole("button", { name: "Claude Code" }).click();
  await expect(page.getByRole("tab", { name: "Claude Code" })).toBeVisible();
  // Claude Code draws its own UI; seeing any of its output proves it launched inside our terminal.
  await expect(page.getByTestId("terminal").last()).toContainText(/Claude|claude|trust|Welcome/, { timeout: 30000 });
  await page.getByRole("button", { name: "Close Claude Code" }).click();
});

test("detects an LM Studio server on this computer and uses its models", async () => {
  const { spawn } = await import("node:child_process");
  const busy = await fetch("http://127.0.0.1:1234/v1/models").then(() => true, () => false);
  test.skip(busy, "something already uses port 1234");
  const mock = spawn(process.execPath, ["../web/e2e/mock-openai.mjs"], { env: { ...process.env, MOCK_PORT: "1234" }, stdio: "ignore" });
  try {
    await new Promise((r) => setTimeout(r, 800));
    await openLocalModels();
    await page.reload();
    await openLocalModels();
    await page.getByRole("button", { name: "Use its models" }).click();
    await expect(page.getByText("LM Studio connected: 2 models.")).toBeVisible();
  } finally {
    mock.kill();
  }
});

test("automations run on a schedule or on demand and keep a history", async () => {
  const { spawn } = await import("node:child_process");
  const mock = spawn(process.execPath, ["../web/e2e/mock-openai.mjs"], { env: { ...process.env, MOCK_PORT: "4011" }, stdio: "ignore" });
  try {
    await new Promise((r) => setTimeout(r, 800));
    await page.evaluate(async () => {
      const res = await fetch("/api/models", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ providerId: "custom", apiKey: "", baseURL: "http://127.0.0.1:4011/v1" }) });
      const { models } = await res.json();
      const s = JSON.parse(localStorage.getItem("moonc:v1") || "{}");
      s.connections = [...(s.connections || []), { id: "mock4011", providerId: "custom", apiKey: "", baseURL: "http://127.0.0.1:4011/v1", label: "Mock", models, addedAt: 0 }];
      s.lastModel = { connectionId: "mock4011", modelId: "mock-fast" };
      localStorage.setItem("moonc:v1", JSON.stringify(s));
    });
    await page.reload();
    await page.getByRole("button", { name: "Automations" }).click();
    await page.getByRole("button", { name: "New automation" }).click();
    await page.getByLabel("Name", { exact: true }).fill("Brief");
    await page.getByLabel("What should the AI do?").fill("summarize my day");
    await page.getByRole("button", { name: "Save automation" }).click();
    await expect(page.getByText("Every day at 08:00")).toBeVisible();
    await page.getByRole("button", { name: "Run now" }).click();
    await page.getByText(/Run history \(1\)/).click();
    await expect(page.getByRole("list", { name: "Brief runs" })).toContainText("Echo from mock-fast: summarize my day");
    await page.getByRole("button", { name: "Continue in chat" }).click();
    await expect(page.locator('[data-role="assistant"]').last()).toContainText("summarize my day");
  } finally {
    mock.kill();
  }
});

test("computer use: approval, overlay, screenshot, real input, audit log, stop and panic hotkey", async () => {
  const robot = (await import("@jitsi/robotjs")).default;
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  expect(await page.evaluate(() => window.moonc.computer.start("e2e check"))).toBe(true);
  await expect(page.getByRole("status").filter({ hasText: "The AI is using this PC: e2e check" })).toBeVisible();
  const overlayOpen = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some((w) => w.webContents.getURL().startsWith("data:text/html")));
  await expect.poll(overlayOpen).toBe(true); // the on-screen frame

  const shot = await page.evaluate(() => window.moonc.computer.act({ action: "screenshot" }));
  expect(shot.width).toBeLessThanOrEqual(1280);
  expect(shot.image.length).toBeGreaterThan(1000);

  await page.evaluate(() => window.moonc.computer.act({ action: "move", x: 40, y: 40 }));
  const after = robot.getMousePos();
  expect(Math.abs(after.x - 40 * (robot.getScreenSize().width / shot.width))).toBeLessThan(3);

  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "The AI is using this PC" })).toHaveCount(0);
  await expect.poll(overlayOpen).toBe(false);
  await expect(page.evaluate(() => window.moonc.computer.act({ action: "screenshot" }))).rejects.toThrow(/No computer-use session/);

  // The global panic hotkey ends a session from anywhere.
  await page.evaluate(() => window.moonc.computer.start("panic check"));
  robot.keyTap("m", ["control", "alt", "shift"]);
  await expect.poll(() => page.evaluate(() => window.moonc.computer.status().then((s) => s.active))).toBe(false);

  const log = await page.evaluate(() => window.moonc.computer.audit());
  const actions = log.map((e) => e.action);
  for (const a of ["session.start", "step", "session.end"]) expect(actions).toContain(a);
  expect(log.find((e) => e.action === "session.end")?.reason).toBe("panic hotkey");
});

test("computer use through chat: the model takes a screenshot after the PC approves", async () => {
  const { spawn } = await import("node:child_process");
  const mock = spawn(process.execPath, ["../web/e2e/mock-openai.mjs"], { env: { ...process.env, MOCK_PORT: "4012" }, stdio: "ignore" });
  try {
    await new Promise((r) => setTimeout(r, 800));
    await page.evaluate(async () => {
      const res = await fetch("/api/models", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ providerId: "custom", apiKey: "", baseURL: "http://127.0.0.1:4012/v1" }) });
      const { models } = await res.json();
      const s = JSON.parse(localStorage.getItem("moonc:v1") || "{}");
      s.connections = [...(s.connections || []).filter((c) => c.id !== "mock4012"), { id: "mock4012", providerId: "custom", apiKey: "", baseURL: "http://127.0.0.1:4012/v1", label: "Mock PC", models, addedAt: 0 }];
      s.lastModel = { connectionId: "mock4012", modelId: "mock-fast" };
      localStorage.setItem("moonc:v1", JSON.stringify(s));
    });
    await page.reload();
    // Screen control lives in Cowork.
    await page.getByRole("group", { name: "Mode" }).getByRole("button", { name: "Cowork" }).click();
    await page.getByRole("button", { name: "New task" }).click();
    await page.getByRole("button", { name: "Use this PC" }).click();
    await page.getByLabel("Message", { exact: true }).fill("please use the computer");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Looked at the screen")).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-role="assistant"]').last()).toContainText("Tool says", { timeout: 20000 });
  } finally {
    mock.kill();
    await page.evaluate(() => window.moonc.computer.stop());
  }
});

test("files: the AI reads shared folders and asks before writing", async () => {
  test.setTimeout(120_000);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("navigation", { name: "Settings" }).getByRole("button", { name: "Files" }).click();
  await page.getByRole("button", { name: "Share a folder" }).click();
  await expect(page.getByRole("list", { name: "Shared folders" })).toContainText("moonc-share-");
  const { spawn } = await import("node:child_process");
  const mock = spawn(process.execPath, ["../web/e2e/mock-openai.mjs"], { env: { ...process.env, MOCK_PORT: "4013" }, stdio: "ignore" });
  try {
    await new Promise((r) => setTimeout(r, 800));
    await page.evaluate(async () => {
      const res = await fetch("/api/models", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ providerId: "custom", apiKey: "", baseURL: "http://127.0.0.1:4013/v1" }) });
      const { models } = await res.json();
      const s = JSON.parse(localStorage.getItem("moonc:v1") || "{}");
      s.connections = [...(s.connections || []).filter((c) => c.id !== "mock4013"), { id: "mock4013", providerId: "custom", apiKey: "", baseURL: "http://127.0.0.1:4013/v1", label: "Mock files", models, addedAt: 0 }];
      s.lastModel = { connectionId: "mock4013", modelId: "mock-fast" };
      localStorage.setItem("moonc:v1", JSON.stringify(s));
    });
    await page.reload();
    await page.getByRole("group", { name: "Mode" }).getByRole("button", { name: "Cowork" }).click();
    await page.getByRole("button", { name: "New task" }).click();
    await page.getByLabel("Message", { exact: true }).fill("list my files");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.locator('[data-role="assistant"]').last()).toContainText("moonc-share-", { timeout: 20000 });

    await page.getByLabel("Message", { exact: true }).fill("save a note");
    await page.getByRole("button", { name: "Send message" }).click();
    await page.getByRole("group", { name: /Approve write/ }).getByRole("button", { name: "Allow once" }).click();
    await expect.poll(() => fs.existsSync(path.join(grantDir, "note.txt")), { timeout: 20000 }).toBe(true);
    expect(fs.readFileSync(path.join(grantDir, "note.txt"), "utf8")).toBe("hello from the moon");
  } finally {
    mock.kill();
  }
});

test("chats and settings survive a restart (same local address every launch)", async () => {
  test.setTimeout(120_000); // two full app starts; slow on CI runners
  const before = new URL(page.url()).port;
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("navigation", { name: "Settings" }).getByRole("button", { name: "Profile" }).click();
  await page.getByLabel("Your name").fill("Restart check");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Restart check").first()).toBeVisible();
  const gone = new Promise((r) => app.process().once("exit", r));
  await app.evaluate(({ app }) => app.quit());
  await gone;
  await app.close().catch(() => {});
  app = await launch();
  // Playwright sometimes misses the first window of a quick relaunch; a real startup failure fails both tries.
  page = await app.firstWindow({ timeout: 20_000 }).catch(async () => {
    await app.close().catch(() => {});
    app = await launch();
    return app.firstWindow();
  });
  await page.waitForURL(/127\.0\.0\.1:\d+\/app/);
  expect(new URL(page.url()).port).toBe(before);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("navigation", { name: "Settings" }).getByRole("button", { name: "Profile" }).click();
  await expect(page.getByLabel("Your name")).toHaveValue("Restart check");
});

test("remote control: allowed device sees the screen; only what it was allowed; home folder only; panic disconnects", async () => {
  const robot = (await import("@jitsi/robotjs")).default;
  const r = await page.evaluate(async () => {
    const b = window.moonc.remote;
    const c = await b.connect({ id: "phone-test", name: "Test phone" }, ["view", "files"]);
    const f = await b.frame("phone-test");
    const fail = async (fn) => {
      try {
        await fn();
        return "";
      } catch (e) {
        return String(e.message);
      }
    };
    const home = await b.list("phone-test");
    return {
      c,
      jpeg: f.image.startsWith("/9j/"),
      input: await fail(() => b.input("phone-test", { action: "click", x: 1, y: 1 })),
      noTerminal: await fail(() => b.exec("phone-test", "echo hi")),
      stranger: await fail(() => b.frame("someone-else")),
      outside: await fail(() => b.list("phone-test", home.path + "/../..")),
      homeOk: Array.isArray(home.entries),
      sessions: (await b.state()).length,
    };
  });
  expect(r.c).toEqual({ allowed: true, tiers: ["view", "files"] });
  expect(r.jpeg).toBe(true);
  expect(r.input).toContain("mouse and keyboard");
  expect(r.noTerminal).not.toBe("");
  expect(r.stranger).toContain("Not connected");
  expect(r.outside).toContain("home folder");
  expect(r.homeOk).toBe(true);
  expect(r.sessions).toBe(1);

  robot.keyTap("m", ["control", "alt", "shift"]);
  await expect.poll(() => page.evaluate(() => window.moonc.remote.state().then((s) => s.length)), { timeout: 5000 }).toBe(0);
  const log = await page.evaluate(() => window.moonc.remote.audit());
  expect(log.find((e) => e.action === "end")?.reason).toBe("panic hotkey");
});

test("home PC: a device allowed the terminal runs commands in the home folder only", async () => {
  const r = await page.evaluate(async () => {
    const b = window.moonc.remote;
    await b.connect({ id: "laptop-test", name: "Test laptop" }, ["files", "terminal"]);
    const out = await b.exec("laptop-test", "echo moon-home");
    let outside = "";
    await b.exec("laptop-test", "echo x", "../..").catch((e) => (outside = String(e.message)));
    await b.end("laptop-test", "test done");
    return { out, outside };
  });
  expect(r.out.exitCode).toBe(0);
  expect(r.out.stdout).toContain("moon-home");
  expect(r.outside).toContain("home folder");
  const log = await page.evaluate(() => window.moonc.remote.audit());
  expect(log.some((e) => e.action === "exec")).toBe(true);
});

test("trusted mode: your own devices connect without the Allow prompt (logged)", async () => {
  const r = await page.evaluate(async () => {
    const b = window.moonc.remote;
    await b.setTrusted(true);
    const c = await b.connect({ id: "tablet-test", name: "Test tablet" }, ["view"]);
    await b.end("tablet-test", "test done");
    const off = await b.setTrusted(false);
    return { c, off, log: (await b.audit()).map((e) => e.action) };
  });
  expect(r.c.allowed).toBe(true);
  expect(r.off).toBe(false);
  expect(r.log).toContain("approve.trusted");
  expect(r.log).toContain("trust.on");
});

test("quick connect reads the clipboard only when it holds a key", async () => {
  await app.evaluate(({ clipboard }) => clipboard.writeText("sk-ant-test-0000111122223333"));
  expect(await page.evaluate(() => window.moonc.clipboard.readKey())).toBe("sk-ant-test-0000111122223333");
  await app.evaluate(({ clipboard }) => clipboard.writeText("my private note with spaces"));
  expect(await page.evaluate(() => window.moonc.clipboard.readKey())).toBeNull();
});

test("the model library is in the sidebar again", async () => {
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "Model library" }).click();
  await expect(page.getByRole("heading", { name: "Local models" })).toBeVisible();
});

test("screen video: only right after an allowed device asks, and it streams live frames", async () => {
  const r = await page.evaluate(async () => {
    const b = window.moonc.remote;
    const tryStream = () => navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }).then((s) => s, (e) => String(e));
    const before = await tryStream();
    await b.connect({ id: "viewer-test", name: "Test viewer" }, ["view"]);
    await b.allowStream("viewer-test");
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }).then((s) => s, (e) => String(e));
    if (typeof stream === "string") return { before: typeof before, stream };
    const audio = stream.getAudioTracks().length;
    // Loop the stream through a real peer connection and check frames arrive on the other end.
    const a = new RTCPeerConnection();
    const z = new RTCPeerConnection();
    a.onicecandidate = (e) => e.candidate && z.addIceCandidate(e.candidate);
    z.onicecandidate = (e) => e.candidate && a.addIceCandidate(e.candidate);
    stream.getTracks().forEach((t) => a.addTrack(t, stream));
    const got = new Promise((res) => (z.ontrack = (e) => res(e.streams[0])));
    await a.setLocalDescription(await a.createOffer());
    await z.setRemoteDescription(a.localDescription);
    await z.setLocalDescription(await z.createAnswer());
    await a.setRemoteDescription(z.localDescription);
    const v = document.createElement("video");
    v.muted = true;
    v.srcObject = await got;
    await v.play();
    await new Promise((res) => setTimeout(res, 1500));
    const size = v.videoWidth;
    stream.getTracks().forEach((t) => t.stop());
    a.close();
    z.close();
    const again = await tryStream();
    await b.end("viewer-test", "test done");
    return { before: typeof before, size, again: typeof again, audio };
  });
  console.log("screen sound tracks:", r.audio);
  expect(r.before).toBe("string"); // refused before any device asked
  expect(r.size).toBeGreaterThan(0); // live frames arrived
  expect(r.again).toBe("string"); // a permission is used once
});

test("your Claude Code is a model in Chat (if installed)", async () => {
  test.setTimeout(120_000);
  const status = await page.evaluate(() => window.moonc.claude.status());
  test.skip(!status.installed, "Claude Code isn't installed on this machine");
  await page.reload();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await page.getByRole("button", { name: "New chat" }).first().click();
  await page.getByRole("combobox", { name: "Choose model" }).click();
  // With several companies connected, pick Claude Code first; with one, its models show straight away.
  const company = page.getByRole("option", { name: /Claude Code \(your plan\)/ });
  if (await company.isVisible().catch(() => false)) await company.click();
  await page.getByRole("option", { name: /Sonnet 5\.5/ }).click();
  await page.getByLabel("Message", { exact: true }).fill("What is 4242 plus 1? Reply with the number only.");
  await page.getByRole("button", { name: "Send message" }).click();
  // Either Claude Code answers, or (signed out / no credits) it says what to do.
  await expect(page.getByText(/4243|sign in again|usage credits/i).first()).toBeVisible({ timeout: 90_000 });
});

test("terminal: Ctrl+V pastes (e.g. a sign-in code)", async () => {
  await page.getByRole("group", { name: "Mode" }).getByRole("button", { name: "Code" }).click();
  await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "Terminal" }).click();
  const term = page.getByTestId("terminal").last();
  await expect(term).toBeVisible();
  await app.evaluate(({ clipboard }) => clipboard.writeText("echo pasted-ok-123"));
  await term.click();
  await page.keyboard.press("Control+V");
  await page.keyboard.press("Enter");
  await expect(term).toContainText("pasted-ok-123", { timeout: 15_000 });
});

test("game mode input: held keys, mouse buttons and relative mouse moves (CI only: moves the real mouse)", async () => {
  test.skip(!process.env.CI, "moves the real mouse and keyboard");
  const robot = (await import("@jitsi/robotjs")).default;
  robot.moveMouse(300, 300);
  const r = await page.evaluate(async () => {
    const b = window.moonc.remote;
    await b.connect({ id: "game-test", name: "Game test" }, ["view", "control"]);
    await b.input("game-test", { action: "move_by", dx: 40, dy: -20 });
    await b.input("game-test", { action: "key_down", key: "shift" });
    await b.input("game-test", { action: "key_up", key: "shift" });
    await b.input("game-test", { action: "wheel", amount: 1 });
    const bad = await b.input("game-test", { action: "key_down", key: "rm -rf" }).then(() => "ignored", (e) => String(e));
    await b.end("game-test", "test done");
    return { bad };
  });
  const p = robot.getMousePos();
  // Raw mouse movement (what games read) goes through Windows' pointer speed, so only the direction is exact.
  expect(p.x).toBeGreaterThan(300);
  expect(p.y).toBeLessThan(300);
  expect(r.bad).toBe("ignored");
});

test("hover and drag: moves follow the pointer, a press with a position goes there first; hovering isn't logged (CI only)", async () => {
  test.skip(!process.env.CI, "moves the real mouse");
  const robot = (await import("@jitsi/robotjs")).default;
  robot.moveMouse(10, 10);
  const r = await page.evaluate(async () => {
    const b = window.moonc.remote;
    await b.connect({ id: "drag-test", name: "Drag test" }, ["view", "control"]);
    await b.input("drag-test", { action: "move", nx: 0.5, ny: 0.5 });
    const afterMove = (await b.audit()).filter((e) => e.clientId === "drag-test" && e.action === "input").length;
    await b.input("drag-test", { action: "mouse_down", nx: 0.25, ny: 0.25 });
    await b.input("drag-test", { action: "mouse_up", nx: 0.3, ny: 0.3 });
    const presses = (await b.audit()).filter((e) => e.clientId === "drag-test" && e.action === "press").length;
    await b.end("drag-test", "test done");
    return { afterMove, presses };
  });
  const s = robot.getScreenSize();
  const p = robot.getMousePos();
  // Released at 30% across, 30% down.
  expect(Math.abs(p.x - Math.round(0.3 * (s.width - 1)))).toBeLessThan(3);
  expect(Math.abs(p.y - Math.round(0.3 * (s.height - 1)))).toBeLessThan(3);
  expect(r.afterMove).toBe(0);
  expect(r.presses).toBe(1);
});

test("allowed places: with the setting on, remote control from elsewhere is refused and listed", async () => {
  const r = await page.evaluate(async () => {
    const b = window.moonc.remote;
    await b.setPlaces({ on: true, list: [], blocked: [] });
    const c = await b.connect({ id: "far-away", name: "Far away" }, ["view"], { ip: "198.51.100.9", country: "FR", city: "Paris", exp: Date.now() + 60000, sig: "forged" });
    const p = await b.places();
    await b.setPlaces({ on: false, list: [], blocked: [] });
    return { c, blocked: p.blocked[0] };
  });
  expect(r.c.allowed).toBe(false);
  expect(r.c.reason).toMatch(/isn't allowed from this place/);
  expect(r.blocked).toMatchObject({ ip: "198.51.100.9", verified: false });
});

test("finds API keys already set up on this PC (shown masked, added only when picked)", async () => {
  const found = await page.evaluate(() => window.moonc.keys.scan());
  const k = found.find((x) => x.source === "MISTRAL_API_KEY");
  expect(k).toMatchObject({ provider: "mistral", masked: "test…3333" });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("navigation", { name: "Settings" }).getByRole("button", { name: "Models & API keys" }).click();
  await page.getByRole("button", { name: "Scan this PC for API keys" }).click();
  await expect(page.getByRole("list", { name: "Keys found on this PC" })).toContainText("MISTRAL_API_KEY");
  await expect(page.getByRole("list", { name: "Keys found on this PC" })).not.toContainText("0000111122223333");
});
