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
