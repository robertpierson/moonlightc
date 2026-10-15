// The in-app code preview's runtime: React plus a JSX/TypeScript transformer and a tiny module loader.
// Built into public/preview-runtime.js by scripts/build-preview-runtime.mjs; it runs inside a sandboxed iframe.
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as ReactDOMClient from "react-dom/client";
import * as JSXRuntime from "react/jsx-runtime";
import { transform } from "sucrase";

const BUILTIN = { react: React, "react-dom": ReactDOM, "react-dom/client": ReactDOMClient, "react/jsx-runtime": JSXRuntime, "react/jsx-dev-runtime": JSXRuntime };
const EXTS = ["", ".js", ".jsx", ".ts", ".tsx", ".json", ".css", "/index.js", "/index.jsx", "/index.ts", "/index.tsx"];

function showError(e) {
  let box = document.getElementById("__moonc_error");
  if (!box) {
    box = document.createElement("pre");
    box.id = "__moonc_error";
    box.style.cssText = "position:fixed;inset:auto 8px 8px 8px;max-height:45%;overflow:auto;margin:0;padding:12px;background:#2a0f14;color:#ffd7dc;font:12px/1.5 ui-monospace,monospace;border-radius:8px;white-space:pre-wrap;z-index:2147483647";
    document.body.appendChild(box);
  }
  box.textContent = String(e && e.stack ? e.message + "\n\n" + e.stack.split("\n").slice(0, 6).join("\n") : e);
}
addEventListener("error", (e) => showError(e.error || e.message));
addEventListener("unhandledrejection", (e) => showError(e.reason));

function join(from, spec) {
  const parts = (spec.startsWith("/") ? spec : from.replace(/[^/]*$/, "") + spec).split("/");
  const out = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p && p !== ".") out.push(p);
  }
  return "/" + out.join("/");
}

/** Run a React project: files is { "/path": "source" }. */
window.__mooncRun = function run(files, entry) {
  const cache = {};
  function load(path) {
    if (cache[path]) return cache[path].exports;
    const src = files[path];
    const mod = { exports: {} };
    cache[path] = mod;
    if (path.endsWith(".css")) {
      const style = document.createElement("style");
      style.textContent = src;
      document.head.appendChild(style);
      return mod.exports;
    }
    if (path.endsWith(".json")) return (mod.exports = JSON.parse(src));
    const code = transform(src, { transforms: ["jsx", "typescript", "imports"], jsxRuntime: "automatic", production: true, filePath: path }).code;
    const require = (spec) => {
      if (BUILTIN[spec]) return BUILTIN[spec];
      if (!spec.startsWith(".") && !spec.startsWith("/")) throw new Error(`"${spec}" isn't available in this preview yet. It runs React and your own files.`);
      const base = join(path, spec);
      const hit = EXTS.map((e) => base + e).find((p) => p in files);
      if (!hit) throw new Error(`Can't find "${spec}" (imported from ${path}).`);
      return load(hit);
    };
    new Function("require", "module", "exports", "React", code + "\n//# sourceURL=" + path)(require, mod, mod.exports, React);
    return mod.exports;
  }
  try {
    load(entry);
  } catch (e) {
    showError(e);
  }
};
