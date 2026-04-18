export type DraftStatus =
  | "pending_review"
  | "generating"
  | "ready"
  | "approved"
  | "publishing"
  | "published"
  | "discarded"
  | "failed";

export interface SocialPostDraft {
  id: string;
  listing_id: string;
  status: DraftStatus;
  quality_score: number | null;
  vision_score: number | null;
  vision_notes: string | null;
  selected_photo_indices: number[] | null;
  generated_slide_urls: string[] | null;
  caption_draft: string | null;
  caption_final: string | null;
  hashtags: string[] | null;
  fb_post_id: string | null;
  ig_post_id: string | null;
  ig_creation_id: string | null;
  published_at: string | null;
  reviewed_at: string | null;
  discarded_reason: string | null;
  error_log: ErrorLogEntry[];
  created_at: string;
  updated_at: string;
}

export interface ErrorLogEntry {
  at: string;
  component: "worker" | "generator" | "publisher";
  message: string;
  details?: unknown;
}

export interface VisionScore {
  score: number;
  reasons: string[];
  best_photo_index: number;
  recommended_indices: number[];
}

export interface CaptionOutput {
  caption: string;
  hashtags: string[];
}

export interface ListingRow {
  id: string;
  title: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  platform: string | null;
  photos_count: number | null;
  data_quality_score: number | null;
  images: string[] | null;
  final_price: number | null;
  current_bid: number | null;
  engine: string | null;
  transmission: string | null;
  mileage: number | null;
  color_exterior: string | null;
  color_interior: string | null;
  location: string | null;
  reserve_status: string | null;
  seller_notes: string | null;
  status: string | null;
  created_at: string;
}

export interface ComparablesSummary {
  avg: number;
  low: number;
  high: number;
  sampleSize: number;
  windowMonths: number;
  thisPrice: number | null;
  deltaPct: number | null;
}
