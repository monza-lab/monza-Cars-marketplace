import { fetchGate1Candidates, computeQualityScore } from "../services/listingSelector";
import { filterRealPhotoUrls, headCheckPhoto } from "../services/photoValidator";
import { scorePhotos } from "../services/visionScorer";
import { DraftRepository } from "../repository/draftRepository";
import { GATE_1, GATE_2, WORKER } from "../config";

export interface WorkerResult {
  candidates: number;
  afterGate1: number;
  afterGate2: number;
  draftsCreated: number;
  errors: { listing_id: string; stage: string; message: string }[];
}

function log(component: string, event: string, details: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ component, event, ...details }));
}

export async function runWorker(
  repo: DraftRepository = new DraftRepository(),
): Promise<WorkerResult> {
  const result: WorkerResult = {
    candidates: 0,
    afterGate1: 0,
    afterGate2: 0,
    draftsCreated: 0,
    errors: [],
  };

  log("worker", "started");
  const candidates = await fetchGate1Candidates();
  result.candidates = candidates.length;
  log("worker", "gate1_complete", { count: candidates.length });

  for (const listing of candidates) {
    if (result.draftsCreated >= WORKER.maxDraftsPerRun) break;

    const realPhotos = filterRealPhotoUrls(listing.images ?? []);
    if (realPhotos.length < GATE_1.minPhotosCount) {
      log("worker", "drop_not_enough_real_photos", { listing_id: listing.id, real: realPhotos.length });
      continue;
    }

    const head = await headCheckPhoto(realPhotos[0]).catch(() => null);
    if (!head?.ok || (head.contentLength ?? 0) < GATE_1.minImageBytes) {
      log("worker", "drop_head_check_failed", {
        listing_id: listing.id,
        contentLength: head?.contentLength ?? null,
      });
      continue;
    }
    result.afterGate1 += 1;

    let vision;
    try {
      vision = await scorePhotos(realPhotos);
    } catch (err) {
      const message = (err as Error).message;
      log("worker", "vision_error", { listing_id: listing.id, message });
      result.errors.push({ listing_id: listing.id, stage: "vision", message });
      continue;
    }

    if (vision.score < GATE_2.visionThreshold) {
      log("worker", "drop_vision_below_threshold", {
        listing_id: listing.id, vision_score: vision.score,
      });
      continue;
    }
    result.afterGate2 += 1;

    try {
      await repo.create({
        listing_id: listing.id,
        quality_score: computeQualityScore(listing),
        vision_score: vision.score,
        vision_notes: vision.reasons.join(" · "),
        selected_photo_indices: vision.recommended_indices,
      });
      result.draftsCreated += 1;
      log("worker", "draft_created", { listing_id: listing.id, vision_score: vision.score });
    } catch (err) {
      const message = (err as Error).message;
      log("worker", "draft_insert_error", { listing_id: listing.id, message });
      result.errors.push({ listing_id: listing.id, stage: "insert", message });
    }
  }

  log("worker", "completed", { ...result });
  return result;
}
