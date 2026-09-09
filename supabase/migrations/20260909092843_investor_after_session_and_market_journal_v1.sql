-- Production migration 20260909092843: investor_after_session_and_market_journal_v1
-- Keeps an auditable Market Score journal and authenticated investor daily-loop data.

create table if not exists public.market_state_journal (
  market_date date not null,
  minute_of_day smallint not null check (minute_of_day between 0 and 1439),
  captured_at timestamptz not null,
  source_updated_at timestamptz,
  score smallint not null check (score between 0 and 100),
  state_code text not null,
  state_label text not null,
  vn_index numeric,
  vn_change_pct numeric,
  adv integer,
  flat integer,
  dec integer,
  breadth_balance numeric,
  value_b numeric,
  leader_symbol text,
  leader_name text,
  leader_change_pct numeric,
  primary key (market_date, minute_of_day)
);
alter table public.market_state_journal enable row level security;
revoke all on public.market_state_journal from anon, authenticated;

create or replace function public.market_state_from_payload_v1(p_payload jsonb)
returns jsonb language plpgsql stable set search_path=public as $$
declare
  v_vn jsonb; v_vn30 jsonb; v_hnx jsonb; v_upcom jsonb; v_leader jsonb;
  v_vn_pct numeric; v_vn30_pct numeric; v_hnx_pct numeric; v_upcom_pct numeric;
  v_adv numeric; v_flat numeric; v_dec numeric; v_total numeric; v_balance numeric;
  v_score numeric:=50; v_secondary numeric; v_state_code text; v_state_label text;
  v_leader_symbol text; v_leader_name text; v_leader_pct numeric;
begin
  select x into v_vn from jsonb_array_elements(coalesce(p_payload->'indexes','[]'::jsonb)) x where x->>'symbol'='VN-INDEX' limit 1;
  select x into v_vn30 from jsonb_array_elements(coalesce(p_payload->'indexes','[]'::jsonb)) x where x->>'symbol'='VN30' limit 1;
  select x into v_hnx from jsonb_array_elements(coalesce(p_payload->'indexes','[]'::jsonb)) x where x->>'symbol'='HNX-INDEX' limit 1;
  select x into v_upcom from jsonb_array_elements(coalesce(p_payload->'indexes','[]'::jsonb)) x where x->>'symbol'='UPCOM-INDEX' limit 1;
  v_vn_pct:=nullif(v_vn->>'change_pct','')::numeric; v_vn30_pct:=nullif(v_vn30->>'change_pct','')::numeric;
  v_hnx_pct:=nullif(v_hnx->>'change_pct','')::numeric; v_upcom_pct:=nullif(v_upcom->>'change_pct','')::numeric;
  v_adv:=nullif(v_vn->>'adv','')::numeric; v_flat:=nullif(v_vn->>'flat','')::numeric; v_dec:=nullif(v_vn->>'dec','')::numeric;
  v_total:=coalesce(v_adv,0)+coalesce(v_flat,0)+coalesce(v_dec,0);
  if v_total>0 then v_balance:=(coalesce(v_adv,0)-coalesce(v_dec,0))/v_total; end if;
  if v_vn_pct is not null then v_score:=v_score+greatest(-2,least(2,v_vn_pct))*7; end if;
  if v_balance is not null then v_score:=v_score+v_balance*28; end if;
  if v_vn30_pct is not null then v_score:=v_score+greatest(-2,least(2,v_vn30_pct))*4; end if;
  if v_hnx_pct is not null and v_upcom_pct is not null then v_secondary:=(v_hnx_pct+v_upcom_pct)/2;
  elsif v_hnx_pct is not null then v_secondary:=v_hnx_pct;
  elsif v_upcom_pct is not null then v_secondary:=v_upcom_pct; end if;
  if v_secondary is not null then v_score:=v_score+greatest(-2,least(2,v_secondary))*3; end if;
  v_score:=round(greatest(0,least(100,v_score)));
  if v_score>=72 then v_state_code:='positive';v_state_label:='TÍCH CỰC';
  elsif v_score>=58 then v_state_code:='constructive';v_state_label:='NGHIÊNG TÍCH CỰC';
  elsif v_score>=46 then v_state_code:='mixed';v_state_label:='PHÂN HÓA';
  elsif v_score>=32 then v_state_code:='cautious';v_state_label:='THẬN TRỌNG';
  else v_state_code:='risk';v_state_label:='RỦI RO CAO'; end if;
  select x into v_leader from jsonb_array_elements(coalesce(p_payload->'indexes','[]'::jsonb)) x
   where x->>'symbol' in ('VNFIN','VNREAL','VNIND','VNIT','VNMAT','VNCONS','VNCOND','VNENE','VNHEAL','VNUTI')
     and nullif(x->>'change_pct','') is not null order by (x->>'change_pct')::numeric desc limit 1;
  v_leader_symbol:=v_leader->>'symbol'; v_leader_pct:=nullif(v_leader->>'change_pct','')::numeric;
  v_leader_name:=case v_leader_symbol when 'VNFIN' then 'Tài chính' when 'VNREAL' then 'Bất động sản' when 'VNIND' then 'Công nghiệp'
    when 'VNIT' then 'Công nghệ thông tin' when 'VNMAT' then 'Nguyên vật liệu' when 'VNCONS' then 'Hàng tiêu dùng thiết yếu'
    when 'VNCOND' then 'Hàng tiêu dùng không thiết yếu' when 'VNENE' then 'Năng lượng' when 'VNHEAL' then 'Y tế'
    when 'VNUTI' then 'Tiện ích' else null end;
  return jsonb_build_object('score',v_score::int,'state_code',v_state_code,'state_label',v_state_label,
    'vn_index',nullif(v_vn->>'value','')::numeric,'vn_change_pct',v_vn_pct,'adv',v_adv::int,'flat',v_flat::int,'dec',v_dec::int,
    'breadth_balance',v_balance,'value_b',coalesce(nullif(v_vn->>'value_b','')::numeric,nullif(v_vn->>'total_value_b','')::numeric),
    'leader_symbol',v_leader_symbol,'leader_name',v_leader_name,'leader_change_pct',v_leader_pct);
