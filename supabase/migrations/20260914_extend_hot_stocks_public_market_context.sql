create or replace function public.hot_stocks_public_v1()
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with snap as (
    select s.*
    from public.market_hot_stocks_snapshot s
    where s.id='ami_tplus_pro'
    limit 1
  ), stock_rows as (
    select jsonb_build_object(
      'symbol', upper(x->>'symbol'),
      'price', nullif(x->>'price','')::numeric,
      'change_pct', nullif(x->>'changePct','')::numeric,
      'value_traded_bn', nullif(x->>'valueTradedBn','')::numeric,
      'projected_volume_ratio_pct', nullif(x->>'projectedVolRatio','')::numeric,
      'previous_volume_ratio_pct', nullif(x->>'projectedPrevVolRatio','')::numeric,
      't_score', nullif(x->>'tScore','')::numeric,
      'signal_class', x->>'signalClass',
      'base_type', x->>'baseType',
      'updated_at', x->>'updatedAt'
    ) as item,
    ord
    from snap s
    cross join lateral jsonb_array_elements(coalesce(s.payload->'stocks','[]'::jsonb)) with ordinality a(x,ord)
    where upper(coalesce(x->>'symbol','')) ~ '^[A-Z]{3}$'
      and coalesce(x->>'reason','')='DAT'
  ), packed as (
    select coalesce(jsonb_agg(item order by ord),'[]'::jsonb) as stocks
    from stock_rows
  )
  select coalesce((
    select jsonb_build_object(
      'title','Cổ phiếu nổi bật theo dòng tiền',
      'symbols', coalesce((select jsonb_agg(z->>'symbol') from jsonb_array_elements(p.stocks) z),'[]'::jsonb),
      'stocks', p.stocks,
      'cta','Dùng như tín hiệu dòng tiền ngắn hạn; không thay thế điểm mua, định giá và quản trị rủi ro.',
      'source','AmiBroker T+ Dòng Tiền Pro',
      'source_updated_at',s.source_updated_at,
      'received_at',s.received_at,
      'age_seconds',greatest(0,extract(epoch from (now()-s.received_at))::integer),
      'fresh',now()-s.received_at <= interval '3 minutes'
    )
    from snap s cross join packed p
  ), jsonb_build_object(
      'title','Cổ phiếu nổi bật theo dòng tiền',
      'symbols','[]'::jsonb,
      'stocks','[]'::jsonb,
      'cta','Dùng như tín hiệu dòng tiền ngắn hạn; không thay thế điểm mua, định giá và quản trị rủi ro.',
      'source','AmiBroker T+ Dòng Tiền Pro',
      'source_updated_at',null,
      'received_at',null,
      'age_seconds',null,
      'fresh',false
  ));
$function$;
