export type MarketplaceView = "monza" | "classic";

const STORAGE_KEY = "monza-preferred-view";

export function getPreferredView(): MarketplaceView | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "monza" || value === "classic" ? value : null;
  } catch {
    return null;
  }
}

export function setPreferredView(view: MarketplaceView): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, view);
  } catch {}
}
