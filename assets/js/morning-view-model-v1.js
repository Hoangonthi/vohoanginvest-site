const shortLabel=raw=>{
  const s=String(raw||'').trim(),u=s.toUpperCase();
  if(!s)return 'CHỜ XÁC NHẬN';
  if(u.includes('PHÒNG THỦ')||u.includes('RỦI RO CAO'))return 'PHÒNG THỦ';
  if(u.includes('THẬN TRỌNG'))return 'THẬN TRỌNG';
  if(u.includes('TÍCH CỰC'))return 'TÍCH CỰC';
  if(u.includes('CHỌN LỌC'))return 'CHỌN LỌC';
  if(u.includes('PHÂN HÓA'))return 'PHÂN HÓA';
  if(u.includes('QUAN SÁT')||u.includes('THEO DÕI'))return 'QUAN SÁT';
  if(u.includes('TRUNG TÍNH'))return 'TRUNG TÍNH';
  return s.split(/[·:–—/]/)[0].trim().split(/\s+/).slice(0,3).join(' ').toUpperCase();
};
const arr=x=>Array.isArray(x)?x:[];
const text=x=>String(x||'').trim();

export function buildMorningViewModel(decision={},macro={},hot={}){
  const brain=decision?.brain&&typeof decision.brain==='object'?decision.brain:{};
  const state=decision?.market?.state||{};
  const rawConclusion=brain?.conclusion||{};
  const conclusion={
    label:shortLabel(rawConclusion?.label_short||rawConclusion?.label||decision?.evaluation?.decision||state?.label),
    summary:text(rawConclusion?.summary||decision?.evaluation?.rationale||''),
    tone:text(decision?.evaluation?.decision_tone||state?.tone||'neutral')||'neutral'
  };
  const actions={
    good:arr(brain?.actions?.good).map(text).filter(Boolean),
    bad:arr(brain?.actions?.bad).map(text).filter(Boolean)
  };
  const scenarios=arr(brain?.scenarios).filter(Boolean);
  const topSignals=arr(brain?.top_signals).length?arr(brain.top_signals):arr(decision?.variables).slice(0,3);
  const changeView=arr(brain?.change_view).map(text).filter(Boolean);
  return {
    schema_version:'morning_view_model_v1',
    source_brain:Boolean(brain?.conclusion),
    generated_at:decision?.generated_at||null,
    conclusion,
    actions,
    scenarios,
    topSignals,
    changeView,
    market:{state},
    macro,
    hot,
    brain
  };
}
