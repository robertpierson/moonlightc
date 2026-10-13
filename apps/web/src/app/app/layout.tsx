import type { Metadata } from "next";

export const metadata: Metadata = { title: "Chat · MoonlightC" };

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return children;
}
