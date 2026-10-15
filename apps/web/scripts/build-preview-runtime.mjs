// Rebuild public/preview-runtime.js (run after changing scripts/preview-runtime.src.js or upgrading React).
import { build } from "esbuild";

await build({
  entryPoints: [new URL("./preview-runtime.src.js", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  define: { "process.env.NODE_ENV": '"production"' },
  outfile: new URL("../public/preview-runtime.js", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"),
  logLevel: "info",
});
