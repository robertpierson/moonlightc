// Packs the extension into apps/web/public/downloads/moonlightc-chrome-extension.zip for the download page.
// The shipped copy only talks to moonlightc.vercel.app; localhost entries exist for tests and are removed here.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const root = path.join(here, "..");
const out = path.join(root, "..", "web", "public", "downloads", "moonlightc-chrome-extension.zip");
const FILES = ["manifest.json", "background.js", "bridge.js", "page.js", "popup.html", "popup.js", "confirm.html", "confirm.js", "icon.png"];

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
manifest.content_scripts[0].matches = manifest.content_scripts[0].matches.filter((m) => m.startsWith("https://"));

const entries = FILES.map((name) => ({ name: `moonlightc-extension/${name}`, data: name === "manifest.json" ? Buffer.from(JSON.stringify(manifest, null, 2)) : fs.readFileSync(path.join(root, name)) }));

// Minimal zip writer (deflate), enough for Chrome and every unzip tool.
const parts = [];
const central = [];
let offset = 0;
for (const e of entries) {
  const name = Buffer.from(e.name);
  const body = zlib.deflateRawSync(e.data);
  const crc = zlib.crc32(e.data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(e.data.length, 22);
  local.writeUInt16LE(name.length, 26);
  parts.push(local, name, body);
  const c = Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50, 0);
  c.writeUInt16LE(20, 4);
  c.writeUInt16LE(20, 6);
  c.writeUInt16LE(0x0800, 8);
  c.writeUInt16LE(8, 10);
  c.writeUInt32LE(crc, 16);
  c.writeUInt32LE(body.length, 20);
  c.writeUInt32LE(e.data.length, 24);
  c.writeUInt16LE(name.length, 28);
  c.writeUInt32LE(offset, 42);
  central.push(c, name);
  offset += 30 + name.length + body.length;
}
const cd = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(entries.length, 8);
end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(cd.length, 12);
end.writeUInt32LE(offset, 16);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([...parts, cd, end]));
console.log(`Wrote ${path.relative(process.cwd(), out)}`);
