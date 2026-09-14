-- Bình luận thị trường trực tiếp trong phiên - V1
-- Dữ liệu chỉ được đọc/ghi qua Edge Functions dùng service role.

create table if not exists public.market_live_snapshots (
  id bigint generated always as identity primary key,
  market_date date not null,
  captured_at timestamptz not null,
  source_updated_at timestamptz,
  source text not null default 'amibroker-live',
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists market_live_snapshots_date_time_idx
  on public.market_live_snapshots (market_date, captured_at desc);

create table if not exists public.market_live_events (
  id bigint generated always as identity primary key,
  market_date date not null,
  detected_at timestamptz not null default now(),
  snapshot_id bigint not null references public.market_live_snapshots(id) on delete cascade,
  event_type text not null,
  event_key text not null,
  severity smallint not null default 1 check (severity between 1 and 5),
  tone text not null default 'neutral',
  title text not null,
  facts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists market_live_events_date_time_idx
  on public.market_live_events (market_date, detected_at desc);

create index if not exists market_live_events_dedupe_idx
  on public.market_live_events (market_date, event_type, event_key, detected_at desc);

create table if not exists public.market_live_comments (
  id bigint generated always as identity primary key,
  market_date date not null,
  published_at timestamptz not null default now(),
  event_id bigint unique references public.market_live_events(id) on delete cascade,
  snapshot_id bigint not null references public.market_live_snapshots(id) on delete cascade,
  tone text not null default 'neutral',
  headline text not null,
  body text not null,
  watch_next text,
  evidence jsonb not null default '{}'::jsonb,
  source_mode text not null default 'template-v1',
  created_at timestamptz not null default now()
);

create index if not exists market_live_comments_date_time_idx
  on public.market_live_comments (market_date, published_at desc, id desc);

alter table public.market_live_snapshots enable row level security;
alter table public.market_live_events enable row level security;
alter table public.market_live_comments enable row level security;

-- Không tạo policy anon/authenticated. Service role của Edge Functions bypass RLS.
revoke all on table public.market_live_snapshots from anon, authenticated;
revoke all on table public.market_live_events from anon, authenticated;
revoke all on table public.market_live_comments from anon, authenticated;
