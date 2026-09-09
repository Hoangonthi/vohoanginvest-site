-- Production migration 20260909093659: admin_growth_retention_metrics_v1
create or replace function public.admin_growth_retention_v1(p_days integer default 30)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); d int:=greatest(1,least(coalesce(p_days,30),180));
begin
  if uid is null or not exists(select 1 from public.admin_users a where a.auth_user_id=uid and a.is_active=true and a.role in ('ADMIN','STAFF')) then raise exception 'CRM_ACCESS_DENIED'; end if;
  return jsonb_build_object(
    'window_days',d,
    'sessions',coalesce((with e as(select session_id,tool_code,event_type,(created_at at time zone 'Asia/Ho_Chi_Minh')::date event_date from public.engagement_events where created_at>=now()-(d||' days')::interval),s as(select session_id,count(distinct event_date) active_days,count(distinct tool_code) tools,count(*) events from e group by session_id) select jsonb_build_object('total',count(*),'returning_2d',count(*) filter(where active_days>=2),'returning_3d',count(*) filter(where active_days>=3),'multi_tool',count(*) filter(where tools>=2),'north_star',count(*) filter(where active_days>=3 and tools>=2)) from s),jsonb_build_object('total',0,'returning_2d',0,'returning_3d',0,'multi_tool',0,'north_star',0)),
    'tool_usage',coalesce((select jsonb_agg(x order by uses desc) from(select tool_code,count(*) uses,count(distinct session_id) sessions,count(*) filter(where event_type in('ANALYZE','SAVE','LEAD_SUCCESS','COPY_BRIEF','SHARE','CTA_CLICK')) actions from public.engagement_events where created_at>=now()-(d||' days')::interval group by tool_code order by count(*) desc limit 20)x),'[]'::jsonb),
    'daily',coalesce((select jsonb_agg(x order by event_day) from(select (created_at at time zone 'Asia/Ho_Chi_Minh')::date event_day,count(distinct session_id) sessions,count(distinct session_id) filter(where tool_code='AFTER_SESSION') after_session,count(distinct session_id) filter(where tool_code='WATCHLIST') watchlist,count(distinct session_id) filter(where tool_code='SYSTEM_JOURNAL') journal,count(distinct session_id) filter(where tool_code='MARKET_READER') market_reader from public.engagement_events where created_at>=now()-(d||' days')::interval group by 1 order by 1)x),'[]'::jsonb),
    'conversions',jsonb_build_object(
      'market_leads',(select count(*) from public.market_brief_leads where created_at>=now()-(d||' days')::interval),
      'meetings',(select count(*) from public.meeting_requests where created_at>=now()-(d||' days')::interval),
      'after_session_saved',(select count(*) from public.investor_daily_checkins where created_at>=now()-(d||' days')::interval),
      'watchlist_items',(select count(*) from public.investor_watchlist where created_at>=now()-(d||' days')::interval)
    )
  );
end;$$;
grant execute on function public.admin_growth_retention_v1(integer) to authenticated;
