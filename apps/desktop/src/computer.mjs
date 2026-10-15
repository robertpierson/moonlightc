// AI computer use on this PC. Safety rules (SPEC §8): every session is approved here in a native dialog, a visible
// overlay shows while it runs, Ctrl+Alt+Shift+M stops everything, sessions time out, destructive steps ask first,
// and every action is written to an audit log.
import robot from "@jitsi/robotjs";
import { app, BrowserWindow, desktopCapturer, dialog, screen } from "electron";
import fs from "node:fs";
import path from "node:path";
import { looksDestructive } from "./safety.mjs";

const TIMEOUT_MS = 15 * 60_000;
const SHOT_WIDTH = 1280;
export const PANIC = "Control+Alt+Shift+M";

let session; // { id, task, startedAt, timer }
let overlay;
let listeners = new Set();

const auditFile = () => path.join(app.getPath("userData"), "computer-audit.jsonl");
function audit(action, detail = {}) {
  const entry = { at: new Date().toISOString(), session: session?.id ?? null, action, ...detail };
  fs.appendFileSync(auditFile(), JSON.stringify(entry) + "\n");
}

export function readAudit(limit = 200) {
  try {
    return fs.readFileSync(auditFile(), "utf8").trim().split("\n").slice(-limit).reverse().map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

const state = () => (session ? { active: true, task: session.task, startedAt: session.startedAt, endsAt: session.startedAt + TIMEOUT_MS } : { active: false });
const emit = () => listeners.forEach((fn) => fn(state()));
export const onState = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const status = state;

function showOverlay() {
  const { bounds } = screen.getPrimaryDisplay();
  overlay = new BrowserWindow({ ...bounds, frame: false, transparent: true, alwaysOnTop: true, focusable: false, skipTaskbar: true, hasShadow: false, resizable: false, webPreferences: { sandbox: true } });
  overlay.setIgnoreMouseEvents(true);
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.loadURL(
    "data:text/html;charset=utf-8," +
      encodeURIComponent(`<!doctype html><html><body style="margin:0;height:100vh;box-sizing:border-box;border:4px solid #8fa8ff;background:transparent;font-family:system-ui">
<div style="position:fixed;top:0;left:50%;transform:translateX(-50%);background:#0f1736;color:#dfe4f0;padding:6px 14px;border-radius:0 0 10px 10px;font-size:13px">
MoonlightC AI is using this PC · press Ctrl+Alt+Shift+M to stop</div></body></html>`),
  );
}

export function stop(reason = "stopped") {
  if (!session) return;
  clearTimeout(session.timer);
  audit("session.end", { reason });
  session = undefined;
  overlay?.destroy();
  overlay = undefined;
  emit();
}

// Automated tests of unpackaged builds can't click native dialogs; installed apps always ask a person.
const autoApprove = () => !app.isPackaged && process.env.MOONC_E2E_AUTO_APPROVE === "1";
const ask = (parent, opts) => (autoApprove() ? Promise.resolve({ response: 0 }) : dialog.showMessageBox(parent, opts));

/** Ask the person at this PC. Nothing runs unless they click Allow. */
export async function start(parent, task) {
  if (session) return true;
  const { response } = await ask(parent, {
    type: "warning",
    buttons: ["Allow", "Don't allow"],
    defaultId: 1,
    cancelId: 1,
    title: "Let the AI use this PC?",
    message: "Let the AI control the mouse and keyboard on this PC?",
    detail: `Task: ${String(task).slice(0, 300)}\n\nA blue frame shows while it works. Press Ctrl+Alt+Shift+M at any time to stop it. It stops by itself after 15 minutes, and it asks before anything risky.`,
  });
  if (response !== 0) {
    audit("session.denied", { task: String(task).slice(0, 300) });
    return false;
  }
  session = { id: Date.now().toString(36), task: String(task).slice(0, 300), startedAt: Date.now(), timer: setTimeout(() => stop("timeout"), TIMEOUT_MS) };
  audit("session.start", { task: session.task });
  showOverlay();
  emit();
  return true;
}

let scale = 1; // screen pixels per screenshot pixel

async function screenshot() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.size; // logical (what robotjs uses)
  const w = Math.min(SHOT_WIDTH, width);
  const h = Math.round((height * w) / width);
  const [src] = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: w, height: h } });
  scale = width / w;
  return { image: src.thumbnail.toPNG().toString("base64"), width: w, height: h };
}

const KEY_ALIASES = { ctrl: "control", cmd: "command", win: "command", esc: "escape", del: "delete", return: "enter", pgup: "pageup", pgdn: "pagedown" };

/** Mouse and keyboard, in screenshot coordinates (sc = screen pixels per screenshot pixel). Shared with remote control. */
export async function runAction(a, sc) {
  const at = (x, y) => [Math.round(Number(x) * sc), Math.round(Number(y) * sc)];
  switch (a.action) {
    case "screenshot":
      break;
    case "click":
    case "double_click":
    case "right_click": {
      const [x, y] = at(a.x, a.y);
      robot.moveMouse(x, y);
      robot.mouseClick(a.action === "right_click" ? "right" : "left", a.action === "double_click");
      break;
    }
    case "move": {
      const [x, y] = at(a.x, a.y);
      robot.moveMouse(x, y);
      break;
    }
    case "type":
      robot.typeString(String(a.text ?? "").slice(0, 2000));
      break;
    case "key": {
      const parts = String(a.keys ?? "").toLowerCase().split("+").map((k) => KEY_ALIASES[k] ?? k);
      const key = parts.pop();
      robot.keyTap(key, parts);
      break;
    }
    case "scroll":
      robot.scrollMouse(0, Math.round(Number(a.amount ?? -3)) * 120);
      break;
    case "wait":
      await new Promise((r) => setTimeout(r, Math.min(5000, Number(a.ms ?? 1000))));
      break;
    default:
      throw new Error(`Unknown action ${a.action}`);
  }
}

/** The screen's size in the pixels the mouse uses (correct with display scaling too). */
export const screenPixels = () => robot.getScreenSize();

/** A screenshot as JPEG data (smaller, for streaming to another device). Returns the scale for runAction. */
export async function captureJpeg(maxWidth = 1024, quality = 55) {
  const { width, height } = screen.getPrimaryDisplay().size;
  const w = Math.min(maxWidth, width);
  const h = Math.round((height * w) / width);
  const [src] = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: w, height: h } });
  return { image: src.thumbnail.toJPEG(quality).toString("base64"), width: w, height: h, scale: width / w };
}

/** Run one action and return a fresh screenshot. */
export async function act(parent, a) {
  if (!session) throw new Error("No computer-use session is running. It may have been stopped or timed out.");
  if (looksDestructive(a)) {
    const { response } = await ask(parent, {
      type: "warning",
      buttons: ["Allow this step", "Stop"],
      defaultId: 1,
      cancelId: 1,
      title: "Risky step",
      message: "The AI wants to do something that might delete, buy, send or install.",
      detail: `${a.reason ? `Why: ${String(a.reason).slice(0, 300)}\n` : ""}Step: ${JSON.stringify({ ...a, reason: undefined }).slice(0, 400)}`,
    });
    audit("step.confirm", { step: a.action, allowed: response === 0 });
    if (response !== 0) {
      stop("user refused a risky step");
      return { stopped: true, note: "The person stopped the session instead of allowing that step." };
    }
  }
  await runAction(a, scale);
  audit("step", { step: a.action, x: a.x, y: a.y, keys: a.keys, chars: a.text ? String(a.text).length : undefined });
  await new Promise((r) => setTimeout(r, a.action === "screenshot" ? 0 : 400));
  return screenshot();
}
