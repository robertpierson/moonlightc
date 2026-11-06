import assert from "node:assert/strict";
import { test } from "node:test";
import { keyNumber, tapLines, textLines } from "./credential-box.mjs";

test("the keys a PIN box needs have numbers; Ctrl, Alt, Windows and F keys don't", () => {
  assert.equal(keyNumber("7"), 0x37);
  assert.equal(keyNumber("a"), 0x41);
  assert.equal(keyNumber("Enter"), 13);
  for (const k of ["control", "ctrl", "alt", "command", "win", "f4", "", undefined]) assert.equal(keyNumber(k), undefined, String(k));
});

test("a tap is a press and a release; only Shift can be combined", () => {
  assert.deepEqual(tapLines("enter"), ["k 13 d", "k 13 u"]);
  assert.deepEqual(tapLines("shift+a"), ["k 16 d", "k 65 d", "k 65 u", "k 16 u"]);
  assert.equal(tapLines("ctrl+v"), null);
  assert.equal(tapLines("alt+f4"), null);
  assert.equal(tapLines("shift+a+b"), null);
});

test("text becomes one line per character, capped", () => {
  assert.deepEqual(textLines("4A"), ["c 52", "c 65"]);
  assert.equal(textLines("x".repeat(1000)).length, 256);
  assert.deepEqual(textLines(undefined), []);
});
