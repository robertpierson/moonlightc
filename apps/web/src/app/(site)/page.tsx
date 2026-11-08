import { SITE_VIEWPORT } from "@/components/site/chrome";
import { Landing } from "@/components/site/landing";
import { getLatestRelease } from "@/lib/releases";

export const viewport = SITE_VIEWPORT;

export default async function Home() {
  return <Landing release={await getLatestRelease()} />;
}
