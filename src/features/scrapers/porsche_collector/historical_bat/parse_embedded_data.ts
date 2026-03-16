export type BatCompletedItem = {
  id: string | number;
  url?: string;
  title?: string;
  sold_text?: string;
  current_bid?: number;
  currency?: string;
  timestamp_end?: string | number;
  [key: string]: unknown;
};

export type BatCompletedPayload = {
  page_current: number;
  pages_total: number;
  items_total: number;
  items: BatCompletedItem[];
};

function parseJsonScript(html: string): string | null {
  const byId = html.match(/<script[^>]*id=["']bat-theme-auctions-completed-initial-data["'][^>]*>([\s\S]*?)<\/script>/i);
  if (byId?.[1]) {
    const raw = byId[1].trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return raw.slice(start, end + 1);
    }
    return raw;
  }

  const fallback = html.match(/"auctions-completed"[\s\S]*?<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (fallback?.[1]) return fallback[1].trim();
  return null;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function parseCompletedPayload(html: string): BatCompletedPayload {
  const rawJson = parseJsonScript(html);
  if (!rawJson) throw new Error("Missing bat-theme-auctions-completed-initial-data script");

  const parsed = JSON.parse(rawJson) as Record<string, unknown>;
  const items = Array.isArray(parsed.items) ? (parsed.items as BatCompletedItem[]) : [];

  return {
    page_current: toNumber(parsed.page_current, 1),
    pages_total: toNumber(parsed.pages_total, 1),
    items_total: toNumber(parsed.items_total, items.length),
    items,
  };
}
