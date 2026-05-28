alter table public.listings
  add column if not exists enrichment_meta jsonb not null default '{}'::jsonb;

create index if not exists listings_source_status_enrichment_meta_gin_idx
  on public.listings using gin (enrichment_meta)
  where status = 'active';
