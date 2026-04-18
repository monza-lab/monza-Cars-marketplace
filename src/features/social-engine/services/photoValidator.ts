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
