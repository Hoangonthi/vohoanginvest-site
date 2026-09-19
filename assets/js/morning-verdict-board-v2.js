const VHB_DECISION='https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/morning-decision-test';
const VHB_MACRO='https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/macro-anchor-public';
const VHB_HOT='https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/hot-stocks-feed';

const vhq=(s,r=document)=>r.querySelector(s);
const vhn=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
const vhf=(v,d=1)=>{const x=vhn(v);return x==null?'—':x.toLocaleString('vi-VN',{maximumFractionDigits:d})};
const vhp=(v,d=1)=>{const x=vhn(v);return x==null?'—':`${x>0?'+':''}${vhf(x,d)}%`};
const vhe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const vhclip=(s,n=155)=>{s=String(s||'').trim();return s.length>n?s.slice(0,n-1).trim()+'…':s};

function vhStyle(){
  if(document.getElementById('vhVerdictBoardV2Style'))return;
  const s=document.createElement('style');
  s.id='vhVerdictBoardV2Style';
  s.textContent=`
  .vh5-verdict.vhb-v2{display:block!important;overflow:hidden;background:linear-gradient(180deg,rgba(8,32,53,.92),rgba(6,25,42,.96));}
  .vhb-top{display:flex;align-items:center;justify-content:space-between;gap:22px;padding:14px 20px;border-bottom:1px solid rgba(242,204,99,.20);background:linear-gradient(90deg,rgba(242,204,99,.045),rgba(77,197,255,.025));}
  .vhb-top-copy{min-width:0;flex:1 1 auto}.vhb-top .vh5-titleline{font-size:12.5px}.vhb-top .vh5-verdict-main{margin-top:8px;font-size:34px;line-height:1.06}.vhb-top .vh5-verdict-sub{margin-top:7px;max-width:760px;font-size:14px;line-height:1.52;color:#d5dfe8}
  .vhb-badges{display:flex;gap:8px;flex:0 0 auto}.vhb-badge{min-width:155px;padding:9px 11px;border:1px solid rgba(255,255,255,.10);border-radius:11px;background:rgba(5,24,41,.58)}.vhb-badge small{display:block;font-size:9.5px;letter-spacing:.07em;text-transform:uppercase;color:#8fa4b7}.vhb-badge b{display:block;margin-top:3px;font-size:11.5px;line-height:1.35;color:#f4d66f}.vhb-badge.medium b{color:#62dfb5}
  .vhb-lanes{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px}.vhb-lane{border:1px solid rgba(93,154,195,.22);border-radius:13px;background:rgba(5,25,43,.72);padding:11px}.vhb-lane.short{border-color:rgba(242,204,99,.24)}.vhb-lane.medium{border-color:rgba(63,220,168,.22)}
  .vhb-lane-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;padding:0 2px}.vhb-lane-title{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:850}.vhb-lane.short .vhb-lane-title{color:#72d4ff}.vhb-lane.medium .vhb-lane-title{color:#58e1b0}.vhb-lane-title .ico{width:27px;height:27px;display:grid;place-items:center;border-radius:8px;border:1px solid currentColor;opacity:.88;font-size:13px}.vhb-lane-status{font-size:10px;font-weight:850;letter-spacing:.045em;text-transform:uppercase;color:#f4d66f;padding:5px 8px;border-radius:999px;border:1px solid rgba(242,204,99,.24);background:rgba(242,204,99,.045)}.vhb-lane.medium .vhb-lane-status{color:#59e0b1;border-color:rgba(89,224,177,.24);background:rgba(89,224,177,.035)}
  .vhb-flow{display:grid;grid-template-columns:minmax(0,1fr) 14px minmax(0,1fr);grid-template-rows:auto 12px auto;align-items:stretch;column-gap:3px;row-gap:2px}.vhb-cell{border:1px solid rgba(255,255,255,.075);border-radius:10px;background:linear-gradient(180deg,rgba(14,48,75,.68),rgba(8,34,56,.72));padding:10px 11px;min-height:142px;height:100%;display:flex;flex-direction:column}.vhb-cell.c1{grid-column:1;grid-row:1}.vhb-a1{grid-column:2;grid-row:1}.vhb-cell.c2{grid-column:3;grid-row:1}.vhb-a2{grid-column:3;grid-row:2}.vhb-cell.c3{grid-column:3;grid-row:3}.vhb-a3{grid-column:2;grid-row:3}.vhb-cell.c4{grid-column:1;grid-row:3}.vhb-arrow{display:grid;place-items:center;color:#e4be5a;font-size:11px;line-height:1;opacity:.68;user-select:none}.vhb-arrow.down{font-size:10px}.vhb-label{display:flex;align-items:center;gap:6px;color:#f3d67c;font-size:10.5px;font-weight:850;letter-spacing:.035em;text-transform:uppercase}.vhb-label:before{content:'';width:4px;height:4px;border-radius:50%;background:currentColor;flex:0 0 auto}.vhb-cell p{margin:6px 0 0;color:#d5dfe8;font-size:12.2px;line-height:1.5}.vhb-cell strong{color:#fff}.vhb-cell .good{color:#64e5b3}.vhb-cell .warn{color:#f3cf74}.vhb-cell .bad{color:#ff7d87}.vhb-cell-body{position:relative;flex:1 1 auto;min-height:0;overflow:hidden}.vhb-cell-body.vhb-clamped{max-height:7.5em}.vhb-cell.is-expanded .vhb-cell-body{max-height:none;overflow:visible}.vhb-cell-toggle-slot{min-height:31px;display:flex;align-items:flex-end;margin-top:5px}.vhb-cell-toggle{height:26px;padding:0 9px;border:1px solid rgba(242,204,99,.42);border-radius:999px;background:rgba(242,204,99,.045);color:#f3d67c;font:800 10.5px/1 inherit;cursor:pointer}.vhb-cell-toggle:hover,.vhb-cell-toggle:focus-visible{background:rgba(242,204,99,.11);outline:none}.vhb-cell-toggle.is-placeholder{visibility:hidden;pointer-events:none}.vhb-cell.is-expanded .vhb-cell-toggle{color:#75d9ff;border-color:rgba(77,197,255,.42);background:rgba(77,197,255,.05)}
  .vhb-mini-lines{display:grid;gap:4px;margin-top:5px}.vhb-mini-lines div{font-size:11.7px;line-height:1.42;color:#d0dae4}.vhb-mini-lines b{color:#f3d67c;font-weight:800}
  .vhb-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.vhb-chip{display:inline-flex;gap:4px;align-items:center;padding:4px 6px;border:1px solid rgba(77,197,255,.20);border-radius:7px;background:rgba(77,197,255,.035);font-size:10.5px;color:#dce7ef}.vhb-chip b{font-size:10.5px}.vhb-chip .up{color:#58e6a7;font-weight:850}
  @media(max-width:980px){.vhb-top{align-items:flex-start;flex-direction:column}.vhb-badges{width:100%;flex-wrap:wrap}.vhb-badge{flex:1 1 180px}.vhb-lanes{grid-template-columns:1fr}.vhb-cell{min-height:94px}}
  @media(max-width:620px){.vhb-top{padding:15px}.vhb-top .vh5-verdict-main{font-size:28px}.vhb-top .vh5-verdict-sub{font-size:13px}.vhb-lanes{padding:8px;gap:8px}.vhb-lane{padding:9px}.vhb-flow{display:flex;flex-direction:column;gap:4px}.vhb-cell{min-height:auto;padding:10px}.vhb-arrow{height:10px}.vhb-arrow:before{content:'↓';font-size:10px}.vhb-arrow{font-size:0}.vhb-lane-head{align-items:flex-start}.vhb-lane-status{text-align:right}.vhb-cell p{font-size:12px}}
  `;
  document.head.appendChild(s);
}

