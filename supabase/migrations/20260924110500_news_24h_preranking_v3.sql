-- News 24h pre-ranking V3: down-rank routine corporate disclosures without deleting them.
alter table public.news_24h_feed_cache add column if not exists content_penalty integer not null default 0;
alter table public.news_24h_feed_cache add column if not exists rank_reason text;

create or replace function public.refresh_news_24h_feed_cache() returns integer
language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 truncate table public.news_24h_feed_cache;
 insert into public.news_24h_feed_cache(event_id,last_seen_at,priority_score,cached_at,content_penalty,rank_reason)
 with scored as (
  select e.*,
   case
    when lower(coalesce(e.event_title,'')) ~ '(thay đổi địa chỉ|giấy chứng nhận đăng ký doanh nghiệp|điều chỉnh thông tin số lượng cổ phiếu đăng ký|thay đổi đăng ký niêm yết|bầu trưởng bks|bầu .*hđqt|chấp thuận thành viên tạo lập thị trường)' then 22
    when lower(coalesce(e.event_title,'')) ~ '(thông báo giao dịch cổ phiếu của người nội bộ|thông báo giao dịch cổ phiếu của tổ chức có liên quan|báo cáo kết quả giao dịch cổ phiếu của người nội bộ|báo cáo kết quả giao dịch cổ phiếu của tổ chức có liên quan)' then 16
    when lower(coalesce(e.event_title,'')) ~ '(công văn của ubcknn|văn bản của ubcknn|tài liệu báo cáo kết quả phát hành cổ phiếu esop)' then 14
    when lower(coalesce(e.event_title,'')) ~ '(nghị quyết hđqt|nghị quyết bks|thông báo về ngày đăng ký cuối cùng)' then 8
    else 0 end routine_penalty
  from public.news_intelligence_events e
  where e.status='ACTIVE' and e.last_seen_at>=now()-interval '26 hours'
 )
 select e.id,e.last_seen_at,
  greatest(0,least(140,
   case upper(coalesce(e.event_type,'OTHER'))
    when 'MARKET' then 82 when 'POLICY' then 82 when 'FED_RATES' then 80 when 'FX' then 78
    when 'FOREIGN_FLOW' then 78 when 'MARGIN' then 76 when 'ETF' then 72 when 'BOND_YIELD' then 70
    when 'INFLATION' then 70 when 'COMMODITY' then 64 when 'EARNINGS' then 62 when 'CAPITAL' then 58
    when 'DIVIDEND' then 50 when 'INSIDER' then 48 else 42 end
   + case when coalesce(array_length(e.primary_tickers,1),0)>0 then 28 else 0 end
   + round(coalesce(e.impact_score,0)*0.14)::int + round(coalesce(e.action_relevance_score,0)*0.12)::int
   + round(coalesce(e.confidence_score,0)*0.06)::int + case when coalesce(e.independent_source_count,0)>=2 then 4 else 0 end
   - case when now()-e.last_seen_at<=interval '2 hours' then 0 when now()-e.last_seen_at<=interval '6 hours' then 3
          when now()-e.last_seen_at<=interval '12 hours' then 7 when now()-e.last_seen_at<=interval '18 hours' then 12 else 18 end
   - case when upper(coalesce(e.event_type,'')) in ('INSIDER','DIVIDEND','CAPITAL') and now()-e.last_seen_at>interval '12 hours' then 6 else 0 end
   - e.routine_penalty
  ))::int,now(),e.routine_penalty,
  case when e.routine_penalty>=14 then 'ROUTINE_DISCLOSURE_DOWNRANK'
       when e.routine_penalty>0 then 'ROUTINE_DISCLOSURE_SOFT_DOWNRANK'
       when upper(coalesce(e.event_type,'')) in ('MARKET','POLICY','FED_RATES','FX','FOREIGN_FLOW','MARGIN') then 'SYSTEM_IMPORTANCE'
       when coalesce(array_length(e.primary_tickers,1),0)>0 then 'DIRECT_TICKER' else 'STANDARD' end
 from scored e;
 get diagnostics n=row_count; return n;
end $$;
revoke all on function public.refresh_news_24h_feed_cache() from public,anon,authenticated;
grant execute on function public.refresh_news_24h_feed_cache() to service_role;
