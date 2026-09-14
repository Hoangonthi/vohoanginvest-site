-- VÕ HOÀNG - Market Live local-first V2
-- Cloud chỉ giữ trạng thái hiện tại + snapshot thưa + event/comment.

create table if not exists public.market_live_current (
  id text primary key,
  market_date date not null,
  captured_at timestamptz not null,
  source_updated_at timestamptz null,
  source text not null default 'amibroker-live',
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.market_live_current enable row level security;

revoke all on table public.market_live_current from anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and indexname='market_live_current_market_date_idx'
  ) then
    create index market_live_current_market_date_idx
      on public.market_live_current (market_date desc, captured_at desc);
  end if;
end $$;

-- Hỗ trợ truy vấn lịch sử thưa và cooldown event nhanh hơn.
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and indexname='market_live_snapshots_date_captured_idx'
  ) then
    create index market_live_snapshots_date_captured_idx
      on public.market_live_snapshots (market_date desc, captured_at desc);
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and indexname='market_live_events_date_key_detected_idx'
  ) then
    create index market_live_events_date_key_detected_idx
      on public.market_live_events (market_date desc, event_key, detected_at desc);
  end if;
end $$;
