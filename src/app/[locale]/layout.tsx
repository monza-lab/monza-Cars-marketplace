import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { ThemeProvider } from "next-themes";
import { ClientHeader } from "@/components/layout/ClientHeader";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { RegionProvider } from "@/lib/RegionContext";
import { CurrencyProvider } from "@/lib/CurrencyContext";
import { MobileBottomNav } from "@/components/mobile";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { AppFooter } from "@/components/layout/AppFooter";
import { OrganizationJsonLd } from "@/components/seo/JsonLd";
import { getSiteUrl } from "@/lib/seo/siteUrl";

// Generate static params for all locales
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Generate metadata based on locale
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const BASE_URL = getSiteUrl();

  const titles: Record<string, string> = {
    en: "MonzaHaus | Collector Car Market Intelligence & Porsche Investment Analysis",
    es: "MonzaHaus | Inteligencia de Mercado de Autos de Colección e Inversión en Porsche",
    de: "MonzaHaus | Sammlerfahrzeug-Marktanalyse & Porsche-Investitionen",
    ja: "MonzaHaus | コレクターカー市場インテリジェンス＆ポルシェ投資分析",
  };

  const descriptions: Record<string, string> = {
    en: "AI-powered collector car intelligence platform. Track Porsche 911, 992, 997 auction results, analyze market trends, and discover investment-grade vehicles from Bring a Trailer, Cars & Bids, and AutoScout24.",
    es: "Plataforma de inteligencia de autos de colección impulsada por IA. Seguimiento de subastas Porsche 911, 992, 997, análisis de tendencias de mercado y descubrimiento de vehículos de inversión.",
    de: "KI-gestützte Sammlerfahrzeug-Plattform. Porsche 911, 992, 997 Auktionsergebnisse verfolgen, Markttrends analysieren und investitionsgeeignete Fahrzeuge entdecken.",
    ja: "AIを活用したコレクターカーインテリジェンス。ポルシェ911、992、997のオークション結果追跡、市場トレンド分析、投資グレード車両の発見。",
  };

  // Build hreflang alternates for all locales
  const languages: Record<string, string> = {};
  for (const loc of ["en", "es", "de", "ja"]) {
    languages[loc] = `${BASE_URL}/${loc}`;
  }

  return {
    title: titles[locale] || titles.en,
    description: descriptions[locale] || descriptions.en,
    alternates: {
      canonical: `${BASE_URL}/${locale}`,
      languages,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate locale
  if (!routing.locales.includes(locale as typeof routing.locales[number])) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  // Get messages for the locale
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <AuthProvider>
          <RegionProvider>
            <CurrencyProvider>
              <OrganizationJsonLd />
              <ClientHeader />
              <main>{children}</main>
              <MobileBottomNav />
              <OnboardingModal />
              <AppFooter />
            </CurrencyProvider>
          </RegionProvider>
        </AuthProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
