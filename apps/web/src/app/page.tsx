import { Bricolage_Grotesque } from "next/font/google";
import { Landing } from "@/components/site/landing";
import { getLatestRelease } from "@/lib/releases";
import "@/components/site/site.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], axes: ["wdth", "opsz"], variable: "--font-display" });

export default async function Home() {
  const release = await getLatestRelease();
  return (
    <div className={display.variable}>
      <Landing release={release} />
    </div>
  );
}
