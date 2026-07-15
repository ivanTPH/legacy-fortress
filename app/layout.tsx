import type { Metadata } from "next";
import UatEnvironmentBanner from "../components/internal/UatEnvironmentBanner";
import TestPersonaBanner from "../components/internal/TestPersonaBanner";
import { getRobotsPolicy } from "../lib/environment/appEnvironment";
import "./globals.css";

export const metadata: Metadata = {
  title: "Legacy Fortress",
  description: "Estate and executor vault for personal, financial, legal, and digital records.",
  icons: {
    icon: [
      { url: "/brand/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/logo.png", sizes: "1024x1024", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/brand/favicon.png"],
  },
  robots: getRobotsPolicy(),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <UatEnvironmentBanner />
        {children}
        <TestPersonaBanner />
      </body>
    </html>
  );
}
