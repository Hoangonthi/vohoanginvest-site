const ENDPOINT = 'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/morning-decision-test';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function fmt(v, digits = 2) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('vi-VN', { maximumFractionDigits: digits }) : '—';
}
function toneClass(v) { return v === 'positive' ? 'positive' : v === 'negative' ? 'negative' : 'neutral'; }
function impactClass(v) { return v === 'CAO' ? 'high' : v === 'TRUNG BÌNH' ? 'medium' : 'low'; }
function signPct(v) { const n = Number(v); return Number.isFinite(n) ? `${n > 0 ? '+' : ''}${fmt(n, 2)}%` : '—'; }
function timeVN(v) { if (!v) return '—'; const d = new Date(v); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }); }

function ensureV2Sections() {
  if (!document.getElementById('v2DynamicStyle')) {
    const style = document.createElement('style');
    style.id = 'v2DynamicStyle';
    style.textContent = `
      .v2-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
      .v2-market{border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:16px;background:rgba(255,255,255,.025)}
      .v2-market span{display:block;font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:rgba(231,237,246,.58);font-weight:800}
      .v2-market b{display:block;margin-top:7px;font-size:18px}.v2-market small{display:block;margin-top:5px;color:rgba(231,237,246,.7)}
      .v2-market .up{color:#35e08b}.v2-market .down{color:#ff6b72}
      .event-list{display:grid;gap:10px}.event-row{display:grid;grid-template-columns:130px 1fr auto;gap:14px;align-items:center;padding:14px 0;border-top:1px solid rgba(255,255,255,.07)}
      .event-row:first-child{border-top:0}.event-source{font-size:11px;font-weight:800;color:#f3cf74;letter-spacing:.08em}.event-title{font-weight:700}.event-title small{display:block;margin-top:5px;color:rgba(231,237,246,.64);font-weight:400}.event-when{font-size:12px;color:rgba(231,237,246,.72);text-align:right}
      .quality-box{margin-top:14px;padding:13px 15px;border-radius:14px;border:1px dashed rgba(224,187,99,.25);color:rgba(231,237,246,.72);font-size:12px;line-height:1.65}
      @media(max-width:900px){.v2-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:560px){.v2-grid{grid-template-columns:1fr 1fr}.event-row{grid-template-columns:1fr}.event-when{text-align:left}}
    `;
    document.head.appendChild(style);
  }

  if (!$('globalMarketsGrid')) {
    const sourceSection = $('sourceList')?.closest('.section');
    if (!sourceSection) return;
    const global = document.createElement('section');
    global.className = 'section';
    global.innerHTML = `
      <div class="section-head"><div>
        <div class="kicker">BỐI CẢNH BÊN NGOÀI</div>
        <h2>Quốc tế, tỷ giá và hàng hóa</h2>
        <p>Hiển thị dữ liệu gốc để ACE tự kiểm tra. Engine chỉ đưa biến động đủ lớn vào phần đánh giá, không cộng mọi con số một cách cơ học.</p>
      </div></div>
      <div id="globalMarketsGrid" class="v2-grid"><div class="empty">Đang tải dữ liệu quốc tế…</div></div>`;
    sourceSection.parentNode.insertBefore(global, sourceSection);

    const events = document.createElement('section');
    events.className = 'section';
    events.innerHTML = `
      <div class="section-head"><div>
        <div class="kicker">RỦI RO THỜI ĐIỂM</div>
        <h2>Sự kiện vĩ mô sắp tới</h2>
        <p>Fed và BLS được lấy từ nguồn chính thức. Trước khi công bố, sự kiện chỉ là rủi ro thời điểm — chưa được gán hướng tích cực hay tiêu cực.</p>
      </div></div>
      <div id="eventList" class="event-list"><div class="empty">Đang tải lịch sự kiện…</div></div>
      <div id="qualityBox" class="quality-box"></div>`;
    sourceSection.parentNode.insertBefore(events, sourceSection);
  }
}

function renderVariables(items) {
  const box = $('variablesGrid');
  if (!box) return;
  if (!Array.isArray(items) || !items.length) {
    box.innerHTML = '<div class="empty">Chưa có biến số đủ điều kiện hiển thị.</div>';
    return;
  }
  box.innerHTML = items.map((x, i) => `
    <article class="variable-card ${toneClass(x.direction)}">
      <div class="variable-top">
        <span class="variable-no">${String(i + 1).padStart(2, '0')}</span>
        <div class="badges">
          <span class="badge ${toneClass(x.direction)}">${esc(x.direction_label)}</span>
          <span class="badge impact ${impactClass(x.impact)}">Tác động ${esc(x.impact)}</span>
          <span class="badge">Tin cậy ${esc(x.confidence || '—')}</span>
        </div>
      </div>
      <div class="kind">${esc(x.kind)}</div>
      <h3>${esc(x.title)}</h3>
      <p class="summary">${esc(x.summary)}</p>
      <div class="meta-row"><span>Phạm vi</span><b>${esc(x.scope)}</b></div>
      <div class="evidence"><strong>Căn cứ dữ liệu</strong>${(x.evidence || []).map(e => `<div>• ${esc(e)}</div>`).join('')}</div>
      <div class="watch"><strong>Cần xác nhận:</strong> ${esc(x.watch)}</div>
      <div class="action-effect"><strong>Ảnh hưởng tới hành động:</strong> ${esc(x.action_effect)}</div>
    </article>`).join('');
}

function renderSources(items) {
  const box = $('sourceList');
  if (!box) return;
  box.innerHTML = (items || []).map(x => `
    <div class="source-item"><b>${esc(x.name)} · ${esc(x.status || '')}</b><span>${esc(x.detail)}</span></div>
  `).join('') || '<div class="empty">Chưa có thông tin nguồn.</div>';
}

