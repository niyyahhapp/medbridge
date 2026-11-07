import type { Metadata, Viewport } from "next";
// Fonts are served from our own site, so loading the page sends nothing to Google.
import "@fontsource-variable/inter/index.css";
import "@fontsource-variable/newsreader/opsz.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedBridge",
  description: "Understand your medical report in plain language, with real research from PubMed.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
