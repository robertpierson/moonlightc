import type { Metadata } from "next";
import { Handoff } from "./handoff";

export const metadata: Metadata = { title: "Back to MoonlightC", robots: { index: false } };

// The desktop app's OpenRouter sign-in lands here in the browser, which passes the code back to the app.
export default function Page() {
  return <Handoff />;
}
