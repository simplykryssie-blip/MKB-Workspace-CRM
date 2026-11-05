import type { Metadata, Viewport } from "next";
import { themeInitScript } from "@/components/layout/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "MKB Business Suite", template: "%s · MKB Business Suite" },
  description: "MKB Financial Group — staff dashboard and client portal (design preview).",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1222" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
