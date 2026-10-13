import fs from "node:fs/promises";
import os from "node:os";
import si from "systeminformation";

const GB = 1024 ** 3;

/** What the "will it run on your PC?" verdicts are based on. */
export async function hardware() {
  const [graphics, disk] = await Promise.all([si.graphics().catch(() => ({ controllers: [] })), fs.statfs(os.homedir()).catch(() => null)]);
  return {
    cpu: os.cpus()[0]?.model?.trim() ?? "Unknown CPU",
    cores: os.cpus().length,
    ramGB: Math.round((os.totalmem() / GB) * 10) / 10,
    gpus: graphics.controllers
      .filter((c) => c.model)
      .map((c) => ({ model: c.model, vramGB: Math.round(((c.vram ?? 0) / 1024) * 10) / 10 })),
    freeDiskGB: disk ? Math.round((disk.bavail * disk.bsize) / GB) : 0,
    os: `${os.type()} ${os.release()}`,
    arch: process.arch,
  };
}
