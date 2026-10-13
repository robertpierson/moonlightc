// Injected into a shared tab. Reads the page, performs one action, and shows the "shared" banner.
// Risky actions come back as needsConfirm; background.js asks the person and only then repeats them.
// Kept as one function so background.js can pass it to chrome.scripting.executeScript.
export function pageAgent(cmd) {
  const RISKY = /\b(buy|purchase|pay|order|checkout|place order|subscribe|send|post|publish|delete|remove|transfer|confirm|submit|sign up|install)\b/i;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  };
  const nameOf = (el) => (el.getAttribute("aria-label") || el.innerText || el.value || el.placeholder || el.title || el.name || "").trim().replace(/\s+/g, " ").slice(0, 80);
  const controls = () => [...document.querySelectorAll("a[href], button, input, textarea, select, [role=button], [role=link], [contenteditable=true]")].filter(visible);

  function banner(on) {
    let host = document.getElementById("moonc-shared-banner");
    if (!on) return host?.remove();
    if (host) return;
    host = document.createElement("div");
    host.id = "moonc-shared-banner";
    host.style.cssText = "position:fixed;inset:0 0 auto 0;z-index:2147483647;pointer-events:none";
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `<div style="pointer-events:auto;margin:8px auto;width:max-content;max-width:92vw;display:flex;gap:10px;align-items:center;padding:8px 12px;border-radius:999px;font:500 13px system-ui;color:#fff;background:linear-gradient(115deg,#4338ca,#7c3aed,#a21caf);box-shadow:0 8px 24px rgba(67,56,202,.35)">MoonlightC can see and use this tab<button style="all:unset;cursor:pointer;padding:2px 10px;border-radius:999px;background:#fff;color:#3b2a9e;font-weight:600">Stop</button></div>`;
    root.querySelector("button").addEventListener("click", (e) => {
      if (e.isTrusted) chrome.runtime.sendMessage({ from: "page", method: "stop" });
    });
    document.documentElement.append(host);
  }

  const find = ({ ref, text }) => {
    if (ref) return document.querySelector(`[data-moonc-ref="${CSS.escape(String(ref))}"]`);
    const t = String(text ?? "").toLowerCase();
    return controls().find((el) => nameOf(el).toLowerCase() === t) ?? controls().find((el) => nameOf(el).toLowerCase().includes(t));
  };

  return (async () => {
    if (cmd.type === "banner") return banner(cmd.on);
    if (cmd.type === "read") {
      let n = 0;
      const items = controls()
        .slice(0, 300)
        .map((el) => {
          el.dataset.mooncRef = String(++n);
          return { ref: String(n), kind: el.tagName.toLowerCase(), name: nameOf(el) };
        });
      return { title: document.title, url: location.href, text: document.body.innerText.slice(0, 30000), controls: items };
    }
    const el = find(cmd);
    if (!el) return { error: "Couldn't find that on the page. Read the tab again to get fresh refs." };
    const label = nameOf(el) || el.tagName.toLowerCase();
    if (cmd.type === "click") {
      const form = el.closest("form");
      const risky = RISKY.test(label) || (el.type === "submit" && !!form);
      // Risky steps are confirmed in the extension's own window, which this page can't draw over or click.
      if (risky && !cmd.confirmed) return { needsConfirm: `click "${label}"` };
      el.scrollIntoView({ block: "center" });
      el.click();
      return { clicked: label };
    }
    if (cmd.type === "type") {
      if (cmd.submit && !cmd.confirmed) return { needsConfirm: `type into "${label}" and submit it` };
      el.focus();
      if (el.isContentEditable) el.innerText = cmd.value;
      else {
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set;
        setter ? setter.call(el, cmd.value) : (el.value = cmd.value);
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      if (cmd.submit) (el.form?.requestSubmit?.() ?? el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
      return { typed: label };
    }
    return { error: "Unknown action." };
  })();
}
