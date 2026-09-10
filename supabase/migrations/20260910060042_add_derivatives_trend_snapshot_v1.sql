-- Mirrors production migration 20260910060042.
-- This file is for Git history/source-of-truth. Production already has this migration applied.

create table if not exists public.market_derivatives_snapshot (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz,
  received_at timestamptz not null default now()
);

alter table public.market_derivatives_snapshot enable row level security;

revoke all on table public.market_derivatives_snapshot from anon, authenticated;
grant select, insert, update, delete on table public.market_derivatives_snapshot to service_role;

create or replace function public.derivatives_ingest_internal_v1(
  p_symbol text,
  p_trend text,
  p_system_price numeric,
  p_t1 numeric,
  p_t2 numeric,
  p_t3 numeric,
  p_reversal_price numeric,
  p_last_price numeric,
  p_source_updated_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_symbol text := upper(regexp_replace(coalesce(p_symbol,''), '[^A-Z0-9]', '', 'g'));
  v_trend text := upper(trim(coalesce(p_trend,'')));
begin
  if length(v_symbol)=0 then raise exception 'SYMBOL_REQUIRED'; end if;
  if v_trend not in ('TANG','GIAM') then raise exception 'TREND_INVALID'; end if;

  insert into public.market_derivatives_snapshot(id,payload,source_updated_at,received_at)
  values('psvn_trend', jsonb_strip_nulls(jsonb_build_object(
    'source','AmiBroker PSVN Trend',
    'symbol',v_symbol,
    'trend',v_trend,
    'system_price',p_system_price,
    'targets',jsonb_build_object('t1',p_t1,'t2',p_t2,'t3',p_t3),
    'reversal_price',p_reversal_price,
    'last_price',p_last_price
  )), p_source_updated_at, now())
  on conflict(id) do update set
    payload=excluded.payload,
    source_updated_at=excluded.source_updated_at,
    received_at=excluded.received_at;

  return jsonb_build_object('ok',true,'symbol',v_symbol,'trend',v_trend,'stored_at',now());
end;
$$;

revoke all on function public.derivatives_ingest_internal_v1(text,text,numeric,numeric,numeric,numeric,numeric,numeric,timestamptz) from public, anon, authenticated;
grant execute on function public.derivatives_ingest_internal_v1(text,text,numeric,numeric,numeric,numeric,numeric,numeric,timestamptz) to service_role, postgres;

create or replace function public.derivatives_public_v1()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_build_object(
      'title','Xu hướng phái sinh',
      'symbol',s.payload->>'symbol',
      'trend',case when s.payload->>'trend'='TANG' then 'Tăng' when s.payload->>'trend'='GIAM' then 'Giảm' else null end,
      'system_price',s.payload->'system_price',
      'targets',s.payload->'targets',
      'reversal_price',s.payload->'reversal_price',
      'last_price',s.payload->'last_price',
      'source_updated_at',s.source_updated_at,
      'received_at',s.received_at,
      'age_seconds',greatest(0,extract(epoch from (now()-s.received_at))::integer),
      'fresh',now()-s.received_at <= interval '10 seconds'
    )
    from public.market_derivatives_snapshot s
    where s.id='psvn_trend'
  ), jsonb_build_object(
    'title','Xu hướng phái sinh',
    'symbol',null,
    'trend',null,
    'system_price',null,
    'targets',jsonb_build_object('t1',null,'t2',null,'t3',null),
    'reversal_price',null,
    'last_price',null,
    'source_updated_at',null,
    'received_at',null,
    'age_seconds',null,
    'fresh',false
  ));
$$;

revoke all on function public.derivatives_public_v1() from public;
grant execute on function public.derivatives_public_v1() to anon, authenticated, service_role, postgres;
