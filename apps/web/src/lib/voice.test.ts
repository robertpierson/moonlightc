import { afterEach, describe, expect, it, vi } from "vitest";
import { bestVoice } from "./voice";

describe("best voice", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("prefers natural voices, then Google's, in the right language", () => {
    const v = (name: string, lang: string) => ({ name, lang }) as SpeechSynthesisVoice;
    vi.stubGlobal("speechSynthesis", { getVoices: () => [v("Microsoft David", "en-US"), v("Google US English", "en-US"), v("Microsoft Aria Online (Natural)", "en-US"), v("Natural Spanish", "es-ES")] });
    expect(bestVoice("en-US")?.name).toBe("Microsoft Aria Online (Natural)");
    vi.stubGlobal("speechSynthesis", { getVoices: () => [v("Microsoft David", "en-US"), v("Google US English", "en-US")] });
    expect(bestVoice("en-US")?.name).toBe("Google US English");
  });
});
