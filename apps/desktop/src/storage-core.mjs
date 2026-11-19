// PC storage: the parts that decide which paths and names are allowed. No Electron here, so it's unit tested
// (storage-core.test.mjs). Everything stays inside one folder; nothing in it is ever opened or run.
import fs from "node:fs";
import path from "node:path";

const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
export const PART = ".moonc-part";

/** A safe file or folder name: no slashes, no Windows-reserved names or characters, no hidden or temporary names. */
export function cleanName(name) {
  let n = String(name ?? "")
    .normalize("NFC")
    // eslint-disable-next-line no-control-regex -- control characters are exactly what's being removed
    .replace(/[\u0000-\u001f\u007f\\/:*?"<>|]/g, "_")
    .replace(/[. ]+$/, "")
    .trim()
    .slice(0, 200);
  if (n.startsWith(".")) n = `_${n.slice(1)}`;
  if (RESERVED.test(n)) n = `_${n}`;
  if (n.toLowerCase().endsWith(PART)) n = `${n.slice(0, -PART.length)}_part`;
  if (!n || n === "_") throw new Error("Pick a different name.");
  return n;
}

/**
 * The real path of `rel` (a path the other device sent, "/"-separated) inside `root`. Each part is cleaned, and links
 * are followed before checking, so nothing outside the folder can be reached, even through a shortcut or junction.
 */
export function inside(root, rel = "") {
  const base = fs.realpathSync.native(root);
  const parts = String(rel ?? "")
    .split(/[\\/]+/)
    .filter((p) => p && p !== ".");
  if (parts.some((p) => p === "..")) throw new Error("That isn't in your storage folder.");
  const abs = path.join(base, ...parts.map(cleanName));
  // Follow links in the part that exists (a new file or folder isn't there yet); the rest is plain names.
  let real = abs;
  const rest = [];
  for (;;) {
    try {
      real = path.join(fs.realpathSync.native(real), ...rest);
      break;
    } catch (e) {
      if (real === base) throw e;
      rest.unshift(path.basename(real));
      real = path.dirname(real);
    }
  }
  const r = path.relative(base, real);
  if (r.startsWith("..") || path.isAbsolute(r)) throw new Error("That isn't in your storage folder.");
  return { real, base, rel: r.split(path.sep).filter(Boolean).join("/") };
}

/** "photo.jpg", then "photo (2).jpg", "photo (3).jpg"… so nothing already there is overwritten. */
export function freeName(dir, name, exists = (p) => fs.existsSync(p)) {
  if (!exists(path.join(dir, name))) return name;
  const ext = path.extname(name);
  const stem = name.slice(0, name.length - ext.length);
  for (let i = 2; i < 10_000; i++) {
    const n = `${stem} (${i})${ext}`;
    if (!exists(path.join(dir, n))) return n;
  }
  throw new Error("Too many files with that name.");
}

/** Bytes used by everything in a folder (stops counting after 200,000 entries). */
export function usedBytes(dir) {
  let total = 0;
  let seen = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (++seen > 200_000) return;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) total += fs.statSync(p).size;
    }
  };
  try {
    walk(dir);
  } catch {}
  return total;
}
