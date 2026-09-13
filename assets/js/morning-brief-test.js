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

function ensureV3Sections() {
  if (!document.getElementById('v3DynamicStyle')) {
    const style = document.createElement('style');
    style.id = 'v3DynamicStyle';
    style.textContent = `
      .v3-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
      .v3-card{border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:16px;background:rgba(255,255,255,.025)}
      .v3-card span{display:block;font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:rgba(231,237,246,.58);font-weight:800}
      .v3-card b{display:block;margin-top:7px;font-size:18px;line-height:1.35}.v3-card small{display:block;margin-top:5px;color:rgba(231,237,246,.7);line-height:1.55}
      .v3-card .up{color:#35e08b}.v3-card .down{color:#ff6b72}.v3-card .gold{color:#f3cf74}
      .macro-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.macro-block{border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:18px;background:rgba(255,255,255,.025)}
      .macro-block h3{margin:0 0 12px;font-size:16px;color:#f3cf74}.macro-item{padding:11px 0;border-top:1px solid rgba(255,255,255,.06)}.macro-item:first-of-type{border-top:0}.macro-item b{display:block;font-size:16px}.macro-item small{display:block;margin-top:5px;color:rgba(231,237,246,.68);line-height:1.5}
      .expectation{border-color:rgba(224,187,99,.28);background:linear-gradient(180deg,rgba(224,187,99,.08),rgba(255,255,255,.02))}.expectation .state{font-size:24px;font-weight:800;margin:8px 0}.expectation.negative .state{color:#ff9aa0}.expectation.positive .state{color:#75e8aa}.expectation.neutral .state{color:#f3cf74}
      .event-list,.news-list{display:grid;gap:10px}.event-row{display:grid;grid-template-columns:130px 1fr auto;gap:14px;align-items:center;padding:14px 0;border-top:1px solid rgba(255,255,255,.07)}
      .event-row:first-child{border-top:0}.event-source{font-size:11px;font-weight:800;color:#f3cf74;letter-spacing:.08em}.event-title{font-weight:700}.event-title small{display:block;margin-top:5px;color:rgba(231,237,246,.64);font-weight:400}.event-when{font-size:12px;color:rgba(231,237,246,.72);text-align:right}
      .news-row{display:grid;grid-template-columns:145px 1fr auto;gap:14px;padding:14px 0;border-top:1px solid rgba(255,255,255,.07);align-items:start}.news-row:first-child{border-top:0}.news-source{font-size:11px;color:#f3cf74;font-weight:800}.news-title{font-weight:700;line-height:1.45}.news-title small{display:block;margin-top:6px;color:rgba(231,237,246,.65);font-weight:400;line-height:1.5}.news-score{font-size:12px;color:rgba(231,237,246,.7);white-space:nowrap}.news-row a:hover .news-title{text-decoration:underline}
      .quality-box{margin-top:14px;padding:13px 15px;border-radius:14px;border:1px dashed rgba(224,187,99,.25);color:rgba(231,237,246,.72);font-size:12px;line-height:1.65}
      @media(max-width:900px){.v3-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.macro-grid{grid-template-columns:1fr 1fr}}
      @media(max-width:560px){.v3-grid,.macro-grid{grid-template-columns:1fr}.event-row,.news-row{grid-template-columns:1fr}.event-when{text-align:left}.news-score{white-space:normal}}
    `;
    document.head.appendChild(style);
  }

  if ($('macroGrid')) return;
  const sourceSection = $('sourceList')?.closest('.section');
  if (!sourceSection) return;

  const macro = document.createElement('section');
  macro.className = 'section';
  macro.innerHTML = `
    <div class="section-head"><div>
      <div class="kicker">VĨ MÔ & KỲ VỌNG CHÍNH SÁCH</div>
      <h2>Vĩ mô đang nghiêng về bên nào?</h2>
      <p>Ưu tiên dữ liệu gốc từ NSO/BLS. Kỳ vọng Fed dùng giá Fed Funds futures làm proxy xu hướng; không giả vờ đây là xác suất CME FedWatch.</p>
    </div></div>
    <div id="macroGrid" class="macro-grid"><div class="empty">Đang lấy dữ liệu vĩ mô…</div></div>`;
  sourceSection.parentNode.insertBefore(macro, sourceSection);

  const global = document.createElement('section');
  global.className = 'section';
  global.innerHTML = `
    <div class="section-head"><div>
      <div class="kicker">BỐI CẢNH BÊN NGOÀI</div>
      <h2>Quốc tế, tỷ giá và hàng hóa</h2>
      <p>Hiển thị dữ liệu gốc để ACE tự kiểm tra. Engine chỉ đưa biến động đủ lớn vào phần đánh giá.</p>
    </div></div>
    <div id="globalMarketsGrid" class="v3-grid"><div class="empty">Đang tải dữ liệu quốc tế…</div></div>`;
  sourceSection.parentNode.insertBefore(global, sourceSection);

  const events = document.createElement('section');
  events.className = 'section';
  events.innerHTML = `
    <div class="section-head"><div>
      <div class="kicker">RỦI RO THỜI ĐIỂM</div>
      <h2>Sự kiện vĩ mô sắp tới</h2>
      <p>Fed và BLS lấy từ nguồn chính thức. Trước giờ công bố, sự kiện chỉ là rủi ro thời điểm, chưa tự gán tích cực hay tiêu cực.</p>
    </div></div>
    <div id="eventList" class="event-list"><div class="empty">Đang tải lịch sự kiện…</div></div>`;
  sourceSection.parentNode.insertBefore(events, sourceSection);

  const news = document.createElement('section');
  news.className = 'section';
  news.innerHTML = `
    <div class="section-head"><div>
      <div class="kicker">RADAR TIN TỰ ĐỘNG</div>
      <h2>Web đang tự đi lấy tin ở đâu?</h2>
      <p>Trang TEST tự đọc RSS của các trang đã chọn, chấm độ liên quan, khử bài gần trùng và chỉ hiển thị lớp tiêu đề/tóm tắt/link nguồn.</p>
    </div></div>
    <div id="webNewsList" class="news-list"><div class="empty">Đang quét tin…</div></div>
    <div id="qualityBox" class="quality-box"></div>`;
  sourceSection.parentNode.insertBefore(news, sourceSection);
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
    const ch = Number(x.change_pct), cls = ch > 0 ? 'up' : ch < 0 ? 'down' : '';
    return `<div class="v3-card"><span>${esc(names[x.symbol] || x.symbol)}</span><b>${fmt(x.price, x.symbol === 'VND=X' ? 0 : 3)}${units[x.symbol] || ''}</b><small class="${cls}">${signPct(ch)}</small></div>`;
  }).join('');
}

