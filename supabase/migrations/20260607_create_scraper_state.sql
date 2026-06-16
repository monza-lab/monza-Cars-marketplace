create table if not exists scraper_state (
  scraper_name text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
