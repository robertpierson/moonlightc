"use client";

import { UserRound } from "lucide-react";
import { useStore } from "@/lib/store";

/** The person's picture, or their initial, or a person icon. */
export function Avatar({ size = "size-8" }: { size?: string }) {
  const profile = useStore((s) => s.profile);
  const initial = profile?.name?.trim()[0]?.toUpperCase();
  return profile?.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element -- a small data URL from this device
    <img src={profile.avatar} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span aria-hidden className={`${size} grid shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground dark:border dark:border-white/15`}>
      {initial ?? <UserRound className="size-4" />}
    </span>
  );
}
