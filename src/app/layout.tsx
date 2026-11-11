import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { DateFilterProvider } from "@/components/providers/DateFilterProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { GitHubPagesClientApi } from "@/components/providers/GitHubPagesClientApi";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "AdSpend Pro - Facebook Ads & Profit Management PWA",
  description: "Personal Facebook Ads expense tracking, product-wise sales revenue, and real-time net profit analytics.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AdSpend Pro",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="antialiased selection:bg-primary/20 selection:text-primary">
        <ThemeProvider>
          <DateFilterProvider>
            <ToastProvider>
              <GitHubPagesClientApi />
              <AppShell>{children}</AppShell>
            </ToastProvider>
          </DateFilterProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