end;$$;

create or replace function public.capture_market_state_journal_v1()
returns trigger language plpgsql security definer set search_path=public as $$
declare s jsonb;
begin
  s:=public.market_state_from_payload_v1(new.payload);
  insert into public.market_state_journal(market_date,minute_of_day,captured_at,source_updated_at,score,state_code,state_label,vn_index,vn_change_pct,adv,flat,dec,breadth_balance,value_b,leader_symbol,leader_name,leader_change_pct)
  values(new.market_date,new.minute_of_day,new.captured_at,new.source_updated_at,(s->>'score')::smallint,s->>'state_code',s->>'state_label',nullif(s->>'vn_index','')::numeric,nullif(s->>'vn_change_pct','')::numeric,nullif(s->>'adv','')::int,nullif(s->>'flat','')::int,nullif(s->>'dec','')::int,nullif(s->>'breadth_balance','')::numeric,nullif(s->>'value_b','')::numeric,s->>'leader_symbol',s->>'leader_name',nullif(s->>'leader_change_pct','')::numeric)
  on conflict(market_date,minute_of_day) do update set captured_at=excluded.captured_at,source_updated_at=excluded.source_updated_at,score=excluded.score,state_code=excluded.state_code,state_label=excluded.state_label,vn_index=excluded.vn_index,vn_change_pct=excluded.vn_change_pct,adv=excluded.adv,flat=excluded.flat,dec=excluded.dec,breadth_balance=excluded.breadth_balance,value_b=excluded.value_b,leader_symbol=excluded.leader_symbol,leader_name=excluded.leader_name,leader_change_pct=excluded.leader_change_pct;
  return new;
end;$$;
drop trigger if exists trg_capture_market_state_journal_v1 on public.market_realtime_history;
create trigger trg_capture_market_state_journal_v1 after insert or update of payload,captured_at,source_updated_at on public.market_realtime_history for each row execute function public.capture_market_state_journal_v1();

