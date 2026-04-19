import * as cheerio from "cheerio";

function hasAutoTraderMediaPathname(pathname: string): boolean {
  return /\/a\/media\/.+\.(?:jpe?g|png|webp|gif)$/i.test(pathname);
}

export function normalizeAutoTraderImageUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  if (candidate.startsWith("//")) {
    candidate = `https:${candidate}`;
  } else if (!candidate.startsWith("http://") && !candidate.startsWith("https://")) {
    candidate = `https://${candidate}`;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!host.endsWith("atcdn.co.uk")) return null;

  url.pathname = url.pathname
    .replace(/\/(?:\{resize\}|%7Bresize%7D)(?=\/|$)/gi, "")
    .replace(/\/+/g, "/");

  if (!hasAutoTraderMediaPathname(url.pathname)) return null;
  return url.toString();
}

function collectUrlTokens(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0] ?? "")
    .filter(Boolean);
}

export function extractAutoTraderImages(html: string): string[] {
  const $ = cheerio.load(html);
  const images = new Set<string>();

  $("img, source").each((_, el) => {
    const candidates = [
      $(el).attr("src"),
      $(el).attr("data-src"),
      $(el).attr("data-lazy-src"),
      $(el).attr("data-original"),
      $(el).attr("srcset"),
      $(el).attr("data-srcset"),
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;
      for (const token of collectUrlTokens(candidate)) {
        const normalized = normalizeAutoTraderImageUrl(token);
        if (normalized) images.add(normalized);
      }
    }
  });

  $("script").each((_, el) => {
    const text = $(el).text();
    const matches = text.match(/https?:\/\/[^"'`\s]+atcdn\.co\.uk[^"'`\s]*/gi) ?? [];
    for (const match of matches) {
      const normalized = normalizeAutoTraderImageUrl(match);
      if (normalized) images.add(normalized);
    }
  });

  return [...images].slice(0, 20);
}
