import { DraftRepository } from "@/features/social-engine/repository/draftRepository";
import { createClient } from "@supabase/supabase-js";
import { filterRealPhotoUrls } from "@/features/social-engine/services/photoValidator";
import { fetchComparablesSummary } from "@/features/social-engine/services/comparablesService";
import { getSeriesThesis, extractSeries } from "@/lib/brandConfig";
import { Slide1Cover } from "@/features/social-engine/templates/CarouselV1/Slide1Cover";
import { Slide2Specs } from "@/features/social-engine/templates/CarouselV1/Slide2Specs";
import { Slide3Market } from "@/features/social-engine/templates/CarouselV1/Slide3Market";
import { Slide4Story } from "@/features/social-engine/templates/CarouselV1/Slide4Story";
import { Slide5CTA } from "@/features/social-engine/templates/CarouselV1/Slide5CTA";
import type { SlideData } from "@/features/social-engine/templates/CarouselV1/templateData";
import type { ListingRow } from "@/features/social-engine/types";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function loadSlideData(draftId: string): Promise<SlideData | null> {
  const repo = new DraftRepository();
  const draft = await repo.findById(draftId);
  if (!draft) return null;

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: listing } = await supa.from("listings").select("*").eq("id", draft.listing_id).single();
  if (!listing) return null;

  const typed = listing as ListingRow;
  const photoUrls = filterRealPhotoUrls(typed.images ?? []);
  const comps = await fetchComparablesSummary(typed).catch(() => null);

  let thesis = "A collector-grade example worth close examination.";
  if (typed.make === "Porsche" && typed.model && typed.year) {
    const series = extractSeries(typed.model, typed.year, typed.make);
    if (series) {
      const t = getSeriesThesis(series, typed.make);
      if (t) thesis = t;
    }
  }

  return {
    listing: typed,
    comps,
    thesis,
    photoUrls,
    selectedIndices: draft.selected_photo_indices ?? [0, 1, 2, 3],
  };
}

export default async function Page({ params }: { params: Promise<{ draftId: string; slideIdx: string }> }) {
  const { draftId, slideIdx } = await params;
  const idx = parseInt(slideIdx, 10);
  const data = await loadSlideData(draftId);
  if (!data) notFound();

  switch (idx) {
    case 1: return <Slide1Cover data={data} />;
    case 2: return <Slide2Specs data={data} />;
    case 3: return <Slide3Market data={data} />;
    case 4: return <Slide4Story data={data} />;
    case 5: return <Slide5CTA data={data} />;
    default: notFound();
  }
}
