import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Onboarding } from "@/components/account/onboarding";
import { accountsEnabled } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Welcome · MoonlightC", robots: { index: false } };

export default function Page() {
  if (!accountsEnabled) notFound();
  return <Onboarding />;
}
