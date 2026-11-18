import type { CodeProject } from "./code";

// The Code tab's preview, built in the browser: no outside service (school and home filters often block those).
// The page runs in a sandboxed iframe with no access to MoonlightC or your keys.

const safe = (s: string) => s.replace(/<\/script/gi, "<\/script");
const rel = (p: string) => "/" + p.replace(/^\.?\//, "");

/** Reports the app's errors to MoonlightC (the page can only send a message; it can't reach anything else). */
const ERROR_REPORTER = `<script>(function(){var last="";function send(m){m=String(m||"").slice(0,600);if(!m||m===last)return;last=m;try{parent.postMessage({mooncPreviewError:m},"*")}catch(e){}}addEventListener("error",function(e){send((e.message||"Error")+(e.lineno?" (line "+e.lineno+")":""))});addEventListener("unhandledrejection",function(e){var r=e.reason;send(r&&r.message?r.message:r)});new MutationObserver(function(){var b=document.getElementById("__moonc_error");if(b)send(b.textContent)}).observe(document.documentElement,{childList:true,subtree:true,characterData:true})})()</script>`;
const withReporter = (html: string) => (/<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + ERROR_REPORTER) : ERROR_REPORTER + html);

/** A complete HTML document that shows the project. */
export function previewDocument(project: CodeProject, origin: string): string {
  return withReporter(buildDocument(project, origin));
}

function buildDocument(project: CodeProject, origin: string): string {
  const files = project.files;
  if (project.template === "react") {
    let main = "/index.js";
    try {
      main = rel(JSON.parse(files["/package.json"] ?? "{}").main ?? main);
    } catch {}
    const entry = [main, "/index.js", "/src/index.js", "/index.jsx", "/src/index.jsx", "/index.tsx", "/src/index.tsx"].find((p) => p in files) ?? main;
    const html = files["/public/index.html"] ?? files["/index.html"] ?? '<!doctype html><html><head><meta charset="utf-8" /></head><body><div id="root"></div></body></html>';
    const run = `<script crossorigin="anonymous" src="${origin}/preview-runtime.js"></script><script>__mooncRun(${safe(JSON.stringify(files))}, ${JSON.stringify(entry)})</script>`;
    return html.includes("</body>") ? html.replace("</body>", `${run}</body>`) : html + run;
  }
  // Plain web page: put its own CSS and JS files inline.
  const html = files["/index.html"] ?? "<!doctype html><p>Add an index.html file.</p>";
  return html
    .replace(/<link\b[^>]*href=["']([^"']+\.css)["'][^>]*>/gi, (tag, href) => (rel(href) in files ? `<style>${files[rel(href)]}</style>` : tag))
    .replace(/<script\b([^>]*)\bsrc=["']([^"']+\.js)["']([^>]*)><\/script>/gi, (tag, a, src, b) => (rel(src) in files ? `<script${a}${b}>${safe(files[rel(src)])}</script>` : tag));
}

/** Where a published app loads its runtime from (the live site, which serves it with CORS). */
const SITE = "https://moonlightc.vercel.app";

/**
 * Extra files that let a React project from Code run on Vercel (or any static host) with no build step: a root page
 * that runs the app the same way the preview does, and a vercel.json that serves the project root.
 */
export function deployFiles(project: CodeProject): Record<string, string> {
  if (project.template !== "react") return {};
  const extra: Record<string, string> = {};
  if (!("/index.html" in project.files)) extra["/index.html"] = buildDocument(project, SITE);
  if (!("/vercel.json" in project.files)) extra["/vercel.json"] = JSON.stringify({ $schema: "https://openapi.vercel.sh/vercel.json", framework: null, outputDirectory: "." }, null, 2) + "\n";
  return extra;
}
