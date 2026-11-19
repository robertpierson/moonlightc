import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { cleanName, freeName, inside, usedBytes } from "./storage-core.mjs";

test("names: no slashes, reserved names, hidden or temporary names", () => {
  assert.equal(cleanName("photo.jpg"), "photo.jpg");
  assert.equal(cleanName("a/b\\c:d"), "a_b_c_d");
  assert.equal(cleanName("CON"), "_CON");
  assert.equal(cleanName("nul.txt"), "_nul.txt");
  assert.equal(cleanName(".bashrc"), "_bashrc");
  assert.equal(cleanName("evil.exe. . "), "evil.exe");
  assert.equal(cleanName("x.moonc-part"), "x_part");
  assert.throws(() => cleanName(""));
  assert.throws(() => cleanName(".."));
});

test("paths stay inside the storage folder, links included", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moonc-st-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "moonc-out-"));
  fs.mkdirSync(path.join(root, "Chromebook"));
  assert.equal(inside(root, "Chromebook").rel, "Chromebook");
  assert.equal(inside(root, "").rel, "");
  assert.throws(() => inside(root, "../x"));
  assert.throws(() => inside(root, "Chromebook/../../x"));
  // Absolute paths are just names inside the folder.
  assert.ok(inside(root, "/etc/passwd").real.startsWith(fs.realpathSync.native(root)));
  assert.ok(inside(root, "C:\\Windows\\System32").real.startsWith(fs.realpathSync.native(root)));
  try {
    fs.symlinkSync(outside, path.join(root, "link"), "junction");
  } catch {
    return; // no permission to make links here; the realpath check is still covered above
  }
  assert.throws(() => inside(root, "link"));
  assert.throws(() => inside(root, "link/secret.txt"));
});

test("new names never overwrite, and sizes add up", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moonc-st-"));
  fs.writeFileSync(path.join(root, "a.txt"), "12345");
  fs.mkdirSync(path.join(root, "d"));
  fs.writeFileSync(path.join(root, "d", "b.txt"), "123");
  assert.equal(freeName(root, "a.txt"), "a (2).txt");
  assert.equal(freeName(root, "new.txt"), "new.txt");
  assert.equal(usedBytes(root), 8);
});
