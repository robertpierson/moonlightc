import { describe, expect, it } from "vitest";
import { verdict } from "./verdict";

const pc = (vramGB: number, ramGB: number, os = "Windows_NT 10", arch = "x64") => ({ cpu: "", cores: 8, ramGB, gpus: vramGB ? [{ model: "GPU", vramGB }] : [], freeDiskGB: 500, os, arch });

describe("verdict", () => {
  it("great when it fits in VRAM", () => expect(verdict(4.9, pc(8, 16)).verdict).toBe("great"));
  it("slow when only RAM fits", () => expect(verdict(9.1, pc(6, 32)).verdict).toBe("slow"));
  it("won't fit when RAM is too small", () => expect(verdict(18.7, pc(0, 16)).verdict).toBe("wont-fit"));
  it("uses unified memory on Apple silicon", () => expect(verdict(13.8, pc(0, 32, "Darwin 24", "arm64")).verdict).toBe("great"));
  it("checks disk space", () => expect(verdict(18, { ...pc(24, 64), freeDiskGB: 10 }).verdict).toBe("wont-fit"));
});