function vhFindVar(d,kind){return(d?.variables||[]).find(x=>x.kind===kind)||null}
function vhGlobal(d,symbol){return(d?.global_markets||[]).find(x=>x.symbol===symbol)||null}
function vhShortDecisionLabel(raw){
  const s=String(raw||'').trim(),u=s.toUpperCase();
  if(!s)return'CHỜ XÁC NHẬN';
  if(u.includes('PHÒNG THỦ'))return'PHÒNG THỦ';
  if(u.includes('THẬN TRỌNG'))return'THẬN TRỌNG';
  if(u.includes('TÍCH CỰC'))return'TÍCH CỰC';
  if(u.includes('CHỌN LỌC'))return'CHỌN LỌC';
  if(u.includes('THEO DÕI')||u.includes('QUAN SÁT'))return'QUAN SÁT';
  if(u.includes('TRUNG TÍNH'))return'TRUNG TÍNH';
  return s.split(/[·:–—]/)[0].trim().split(/\s+/).slice(0,3).join(' ').toUpperCase();
}

function vhMarket(d){
  const score=vhn(d?.market?.state?.score)??50;
  const brain=d?.brain;
  if(brain?.conclusion?.label){
    const tone=d?.evaluation?.decision_tone==="negative"?"negative":d?.evaluation?.decision_tone==="positive"?"positive":"neutral";
    return{score,label:vhShortDecisionLabel(brain?.conclusion?.label_short||brain.conclusion.label),tone,action:String(brain.conclusion.summary||"")};
  }
  if(score<=25)return{score,label:'PHÒNG THỦ CAO',tone:'risk',action:'Ưu tiên giảm rủi ro danh mục, hạn chế mở vị thế mới và không dùng đòn bẩy để bắt đáy.'};
  if(score<40)return{score,label:'THẬN TRỌNG',tone:'negative',action:'Chưa phù hợp để mở rộng danh mục trên diện rộng; giữ tỷ trọng an toàn và chỉ chọn mã khỏe hơn thị trường.'};
  if(score<55)return{score,label:'TRUNG TÍNH / CHỌN LỌC',tone:'neutral',action:'Chưa có lợi thế đủ rõ để tăng mạnh tỷ trọng; giữ vị thế tốt và chờ độ rộng, dòng tiền xác nhận.'};
  if(score<70)return{score,label:'TÍCH CỰC CÓ ĐIỀU KIỆN',tone:'positive',action:'Có thể nâng mức chủ động từng bước, nhưng chỉ ở cổ phiếu có điểm mua và dòng tiền xác nhận.'};
  return{score,label:'TÍCH CỰC',tone:'positive',action:'Môi trường ngắn hạn đang thuận lợi hơn; có thể duy trì tỷ trọng chủ động nhưng vẫn giữ kỷ luật điểm mua và quản trị rủi ro.'};
}
function vhBreadth(d){
  const x=vhFindVar(d,'MARKET_BREADTH');
  if(!x)return'Độ lan tỏa chưa có dữ liệu đủ rõ để thay đổi cách hành động.';
  if(x.direction==='negative')return'Số mã giảm đang chiếm ưu thế; chưa phù hợp để mua thêm trên diện rộng.';
  if(x.direction==='positive')return'Số mã tăng đang lan tỏa tốt hơn; thuận lợi hơn cho việc mở rộng danh mục có chọn lọc.';
  return'Số mã tăng và giảm khá cân bằng; chưa có lợi thế đủ rõ cho bên mua.';
}
function vhLiquidity(d){
  const x=vhFindVar(d,'LIQUIDITY');
  if(!x)return'Thanh khoản hiện chưa đủ dữ liệu so sánh để nâng thành tín hiệu chính.';
  if(x.direction==='negative')return'Tiền vào thị trường đang thấp hơn mức thường thấy cùng thời điểm; nhịp hồi nếu có cần thêm xác nhận.';
  if(x.direction==='positive')return'Thanh khoản đang cao hơn mức thường thấy cùng thời điểm; nếu độ rộng cùng tốt, nhịp tăng đáng tin cậy hơn.';
  return'Thanh khoản đang quanh mức bình thường; chưa tạo thêm lợi thế rõ cho bên mua hoặc bên bán.';
}
function vhEventName(ev){
  const t=String(ev?.title||'');
  if(ev?.type==='FOMC'||/FOMC/i.test(t))return'cuộc họp Fed và quyết định lãi suất';
  if(/Import and Export Price Indexes/i.test(t))return'chỉ số giá xuất khẩu và nhập khẩu của Mỹ';
  if(/Consumer Price Index/i.test(t))return'chỉ số giá tiêu dùng Mỹ (CPI)';
  if(/Producer Price Index/i.test(t))return'chỉ số giá sản xuất Mỹ (PPI)';
  if(/Employment Situation/i.test(t))return'báo cáo việc làm Mỹ';
  if(/Real Earnings/i.test(t))return'báo cáo thu nhập thực tế của người lao động Mỹ';
  return t.replace(/U\.S\./gi,'Mỹ').replace(/United States/gi,'Mỹ');
}
function vhEvent(d){
  const ev=(d?.upcoming_events||[]).filter(x=>vhn(x.hours_away)!=null&&vhn(x.hours_away)>=0&&vhn(x.hours_away)<=168).sort((a,b)=>a.hours_away-b.hours_away)[0];
  if(!ev)return'Trong 7 ngày tới chưa có sự kiện kinh tế Mỹ đủ lớn để phải thay đổi chiến lược chỉ vì yếu tố thời điểm.';
  const h=vhn(ev.hours_away)||0,when=h<24?`${Math.max(1,Math.round(h))} giờ tới`:`${vhf(h/24,1)} ngày tới`;
  return `${vhEventName(ev)} dự kiến công bố trong khoảng ${when}; đây là mốc có thể làm thay đổi kỳ vọng lãi suất, lợi suất Mỹ và đồng USD.`;
}
function vhFed(d){
  const f=d?.macro?.fed_expectation;
  if(!f?.ok)return'Kỳ vọng lãi suất Fed hiện chưa tạo hướng đủ rõ.';
  const sh=vhn(f.shift_5d_pct_point),a=Math.abs(sh||0);
  if(f.tone==='negative')return`Thị trường đang giảm kỳ vọng Fed hạ lãi suất sớm${sh!=null?` sau khi mức lãi suất hàm ý tăng khoảng ${vhf(a,3)} điểm %`:''}.`;
  if(f.tone==='positive')return`Thị trường đang tăng kỳ vọng Fed hạ lãi suất${sh!=null?` sau khi mức lãi suất hàm ý giảm khoảng ${vhf(a,3)} điểm %`:''}.`;
  return'Kỳ vọng lãi suất Fed chưa dịch chuyển đủ mạnh để tạo một hướng rõ.';
}
function vhHot(h,limit=3){return(h?.stocks||[]).filter(x=>vhn(x.change_pct)!=null).sort((a,b)=>(vhn(b.value_traded_bn)||0)-(vhn(a.value_traded_bn)||0)).slice(0,limit)}

