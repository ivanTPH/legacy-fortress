import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Legacy Fortress",
  description: "Estate and executor vault for personal, financial, legal, and digital records.",
  icons: {
    icon: [
      { url: "/brand/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/logo.png", sizes: "1024x1024", type: "image/png" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/brand/favicon.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
  <link
    rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined"
  />
</head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
