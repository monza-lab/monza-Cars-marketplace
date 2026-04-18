import { NextRequest, NextResponse } from "next/server";
import { DraftRepository } from "@/features/social-engine/repository/draftRepository";
import { renderCarousel } from "@/features/social-engine/services/carouselRenderer";
import { generateCaption } from "@/features/social-engine/services/captionGenerator";
import { fetchComparablesSummary } from "@/features/social-engine/services/comparablesService";
import { filterRealPhotoUrls } from "@/features/social-engine/services/photoValidator";
import { createClient } from "@supabase/supabase-js";
import { extractSeries, getSeriesThesis } from "@/lib/brandConfig";
import type { ListingRow } from "@/features/social-engine/types";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min

function assertAdmin(req: NextRequest) {
  const token = req.headers.get("x-admin-token");
  if (!token || token !== process.env.ADMIN_DASHBOARD_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ draftId: string }> }) {
  const authFail = assertAdmin(req);
  if (authFail) return authFail;

  const { draftId } = await ctx.params;
  const repo = new DraftRepository();
  const draft = await repo.findById(draftId);
  if (!draft) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    await repo.updateStatus(draftId, "generating");

    const supa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { data: listing } = await supa.from("listings").select("*").eq("id", draft.listing_id).single();
    if (!listing) {
      await repo.appendError(draftId, { at: new Date().toISOString(), component: "generator", message: "listing not found" });
      return NextResponse.json({ error: "listing_not_found" }, { status: 404 });
    }

    const typed = listing as ListingRow;
    const photos = filterRealPhotoUrls(typed.images ?? []);
    if (photos.length < 4) {
      const msg = `not enough valid photos: ${photos.length}`;
      await repo.appendError(draftId, { at: new Date().toISOString(), component: "generator", message: msg });
      return NextResponse.json({ error: msg }, { status: 422 });
    }

    const comps = await fetchComparablesSummary(typed).catch(() => null);

    let thesis = "A collector-grade example worth close examination.";
    if (typed.make === "Porsche" && typed.model && typed.year) {
      const series = extractSeries(typed.model, typed.year, typed.make);
      if (series) {
        const t = getSeriesThesis(series, typed.make);
        if (t) thesis = t;
      }
    }

    const caption = await generateCaption(typed, comps, thesis);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? `http://localhost:3000`;
    const slideUrls = await renderCarousel(draftId, baseUrl);

    await repo.updateGeneration(draftId, slideUrls, caption.caption, caption.hashtags);

    return NextResponse.json({ ok: true, slideUrls, caption });
  } catch (err) {
    const message = (err as Error).message;
    await repo.appendError(draftId, {
      at: new Date().toISOString(),
      component: "generator", message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