function vhEqualizeExpandableCards(root){
  const cards=[...root.querySelectorAll('.vhb-cell')];
  cards.forEach(card=>{
    let body=card.querySelector(':scope > .vhb-cell-body');
    let slot=card.querySelector(':scope > .vhb-cell-toggle-slot');
    let btn=slot?.querySelector('.vhb-cell-toggle');
    if(!body){
      const label=card.querySelector(':scope > .vhb-label');
      body=document.createElement('div');
      body.className='vhb-cell-body vhb-clamped';
      [...card.children].filter(x=>x!==label).forEach(x=>body.appendChild(x));
      card.appendChild(body);
      slot=document.createElement('div');
      slot.className='vhb-cell-toggle-slot';
      btn=document.createElement('button');
      btn.type='button';
      btn.className='vhb-cell-toggle is-placeholder';
      btn.textContent='Xem thêm';
      btn.setAttribute('aria-expanded','false');
      slot.appendChild(btn);
      card.appendChild(slot);
      btn.addEventListener('click',()=>{
        const expanded=card.classList.toggle('is-expanded');
        body.classList.toggle('vhb-clamped',!expanded);
        btn.textContent=expanded?'Thu gọn':'Xem thêm';
        btn.setAttribute('aria-expanded',expanded?'true':'false');
        requestAnimationFrame(()=>vhEqualizeExpandableCards(root));
      });
    }
    if(!body||!btn)return;
    if(card.classList.contains('is-expanded')){
      btn.classList.remove('is-placeholder');
      btn.textContent='Thu gọn';
      return;
    }
    body.classList.add('vhb-clamped');
    btn.textContent='Xem thêm';
    requestAnimationFrame(()=>{
      const overflowing=body.scrollHeight>body.clientHeight+3;
      btn.classList.toggle('is-placeholder',!overflowing);
    });
  });
}
window.__VH_CARD_EQUALIZER__=root=>vhEqualizeExpandableCards(root||document);

