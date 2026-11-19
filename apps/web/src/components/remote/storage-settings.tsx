"use client";

import { FolderOpen, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TwoStepGate } from "@/components/account/two-step-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { desktop } from "@/lib/desktop";
import { bytes } from "@/lib/pc-storage";
import { updateNow } from "@/lib/store";

type St = { on: boolean; maxGB: number; dir: string; used: number; free: number };

/** Desktop app: Settings > PC storage. Off by default; only the person at this PC can switch it. */
export function StorageSettings({ onSetup }: { onSetup: () => void }) {
  const s = desktop()?.storage;
  const [st, setSt] = useState<St>();
  const [limit, setLimit] = useState("");
  useEffect(() => {
    s?.settings().then((x) => (setSt(x), setLimit(String(x.maxGB))));
  }, [s]);
  if (!s) return <p className="text-sm">Update MoonlightC on this PC to use PC storage.</p>;
  if (!st) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const save = async (next: { on: boolean; maxGB: number }) => {
    const x = await s.setSettings(next);
    setSt(x);
    setLimit(String(x.maxGB));
    updateNow((v) => ({ ...v, pcStorage: x.on }));
    return x;
  };
  const freeGB = Math.floor((st.free + st.used) / 1024 ** 3);
  return (
    <TwoStepGate onSetup={onSetup}>
      <div className="grid gap-5">
        <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
          <div className="grid gap-0.5">
            <Label htmlFor="pc-storage" className="font-medium">
              Let my other devices store files on this PC
            </Label>
            <span className="text-sm text-muted-foreground">Your phone, Chromebook or laptop, signed in to your account, can upload, download and organize files in one folder here.</span>
          </div>
          <Switch
            id="pc-storage"
            checked={st.on}
            onCheckedChange={async (on) => {
              const x = await save({ on, maxGB: st.maxGB });
              toast.success(x.on ? "PC storage is on. Open this PC from your other device to use it." : "PC storage is off.");
            }}
          />
        </div>

        {st.on && (
          <>
            <div className="grid gap-2 rounded-xl border p-4">
              <span className="font-medium">The folder</span>
              <code className="truncate rounded bg-muted px-2 py-1 text-xs">{st.dir}</code>
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Space used" aria-valuemin={0} aria-valuemax={st.maxGB} aria-valuenow={Math.round((st.used / 1024 ** 3) * 10) / 10}>
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, (st.used / (st.maxGB * 1024 ** 3)) * 100)}%` }} />
              </div>
              <p className="text-sm text-muted-foreground">
                {bytes(st.used)} used of your {st.maxGB} GB limit. {bytes(st.free)} free on this drive.
              </p>
              <Button variant="outline" size="sm" className="justify-self-start" onClick={() => s.openFolder()}>
                <FolderOpen /> Show the folder
              </Button>
            </div>

            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const x = await save({ on: true, maxGB: Number(limit) });
                toast.success(`Space limit set to ${x.maxGB} GB.`);
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="storage-limit">Space limit (GB)</Label>
                <Input id="storage-limit" type="number" min={1} max={freeGB || 100_000} value={limit} onChange={(e) => setLimit(e.target.value)} className="w-32" />
              </div>
              <Button type="submit" variant="outline" disabled={!Number(limit) || Number(limit) === st.maxGB}>
                Save limit
              </Button>
            </form>
          </>
        )}

        <section aria-labelledby="storage-safe" className="grid gap-2 rounded-xl border p-4 text-sm">
          <h3 id="storage-safe" className="flex items-center gap-2 font-medium">
            <ShieldCheck className="size-4" /> What stays safe
          </h3>
          <ul className="grid list-disc gap-1 pl-5 text-muted-foreground">
            <li>Only that one folder. Your other files, the screen, the keyboard and the terminal can&apos;t be reached through storage.</li>
            <li>Nothing in it is ever opened or run by MoonlightC. Files are only saved and read back.</li>
            <li>Every file is marked as downloaded from the internet, so Windows warns you before running one you double-click.</li>
            <li>Only your own devices, signed in with two-step sign-in, can connect. Removed files go to this PC&apos;s Recycle Bin.</li>
            <li>The space limit and 5 GB of free space are always kept. Every change is in Settings &gt; Remote control &gt; Activity.</li>
          </ul>
        </section>
      </div>
    </TwoStepGate>
  );
}
