import { requireAdmin } from "@/features/social-engine/auth";
import { DraftRepository } from "@/features/social-engine/repository/draftRepository";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import type { DraftStatus, SocialPostDraft } from "@/features/social-engine/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TABS: { key: DraftStatus; label: string }[] = [
  { key: "pending_review", label: "Pending" },
  { key: "ready", label: "Ready" },
  { key: "published", label: "Published" },
  { key: "discarded", label: "Discarded" },
  { key: "failed", label: "Failed" },
];

type ListingHeader = { id: string; title: string | null; platform: string | null; images: string[] | null };

async function fetchListingHeaders(ids: string[]): Promise<Map<string, ListingHeader>> {
  if (ids.length === 0) return new Map();
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data } = await supa.from("listings")
    .select("id, title, year, make, model, trim, platform, images")
    .in("id", ids);
  return new Map((data ?? []).map((l) => [l.id as string, l as ListingHeader]));
}

function DraftCard({ draft, listing }: { draft: SocialPostDraft; listing: ListingHeader | undefined }) {
  const cover = Array.isArray(listing?.images)
    ? listing!.images.find((u) => typeof u === "string" && u.startsWith("http") && !u.includes("/assets/"))
    : null;
  return (
    <Link href={`/admin/social/${draft.id}`} style={{
      display: "flex", gap: 16, padding: 16, background: "#161113",
      border: "1px solid #2A2226", borderRadius: 10, textDecoration: "none", color: "#E8E2DE",
    }}>
      <div style={{
        width: 120, height: 150,
        backgroundImage: cover ? `url(${cover})` : "none",
        backgroundColor: "#0E0A0C",
        backgroundSize: "cover", backgroundPosition: "center", borderRadius: 6, flexShrink: 0,
      }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "Cormorant, serif", fontWeight: 400, fontSize: 22, lineHeight: 1.2 }}>
            {listing?.title ?? "Unknown listing"}
          </div>
          <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#9A8E88", marginTop: 4 }}>
            {listing?.platform?.replace(/_/g, " ").toLowerCase()}
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#9A8E88" }}>
          <span>Quality: {draft.quality_score}</span>
          <span>Vision: {draft.vision_score}</span>
          <span>Status: {draft.status}</span>
        </div>
      </div>
    </Link>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: DraftStatus }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const tab: DraftStatus = (sp.tab as DraftStatus) ?? "pending_review";

  const repo = new DraftRepository();
  const drafts = await repo.listByStatus(tab, 50);
  const listings = await fetchListingHeaders(drafts.map((d) => d.listing_id));

  return (
    <div style={{
      minHeight: "100vh", background: "#0E0A0C", color: "#E8E2DE", padding: "48px 64px",
      fontFamily: "Karla, sans-serif",
    }}>
      <h1 style={{ fontFamily: "Cormorant, serif", fontWeight: 400, fontSize: 44, marginBottom: 32 }}>
        Social Engine · Drafts
      </h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
        {TABS.map((t) => (
          <Link key={t.key} href={`?tab=${t.key}`} style={{
            padding: "8px 16px", borderRadius: 20, textDecoration: "none",
            background: tab === t.key ? "#7A2E4A" : "transparent",
            border: "1px solid " + (tab === t.key ? "#7A2E4A" : "#2A2226"),
            color: tab === t.key ? "white" : "#9A8E88",
            fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase",
          }}>
            {t.label}
          </Link>
        ))}
      </div>
      {drafts.length === 0 ? (
        <div style={{ color: "#9A8E88", fontSize: 14 }}>No drafts in this state.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 16 }}>
          {drafts.map((d) => <DraftCard key={d.id} draft={d} listing={listings.get(d.listing_id)} />)}
        </div>
      )}
    </div>
  );
}
