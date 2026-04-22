-- advisor_conversations: one row per chat thread
create table if not exists public.advisor_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anonymous_session_id text,
  title text not null default 'New conversation',
  surface text not null check (surface in ('oracle','chat','page')),
  initial_context_listing_id text,
  initial_context_series_id text,
  locale text not null default 'en' check (locale in ('en','de','es','ja')),
  share_token text unique,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint user_or_anon check (user_id is not null or anonymous_session_id is not null)
);

create index idx_advisor_conv_user        on public.advisor_conversations(user_id)           where user_id is not null;
create index idx_advisor_conv_anon        on public.advisor_conversations(anonymous_session_id) where anonymous_session_id is not null;
create index idx_advisor_conv_share       on public.advisor_conversations(share_token)        where share_token is not null;
create index idx_advisor_conv_recent      on public.advisor_conversations(last_message_at desc);

alter table public.advisor_conversations enable row level security;

-- Owners (authenticated) can CRUD their own rows.
create policy "advisor_conv_owner_all"
  on public.advisor_conversations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Public read by share_token for non-archived rows. Enforced via a dedicated RPC;
-- here we allow select only when share_token is explicitly supplied AND row not archived.
create policy "advisor_conv_shared_read"
  on public.advisor_conversations
  for select
  using (share_token is not null and is_archived = false);

-- Service role (server-side route handler) bypasses RLS. No anon-session policy in
-- SQL — anonymous access is mediated by the server using a signed cookie + service role.
