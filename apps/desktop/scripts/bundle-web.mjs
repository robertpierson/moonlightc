// Builds the web app as a self-contained server and copies it into app-server/ for packaging.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, "../../web");
const out = path.resolve(here, "../app-server");

execSync("pnpm exec next build", { cwd: web, stdio: "inherit", env: { ...process.env, DESKTOP_BUILD: "1" } });

const standalone = path.join(web, ".next-desktop", "standalone");
fs.rmSync(out, { recursive: true, force: true });
// Windows can't create symlinks without admin rights, so copy real files. The server is started with NODE_PATH pointing at
// deps/.pnpm/node_modules (pnpm's flat folder) so packages still find their dependencies.
fs.cpSync(standalone, out, { recursive: true, dereference: true });
// Node's cpSync can leave nested symlinks on macOS/Linux; signed app bundles must not point outside themselves.
function materialize(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) {
      const real = fs.realpathSync(p);
      fs.rmSync(p, { force: true });
      fs.cpSync(real, p, { recursive: true, dereference: true });
      if (fs.statSync(p).isDirectory()) materialize(p);
    } else if (e.isDirectory()) materialize(p);
  }
}
materialize(out);

// electron-builder skips a top-level node_modules folder in extra resources, so ship it under another name.
fs.renameSync(path.join(out, "node_modules"), path.join(out, "deps"));
fs.cpSync(path.join(web, ".next-desktop", "static"), path.join(out, "apps", "web", ".next-desktop", "static"), { recursive: true });
fs.cpSync(path.join(web, "public"), path.join(out, "apps", "web", "public"), { recursive: true });
console.log("Bundled web app into", out);
