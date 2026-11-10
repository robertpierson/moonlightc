import type { MetadataRoute } from "next";
import { PAGES } from "@/components/site/pages";

const SITE = "https://moonlightc.vercel.app";

/** The public pages, for search engines. The app itself (/app) is not listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [...PAGES.map(([path]) => path), "/learn", "/questions", "/privacy", "/terms"].map((path) => ({ url: SITE + (path === "/" ? "" : path) }));
}