function renderMacro(macro) {
  const box = $('macroGrid');
  if (!box) return;
  const vn = macro?.vietnam?.items || [], us = macro?.united_states?.items || [], fed = macro?.fed_expectation || {};
  const itemHtml = (x) => {
    let line = x.unit ? `${fmt(x.value, 2)} ${esc(x.unit)}` : fmt(x.value, 2);
    if (x.id === 'us-cpi' && Number.isFinite(Number(x.yoy))) line = `${fmt(x.yoy, 2)}% YoY · ${fmt(x.mom, 2)}% MoM`;
    if (x.id === 'us-payroll' && Number.isFinite(Number(x.change))) line += ` · ${Number(x.change) > 0 ? '+' : ''}${fmt(x.change, 0)}k MoM`;
    return `<div class="macro-item"><b>${esc(x.label)}: ${line}</b><small>${esc(x.period || '')} · Nguồn ${esc(x.source || '')}</small></div>`;
  };
  const fedTone = toneClass(fed.tone);
  box.innerHTML = `
    <div class="macro-block"><h3>🇻🇳 Việt Nam</h3>${vn.length ? vn.map(itemHtml).join('') : '<div class="empty">NSO chưa trả dữ liệu có thể đọc.</div>'}</div>
    <div class="macro-block"><h3>🇺🇸 Mỹ</h3>${us.length ? us.map(itemHtml).join('') : '<div class="empty">BLS chưa trả dữ liệu có thể đọc.</div>'}</div>
    <div class="macro-block expectation ${fedTone}">
      <h3>🏦 Kỳ vọng Fed</h3>
      <div class="state">${esc(fed.label || 'CHƯA CÓ DỮ LIỆU')}</div>
      <div class="macro-item"><b>Implied rate: ${fed.ok ? `${fmt(fed.implied_rate, 3)}%` : '—'}</b><small>Dịch chuyển cửa sổ gần đây: ${fed.shift_5d_pct_point == null ? '—' : `${Number(fed.shift_5d_pct_point) > 0 ? '+' : ''}${fmt(fed.shift_5d_pct_point, 3)} điểm %`}</small></div>
      <small>${esc(fed.note || '')}</small>
    </div>`;
}

