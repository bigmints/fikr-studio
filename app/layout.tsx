import type { Metadata } from "next";
import { Geist, Geist_Mono, Vazirmatn } from "next/font/google";
import Script from "next/script";
import { MobileWall } from "@/components/mobile-wall";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
//   preload: false,
// });

// removed next/font/google due to relative assetPrefix conflict in Electron
// using standard stylesheet links below instead

export const metadata: Metadata = {
  title: "Fikr Studio",
  description:
    "A spatial research tool where AI augments your thinking — not replaces it.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "Fikr Studio",
    description:
      "A spatial research tool where AI augments your thinking — not replaces it.",
    url: "https://Fikr Studio.space",
    siteName: "Fikr Studio",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fikr Studio",
    description:
      "A spatial research tool where AI augments your thinking — not replaces it.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&family=Vazirmatn:wght@100..900&display=swap" rel="stylesheet" />
      </head>
      <body
        className="font-sans antialiased"
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <MobileWall />
          {children}
          {/* Umami analytics — Fikr Studio.space only. Remove or replace with your
              own data-website-id if self-hosting. Safe to delete entirely. */}
          <Script
            src="https://cloud.umami.is/script.js"
            data-website-id="e292316e-48ff-4e1b-ac45-353ea9783dea"
            strategy="afterInteractive"
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
