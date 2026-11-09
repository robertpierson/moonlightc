import { ImageResponse } from "next/og";

// The picture shown when someone shares a MoonlightC link (Discord, iMessage, X...): the headline over a silver sky,
// with the moon's edge rising along the bottom, like the website.
export const alt = "MoonlightC: every AI, one window.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(180deg, #d5dbe5 0%, #e9ecf1 45%, #f7f8fa 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 64, fontSize: 30, fontWeight: 600, color: "#0e1628" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(180deg,#25324f,#0f1626)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 26, height: 26, borderRadius: 13, background: "#e9ecf2", boxShadow: "inset -9px -4px 0 0 #1a2440" }} />
          </div>
          MoonlightC
        </div>
        <div style={{ marginTop: 44, fontSize: 104, fontWeight: 600, letterSpacing: -5, lineHeight: 1, color: "#0e1628", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span>Every AI,</span>
          <span>one window.</span>
        </div>
        <div style={{ marginTop: 28, fontSize: 30, color: "#4a5368" }}>Claude, GPT, Gemini and more, with your own keys. Free.</div>
        {/* The moon's edge, with a soft halo. */}
        <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", left: 0, top: 0 }}>
          <defs>
            <radialGradient id="m" cx="600" cy="560" r="1000" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.25" stopColor="#eef0f5" />
              <stop offset="0.6" stopColor="#cdd3dd" />
              <stop offset="1" stopColor="#aab3c3" />
            </radialGradient>
          </defs>
          <circle cx="600" cy="1590" r="1060" fill="#ffffff" opacity="0.55" />
          <circle cx="600" cy="1590" r="1040" fill="#ffffff" opacity="0.7" />
          <circle cx="600" cy="1590" r="1020" fill="url(#m)" />
        </svg>
      </div>
    ),
    size,
  );
}
