import type { Metadata } from "next";
import { SearchClient } from "./SearchClient";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });

  return {
    title: t("search.meta.title"),
    description: t("search.meta.description"),
  };
}

export default function SearchPage() {
  return (
    <div className="flex flex-col h-screen pt-[100px] bg-[#0b0b10]">
      <SearchClient />
    </div>
  );
}