function renderGlobal(rows) {
  const box = $('globalMarketsGrid');
  if (!box) return;
  const names = { '^GSPC':'S&P 500', '^IXIC':'Nasdaq', 'DX-Y.NYB':'DXY', '^TNX':'US10Y', 'GC=F':'Gold', 'CL=F':'WTI Oil', 'VND=X':'USD/VND' };
  const units = { '^TNX':'%', 'VND=X':'', 'GC=F':' USD', 'CL=F':' USD' };
  const good = (rows || []).filter(x => x?.ok);
  if (!good.length) { box.innerHTML = '<div class="empty">Nguồn quốc tế hiện chưa phản hồi.</div>'; return; }
  box.innerHTML = good.map(x => {
    const ch = Number(x.change_pct);
    const cls = ch > 0 ? 'up' : ch < 0 ? 'down' : '';
    return `<div class="v2-market"><span>${esc(names[x.symbol] || x.symbol)}</span><b>${fmt(x.price, x.symbol === 'VND=X' ? 0 : 3)}${units[x.symbol] || ''}</b><small class="${cls}">${signPct(ch)}</small></div>`;
  }).join('');
}

function renderEvents(rows) {
  const box = $('eventList');
  if (!box) return;
  if (!Array.isArray(rows) || !rows.length) { box.innerHTML = '<div class="empty">Chưa có sự kiện lớn trong cửa sổ theo dõi.</div>'; return; }
  box.innerHTML = rows.map(x => {
    const h = Number(x.hours_away);
    const away = Number.isFinite(h) ? (h < 24 ? `còn ${Math.max(0, Math.round(h))} giờ` : `còn ${fmt(h / 24, 1)} ngày`) : '';
    return `<div class="event-row"><div class="event-source">${esc(x.source)}</div><div class="event-title">${esc(x.title)}<small>${esc(x.detail || x.type || '')}</small></div><div class="event-when">${esc(timeVN(x.at))}<br>${esc(away)}</div></div>`;
  }).join('');
}

function renderQuality(q) {
  const box = $('qualityBox'); if (!box) return;
  const flow = q?.flow_baseline_ready ? `Thanh khoản: đủ chuẩn ${q.flow_baseline_days} phiên.` : `Thanh khoản: CHƯA chấm hướng vì mới có ${q?.flow_baseline_days ?? 0} phiên baseline (cần ≥5).`;
  const news = `Tin tức: nhận ${q?.news_deduped_from ?? 0}, sau khử trùng còn ${q?.news_kept ?? 0} tin khác nhau.`;
  const market = q?.market_closed ? 'Thị trường VN đang đóng cửa: dùng snapshot phiên gần nhất, không gọi là realtime.' : 'Thị trường VN đang trong phiên.';
  box.innerHTML = `<b>Kiểm soát chất lượng V2:</b> ${esc(flow)} ${esc(news)} ${esc(market)}`;
}

async function init() {
  ensureV2Sections();
  const status = $('testStatus');
  try {
    const r = await fetch(ENDPOINT, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    if (!d?.ok) throw new Error(d?.error || 'Không nhận được dữ liệu');

    if (status) {
      const when = d.generated_at ? new Date(d.generated_at).toLocaleString('vi-VN') : '—';
      status.textContent = `V2 · ${d.version || ''} · cập nhật ${when}`;
      status.classList.add('ok');
    }

    const market = d.market || {}, state = market.state || {}, vn = market.vn_index || {}, freshness = market.freshness || {}, evaluation = d.evaluation || {};
    if ($('marketState')) $('marketState').textContent = state.label || '—';
    if ($('marketScore')) $('marketScore').textContent = state.score == null ? '—' : `${state.score}/100`;
    if ($('vnIndex')) $('vnIndex').textContent = vn.value == null ? '—' : fmt(vn.value, 2);
    if ($('vnChange')) $('vnChange').textContent = signPct(vn.change_pct);
    if ($('freshness')) $('freshness').textContent = freshness.label || '—';
    if ($('variableCount')) $('variableCount').textContent = String(evaluation.total_variables ?? 0);

    const decision = $('decisionBox');
    if (decision) decision.className = `decision-box ${toneClass(evaluation.decision_tone)}`;
    if ($('decisionLabel')) $('decisionLabel').textContent = evaluation.decision || 'GIỮ QUAN ĐIỂM';
    if ($('decisionReason')) $('decisionReason').textContent = evaluation.rationale || '—';
    if ($('decisionStats')) $('decisionStats').innerHTML = `
      <span><b>${evaluation.positive ?? 0}</b> tích cực</span>
      <span><b>${evaluation.negative ?? 0}</b> tiêu cực</span>
      <span><b>${evaluation.high_impact ?? 0}</b> tác động cao</span>
      <span><b>${fmt(evaluation.balance_score, 2)}</b> cân bằng trọng số</span>`;

    renderVariables(d.variables || []);
    renderGlobal(d.global_markets || []);
    renderEvents(d.upcoming_events || []);
    renderQuality(d.quality || {});
    renderSources(d.sources || []);
  } catch (err) {
    if (status) { status.textContent = `Không tải được dữ liệu thử nghiệm: ${err?.message || err}`; status.classList.add('error'); }
    const box = $('variablesGrid');
    if (box) box.innerHTML = '<div class="empty">Nguồn dữ liệu đang lỗi hoặc chưa phản hồi. Trang test không dùng dữ liệu giả để thay thế.</div>';
  }
}

init();
