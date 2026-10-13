import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SignIn } from "@/components/account/sign-in";
import { accountsEnabled } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in · MoonlightC" };

export default function Page() {
  if (!accountsEnabled) notFound();
  return <SignIn />;
}
