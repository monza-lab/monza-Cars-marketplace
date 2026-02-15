import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Header } from "@/components/layout/Header";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { RegionProvider } from "@/lib/RegionContext";
import { MobileBottomNav } from "@/components/mobile";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";

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

  const titles: Record<string, string> = {
    en: "Monza Lab | Investment-Grade Automotive Assets",
    es: "Monza Lab | Activos Automotrices de Inversión",
    de: "Monza Lab | Investitionsfähige Automobilwerte",
    ja: "Monza Lab | 投資級自動車資産",
  };

  const descriptions: Record<string, string> = {
    en: "The intelligent terminal for collector vehicle acquisition and analysis. AI-powered insights for smarter acquisitions.",
    es: "La terminal inteligente para la adquisición y análisis de vehículos de colección. Insights impulsados por IA.",
    de: "Das intelligente Terminal für die Akquisition und Analyse von Sammlerfahrzeugen. KI-gestützte Erkenntnisse.",
    ja: "コレクター車両の取得と分析のためのインテリジェントターミナル。AI駆動のインサイト。",
  };

  return {
    title: titles[locale] || titles.en,
    description: descriptions[locale] || descriptions.en,
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
      <AuthProvider>
        <RegionProvider>
          <Header />
          <main>{children}</main>
          <MobileBottomNav />
          <OnboardingModal />
        </RegionProvider>
      </AuthProvider>
    </NextIntlClientProvider>
  );
}
