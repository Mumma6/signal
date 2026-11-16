import type { Metadata, Viewport } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: "Signal — Stay ahead of AI. Without the noise.", template: "%s — Signal" },
  description:
    "Your considered daily AI briefing. Original source excerpts, recurring themes, and popular open-source projects. No model account required.",
  applicationName: "Signal",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  alternates: { types: { "application/rss+xml": "/feed.xml" } },
  openGraph: {
    type: "website",
    siteName: "Signal",
    title: "Signal — Stay ahead of AI. Without the noise.",
    description: "A little perspective. Every day.",
  },
  twitter: { card: "summary_large_image" },
};
export const viewport: Viewport = { themeColor: "#101112", colorScheme: "dark" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a href="#content" className="skip-link">
          Skip to content
        </a>
        <Header />
        <div id="content" className="min-h-[70vh]">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
