import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { SocialPostDraft, DraftStatus, ErrorLogEntry } from "../types";

function makeClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE env vars for social-engine");
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export interface CreateDraftInput {
  listing_id: string;
  quality_score: number;
  vision_score: number;
  vision_notes: string;
  selected_photo_indices: number[];
}

export class DraftRepository {
  constructor(private readonly client: SupabaseClient = makeClient()) {}

  async findByListingId(listing_id: string): Promise<SocialPostDraft | null> {
    const { data, error } = await this.client
      .from("social_post_drafts")
      .select("*")
      .eq("listing_id", listing_id)
      .maybeSingle();
    if (error) throw error;
    return (data as SocialPostDraft) ?? null;
  }

  async findById(id: string): Promise<SocialPostDraft | null> {
    const { data, error } = await this.client
      .from("social_post_drafts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as SocialPostDraft) ?? null;
  }

  async listByStatus(status: DraftStatus, limit = 50): Promise<SocialPostDraft[]> {
    const { data, error } = await this.client
      .from("social_post_drafts")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as SocialPostDraft[];
  }

  async create(input: CreateDraftInput): Promise<SocialPostDraft> {
    const { data, error } = await this.client
      .from("social_post_drafts")
      .insert({
        listing_id: input.listing_id,
        status: "pending_review",
        quality_score: input.quality_score,
        vision_score: input.vision_score,
        vision_notes: input.vision_notes,
        selected_photo_indices: input.selected_photo_indices,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as SocialPostDraft;
  }

  async updateStatus(id: string, status: DraftStatus): Promise<void> {
    const { error } = await this.client
      .from("social_post_drafts")
      .update({ status })
      .eq("id", id);
    if (error) throw error;
  }

  async updateGeneration(
    id: string,
    slide_urls: string[],
    caption_draft: string,
    hashtags: string[],
  ): Promise<void> {
    const { error } = await this.client
      .from("social_post_drafts")
      .update({
        generated_slide_urls: slide_urls,
        caption_draft,
        hashtags,
        status: "ready",
      })
      .eq("id", id);
    if (error) throw error;
  }

  async updatePublished(
    id: string,
    ig_post_id: string,
    fb_post_id: string,
    ig_creation_id: string,
    caption_final: string,
  ): Promise<void> {
    const { error } = await this.client
      .from("social_post_drafts")
      .update({
        status: "published",
        ig_post_id,
        fb_post_id,
        ig_creation_id,
        caption_final,
        published_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
  }

  async appendError(id: string, entry: ErrorLogEntry): Promise<void> {
    const existing = await this.findById(id);
    const log = (existing?.error_log as ErrorLogEntry[] | null) ?? [];
    log.push(entry);
    const { error } = await this.client
      .from("social_post_drafts")
      .update({ error_log: log, status: "failed" })
      .eq("id", id);
    if (error) throw error;
  }

  async discard(id: string, reason: string): Promise<void> {
    const { error } = await this.client
      .from("social_post_drafts")
      .update({
        status: "discarded",
        discarded_reason: reason,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
  }
}
