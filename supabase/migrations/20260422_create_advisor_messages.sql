create table if not exists public.advisor_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.advisor_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','tool')),
  content text not null,
  tool_calls jsonb,
  tier_classification text check (tier_classification in ('instant','marketplace','deep_research')),
  credits_used integer not null default 0,
  latency_ms integer,
  model text,
  is_superseded boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_advisor_msg_conv on public.advisor_messages(conversation_id, created_at);

alter table public.advisor_messages enable row level security;

-- Select visibility inherits from parent conversation (owner or shared).
create policy "advisor_msg_owner_select"
  on public.advisor_messages
  for select
  using (
    exists (
      select 1 from public.advisor_conversations c
      where c.id = conversation_id
        and (c.user_id = auth.uid() or (c.share_token is not null and c.is_archived = false))
    )
  );

-- Writes only via service role (route handler). No direct client write policy.
