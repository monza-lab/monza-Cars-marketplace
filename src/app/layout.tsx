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
    default: "MonzaHaus | Investment-Grade Automotive Assets",
    template: "%s | MonzaHaus",
  },
  description:
    "AI-powered collector car intelligence platform. Track Porsche 911, 992, 997 auction results from Bring a Trailer, Cars & Bids, and AutoScout24. Analyze market trends and discover investment-grade collector vehicles.",
  keywords: [
    "collector car market intelligence",
    "Porsche 911 auction results",
    "Porsche 992 investment",
    "Porsche 997 market analysis",
    "Bring a Trailer auction data",
    "Cars and Bids results",
    "AutoScout24 Porsche",
    "classic car investment",
    "collector vehicle analysis",
    "car auction tracker",
    "Porsche market trends",
    "investment grade cars",
    "collectible Porsche prices",
    "MonzaHaus",
  ],
  alternates: {
    canonical: BASE_URL,
    languages: {
      en: `${BASE_URL}/en`,
      es: `${BASE_URL}/es`,
      de: `${BASE_URL}/de`,
      ja: `${BASE_URL}/ja`,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    siteName: "MonzaHaus",
    title: "MonzaHaus | Collector Car Market Intelligence & Porsche Investment Analysis",
    description:
      "Track Porsche 911, 992, 997 auction results. AI-powered market intelligence from Bring a Trailer, Cars & Bids, and AutoScout24. Discover investment-grade collector vehicles.",
    locale: "en_US",
    alternateLocale: ["es_ES", "de_DE", "ja_JP"],
    images: [
      {
        url: "/og-image.png",
        width: 2400,
        height: 1260,
        alt: "MonzaHaus — AI-powered collector car market intelligence platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MonzaHaus | Collector Car Market Intelligence",
    description:
      "Track Porsche 911 auction results, analyze collector car market trends, and discover investment-grade vehicles. AI-powered intelligence from BaT, C&B, and AutoScout24.",
    images: ["/og-image.png"],
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
    title: "MonzaHaus",
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
