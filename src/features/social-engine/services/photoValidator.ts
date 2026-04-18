const UNACCEPTABLE_PATH_FRAGMENTS = [
  "/assets/",
  "placeholder",
  "/icons/",
];

export function filterRealPhotoUrls(urls: (string | null | undefined)[] | null | undefined): string[] {
  if (!urls) return [];
  return urls.filter((u): u is string => {
    if (!u || typeof u !== "string") return false;
    if (!u.startsWith("http")) return false;
    const lower = u.toLowerCase();
    if (lower.endsWith(".svg")) return false;
    if (UNACCEPTABLE_PATH_FRAGMENTS.some((f) => lower.includes(f))) return false;
    return true;
  });
}

export interface HeadCheckResult {
  ok: boolean;
  contentLength: number | null;
  contentType: string | null;
}

export async function headCheckPhoto(url: string, signal?: AbortSignal): Promise<HeadCheckResult> {
  try {
    const r = await fetch(url, { method: "HEAD", signal });
    const clRaw = r.headers.get("content-length");
    const contentLength = clRaw ? parseInt(clRaw, 10) : null;
    const contentType = r.headers.get("content-type");
    return {
      ok: r.ok && (contentType?.startsWith("image/") ?? false),
      contentLength,
      contentType,
    };
  } catch {
    return { ok: false, contentLength: null, contentType: null };
  }
}

// Known CDN transform patterns that downsample images. Strip them to (try to)
// reach the original/larger version. If the stripped URL fails, the original
// (smaller) URL is used as fallback.
const DOWNSAMPLE_TRANSFORMS: RegExp[] = [
  /\/\d+x\d+\.\w+$/i,           // AS24: /720x540.webp
  /\?fit=[^&]+(&|$)/i,          // BAT: ?fit=940%2C627
  /\?ar=[^&]+(&|$)/i,           // Classic.com: ?ar=16%3A9
  /\?w=\d+(&|$)/i,
  /\?h=\d+(&|$)/i,
  /\?width=\d+(&|$)/i,
  /\?height=\d+(&|$)/i,
];

export function upscaleUrl(url: string): string {
  let out = url;
  for (const rx of DOWNSAMPLE_TRANSFORMS) out = out.replace(rx, "");
  out = out.replace(/\?$/, "").replace(/[?&]$/, "");
  return out;
}

/** Resolve the best-quality URL for a photo. Prefers the upscaled variant if
 * it passes the minimum byte threshold. Returns null if neither is big enough. */
export async function resolveHighQualityUrl(
  url: string,
  minBytes = 150_000,
): Promise<string | null> {
  const upscaled = upscaleUrl(url);
  const candidates = upscaled === url ? [url] : [upscaled, url];
  for (const candidate of candidates) {
    const check = await headCheckPhoto(candidate).catch(() => null);
    if (check?.ok && (check.contentLength ?? 0) >= minBytes) {
      return candidate;
    }
  }
  return null;
}

/** Return URLs passing the quality threshold (upscaled where possible). */
export async function filterHighQualityPhotos(
  urls: string[],
  minBytes = 150_000,
  maxConcurrent = 8,
): Promise<string[]> {
  const out: (string | null)[] = new Array(urls.length).fill(null);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(maxConcurrent, urls.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= urls.length) break;
      out[i] = await resolveHighQualityUrl(urls[i], minBytes).catch(() => null);
    }
  });
  await Promise.all(workers);
  return out.filter((u): u is string => u !== null);
}