insert into public.market_state_journal(market_date,minute_of_day,captured_at,source_updated_at,score,state_code,state_label,vn_index,vn_change_pct,adv,flat,dec,breadth_balance,value_b,leader_symbol,leader_name,leader_change_pct)
select h.market_date,h.minute_of_day,h.captured_at,h.source_updated_at,(s->>'score')::smallint,s->>'state_code',s->>'state_label',nullif(s->>'vn_index','')::numeric,nullif(s->>'vn_change_pct','')::numeric,nullif(s->>'adv','')::int,nullif(s->>'flat','')::int,nullif(s->>'dec','')::int,nullif(s->>'breadth_balance','')::numeric,nullif(s->>'value_b','')::numeric,s->>'leader_symbol',s->>'leader_name',nullif(s->>'leader_change_pct','')::numeric from public.market_realtime_history h cross join lateral public.market_state_from_payload_v1(h.payload) s on conflict(market_date,minute_of_day) do nothing;

create or replace function public.public_market_journal_v1(p_days integer default 20)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_days integer:=greatest(1,least(coalesce(p_days,20),60));
begin
 return jsonb_build_object('days',coalesce((with dates as(select distinct market_date from public.market_state_journal order by market_date desc limit v_days),rows as(select j.* from public.market_state_journal j join dates d using(market_date)),daily as(select market_date,min(score) low_score,max(score) high_score,(array_agg(score order by minute_of_day asc))[1] open_score,(array_agg(score order by minute_of_day desc))[1] close_score,(array_agg(state_label order by minute_of_day desc))[1] close_state,(array_agg(vn_index order by minute_of_day desc))[1] vn_index,(array_agg(vn_change_pct order by minute_of_day desc))[1] vn_change_pct,(array_agg(adv order by minute_of_day desc))[1] adv,(array_agg(flat order by minute_of_day desc))[1] flat,(array_agg(dec order by minute_of_day desc))[1] dec,(array_agg(value_b order by minute_of_day desc))[1] value_b,(array_agg(leader_name order by minute_of_day desc))[1] leader_name,(array_agg(leader_change_pct order by minute_of_day desc))[1] leader_change_pct,count(*) points from rows group by market_date) select jsonb_agg(to_jsonb(daily) order by market_date desc) from daily),'[]'::jsonb),
 'events',coalesce((with dates as(select distinct market_date from public.market_state_journal order by market_date desc limit v_days),q as(select j.*,lag(score) over(partition by market_date order by minute_of_day) prev_score,lag(state_label) over(partition by market_date order by minute_of_day) prev_state from public.market_state_journal j join dates d using(market_date)),marked as(select * from q where prev_score is not null and(state_label is distinct from prev_state or abs(score-prev_score)>=4)) select jsonb_agg(jsonb_build_object('market_date',market_date,'minute_of_day',minute_of_day,'captured_at',captured_at,'score',score,'previous_score',prev_score,'state_label',state_label,'previous_state',prev_state,'vn_change_pct',vn_change_pct,'adv',adv,'flat',flat,'dec',dec,'value_b',value_b,'leader_name',leader_name,'leader_change_pct',leader_change_pct) order by market_date desc,minute_of_day desc) from(select * from marked order by market_date desc,minute_of_day desc limit 80)e),'[]'::jsonb));
end;$$;
grant execute on function public.public_market_journal_v1(integer) to anon,authenticated;

create table if not exists public.investor_watchlist(id uuid primary key default gen_random_uuid(),passport_id uuid not null references public.investor_passports(id) on delete cascade,symbol text not null,sector text,thesis text,trigger_price numeric,invalidation_price numeric,note text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(passport_id,symbol));
alter table public.investor_watchlist enable row level security; revoke all on public.investor_watchlist from anon,authenticated;
create table if not exists public.investor_daily_checkins(id uuid primary key default gen_random_uuid(),passport_id uuid not null references public.investor_passports(id) on delete cascade,market_date date not null,account_value numeric,account_return_pct numeric,cash_pct numeric,margin_pct numeric,mood text,primary_worry text,followed_plan boolean,behavior_flags jsonb not null default '{}'::jsonb,note text,market_score smallint,market_state text,vn_change_pct numeric,breadth_balance numeric,market_value_b numeric,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(passport_id,market_date),check(mood is null or mood in('CALM','WORRIED','FOMO','FRUSTRATED','EXCITED','CONFUSED')),check(cash_pct is null or cash_pct between 0 and 100),check(margin_pct is null or margin_pct between 0 and 300),check(account_return_pct is null or account_return_pct between -100 and 100));
alter table public.investor_daily_checkins enable row level security; revoke all on public.investor_daily_checkins from anon,authenticated;
create table if not exists public.investor_daily_items(id uuid primary key default gen_random_uuid(),checkin_id uuid not null references public.investor_daily_checkins(id) on delete cascade,symbol text not null,item_type text not null check(item_type in('POSITION','WATCHLIST')),sector text,day_change_pct numeric,weight_pct numeric,note text,created_at timestamptz not null default now(),unique(checkin_id,symbol,item_type),check(day_change_pct is null or day_change_pct between -100 and 100),check(weight_pct is null or weight_pct between 0 and 100));
alter table public.investor_daily_items enable row level security; revoke all on public.investor_daily_items from anon,authenticated;

