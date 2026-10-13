import type { Hardware } from "./desktop";

export type Verdict = "great" | "slow" | "wont-fit";

// ponytail: rule of thumb. A model needs roughly its file size plus ~20% for context. If that fits in GPU memory it runs
// fast; if it fits in system RAM it runs on the CPU (slower); otherwise it won't load. Tune the margins if users report misses.
export function verdict(sizeGB: number, hw: Hardware): { verdict: Verdict; reason: string } {
  const need = sizeGB * 1.2;
  const vram = Math.max(0, ...hw.gpus.map((g) => g.vramGB));
  const apple = hw.os.startsWith("Darwin") && hw.arch === "arm64"; // unified memory: GPU can use most of RAM
  if (hw.freeDiskGB && sizeGB > hw.freeDiskGB - 2) return { verdict: "wont-fit", reason: `Needs ${sizeGB} GB of disk; you have ${hw.freeDiskGB} GB free.` };
  if (apple ? need <= hw.ramGB * 0.7 : need <= vram) return { verdict: "great", reason: apple ? "Fits in your Mac's memory." : `Fits in your GPU's ${vram} GB.` };
  if (need <= hw.ramGB * 0.75) return { verdict: "slow", reason: vram ? `Bigger than your GPU's ${vram} GB, so part runs on the CPU.` : "No suitable GPU found, so it runs on the CPU." };
  return { verdict: "wont-fit", reason: `Needs about ${Math.ceil(need)} GB of memory; you have ${hw.ramGB} GB.` };
}
