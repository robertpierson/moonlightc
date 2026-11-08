import { ThemeProvider } from "@/components/theme";
import { Toaster } from "@/components/ui/sonner";

/** Everything except the public website: themes (dark by default) and toasts. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <ThemeProvider>
      {children}
      <Toaster position="top-center" />
    </ThemeProvider>
  );
}
