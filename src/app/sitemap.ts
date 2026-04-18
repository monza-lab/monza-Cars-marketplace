import type { MetadataRoute } from "next"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://monzalab.com"

const LOCALES = ["en", "es", "de", "ja"] as const

const STATIC_ROUTES = [
  "",            // homepage
  "/pricing",
  "/search",
]

const PORSCHE_SERIES = [
  "992", "991", "997", "996", "993", "964", "930",
  "718-cayman", "718-boxster",
  "cayenne", "macan", "panamera", "taycan",
]

/** Build alternates map for a given path across all locales */
function buildAlternates(path: string) {
  const languages: Record<string, string> = {}
  for (const locale of LOCALES) {
    languages[locale] = `${BASE_URL}/${locale}${path}`
  }
  languages["x-default"] = `${BASE_URL}/en${path}`
  return { languages }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = []

  // Static routes with hreflang alternates
  for (const locale of LOCALES) {
    for (const route of STATIC_ROUTES) {
      entries.push({
        url: `${BASE_URL}/${locale}${route}`,
        lastModified: new Date(),
        changeFrequency: route === "" ? "daily" : "weekly",
        priority: route === "" ? 1.0 : 0.8,
        alternates: buildAlternates(route),
      })
    }
  }

  // Porsche make page per locale
  for (const locale of LOCALES) {
    entries.push({
      url: `${BASE_URL}/${locale}/cars/porsche`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
      alternates: buildAlternates("/cars/porsche"),
    })
  }

  // Series-level deep links (e.g. /en/cars/porsche?series=992)
  for (const locale of LOCALES) {
    for (const series of PORSCHE_SERIES) {
      entries.push({
        url: `${BASE_URL}/${locale}/cars/porsche?series=${series}`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.7,
        alternates: buildAlternates(`/cars/porsche?series=${series}`),
      })
    }
  }

  // MonzaHaus Index pages
  for (const locale of LOCALES) {
    entries.push({
      url: `${BASE_URL}/${locale}/index/air-cooled-911`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: buildAlternates("/index/air-cooled-911"),
    })
  }

  return entries
}