function vhMacroState(macro,d){
  let m=macro;
  try{if(m?.ok)localStorage.setItem('vh_macro_anchor_cache_v1',JSON.stringify(m));else{const c=JSON.parse(localStorage.getItem('vh_macro_anchor_cache_v1')||'null');if(c?.ok)m=c}}catch{}
  if(m?.ok){
    const r=String(m.regime||'').toUpperCase();
    const label=r.includes('TÍCH CỰC')?m.regime:r.includes('RỦI RO')||r.includes('TIÊU CỰC')?'THẬN TRỌNG':m.regime||'TRUNG TÍNH';
    const cards=(m.cards||[]);
    const support=cards.filter(x=>x.tone==='positive'||/MẠNH|RỘNG|TÍCH CỰC/i.test(String(x.status||''))).slice(0,2);
    const warning=cards.filter(x=>x.tone==='warning'||/CHẶT|THEO DÕI|RỦI RO/i.test(String(x.status||''))).slice(0,2);
    const supportText=support.length?support.map(x=>`${x.title}: ${vhclip((x.evidence||[]).filter(Boolean).join(' · '),105)}`).join(' | '):'Tăng trưởng, sản xuất, đầu tư và cầu nội địa vẫn là các lực đỡ cần theo dõi.';
    const riskText=warning.length?warning.map(x=>`${x.title}: ${vhclip(x.conclusion||x.market_implication||'',115)}`).join(' | '):'Lạm phát, tỷ giá và điều kiện tiền tệ là các biến số có thể làm thay đổi đánh giá.';
    const watch=(cards.map(x=>x.watch).filter(Boolean).slice(0,2).join(' · '))||'Đánh giá sẽ thay đổi khi tăng trưởng, lạm phát, tỷ giá hoặc điều kiện tiền tệ chuyển hướng đủ rõ.';
    return{label,thesis:vhclip(m.thesis||'Nền vĩ mô hiện vẫn là lực đỡ cho xu hướng trung hạn.',170),support:supportText,risk:riskText,watch};
  }
  const fed=vhFed(d),y=vhGlobal(d,'^TNX');
  return{label:'TRUNG TÍNH / CHỜ XÁC NHẬN',thesis:'Xu hướng 3–12 tháng hiện chưa có bằng chứng đủ mạnh để nâng mức lạc quan hoặc chuyển sang bi quan.',support:'Các lực đỡ trong nước cần tiếp tục được xác nhận qua tăng trưởng, sản xuất, đầu tư và lợi nhuận doanh nghiệp.',risk:`Điều kiện vốn quốc tế cần theo dõi. ${fed}${y?.ok&&vhn(y.price)!=null?` Lợi suất Mỹ 10 năm hiện khoảng ${vhf(y.price,3)}%.`:''}`,watch:'Quan điểm sẽ thay đổi khi tăng trưởng, lạm phát, tỷ giá và điều kiện tiền tệ xác nhận một hướng rõ hơn.'};
}

