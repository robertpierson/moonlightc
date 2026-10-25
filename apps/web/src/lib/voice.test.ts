import { afterEach, describe, expect, it, vi } from "vitest";
import { bestVoice, silenceCheck } from "./voice";

describe("hands-free listening", () => {
  const quiet = new Float32Array(2048).fill(0.002);
  const talking = new Float32Array(2048).fill(0.1);
  it("waits for speech, keeps going through short gaps, stops after a pause", () => {
    expect(silenceCheck(quiet, 10_000)).toEqual({ lastSpeech: undefined, stop: false }); // nobody has spoken yet
    expect(silenceCheck(talking, 11_000)).toEqual({ lastSpeech: 11_000, stop: false });
    expect(silenceCheck(quiet, 11_800, 11_000).stop).toBe(false); // a gap between words
    expect(silenceCheck(quiet, 12_300, 11_000).stop).toBe(true);
  });
  it("stops at 30 seconds, speech or not", () => {
    expect(silenceCheck(quiet, 30_000).stop).toBe(true);
    expect(silenceCheck(talking, 30_000).stop).toBe(true);
  });
});

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
