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
// node_modules/.pnpm/node_modules (pnpm's flat folder) so packages still find their dependencies.
fs.cpSync(standalone, out, { recursive: true, dereference: true });
fs.cpSync(path.join(web, ".next-desktop", "static"), path.join(out, "apps", "web", ".next-desktop", "static"), { recursive: true });
fs.cpSync(path.join(web, "public"), path.join(out, "apps", "web", "public"), { recursive: true });
console.log("Bundled web app into", out);