function vhRender(d,macro,hot){
  const host=document.getElementById('vhDecisionBoardV5');if(!host)return;
  const box=vhq('.vh5-verdict',host);if(!box)return;
  const brain=d?.brain||null,mk0=vhMarket(d),mk={...mk0,label:vhShortDecisionLabel(brain?.conclusion?.label_short||brain?.conclusion?.label||mk0.label),action:String(brain?.conclusion?.summary||mk0.action||'')},ms=vhMacroState(macro,d),hot3=vhHot(hot,3);
  const hotHtml=hot3.length?`<div class="vhb-chips">${hot3.map(x=>`<span class="vhb-chip"><b>${vhe(x.symbol)}</b><span class="up">${vhe(vhp(x.change_pct,1))}</span> · ${vhe(vhf(x.value_traded_bn,1))} tỷ</span>`).join('')}</div>`:'';
  const shortSignal=`<div class="vhb-mini-lines"><div><b>Độ lan tỏa:</b> ${vhe(vhBreadth(d))}</div><div><b>Dòng tiền:</b> ${vhe(vhLiquidity(d))}</div></div>`;
  const external=`<div class="vhb-mini-lines"><div><b>Sự kiện:</b> ${vhe(vhEvent(d))}</div><div><b>Lãi suất Mỹ:</b> ${vhe(vhFed(d))}</div></div>`;
  box.classList.add('vhb-v2');
  box.innerHTML=`
    <div class="vhb-top">
      <div class="vhb-top-copy">
        <div class="vh5-titleline"><span class="ico">▥</span>Kết luận hôm nay</div>
        <div class="vh5-verdict-main" data-tone="${vhe(mk.tone)}">${vhe(mk.label)}</div>
      </div>
      <div class="vhb-badges" aria-label="Tóm tắt theo thời gian">
        <div class="vhb-badge"><small>Ngắn hạn · 1–5 phiên</small><b>${vhe(mk.label)}</b></div>
        <div class="vhb-badge medium"><small>Trung – dài hạn · 3–12 tháng</small><b>${vhe(ms.label)}</b></div>
      </div>
    </div>
    <div class="vhb-lanes">
      <section class="vhb-lane short">
        <div class="vhb-lane-head"><div class="vhb-lane-title"><span class="ico">◷</span>Ngắn hạn (1–5 phiên)</div><div class="vhb-lane-status">${vhe(mk.label)}</div></div>
        <div class="vhb-flow">
          <article class="vhb-cell c1"><div class="vhb-label">Quan điểm</div><p><strong>${vhe(mk.label)}</strong> · Điểm trạng thái ${Math.round(mk.score)}/100. ${vhe(mk.action)}</p></article>
          <span class="vhb-arrow vhb-a1">→</span>
          <article class="vhb-cell c2"><div class="vhb-label">Lan tỏa & dòng tiền</div>${shortSignal}</article>
          <span class="vhb-arrow down vhb-a2">↓</span>
          <article class="vhb-cell c3"><div class="vhb-label">Biến số 1 tuần tới</div>${external}</article>
          <span class="vhb-arrow vhb-a3">←</span>
          <article class="vhb-cell c4"><div class="vhb-label">Hành động</div><p>${vhe(mk.action)}</p>${hot3.length?`<div class="vhb-mini-lines"><div><b>Cổ phiếu đang có dòng tiền:</b></div></div>${hotHtml}`:''}</article>
        </div>
      </section>
      <section class="vhb-lane medium">
        <div class="vhb-lane-head"><div class="vhb-lane-title"><span class="ico">♧</span>Trung – dài hạn (3–12 tháng)</div><div class="vhb-lane-status">${vhe(ms.label)}</div></div>
        <div class="vhb-flow">
          <article class="vhb-cell c1"><div class="vhb-label">Đánh giá</div><p><strong>${vhe(ms.label)}</strong>. ${vhe(ms.thesis)}</p></article>
          <span class="vhb-arrow vhb-a1">→</span>
          <article class="vhb-cell c2"><div class="vhb-label">Lực đỡ chính</div><p>${vhe(ms.support)}</p></article>
          <span class="vhb-arrow down vhb-a2">↓</span>
          <article class="vhb-cell c3"><div class="vhb-label">Rủi ro cần theo dõi</div><p>${vhe(ms.risk)}</p></article>
          <span class="vhb-arrow vhb-a3">←</span>
          <article class="vhb-cell c4"><div class="vhb-label">Khi nào đổi quan điểm?</div><p>${vhe(ms.watch)}</p></article>
        </div>
      </section>
    </div>`;
  vhEqualizeExpandableCards(box);
}

async function vhGet(url){const r=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store'});const j=await r.json();if(!r.ok||!j?.ok)throw new Error(j?.error||`HTTP ${r.status}`);return j}
async function vhWait(){for(let i=0;i<100;i++){const h=document.getElementById('vhDecisionBoardV5');if(h)return h;await new Promise(r=>setTimeout(r,80))}return null}
async function vhInit(){vhStyle();const host=await vhWait();if(!host)return;try{const[d,m,h]=await Promise.all([vhGet(VHB_DECISION),vhGet(VHB_MACRO).catch(()=>({ok:false})),vhGet(VHB_HOT).catch(()=>({ok:false,stocks:[]}))]);await new Promise(r=>setTimeout(r,260));vhRender(d,m,h)}catch(e){console.warn('morning-verdict-board-v2',e)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',vhInit,{once:true});else vhInit();
