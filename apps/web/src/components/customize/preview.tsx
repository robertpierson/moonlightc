"use client";

import type { Look, ThemeId } from "@/lib/customize";

const FONT: Record<Look["font"], string | undefined> = {
  default: undefined,
  rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif',
  serif: 'ui-serif, "Iowan Old Style", Georgia, serif',
  mono: "var(--font-geist-mono), ui-monospace, monospace",
};

/**
 * A small, true-to-life picture of the chat screen drawn with a look's own colors and layout, so you can see a theme,
 * setup or font before you choose it. It's decoration: screen readers skip it (the option's name says what it is).
 */
export function AppPreview({ look, theme, className = "", inherit }: { look: Partial<Look>; theme?: ThemeId; className?: string; inherit?: boolean }) {
  const t = theme ?? look.theme ?? "moonlight";
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(look.overrides ?? {})) vars[`--${k}`] = v;
  if (look.radius !== undefined) vars["--radius"] = `${look.radius}rem`;
  const right = look.sidebarSide === "right";
  const compact = look.density === "compact";
  const plain = look.messages === "plain";
  const gap = compact ? "gap-1" : "gap-1.5";
  return (
    <div
      aria-hidden
      // The current theme inherits the page's own tokens (so Moonlight follows light or dark); others carry their own.
      data-preview-theme={inherit ? undefined : t}
      style={{ ...vars, fontFamily: FONT[look.font ?? "default"], fontSize: `${10 * (look.textScale ?? 1)}px` } as React.CSSProperties}
      className={`pointer-events-none flex aspect-[16/10] w-full overflow-hidden rounded-[calc(var(--radius)*1.1)] border bg-background text-foreground select-none ${right ? "flex-row-reverse" : ""} ${className}`}
    >
      <div className={`flex w-[28%] flex-col ${gap} border-border bg-sidebar p-[4%] ${right ? "border-l" : "border-r"}`}>
        <div className="h-[9%] w-full rounded-[calc(var(--radius)*0.6)] bg-primary" />
        {[70, 85, 55, compact ? 80 : 0, compact ? 60 : 0].filter(Boolean).map((w, i) => (
          <div key={i} className="h-[6%] rounded-[calc(var(--radius)*0.4)] bg-muted" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-[4%]">
        <div className={`flex flex-1 flex-col ${compact ? "gap-[3%]" : "gap-[5%]"}`}>
          <div className={`flex ${plain ? "justify-start" : "justify-end"}`}>
            <div className={`h-[0.9em] w-[45%] ${plain ? "border-l-2 border-primary" : "rounded-[calc(var(--radius)*0.8)] bg-secondary"}`} style={{ height: "1.1em" }} />
          </div>
          <div className="grid gap-[0.35em]">
            <div className="h-[0.45em] w-[90%] rounded-full bg-foreground/70" />
            <div className="h-[0.45em] w-[75%] rounded-full bg-foreground/50" />
            <div className="h-[0.45em] w-[60%] rounded-full bg-foreground/35" />
          </div>
          <div className={`flex ${plain ? "justify-start" : "justify-end"}`}>
            <div className={`w-[30%] ${plain ? "border-l-2 border-primary" : "rounded-[calc(var(--radius)*0.8)] bg-secondary"}`} style={{ height: "1.1em" }} />
          </div>
        </div>
        <div
          className={`mt-[4%] flex items-end justify-end rounded-[calc(var(--radius)*0.9)] border bg-card p-[2.5%] ${look.bigInput ? "h-[30%]" : "h-[15%]"}`}
        >
          <div className="aspect-square h-[1.1em] rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}

/**
 * A big, readable chat screen drawn in a theme, so you can see exactly how it looks before you pick it.
 * Decoration only: screen readers skip it (the caption names the theme).
 */
export function ThemeShowcase({ look, inherit }: { look: Partial<Look>; inherit?: boolean }) {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(look.overrides ?? {})) vars[`--${k}`] = v;
  if (look.radius !== undefined) vars["--radius"] = `${look.radius}rem`;
  const r = (n: number) => `calc(var(--radius) * ${n})`;
  const chats = ["Weekend in Lisbon", "Fix my resume", "Pasta for four", "Study plan"];
  return (
    <div
      aria-hidden
      data-preview-theme={inherit ? undefined : (look.theme ?? "moonlight")}
      style={{ ...vars, fontFamily: FONT[look.font ?? "default"], borderRadius: r(1.4) } as React.CSSProperties}
      className="pointer-events-none flex h-72 w-full overflow-hidden border bg-background text-[11px] leading-snug text-foreground shadow-sm transition-colors duration-300 select-none sm:h-80 sm:text-xs"
    >
      <div className="hidden w-[30%] max-w-48 shrink-0 flex-col gap-1 border-r bg-sidebar p-3 sm:flex">
        <p className="mb-1 px-1 font-semibold">MoonlightC</p>
        <p className="mb-2 bg-primary px-2.5 py-1.5 text-primary-foreground" style={{ borderRadius: r(0.8) }}>
          + New chat
        </p>
        {chats.map((c, i) => (
          <p key={c} className={`truncate px-2 py-1 ${i === 0 ? "bg-accent font-medium" : "text-muted-foreground"}`} style={{ borderRadius: r(0.6) }}>
            {c}
          </p>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <span className="font-medium">Weekend in Lisbon</span>
          <span className="text-muted-foreground">Auto: Planning</span>
        </div>
        <div className="flex flex-1 flex-col gap-3 overflow-hidden px-4 py-3">
          <p className="max-w-[75%] self-end bg-secondary px-3 py-2" style={{ borderRadius: r(1.2) }}>
            Plan two days in Lisbon on a small budget.
          </p>
          <div className="grid max-w-[90%] gap-1.5">
            <p>Here&apos;s a relaxed plan that keeps costs low:</p>
            <div className="grid gap-1 border bg-card p-2.5" style={{ borderRadius: r(0.9) }}>
              <p>
                <span className="font-semibold">Day 1.</span> Alfama, the castle at sunset, dinner in Mouraria.
              </p>
              <p>
                <span className="font-semibold">Day 2.</span> Tram 28 to Belém, then the riverside walk.
              </p>
            </div>
            <p className="text-muted-foreground">About €60 a day, not counting where you stay.</p>
            <p className="text-link underline underline-offset-2">Open the route in Maps</p>
          </div>
        </div>
        <div className="m-3 mt-0 flex items-center gap-2 border bg-card py-1.5 pr-1.5 pl-3" style={{ borderRadius: r(1.2) }}>
          <span className="flex-1 truncate text-muted-foreground">Message MoonlightC</span>
          <span className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">↑</span>
        </div>
      </div>
    </div>
  );
}
