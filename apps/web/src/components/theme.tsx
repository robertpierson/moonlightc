"use client";

import { Moon, Sun } from "lucide-react";
import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { sunElevation, sunLook, sunPlace } from "@/lib/sun";
import { Button } from "@/components/ui/button";

/** The public website (home, download, privacy, terms) is always light; only the app has themes. */
export const isSitePage = (path: string) => path === "/" || ["/download", "/privacy", "/terms"].some((p) => path === p || path.startsWith(`${p}/`));

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const site = isSitePage(usePathname() ?? "");
  return (
    // The app starts dark (easier on the eyes at night); people can switch in Settings > Appearance.
    <NextThemes attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange forcedTheme={site ? "light" : undefined}>
      {!site && <FollowTheSun />}
      {children}
    </NextThemes>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button variant="ghost" size="icon" aria-label="Switch light or dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}

/** When "Follow the sun" is on: light by day, dimmer through dusk and dawn, dark at night (checked every few minutes). */
function FollowTheSun() {
  const { setTheme } = useTheme();
  useEffect(() => {
    const apply = () => {
      const place = sunPlace();
      const root = document.documentElement;
      if (!place) return void (root.style.filter = "");
      const look = sunLook(sunElevation(place.lat, place.lon));
      setTheme(look.mode);
      root.style.filter = look.brightness < 1 ? `brightness(${look.brightness})` : "";
    };
    apply();
    const t = setInterval(apply, 5 * 60_000);
    addEventListener("moonc:sun", apply);
    return () => {
      clearInterval(t);
      removeEventListener("moonc:sun", apply);
      document.documentElement.style.filter = "";
    };
  }, [setTheme]);
  return null;
}
