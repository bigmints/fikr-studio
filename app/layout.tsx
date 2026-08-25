import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const bundledFontFaces = `
  @font-face {
    font-family: "Inter";
    font-style: normal;
    font-weight: 100 900;
    font-display: swap;
    src: url("fonts/inter-latin-variable.woff2") format("woff2");
  }
  @font-face {
    font-family: "Source Serif 4";
    font-style: normal;
    font-weight: 200 900;
    font-display: swap;
    src: url("fonts/source-serif-4-latin-variable.woff2") format("woff2");
  }
  @font-face {
    font-family: "JetBrains Mono";
    font-style: normal;
    font-weight: 100 800;
    font-display: swap;
    src: url("fonts/jetbrains-mono-latin-variable.woff2") format("woff2");
  }
`;

export const metadata: Metadata = {
  title: "Fikr Studio",
  description:
    "Ask, understand, and create from your knowledge.",
  openGraph: {
    title: "Fikr",
    description:
      "Ask, understand, and create from your knowledge.",
    url: "https://fikr.one",
    siteName: "Fikr",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fikr",
    description:
      "Ask, understand, and create from your knowledge.",
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
        <link rel="icon" href="icon.svg" type="image/svg+xml" />
        <style>{bundledFontFaces}</style>
      </head>
      <body
        className="font-sans antialiased"
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