function renderEvents(rows) {
  const box = $('eventList');
  if (!box) return;
  if (!Array.isArray(rows) || !rows.length) { box.innerHTML = '<div class="empty">Chưa có sự kiện lớn trong cửa sổ theo dõi.</div>'; return; }
  box.innerHTML = rows.map(x => {
    const h = Number(x.hours_away), away = Number.isFinite(h) ? (h < 24 ? `còn ${Math.max(0, Math.round(h))} giờ` : `còn ${fmt(h / 24, 1)} ngày`) : '';
    return `<div class="event-row"><div class="event-source">${esc(x.source)}</div><div class="event-title">${esc(x.title)}<small>${esc(x.detail || x.type || '')}</small></div><div class="event-when">${esc(timeVN(x.at))}<br>${esc(away)}</div></div>`;
  }).join('');
}

function renderWebNews(data) {
  const box = $('webNewsList'); if (!box) return;
  const items = data?.items || [];
  if (!items.length) { box.innerHTML = '<div class="empty">Các RSS hiện chưa trả tin.</div>'; return; }
  box.innerHTML = items.map(x => `
    <div class="news-row">
      <div class="news-source">${esc(x.source)}<br><small>${esc(x.bucket)}</small></div>
      <a href="${esc(x.link || '#')}" target="_blank" rel="noopener noreferrer"><div class="news-title">${esc(x.title)}<small>${esc((x.summary || '').slice(0, 240))}</small></div></a>
      <div class="news-score">Liên quan ${esc(x.score ?? '—')}/90<br>${esc(x.published_at ? timeVN(x.published_at) : '')}</div>
    </div>`).join('');
}

function renderQuality(q, webNews) {
  const box = $('qualityBox'); if (!box) return;
  const flow = q?.flow_baseline_ready ? `Thanh khoản: đủ chuẩn ${q.flow_baseline_days} phiên.` : `Thanh khoản: chưa chấm hướng vì mới có ${q?.flow_baseline_days ?? 0} phiên baseline (cần ≥5).`;
  const rss = `RSS: ${q?.web_rss_sources_ok ?? 0}/6 nguồn đang phản hồi, radar giữ ${(webNews?.items || []).length} tin sau lọc/trùng.`;
  const market = q?.market_closed ? 'Thị trường VN đóng cửa: dùng snapshot phiên gần nhất.' : 'Thị trường VN đang trong phiên.';
  box.innerHTML = `<b>Kiểm soát chất lượng V3:</b> ${esc(flow)} ${esc(rss)} ${esc(market)}`;
}

async function init() {
  ensureV3Sections();
  const status = $('testStatus');
  try {
    const r = await fetch(ENDPOINT, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    if (!d?.ok) throw new Error(d?.error || 'Không nhận được dữ liệu');

    if (status) {
      const when = d.generated_at ? new Date(d.generated_at).toLocaleString('vi-VN') : '—';
      status.textContent = `V3 · ${d.version || ''} · cập nhật ${when}`;
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
    renderMacro(d.macro || {});
    renderGlobal(d.global_markets || []);
    renderEvents(d.upcoming_events || []);
    renderWebNews(d.web_news || {});
    renderQuality(d.quality || {}, d.web_news || {});
    renderSources(d.sources || []);
  } catch (err) {
    if (status) { status.textContent = `Không tải được dữ liệu thử nghiệm: ${err?.message || err}`; status.classList.add('error'); }
    const box = $('variablesGrid');
    if (box) box.innerHTML = '<div class="empty">Nguồn dữ liệu đang lỗi hoặc chưa phản hồi. Trang test không dùng dữ liệu giả để thay thế.</div>';
  }
}

init();
