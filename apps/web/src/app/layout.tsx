import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { RegisterSW } from "@/components/register-sw";
import { ThemeProvider } from "@/components/theme";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = { themeColor: "#0f1736" };

export const metadata: Metadata = {
  metadataBase: new URL("https://moonlightc.vercel.app"),
  appleWebApp: { capable: true, title: "MoonlightC", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  title: "MoonlightC",
  description: "Every AI in one place: cloud models, local models, creative tools and your own computers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <Toaster position="top-center" />
          <RegisterSW />
        </ThemeProvider>
      </body>
    </html>
  );
}
