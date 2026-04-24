import type { Metadata } from 'next'
import { Geist, Geist_Mono, Vazirmatn } from 'next/font/google'
import Script from 'next/script'
import { MobileWall } from '@/components/mobile-wall'
import './globals.css'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: 'FikrPad',
  description: 'A spatial research tool where AI augments your thinking — not replaces it.',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'FikrPad',
    description: 'A spatial research tool where AI augments your thinking — not replaces it.',
    url: 'https://FikrPad.space',
    siteName: 'FikrPad',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FikrPad',
    description: 'A spatial research tool where AI augments your thinking — not replaces it.',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${vazirmatn.variable} font-sans antialiased`} suppressHydrationWarning>
        <MobileWall />
        {children}
        {/* Umami analytics — FikrPad.space only. Remove or replace with your
            own data-website-id if self-hosting. Safe to delete entirely. */}
        <Script
          src="https://cloud.umami.is/script.js"
          data-website-id="334833bb-9911-4ddb-b3f2-6df25795cd0e"
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
