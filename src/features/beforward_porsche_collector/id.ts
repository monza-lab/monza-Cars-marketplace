import crypto from "node:crypto";

export function canonicalizeUrl(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://www.beforward.jp${url}`);
    u.hash = "";
    for (const key of Array.from(u.searchParams.keys())) {
      if (/^utm_/i.test(key) || key === "ref" || key === "fbclid") {
        u.searchParams.delete(key);
      }
    }
    return u.toString();
  } catch {
    return url;
  }
}

export function deriveSourceId(input: { refNo?: string | null; sourceUrl: string }): string {
  const refNo = (input.refNo ?? "").trim().toUpperCase();
  if (refNo) return `bf-${refNo}`;

  const url = canonicalizeUrl(input.sourceUrl);
  const urlMatch = url.toLowerCase().match(/\/id\/(\d+)\/?$/);
  if (urlMatch) return `bf-id-${urlMatch[1]}`;

  const hash = crypto.createHash("sha256").update(url).digest("hex").slice(0, 24);
  return `bf-${hash}`;
}
