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
