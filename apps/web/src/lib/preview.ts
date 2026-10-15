import type { CodeProject } from "./code";

// The Code tab's preview, built in the browser: no outside service (school and home filters often block those).
// The page runs in a sandboxed iframe with no access to MoonlightC or your keys.

const safe = (s: string) => s.replace(/<\/script/gi, "<\/script");
const rel = (p: string) => "/" + p.replace(/^\.?\//, "");

/** A complete HTML document that shows the project. */
export function previewDocument(project: CodeProject, origin: string): string {
  const files = project.files;
  if (project.template === "react") {
    let main = "/index.js";
    try {
      main = rel(JSON.parse(files["/package.json"] ?? "{}").main ?? main);
    } catch {}
    const entry = [main, "/index.js", "/src/index.js", "/index.jsx", "/src/index.jsx", "/index.tsx", "/src/index.tsx"].find((p) => p in files) ?? main;
    const html = files["/public/index.html"] ?? files["/index.html"] ?? '<!doctype html><html><head><meta charset="utf-8" /></head><body><div id="root"></div></body></html>';
    const run = `<script src="${origin}/preview-runtime.js"></script><script>__mooncRun(${safe(JSON.stringify(files))}, ${JSON.stringify(entry)})</script>`;
    return html.includes("</body>") ? html.replace("</body>", `${run}</body>`) : html + run;
  }
  // Plain web page: put its own CSS and JS files inline.
  const html = files["/index.html"] ?? "<!doctype html><p>Add an index.html file.</p>";
  return html
    .replace(/<link\b[^>]*href=["']([^"']+\.css)["'][^>]*>/gi, (tag, href) => (rel(href) in files ? `<style>${files[rel(href)]}</style>` : tag))
    .replace(/<script\b([^>]*)\bsrc=["']([^"']+\.js)["']([^>]*)><\/script>/gi, (tag, a, src, b) => (rel(src) in files ? `<script${a}${b}>${safe(files[rel(src)])}</script>` : tag));
}
