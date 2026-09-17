const PS_URL = 'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/derivatives-feed';
const EXPECTED_SYMBOL = 'VN30F1M';

const nf = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const el = id => document.getElementById(id);
const num = v => {
  const n = Number(v);
  return Number.isFinite(n) ? nf.format(n) : '—';
};

function clearCard(message = 'Dữ liệu phái sinh đang cập nhật') {
  const trend = el('vh-ps-trend');
  const entry = el('vh-ps-entry');
  const current = el('vh-ps-current');
  const targets = el('vh-ps-targets');
  const reversal = el('vh-ps-reversal');
  const status = el('vh-ps-status');

  if (trend) trend.textContent = '—';
  if (entry) entry.textContent = '—';
  if (current) current.textContent = '—';
  if (targets) targets.textContent = '—';
  if (reversal) reversal.textContent = '—';
  if (status) status.textContent = message;
}

function renderValidated(d) {
  const trendText = String(d?.trend || '').trim();
  const trend = el('vh-ps-trend');
  const entry = el('vh-ps-entry');
  const current = el('vh-ps-current');
  const targets = el('vh-ps-targets');
  const reversal = el('vh-ps-reversal');
  const status = el('vh-ps-status');

  if (trend) {
    trend.textContent = trendText || '—';
    trend.className = 'ps-value ' + (
      trendText.toLowerCase() === 'tăng' ? 'up' :
      trendText.toLowerCase() === 'giảm' ? 'down' : ''
    );
  }
  if (entry) entry.textContent = num(d?.system_price);
  if (current) current.textContent = num(d?.last_price);
  if (targets) {
    targets.textContent = `T1 ${num(d?.targets?.t1)} · T2 ${num(d?.targets?.t2)} · T3 ${num(d?.targets?.t3)}`;
  }
  if (reversal) reversal.textContent = num(d?.reversal_price);
  if (status) status.textContent = d?.fresh === true ? 'Realtime' : 'Dữ liệu phái sinh cuối cùng';
}

async function enforceDerivativesSource() {
  try {
    const r = await fetch(`${PS_URL}?guard=1&t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();

    // Hard rule: this card belongs to VN30F1M only.
    // Never display VN-Index, VN30 cash, or another symbol here.
    if (String(d?.symbol || '').toUpperCase() !== EXPECTED_SYMBOL) {
      clearCard();
      return;
    }

    renderValidated(d);
  } catch (_) {
    clearCard();
  }
}

enforceDerivativesSource();
setInterval(enforceDerivativesSource, 2000);
