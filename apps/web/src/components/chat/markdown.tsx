"use client";

import { code } from "@streamdown/code";
import { createMathPlugin } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { Streamdown } from "streamdown";
import "katex/dist/katex.min.css";
import "streamdown/styles.css";

const plugins = { code, math: createMathPlugin({ singleDollarTextMath: true }), mermaid };

export default function Markdown({ text, streaming }: { text: string; streaming: boolean }) {
  return (
    <Streamdown plugins={plugins} isAnimating={streaming} className="min-w-0">
      {text}
    </Streamdown>
  );
}
