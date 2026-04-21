-- 20260421_create_listing_translations.sql
-- AI-generated editorial hook per (listing_id, locale).
-- See docs/superpowers/specs/2026-04-21-ai-listing-rewriter-design.md

create table public.listing_translations (
  listing_id      text         not null,
  locale          text         not null,
  headline        text         not null,
  highlights      jsonb        not null,
  source_hash     text         not null,
  prompt_version  text         not null,
  model           text         not null,
  generated_at    timestamptz  not null default now(),
  primary key (listing_id, locale),
  constraint listing_translations_locale_chk
    check (locale in ('en','es','de','ja')),
  constraint listing_translations_highlights_chk
    check (jsonb_typeof(highlights) = 'array')
);

create index listing_translations_listing_idx
  on public.listing_translations (listing_id);

alter table public.listing_translations enable row level security;

create policy "listing_translations_read_all"
  on public.listing_translations
  for select
  using (true);

-- No insert/update/delete policy: writes only via service-role key (bypasses RLS).
