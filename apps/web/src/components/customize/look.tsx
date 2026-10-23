"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { loadBackdrop } from "@/lib/backdrop-file";
import { runEffect } from "./effects";
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
  }, [look, setTheme]);
  return <Backdrop />;
}

/** Tell the background to reload your picture/video after it changes. */
export const BACKDROP_EVENT = "moonc-backdrop";

/** Your background behind the app (picture, GIF, video and/or an effect); the chat area lets it show through. */
function Backdrop() {
  const look = useLook();
  const b = look.backdrop ?? { blur: 0, hue: 0, saturate: 1, brightness: 1, effect: "none" as const, amount: 1 };
  const [file, setFile] = useState<{ url: string; video: boolean }>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let url = "";
    const load = () =>
      loadBackdrop().then((blob) => {
        if (url) URL.revokeObjectURL(url);
        url = blob ? URL.createObjectURL(blob) : "";
        setFile(blob ? { url, video: blob.type.startsWith("video/") } : undefined);
      });
    load();
    addEventListener(BACKDROP_EVENT, load);
    return () => {
      removeEventListener(BACKDROP_EVENT, load);
      if (url) URL.revokeObjectURL(url);
    };
  }, []);
  const src = file?.url ?? look.wallpaper;
  const on = !!src || b.effect !== "none";
  useEffect(() => {
    const root = document.documentElement;
    if (!on) return void delete root.dataset.backdrop;
    root.dataset.backdrop = "";
    root.style.setProperty("--wallpaper-tint", `color-mix(in oklch, var(--background) ${Math.round(look.wallpaperTint * 100)}%, transparent)`);
  }, [on, look.wallpaperTint]);
  useEffect(() => (canvas.current ? runEffect(canvas.current, b.effect, b.amount) : undefined), [b.effect, b.amount]);
  // A video background rests while the window is hidden, and stays still when the system asks for reduced motion.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sync = () => (document.hidden || still ? v.pause() : v.play().catch(() => {}));
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [file]);
  if (!on) return null;
  const filter = `blur(${b.blur}px) hue-rotate(${b.hue}deg) saturate(${b.saturate}) brightness(${b.brightness})`;
  const media = "absolute inset-0 size-full object-cover";
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {src && (file?.video ? <video ref={video} src={src} muted loop playsInline className={media} style={{ filter, transform: b.blur ? "scale(1.05)" : undefined }} /> : (
        // eslint-disable-next-line @next/next/no-img-element -- your own picture from this device
        <img src={src} alt="" className={media} style={{ filter, transform: b.blur ? "scale(1.05)" : undefined }} />
      ))}
      <canvas ref={canvas} className="absolute inset-0 size-full" />
    </div>
  );
}

export function applyDistro(d: Distro) {
  update((s) => ({ ...s, look: d.look, distroId: d.id }));
  toast.success(`${d.name} applied.`);
}

export const currentLook = () => getState().look ?? DEFAULT_LOOK;
