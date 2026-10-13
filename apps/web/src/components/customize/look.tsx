"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";
import { toast } from "sonner";
import { DEFAULT_LOOK, EDITABLE, themeMode, type Distro, type Look } from "@/lib/customize";
import { getState, update, useStore } from "@/lib/store";

export const useLook = () => useStore((s) => s.look) ?? DEFAULT_LOOK;
export const setLook = (patch: Partial<Look>) => update((s) => ({ ...s, look: { ...(s.look ?? DEFAULT_LOOK), ...patch }, distroId: undefined }));

/** Applies the current look to the page: theme tokens, light/dark, density, wallpaper. */
export function LookApplier() {
  const look = useLook();
  const { setTheme } = useTheme();
  useEffect(() => {
    const root = document.documentElement;
    if (look.theme === "moonlight") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", look.theme);
    const mode = themeMode(look.theme);
    if (mode) setTheme(mode);
    root.dataset.density = look.density;
    for (const k of EDITABLE) root.style.removeProperty(`--${k}`);
    for (const [k, v] of Object.entries(look.overrides)) root.style.setProperty(`--${k}`, v);
    if (look.radius !== undefined) root.style.setProperty("--radius", `${look.radius}rem`);
    else root.style.removeProperty("--radius");
    if (look.wallpaper) {
      document.body.dataset.wallpaper = "";
      document.body.style.setProperty("--wallpaper", `url("${look.wallpaper}")`);
      document.body.style.setProperty("--wallpaper-tint", `color-mix(in oklch, var(--background) ${Math.round(look.wallpaperTint * 100)}%, transparent)`);
    } else {
      delete document.body.dataset.wallpaper;
    }
  }, [look, setTheme]);
  return null;
}

export function applyDistro(d: Distro) {
  update((s) => ({ ...s, look: d.look, distroId: d.id }));
  toast.success(`${d.name} applied.`);
}

export const currentLook = () => getState().look ?? DEFAULT_LOOK;
