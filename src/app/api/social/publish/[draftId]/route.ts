import { NextRequest, NextResponse } from "next/server";
import { DraftRepository } from "@/features/social-engine/repository/draftRepository";
import { publishToMeta } from "@/features/social-engine/services/metaPublisher";
import { createClient } from "@supabase/supabase-js";
import { buildReportUrl } from "@/features/social-engine/services/captionGenerator";
import type { ListingRow } from "@/features/social-engine/types";

export const runtime = "nodejs";
export const maxDuration = 120;

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
  const { caption_final } = (await req.json().catch(() => ({}))) as { caption_final?: string };

  const repo = new DraftRepository();
  const draft = await repo.findById(draftId);
  if (!draft) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!draft.generated_slide_urls || draft.generated_slide_urls.length !== 5) {
    return NextResponse.json({ error: "carousel not ready" }, { status: 422 });
  }
  const caption = caption_final ?? draft.caption_final ?? draft.caption_draft ?? "";
  if (!caption.trim()) return NextResponse.json({ error: "caption is empty" }, { status: 422 });

  const required = ["META_PAGE_ACCESS_TOKEN", "META_PAGE_ID", "META_IG_BUSINESS_ID"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    await repo.appendError(draftId, {
      at: new Date().toISOString(), component: "publisher",
      message: `missing env: ${missing.join(", ")}`,
    });
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  }

  try {
    await repo.updateStatus(draftId, "publishing");

    const supa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { data: listing } = await supa.from("listings").select("*").eq("id", draft.listing_id).single();
    const reportUrl = `https://${buildReportUrl(listing as ListingRow)}`;

    const out = await publishToMeta({
      pageId: process.env.META_PAGE_ID!,
      igBusinessId: process.env.META_IG_BUSINESS_ID!,
      pageAccessToken: process.env.META_PAGE_ACCESS_TOKEN!,
      apiVersion: process.env.META_GRAPH_API_VERSION ?? "v19.0",
      slideUrls: draft.generated_slide_urls,
      caption,
      reportUrl,
    });

    await repo.updatePublished(draftId, out.ig_post_id, out.fb_post_id, out.ig_creation_id, caption);
    return NextResponse.json({ ok: true, ...out });
  } catch (err) {
    const message = (err as Error).message;
    await repo.appendError(draftId, {
      at: new Date().toISOString(), component: "publisher", message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
