import { describe, expect, it } from "vitest";
import { parseExport } from "./import-chats";

describe("importing chats", () => {
  it("reads a ChatGPT export, following the branch you last saw", () => {
    const { from, chats } = parseExport([
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "Pasta",
        update_time: 1_700_000_000,
        current_node: "c",
        mapping: {
          root: { message: null, parent: null },
          s: { message: { author: { role: "system" }, content: { parts: ["hidden"] } }, parent: "root" },
          a: { message: { author: { role: "user" }, content: { parts: ["How long to boil?"] } }, parent: "s" },
          old: { message: { author: { role: "assistant" }, content: { parts: ["old answer"] } }, parent: "a" },
          c: { message: { author: { role: "assistant" }, content: { parts: ["About 10 minutes."] } }, parent: "a" },
        },
      },
    ]);
    expect(from).toBe("ChatGPT");
    expect(chats[0].id).toBe("11111111-1111-4111-8111-111111111111");
    expect(chats[0].messages.map((m) => [m.role, (m.parts[0] as { text: string }).text])).toEqual([
      ["user", "How long to boil?"],
      ["assistant", "About 10 minutes."],
    ]);
    expect(chats[0].updatedAt).toBe(1_700_000_000_000);
  });

  it("reads a Claude export and skips empty chats", () => {
    const { from, chats } = parseExport([
      { uuid: "22222222-2222-4222-8222-222222222222", name: "Essay", updated_at: "2026-01-02T00:00:00Z", chat_messages: [{ sender: "human", text: "Help me" }, { sender: "assistant", content: [{ type: "text", text: "Sure." }] }] },
      { uuid: "33333333-3333-4333-8333-333333333333", name: "Empty", chat_messages: [] },
    ]);
    expect(from).toBe("Claude");
    expect(chats).toHaveLength(1);
    expect(chats[0].title).toBe("Essay");
    expect(chats[0].messages[1].role).toBe("assistant");
  });
});
