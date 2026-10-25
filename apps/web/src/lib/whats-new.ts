// "What's new" in Settings: recent changes in plain English, newest first. Only things that really shipped.
export const WHATS_NEW: { version: string; date: string; items: string[] }[] = [
  {
    version: "0.6.52",
    date: "October 23, 2026",
    items: [
      "Remote control: copy and paste between your device and the PC, drop files on the screen to send them, smooth scrolling, and a live frames-per-second and delay readout.",
      "Remote control full screen sends Alt+F4, Alt+Tab and the Search key to the PC (hold Esc to leave). F1–F12 work too.",
      "Paste a web link in “Type on the computer” and press Open on PC.",
      "Live video reconnects by itself after a Wi-Fi drop.",
      "Locked chats: hide chats behind a PIN (chat menu > Lock chat).",
      "Esc stops a reply. Starter ideas on an empty chat. An optional notification when a reply finishes.",
      "Claude Code follows Settings > Code permission and shows each step it takes.",
      "Long-press the installed app icon for “Remote control my PC”.",
    ],
  },
  {
    version: "0.6.41",
    date: "October 23, 2026",
    items: [
      "Share a chat as a read-only link (chat menu > Share link).",
      "Import your chats from ChatGPT or Claude (Settings > Privacy & data).",
      "Talk mode: a hands-free voice conversation (the sound-wave button next to the mic, in Chrome).",
      "Your own background: a picture, GIF or video, with blur, colors and effects like rain and lanterns (Settings > Appearance).",
      "Remote control works on networks that block direct video, through a relay (others add their own free Cloudflare key in Settings > Account).",
    ],
  },
];
