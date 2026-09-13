const ENDPOINT = 'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/morning-decision-test';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function fmt(v, digits = 2) {
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString('vi-VN', { maximumFractionDigits: digits })
    : '—';
}

function toneClass(v) {
  if (v === 'positive') return 'positive';
  if (v === 'negative') return 'negative';
  return 'neutral';
}

function impactClass(v) {
  if (v === 'CAO') return 'high';
  if (v === 'TRUNG BÌNH') return 'medium';
  return 'low';
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
        </div>
      </div>
      <div class="kind">${esc(x.kind)}</div>
      <h3>${esc(x.title)}</h3>
      <p class="summary">${esc(x.summary)}</p>
      <div class="meta-row"><span>Phạm vi</span><b>${esc(x.scope)}</b></div>
      <div class="evidence">
        <strong>Căn cứ dữ liệu</strong>
        ${(x.evidence || []).map(e => `<div>• ${esc(e)}</div>`).join('')}
      </div>
      <div class="watch"><strong>Cần xác nhận:</strong> ${esc(x.watch)}</div>
      <div class="action-effect"><strong>Ảnh hưởng tới hành động:</strong> ${esc(x.action_effect)}</div>
    </article>
  `).join('');
}

function renderSources(items) {
  const box = $('sourceList');
  if (!box) return;
  box.innerHTML = (items || []).map(x => `
    <div class="source-item">
      <b>${esc(x.name)}</b>
      <span>${esc(x.detail)}</span>
    </div>
  `).join('') || '<div class="empty">Chưa có thông tin nguồn.</div>';
}

async function init() {
  const status = $('testStatus');
  try {
    const r = await fetch(ENDPOINT, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    if (!d?.ok) throw new Error(d?.error || 'Không nhận được dữ liệu');

    if (status) {
      const when = d.generated_at ? new Date(d.generated_at).toLocaleString('vi-VN') : '—';
      status.textContent = `Dữ liệu thử nghiệm cập nhật ${when}`;
      status.classList.add('ok');
    }

    const market = d.market || {};
    const state = market.state || {};
    const vn = market.vn_index || {};
    const freshness = market.freshness || {};
    const evaluation = d.evaluation || {};

    $('marketState').textContent = state.label || '—';
    $('marketScore').textContent = state.score == null ? '—' : `${state.score}/100`;
    $('vnIndex').textContent = vn.value == null ? '—' : fmt(vn.value, 2);
    $('vnChange').textContent = vn.change_pct == null ? '—' : `${Number(vn.change_pct) > 0 ? '+' : ''}${fmt(vn.change_pct, 2)}%`;
    $('freshness').textContent = freshness.label || '—';
    $('variableCount').textContent = String(evaluation.total_variables ?? 0);

    const decision = $('decisionBox');
    decision.className = `decision-box ${toneClass(evaluation.decision_tone)}`;
    $('decisionLabel').textContent = evaluation.decision || 'GIỮ QUAN ĐIỂM';
    $('decisionReason').textContent = evaluation.rationale || '—';
    $('decisionStats').innerHTML = `
      <span><b>${evaluation.positive ?? 0}</b> tích cực</span>
      <span><b>${evaluation.negative ?? 0}</b> tiêu cực</span>
      <span><b>${evaluation.high_impact ?? 0}</b> tác động cao</span>
    `;

    renderVariables(d.variables || []);
    renderSources(d.sources || []);
  } catch (err) {
    if (status) {
      status.textContent = `Không tải được dữ liệu thử nghiệm: ${err?.message || err}`;
      status.classList.add('error');
    }
    const box = $('variablesGrid');
    if (box) box.innerHTML = '<div class="empty">Nguồn dữ liệu đang lỗi hoặc chưa phản hồi. Trang test không dùng dữ liệu giả để thay thế.</div>';
  }
}

init();
