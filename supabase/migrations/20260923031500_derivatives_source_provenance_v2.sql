-- Preserve the proven derivatives advisory state machine while allowing
-- trusted publishers to record the actual calculation source.

create or replace function public.derivatives_ingest_internal_v2(
  p_symbol text,
  p_trend text,
  p_system_price numeric,
  p_t1 numeric,
  p_t2 numeric,
  p_t3 numeric,
  p_reversal_price numeric,
  p_last_price numeric,
  p_source text default 'AmiBroker PSVN Trend',
  p_source_updated_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_source text := left(trim(coalesce(p_source,'AmiBroker PSVN Trend')),120);
begin
  if v_source not in ('AmiBroker PSVN Trend','DATATICK_PSVN_SUPERTREND_V1') then
    raise exception 'DERIVATIVES_SOURCE_NOT_ALLOWED';
  end if;

  v_result := public.derivatives_ingest_internal_v1(
    p_symbol,
    p_trend,
    p_system_price,
    p_t1,
    p_t2,
    p_t3,
    p_reversal_price,
    p_last_price,
    p_source_updated_at
  );

  update public.market_derivatives_snapshot
  set payload = jsonb_set(payload,'{source}',to_jsonb(v_source),true)
  where id='psvn_trend'
    and source_updated_at is not distinct from p_source_updated_at;

  return coalesce(v_result,'{}'::jsonb) || jsonb_build_object('source',v_source);
end;
$$;

revoke all on function public.derivatives_ingest_internal_v2(
  text,text,numeric,numeric,numeric,numeric,numeric,numeric,text,timestamptz
) from public, anon, authenticated;

grant execute on function public.derivatives_ingest_internal_v2(
  text,text,numeric,numeric,numeric,numeric,numeric,numeric,text,timestamptz
) to service_role, postgres;
