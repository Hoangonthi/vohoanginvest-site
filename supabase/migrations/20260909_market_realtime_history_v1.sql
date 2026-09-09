create table if not exists public.market_realtime_history (
  id bigint generated always as identity primary key,
  market_date date not null,
  minute_of_day smallint not null check (minute_of_day between 0 and 1439),
  captured_at timestamptz not null default now(),
  source_updated_at timestamptz,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (market_date, minute_of_day)
);

create index if not exists market_realtime_history_captured_at_idx
  on public.market_realtime_history (captured_at desc);
create index if not exists market_realtime_history_market_date_idx
  on public.market_realtime_history (market_date desc, minute_of_day desc);

alter table public.market_realtime_history enable row level security;

comment on table public.market_realtime_history is 'Minute-level Vietnam market snapshots for realtime interpretation, intraday pace, and same-time historical baselines.';

insert into public.market_realtime_history (market_date, minute_of_day, captured_at, source_updated_at, payload)
select
  (received_at at time zone 'Asia/Ho_Chi_Minh')::date,
  ((extract(hour from received_at at time zone 'Asia/Ho_Chi_Minh')::int * 60) + extract(minute from received_at at time zone 'Asia/Ho_Chi_Minh')::int)::smallint,
  received_at,
  source_updated_at,
  payload
from public.market_realtime_snapshot
where id = 'vietnam'
on conflict (market_date, minute_of_day) do update
set captured_at = excluded.captured_at,
    source_updated_at = excluded.source_updated_at,
    payload = excluded.payload;
