import { describe, expect, it } from "vitest";
import { claudeText } from "./claude-code";

describe("Claude Code steps", () => {
  it("shows its words plus one short line per step", () => {
    expect(
      claudeText([
        { type: "text", text: "Fixing the test." },
        { type: "tool_use", name: "Bash", input: { command: "npm test\nmore" } },
        { type: "tool_use", name: "Edit", input: { file_path: "src/app.ts" } },
        { type: "tool_use", name: "Mystery" },
      ]),
    ).toBe("Fixing the test.\n\n*Ran* `npm test`\n\n*Edited* `src/app.ts`\n\n*Used Mystery*");
  });
});
