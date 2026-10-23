import type { Metadata } from "next";
import { Suspense } from "react";
import { SharedChat } from "./shared-chat";

// Shared chats are for whoever has the link, not for search engines.
export const metadata: Metadata = { title: "Shared chat · MoonlightC", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <SharedChat />
    </Suspense>
  );
}
