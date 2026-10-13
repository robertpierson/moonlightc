export interface Artifact {
  lang: "html" | "svg" | "react";
  code: string;
  title: string;
}

const FENCE = /```(html|svg|jsx|tsx|react)[^\n]*\n([\s\S]*?)```/g;

/** Find complete, previewable code blocks in an assistant answer. */
export function extractArtifacts(text: string): Artifact[] {
  return [...text.matchAll(FENCE)].map((m, i) => {
    const lang = m[1] === "html" || m[1] === "svg" ? m[1] : "react";
    const code = m[2].trim();
    const title = code.match(/<title>([^<]{1,80})<\/title>/i)?.[1] ?? `${lang === "react" ? "React" : lang.toUpperCase()} artifact ${i + 1}`;
    return { lang, code, title };
  });
}

/** Build the iframe document. The iframe is sandboxed without same-origin, so it can't read the app's storage. */
export function artifactDocument(a: Artifact): string {
  if (a.lang === "html") return a.code;
  if (a.lang === "svg") return `<!doctype html><body style="margin:0;display:grid;place-items:center;min-height:100vh">${a.code}</body>`;
  // React: transpile in the frame with Babel and render the default export (or App).
  const src = JSON.stringify(a.code).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.tailwindcss.com/3.4.17"></script></head>
<body><div id="root"></div>
<script src="https://unpkg.com/@babel/standalone@7.28.4/babel.min.js"></script>
<script type="module">
const code = ${src}.replace(/^\\s*export\\s+default\\s+function\\s+(\\w+)/m, "function $1").replace(/^\\s*export\\s+default\\s+(\\w+);?\\s*$/m, "");
const name = (${src}.match(/export\\s+default\\s+(?:function\\s+)?(\\w+)/) || [])[1] || "App";
try {
  const out = Babel.transform(code + "\\nwindow.__C = " + name + ";", { presets: [["react", { runtime: "classic" }], ["typescript", { isTSX: true, allExtensions: true }]], plugins: [] }).code;
  const React = await import("https://esm.sh/react@19.2.0");
  const { createRoot } = await import("https://esm.sh/react-dom@19.2.0/client");
  const body = out.replace(/^import\\s+[^;]+from\\s+["']([^"']+)["'];?/gm, "");
  new Function("React", "useState", "useEffect", "useRef", "useMemo", "useCallback", body)(React, React.useState, React.useEffect, React.useRef, React.useMemo, React.useCallback);
  createRoot(document.getElementById("root")).render(React.createElement(window.__C));
} catch (e) {
  document.body.innerHTML = "<pre style='color:#b00;white-space:pre-wrap;padding:1rem'>" + String(e).replace(/</g, "&lt;") + "</pre>";
}
</script></body></html>`;
}

export function downloadArtifact(a: Artifact) {
  const ext = a.lang === "react" ? "jsx" : a.lang;
  const type = a.lang === "svg" ? "image/svg+xml" : a.lang === "html" ? "text/html" : "text/javascript";
  const el = document.createElement("a");
  el.href = URL.createObjectURL(new Blob([a.code], { type }));
  el.download = `${a.title.replace(/[^\w\- ]+/g, "").trim() || "artifact"}.${ext}`;
  el.click();
  URL.revokeObjectURL(el.href);
}
