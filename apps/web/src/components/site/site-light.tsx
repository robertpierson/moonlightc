"use client";

import { useEffect } from "react";

/** Coming from the app (dark, maybe dimmed by "Follow the sun") to the website: undo the app's look on the page. */
export function SiteLight() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    root.classList.add("light");
    root.style.colorScheme = "light";
    root.style.filter = "";
    root.removeAttribute("data-theme");
  }, []);
  return null;
}
