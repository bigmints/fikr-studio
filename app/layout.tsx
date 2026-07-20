import type { Metadata } from "next";
import { MobileWall } from "@/components/mobile-wall";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

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
    url: "https://fikr.one/studio",
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
        </ThemeProvider>
      </body>
    </html>
  );
}
