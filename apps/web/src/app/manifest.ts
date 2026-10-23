import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MoonlightC",
    short_name: "MoonlightC",
    description: "Every AI in one place, with your own keys.",
    id: "/app",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#0f1736",
    theme_color: "#0f1736",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press (or right-click) the installed app's icon.
    shortcuts: [
      { name: "Remote control my PC", short_name: "Remote control", url: "/app?open=remote", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "New chat", short_name: "New chat", url: "/app", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
