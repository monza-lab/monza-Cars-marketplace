-- Migration: Create social_post_drafts for the MonzaHaus Social Engine
-- One draft per listing; tracks quality scores, generated images, caption, publish IDs.

create table if not exists social_post_drafts (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  status text not null default 'pending_review'
    check (status in ('pending_review','generating','ready','approved','publishing','published','discarded','failed')),
    -- pending_review | generating | ready | approved | publishing | published | discarded | failed
  quality_score int,
  vision_score int,
  vision_notes text,
  selected_photo_indices int[],
  generated_slide_urls text[],
  caption_draft text,
  caption_final text,
  hashtags text[],
  fb_post_id text,
  ig_post_id text,
  ig_creation_id text,
  published_at timestamptz,
  reviewed_at timestamptz,
  discarded_reason text,
  error_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id)
);

create index if not exists idx_social_drafts_status on social_post_drafts(status);
create index if not exists idx_social_drafts_created on social_post_drafts(created_at desc);

-- Trigger to auto-update updated_at on row change
create or replace function set_social_drafts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_social_drafts_updated_at on social_post_drafts;
create trigger trg_social_drafts_updated_at
before update on social_post_drafts
for each row execute function set_social_drafts_updated_at();
