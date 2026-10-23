import { describe, expect, it } from "vitest";
import { checkPin, hasPin, lockChat, resetPin, setPin, visible } from "./chat-lock";
import { getState, saveChat } from "./store";

describe("locked chats", () => {
  it("a PIN unlocks only when it matches; forgetting it sends locked chats to the Trash", async () => {
    await expect(setPin("12")).rejects.toThrow("4 to 8 digits");
    await setPin("2468");
    expect(hasPin()).toBe(true);
    expect(await checkPin("2468")).toBe(true);
    expect(await checkPin("1111")).toBe(false);
    expect(getState().chatLock?.hash).not.toContain("2468");

    saveChat({ id: "c1", title: "Secret", messages: [], updatedAt: 1 });
    saveChat({ id: "c2", title: "Open", messages: [], updatedAt: 2 });
    lockChat("c1");
    expect(visible(getState().chats).map((c) => c.id)).toEqual(["c2"]);

    resetPin();
    expect(hasPin()).toBe(false);
    expect(getState().chats.map((c) => c.id)).toEqual(["c2"]);
    expect(getState().trash?.map((c) => c.id)).toContain("c1");
  });
});
