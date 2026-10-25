/**
 * The most natural-sounding voice this device has for the page's language: "Natural"/"Neural" voices (Windows,
 * Edge), then Google's (Chrome, Chromebooks), then any in the language. Undefined = the browser's default.
 */
export function bestVoice(lang = typeof navigator !== "undefined" ? navigator.language : "en-US") {
  if (typeof speechSynthesis === "undefined") return undefined;
  const base = lang.split("-")[0].toLowerCase();
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(base));
  const score = (v: SpeechSynthesisVoice) => (/natural|neural/i.test(v.name) ? 3 : /google/i.test(v.name) ? 2 : /online/i.test(v.name) ? 1 : 0) + (v.lang.toLowerCase() === lang.toLowerCase() ? 0.5 : 0);
  return voices.sort((a, b) => score(b) - score(a))[0];
}

/** A spoken line in the best voice. */
export function utterance(text: string) {
  const u = new SpeechSynthesisUtterance(text);
  const v = bestVoice();
  if (v) {
    u.voice = v;
    u.lang = v.lang;
  }
  return u;
}

// Hands-free listening without a speech service (the desktop app records and transcribes instead).
// ponytail: a fixed volume threshold, not real voice detection: a loud noise counts as speech and a very quiet voice
// may not. Tune SPEECH_LEVEL, or measure the room's noise first, if that bites.
const SPEECH_LEVEL = 0.02; // mic volume (RMS, 0–1) that counts as someone talking
const PAUSE_MS = 1300; // quiet this long after speaking = they're done
const MAX_MS = 30_000;

/**
 * One mic reading while listening: `samples` from an AnalyserNode, `ms` since recording began, `lastSpeech` when
 * someone was last heard (undefined until they speak). Returns the new `lastSpeech` and whether to stop recording:
 * after a short pause once they've spoken, or at the time limit.
 */
export function silenceCheck(samples: Float32Array, ms: number, lastSpeech?: number) {
  const level = Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
  const last = level >= SPEECH_LEVEL ? ms : lastSpeech;
  return { lastSpeech: last, stop: ms >= MAX_MS || (last !== undefined && ms - last >= PAUSE_MS) };
}
