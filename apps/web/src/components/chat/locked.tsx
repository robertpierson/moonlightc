"use client";

import { Lock, LockOpen } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { checkPin, hasPin, resetPin, setOpen, setPin, unlockChat, useLockOpen, validPin } from "@/lib/chat-lock";
import { useStore } from "@/lib/store";

/** Create your chat PIN (twice), or enter it. */
export function PinDialog({ mode, onDone, onClose }: { mode: "create" | "enter"; onDone: () => void; onClose: () => void }) {
  const [pin, setPinText] = useState("");
  const [again, setAgain] = useState("");
  const [forgot, setForgot] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "create") {
      if (!validPin(pin)) return toast.error("Use 4 to 8 digits.");
      if (pin !== again) return toast.error("The two PINs don't match.");
      await setPin(pin);
      return onDone();
    }
    if (await checkPin(pin)) return onDone();
    setPinText("");
    toast.error("Wrong PIN.");
  };
  const digits = { inputMode: "numeric" as const, autoComplete: "off", maxLength: 8, type: "password" };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Choose a chat PIN" : forgot ? "Forgot your PIN?" : "Enter your chat PIN"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Locked chats are hidden from your chat list and search until you enter this PIN. 4 to 8 digits."
              : forgot
                ? "Your locked chats move to the Trash (still hidden from others), then you can choose a new PIN."
                : "To see your locked chats."}
          </DialogDescription>
        </DialogHeader>
        {forgot ? (
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForgot(false)}>
              Back
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                resetPin();
                toast.success("PIN reset. Locked chats are in the Trash.");
                onClose();
              }}
            >
              Reset PIN
            </Button>
          </DialogFooter>
        ) : (
          <form onSubmit={submit} className="grid gap-3">
            <Input aria-label="PIN" placeholder="PIN" autoFocus value={pin} onChange={(e) => setPinText(e.target.value.replace(/\D/g, ""))} {...digits} />
            {mode === "create" && <Input aria-label="PIN again" placeholder="PIN again" value={again} onChange={(e) => setAgain(e.target.value.replace(/\D/g, ""))} {...digits} />}
            <DialogFooter>
              {mode === "enter" && (
                <Button type="button" variant="ghost" onClick={() => setForgot(true)}>
                  Forgot PIN?
                </Button>
              )}
              <Button type="submit">{mode === "create" ? "Save PIN" : "Unlock"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** All chats > Locked: shown after the PIN; open one, or unlock it back into your lists. */
export function LockedChats({ workspace, onSelect }: { workspace: "chat" | "cowork"; onSelect: (id: string) => void }) {
  const all = useStore((s) => s.chats);
  const locked = useMemo(() => all.filter((c) => c.locked && (c.workspace === "cowork") === (workspace === "cowork")), [all, workspace]);
  const open = useLockOpen();
  const [asking, setAsking] = useState(false);
  if (!locked.length) return null;
  return (
    <section id="locked" aria-label="Locked chats" className="grid scroll-mt-4 gap-2 border-t pt-4">
      <div className="flex items-center gap-2">
        <h3 className="flex-1 font-medium">Locked ({locked.length})</h3>
        {open ? (
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            <Lock /> Hide
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAsking(true)}>
            <LockOpen /> Show locked chats
          </Button>
        )}
      </div>
      {open && (
        <ul className="grid gap-1">
          {[...locked]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <button className="min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent" onClick={() => onSelect(c.id)}>
                  {c.title}
                </button>
                <Button size="sm" variant="ghost" onClick={() => unlockChat(c.id)}>
                  Unlock
                </Button>
              </li>
            ))}
        </ul>
      )}
      {asking && (
        <PinDialog
          mode={hasPin() ? "enter" : "create"}
          onDone={() => {
            setAsking(false);
            setOpen(true);
          }}
          onClose={() => setAsking(false)}
        />
      )}
    </section>
  );
}
