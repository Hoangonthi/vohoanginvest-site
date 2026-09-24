-- News 24h precomputed ranking cache v2
-- Production-applied on 2026-09-24. Keeps the public page fast while all 26h events compete for Top 300.
create table if not exists public.news_24h_feed_cache (
  event_id uuid primary key references public.news_intelligence_events(id) on delete cascade,
  last_seen_at timestamptz not null,
  priority_score integer not null default 0,
  cached_at timestamptz not null default now()
);
create index if not exists news_24h_feed_cache_rank_idx
  on public.news_24h_feed_cache(priority_score desc,last_seen_at desc);
alter table public.news_24h_feed_cache enable row level security;
revoke all on public.news_24h_feed_cache from anon, authenticated;
grant select,insert,update,delete on public.news_24h_feed_cache to service_role;

create or replace function public.refresh_news_24h_feed_cache() returns integer
language plpgsql security definer set search_path=public as $$
declare n integer;
begin
  truncate table public.news_24h_feed_cache;
  insert into public.news_24h_feed_cache(event_id,last_seen_at,priority_score,cached_at)
  select e.id,e.last_seen_at,
    greatest(0,least(140,
      case upper(coalesce(e.event_type,'OTHER'))
        when 'MARKET' then 82 when 'POLICY' then 82 when 'FED_RATES' then 80
        when 'FX' then 78 when 'FOREIGN_FLOW' then 78 when 'MARGIN' then 76
        when 'ETF' then 72 when 'BOND_YIELD' then 70 when 'INFLATION' then 70
        when 'COMMODITY' then 64 when 'EARNINGS' then 62 when 'CAPITAL' then 58
        when 'DIVIDEND' then 50 when 'INSIDER' then 48 else 42 end
      + case when coalesce(array_length(e.primary_tickers,1),0)>0 then 28 else 0 end
      + round(coalesce(e.impact_score,0)*0.14)::int
      + round(coalesce(e.action_relevance_score,0)*0.12)::int
      + round(coalesce(e.confidence_score,0)*0.06)::int
      + case when coalesce(e.independent_source_count,0)>=2 then 4 else 0 end
      - case when now()-e.last_seen_at<=interval '2 hours' then 0
             when now()-e.last_seen_at<=interval '6 hours' then 3
             when now()-e.last_seen_at<=interval '12 hours' then 7
             when now()-e.last_seen_at<=interval '18 hours' then 12 else 18 end
      - case when upper(coalesce(e.event_type,'')) in ('INSIDER','DIVIDEND','CAPITAL')
                  and now()-e.last_seen_at>interval '12 hours' then 6 else 0 end
    ))::int, now()
  from public.news_intelligence_events e
  where e.status='ACTIVE' and e.last_seen_at>=now()-interval '26 hours';
  get diagnostics n=row_count;
  return n;
end $$;
revoke all on function public.refresh_news_24h_feed_cache() from public,anon,authenticated;
grant execute on function public.refresh_news_24h_feed_cache() to service_role;
