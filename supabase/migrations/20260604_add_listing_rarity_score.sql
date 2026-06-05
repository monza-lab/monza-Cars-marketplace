alter table public.listings
  add column if not exists rarity_score smallint,
  add column if not exists rarity_tier text,
  add column if not exists rarity_signals_json jsonb,
  add column if not exists rarity_scored_at timestamptz,
  add column if not exists rarity_score_version text;

create index if not exists listings_porsche_active_rarity_idx
  on public.listings (rarity_score desc nulls last, end_time asc nulls last, id desc)
  where make = 'Porsche' and status = 'active';
