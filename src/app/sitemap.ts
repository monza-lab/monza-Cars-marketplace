import type { MetadataRoute } from "next"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://monzalab.com"

const LOCALES = ["en", "es", "de", "ja"]

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

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = []

  // Static routes per locale
  for (const locale of LOCALES) {
    for (const route of STATIC_ROUTES) {
      entries.push({
        url: `${BASE_URL}/${locale}${route}`,
        lastModified: new Date(),
        changeFrequency: route === "" ? "daily" : "weekly",
        priority: route === "" ? 1.0 : 0.8,
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
      })
    }
  }

  return entries
}
