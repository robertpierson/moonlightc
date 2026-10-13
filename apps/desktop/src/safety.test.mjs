import assert from "node:assert/strict";
import { test } from "node:test";
import { looksDestructive } from "./safety.mjs";

test("risky computer-use steps are caught", () => {
  assert.equal(looksDestructive({ action: "click", destructive: true }), true);
  assert.equal(looksDestructive({ action: "key", keys: "shift+delete" }), true);
  assert.equal(looksDestructive({ action: "type", text: "rm -rf ~" }), true);
  assert.equal(looksDestructive({ action: "type", text: "Remove-Item C:/tmp -Recurse" }), true);
  assert.equal(looksDestructive({ action: "type", text: "hello world" }), false);
  assert.equal(looksDestructive({ action: "click", x: 1, y: 2 }), false);
});
