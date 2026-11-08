import { SiteLight } from "@/components/site/site-light";

/** The public website: always light, never themed. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteLight />
      {children}
    </>
  );
}
