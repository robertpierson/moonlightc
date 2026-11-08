// "What's new" in Settings: recent changes in plain English, newest first. Only things that really shipped.
export const WHATS_NEW: { version: string; date: string; items: string[] }[] = [
  {
    version: "0.6.63",
    date: "November 8, 2026",
    items: [
      "A new website: white and silver, with a live preview of the app.",
      "The app now starts in dark mode. You can still pick light or match your device in Settings > Appearance.",
      "The Chrome extension has a new icon and colors, and is ready for the Chrome Web Store.",
    ],
  },
  {
    version: "0.6.62",
    date: "November 7, 2026",
    items: [
      "Keep this PC awake (Settings > General, off by default): while MoonlightC is open, Windows won't put the PC to sleep by itself.",
      "The relay count in the tray panel now counts time when either device uses the relay, and shows minutes under an hour instead of 0.",
    ],
  },
  {
    version: "0.6.61",
    date: "November 6, 2026",
    items: [
      "Type your PIN from another device: Windows ignores remote typing in its own PIN and password boxes, like the one a website's passkey opens. Turn this on in Settings > Remote control, at the PC, and those boxes work from your other devices.",
    ],
  },
  {
    version: "0.6.60",
    date: "November 5, 2026",
    items: [
      "Always on now keeps the window open: the X won't close it, and it stays open after a restart. Turn it off to close MoonlightC normally.",
      "Clicking MoonlightC's own X or title bar from another device could freeze the app. It now frees itself within a few seconds.",
    ],
  },
  {
    version: "0.6.59",
    date: "November 4, 2026",
    items: [
      "Click the MoonlightC tray icon for a small panel: remote control on or off, who's connected, your security level, relay hours, and shortcuts into the app.",
      "Always on (Settings > General, off by default): if something ends MoonlightC, it opens again by itself.",
    ],
  },
  {
    version: "0.6.58",
    date: "October 29, 2026",
    items: [
      "Remote control says clearly when your PC is off or asleep, and when it was last on.",
      "The PC app heals itself: if it ever freezes for 90 seconds it restarts on its own, a crashed page or app server comes back by itself, and no pop-up can freeze it while you're away.",
      "Security levels for your PCs (Settings > Account): Password only, Balanced, Strict or Maximum. Lowering the level needs your two-step code.",
      "The relay for strict networks (school, work) now really works: live video instead of pictures. Settings > Account > Test relay checks it.",
      "Pictures mode no longer jams slow networks.",
      "The New chat button stays readable in dark themes.",
    ],
  },
  {
    version: "0.6.54",
    date: "October 28, 2026",
    items: [
      "Remote control on strict networks (schools, work, hotels): live video waits longer for the relay route and retries through the relay only, instead of falling back to pictures.",
      "Pictures mode is quicker when live video can't connect.",
      "Settings > Account > Test relay checks the relay in one tap and says why if it isn't working.",
      "Send and download files up to 25 MB with remote control.",
      "Hands-free Talk in the desktop app with an OpenAI or Groq key.",
      "Press the up arrow in an empty message box to edit your last message.",
    ],
  },
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
