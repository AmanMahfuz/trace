import type { Metadata } from "next";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SidebarProvider, NavigationSidebar } from "@/design-system/patterns";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trace — Career Diagnostic & Voice Sparring for Freshers",
  description: "Honest odds before applying, ghost-job detection, bullet-level tailoring, and 5-minute voice interview prep.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col font-sans bg-surface-page text-content-primary">
        <ErrorBoundary>
          <SidebarProvider>
            <div className="min-h-screen flex flex-col md:flex-row">
              <NavigationSidebar />
              <div className="flex-1 flex flex-col min-w-0">
                {children}
              </div>
            </div>
          </SidebarProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