create or replace function public.investor_list_watchlist_v1() returns jsonb language plpgsql security definer set search_path=public as $$declare uid uuid:=auth.uid();p public.investor_passports;begin if uid is null then raise exception 'AUTH_REQUIRED';end if;select * into p from public.investor_passports where auth_user_id=uid;if not found then return '[]'::jsonb;end if;return coalesce((select jsonb_agg(to_jsonb(w) order by w.updated_at desc) from public.investor_watchlist w where w.passport_id=p.id),'[]'::jsonb);end;$$;
create or replace function public.investor_upsert_watchlist_v1(p_payload jsonb) returns jsonb language plpgsql security definer set search_path=public as $$declare uid uuid:=auth.uid();p public.investor_passports;w public.investor_watchlist;sym text;begin if uid is null then raise exception 'AUTH_REQUIRED';end if;select * into p from public.investor_passports where auth_user_id=uid;if not found then insert into public.investor_passports(auth_user_id) values(uid) returning * into p;end if;sym:=upper(trim(coalesce(p_payload->>'symbol','')));if sym !~ '^[A-Z0-9.-]{2,12}$' then raise exception 'INVALID_SYMBOL';end if;insert into public.investor_watchlist(passport_id,symbol,sector,thesis,trigger_price,invalidation_price,note) values(p.id,sym,nullif(left(trim(coalesce(p_payload->>'sector','')),60),''),nullif(left(trim(coalesce(p_payload->>'thesis','')),600),''),nullif(p_payload->>'trigger_price','')::numeric,nullif(p_payload->>'invalidation_price','')::numeric,nullif(left(trim(coalesce(p_payload->>'note','')),800),'')) on conflict(passport_id,symbol) do update set sector=excluded.sector,thesis=excluded.thesis,trigger_price=excluded.trigger_price,invalidation_price=excluded.invalidation_price,note=excluded.note,updated_at=now() returning * into w;return to_jsonb(w);end;$$;
create or replace function public.investor_remove_watchlist_v1(p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$declare uid uuid:=auth.uid();p public.investor_passports;n int;begin if uid is null then raise exception 'AUTH_REQUIRED';end if;select * into p from public.investor_passports where auth_user_id=uid;if not found then return jsonb_build_object('success',true,'deleted',0);end if;delete from public.investor_watchlist where id=p_id and passport_id=p.id;get diagnostics n=row_count;return jsonb_build_object('success',true,'deleted',n);end;$$;
create or replace function public.investor_save_daily_checkin_v1(p_payload jsonb) returns jsonb language plpgsql security definer set search_path=public as $$declare uid uuid:=auth.uid();p public.investor_passports;c public.investor_daily_checkins;d date;m public.market_state_journal;item jsonb;sym text;typ text;begin if uid is null then raise exception 'AUTH_REQUIRED';end if;select * into p from public.investor_passports where auth_user_id=uid;if not found then insert into public.investor_passports(auth_user_id) values(uid) returning * into p;end if;d:=coalesce(nullif(p_payload->>'market_date','')::date,(now() at time zone 'Asia/Ho_Chi_Minh')::date);if d>(now() at time zone 'Asia/Ho_Chi_Minh')::date or d<(now() at time zone 'Asia/Ho_Chi_Minh')::date-365 then raise exception 'INVALID_DATE';end if;select * into m from public.market_state_journal where market_date<=d order by market_date desc,minute_of_day desc limit 1;insert into public.investor_daily_checkins(passport_id,market_date,account_value,account_return_pct,cash_pct,margin_pct,mood,primary_worry,followed_plan,behavior_flags,note,market_score,market_state,vn_change_pct,breadth_balance,market_value_b) values(p.id,d,nullif(p_payload->>'account_value','')::numeric,nullif(p_payload->>'account_return_pct','')::numeric,nullif(p_payload->>'cash_pct','')::numeric,nullif(p_payload->>'margin_pct','')::numeric,nullif(p_payload->>'mood',''),nullif(left(trim(coalesce(p_payload->>'primary_worry','')),120),''),case when p_payload?'followed_plan' then(p_payload->>'followed_plan')::boolean else null end,case when jsonb_typeof(coalesce(p_payload->'behavior_flags','{}'::jsonb))='object' then coalesce(p_payload->'behavior_flags','{}'::jsonb) else '{}'::jsonb end,nullif(left(trim(coalesce(p_payload->>'note','')),1200),''),m.score,m.state_label,m.vn_change_pct,m.breadth_balance,m.value_b) on conflict(passport_id,market_date) do update set account_value=excluded.account_value,account_return_pct=excluded.account_return_pct,cash_pct=excluded.cash_pct,margin_pct=excluded.margin_pct,mood=excluded.mood,primary_worry=excluded.primary_worry,followed_plan=excluded.followed_plan,behavior_flags=excluded.behavior_flags,note=excluded.note,market_score=excluded.market_score,market_state=excluded.market_state,vn_change_pct=excluded.vn_change_pct,breadth_balance=excluded.breadth_balance,market_value_b=excluded.market_value_b,updated_at=now() returning * into c;delete from public.investor_daily_items where checkin_id=c.id;for item in select value from jsonb_array_elements(coalesce(p_payload->'items','[]'::jsonb)) loop sym:=upper(trim(coalesce(item->>'symbol','')));typ:=upper(coalesce(item->>'item_type','WATCHLIST'));if sym~'^[A-Z0-9.-]{2,12}$' and typ in('POSITION','WATCHLIST') then insert into public.investor_daily_items(checkin_id,symbol,item_type,sector,day_change_pct,weight_pct,note) values(c.id,sym,typ,nullif(left(trim(coalesce(item->>'sector','')),60),''),nullif(item->>'day_change_pct','')::numeric,nullif(item->>'weight_pct','')::numeric,nullif(left(trim(coalesce(item->>'note','')),500),'')) on conflict(checkin_id,symbol,item_type) do update set sector=excluded.sector,day_change_pct=excluded.day_change_pct,weight_pct=excluded.weight_pct,note=excluded.note;end if;end loop;return jsonb_build_object('checkin',to_jsonb(c),'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.symbol) from public.investor_daily_items i where i.checkin_id=c.id),'[]'::jsonb));end;$$;
create or replace function public.investor_get_after_session_v1(p_days integer default 30) returns jsonb language plpgsql security definer set search_path=public as $$declare uid uuid:=auth.uid();p public.investor_passports;lim int:=greatest(1,least(coalesce(p_days,30),90));begin if uid is null then raise exception 'AUTH_REQUIRED';end if;select * into p from public.investor_passports where auth_user_id=uid;if not found then insert into public.investor_passports(auth_user_id) values(uid) returning * into p;end if;return jsonb_build_object('passport',to_jsonb(p),'positions',coalesce((select jsonb_agg(to_jsonb(x) order by x.opened_at desc) from public.investor_positions x where x.passport_id=p.id and x.status='OPEN'),'[]'::jsonb),'watchlist',coalesce((select jsonb_agg(to_jsonb(w) order by w.updated_at desc) from public.investor_watchlist w where w.passport_id=p.id),'[]'::jsonb),'checkins',coalesce((select jsonb_agg(jsonb_build_object('checkin',to_jsonb(c),'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.symbol) from public.investor_daily_items i where i.checkin_id=c.id),'[]'::jsonb)) order by c.market_date desc) from(select * from public.investor_daily_checkins where passport_id=p.id order by market_date desc limit lim)c),'[]'::jsonb),'market_latest',(select to_jsonb(j) from public.market_state_journal j order by market_date desc,minute_of_day desc limit 1));end;$$;
grant execute on function public.investor_list_watchlist_v1() to authenticated;
grant execute on function public.investor_upsert_watchlist_v1(jsonb) to authenticated;
grant execute on function public.investor_remove_watchlist_v1(uuid) to authenticated;
grant execute on function public.investor_save_daily_checkin_v1(jsonb) to authenticated;
grant execute on function public.investor_get_after_session_v1(integer) to authenticated;
