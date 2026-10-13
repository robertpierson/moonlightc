import { describe, expect, it } from "vitest";
import { assertPublicURL } from "./server-guard";

const c = (baseURL: string) => ({ providerId: "custom", apiKey: "", baseURL });

describe("assertPublicURL", () => {
  it.each([
    "http://example.com/v1",
    "https://localhost:1234/v1",
    "https://127.0.0.1/v1",
    "https://10.0.0.5/v1",
    "https://192.168.1.2/v1",
    "https://172.20.0.1/v1",
    "https://169.254.169.254/latest",
    "https://[::1]/v1",
    "https://printer.local/v1",
    "not a url",
  ])("blocks %s", (u) => expect(() => assertPublicURL(c(u))).toThrow());

  it("allows public https", () => expect(() => assertPublicURL(c("https://api.example.com/v1"))).not.toThrow());
  it("ignores built-in providers", () => expect(() => assertPublicURL({ providerId: "openai", apiKey: "k" })).not.toThrow());
});

import { htmlToText } from "./tools";
describe("htmlToText", () => {
  it("drops scripts and tags, keeps text", () => {
    expect(htmlToText("<head><title>t</title></head><p>Hello &amp; <b>bye</b></p><script>evil()</script>")).toBe("Hello & bye");
  });
});
