import { describe, expect, it } from "vitest";
import { errorKind } from "./analytics";

describe("error kinds", () => {
  it("never include the error's words: a crash's type and place, or a fixed category", () => {
    const e = new TypeError("Cannot read properties of undefined (reading 'secret user text')");
    e.stack = "TypeError: x\n    at f (https://moonlightc.vercel.app/_next/static/chunks/3fwz8mzlybpr1.js:12:345)";
    expect(errorKind(e)).toBe("app:TypeError@3fwz8mzlybpr1.js:12");
    expect(errorKind("OpenRouter says your account is out of credit. my private prompt", "chat")).toBe("chat:credit");
    expect(errorKind("something odd about my private prompt", "chat")).toBe("chat:other");
    expect(errorKind("Invalid API key", "chat")).toBe("chat:auth");
  });
});
