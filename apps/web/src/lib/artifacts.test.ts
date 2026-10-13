import { describe, expect, it } from "vitest";
import { artifactDocument, extractArtifacts } from "./artifacts";

describe("extractArtifacts", () => {
  it("finds html, svg and react blocks and ignores others", () => {
    const text = "a\n```html\n<title>Hi</title><p>x</p>\n```\n```python\nprint(1)\n```\n```svg\n<svg></svg>\n```\n```jsx\nexport default function App(){return <b/>}\n```";
    const out = extractArtifacts(text);
    expect(out.map((a) => a.lang)).toEqual(["html", "svg", "react"]);
    expect(out[0].title).toBe("Hi");
  });
  it("ignores an unfinished block while streaming", () => {
    expect(extractArtifacts("```html\n<p>half")).toEqual([]);
  });
});

describe("artifactDocument", () => {
  it("can't be broken out of with a closing script tag", () => {
    const doc = artifactDocument({ lang: "react", title: "x", code: "const s = '</script><script>alert(1)</script>';" });
    expect(doc).not.toContain("<script>alert(1)");
  });
});
