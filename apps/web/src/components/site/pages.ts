/** The website's pages, in menu order. */
export const PAGES = [
  ["/", "Overview"],
  ["/models", "Models"],
  ["/remote", "Remote control"],
  ["/code", "Code"],
  ["/extension", "Chrome extension"],
  ["/download", "Download"],
] as const;

/** Where each part starts in public/demo/moonlightc-demo.mp4 (from scripts/demo/record.mjs's chapters.json). */
export const DEMO_CHAPTERS = [
  { t: 0, label: "Ask anything" },
  { t: 7.2, label: "Switch models mid-chat" },
  { t: 13.6, label: "Build an app in Code" },
  { t: 20.5, label: "Use it right away" },
];
