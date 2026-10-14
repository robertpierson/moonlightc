import { describe, expect, it } from "vitest";
import { beginEditing, getState, hasUnsavedChanges, revertEdits, update, updateNow } from "./store";

describe("settings save bar", () => {
  it("counts only real edits; defaults picked in the background are kept without Save", () => {
    beginEditing();
    updateNow((s) => ({ ...s, lastModel: { connectionId: "ollama-local", modelId: "smol" } }));
    expect(hasUnsavedChanges()).toBe(false);
    update((s) => ({ ...s, webTools: !s.webTools }));
    expect(hasUnsavedChanges()).toBe(true);
    revertEdits();
    expect(hasUnsavedChanges()).toBe(false);
    expect(getState().lastModel?.modelId).toBe("smol");
    // Same value rebuilt as a new object is not a change.
    update((s) => ({ ...s, lastModel: { ...s.lastModel! } }));
    expect(hasUnsavedChanges()).toBe(false);
  });
});
