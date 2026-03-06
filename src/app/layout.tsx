import type { Metadata } from "next";
import { Cormorant, Karla } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { routing } from "@/i18n/routing";

const cormorant = Cormorant({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["300", "400", "500", "600"],
});

const karla = Karla({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"],
});

import type { Viewport } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://monzalab.com";

export const viewport: Viewport = {
  themeColor: "#FDFBF9",
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Monza Lab | Investment-Grade Automotive Assets",
    template: "%s | Monza Lab",
  },
  description:
    "The intelligent terminal for collector vehicle acquisition and analysis. AI-powered insights for smarter acquisitions.",
  keywords: [
    "car auction",
    "vehicle investment",
    "Bring a Trailer",
    "Cars and Bids",
    "collectible cars",
    "auction analysis",
    "classic cars",
    "Porsche 911",
    "collector car market",
    "porsche investment",
  ],
  openGraph: {
    type: "website",
    siteName: "Monza Lab",
    title: "Monza Lab | Investment-Grade Automotive Assets",
    description:
      "The intelligent terminal for collector vehicle acquisition and analysis. AI-powered insights for smarter acquisitions.",
    locale: "en_US",
    alternateLocale: ["es_ES", "de_DE", "ja_JP"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Monza Lab | Investment-Grade Automotive Assets",
    description:
      "AI-powered collector car investment terminal. Analyze Porsche auctions, track market trends, and make smarter acquisitions.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Monza Lab",
  },
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale?: string }>;
}) {
  const { locale } = await params;
  const lang = routing.locales.includes(
    locale as (typeof routing.locales)[number]
  )
    ? locale
    : routing.defaultLocale;

  return (
    <html lang={lang} className="" suppressHydrationWarning>
      <body
        className={`${cormorant.variable} ${karla.variable} font-sans antialiased bg-background text-foreground noise-overlay`}
      >
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
