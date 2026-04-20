import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/seo/siteUrl"

const BASE_URL = getSiteUrl()

const DISALLOW = [
  "/api/",
  "/auth/",
  "/*/account",
  "/*/search-history",
  "/internal/",
]

const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "anthropic-ai",
  "Claude-Web",
  "ClaudeBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "CCBot",
  "cohere-ai",
  "Bytespider",
  "Amazonbot",
  "Applebot-Extended",
]

export default function robots(): MetadataRoute.Robots {
  const aiRules = AI_BOTS.map((userAgent) => ({
    userAgent,
    allow: "/",
    disallow: DISALLOW,
  }))

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW,
      },
      ...aiRules,
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
