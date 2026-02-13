import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import "./globals.css";
import { routing } from "@/i18n/routing";

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Monza Lab | Investment-Grade Automotive Assets",
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
  ],
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
    <html lang={lang} className="dark">
      <body
        className={`${publicSans.variable} font-sans antialiased bg-background text-foreground noise-overlay`}
      >
        {children}
      </body>
    </html>
  );
}
