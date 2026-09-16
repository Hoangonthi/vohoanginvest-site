import { supabaseClient } from './assets/js/supabase-client.js';

const $ = s => document.querySelector(s);
const fmtMoney = v => Number(v || 0) > 0
  ? `${new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(Number(v))} đ`
  : '—';
const fmtPct = v => Number.isFinite(Number(v)) ? `${Number(v).toFixed(1).replace('.0','')}%` : '—';

const loginBox = $('#loginBox');
const app = $('#app');
const loginMsg = $('#loginMsg');
const nextPage = new URLSearchParams(location.search).get('next');

function fill(p = {}) {
  $('#mCapital').textContent = fmtMoney(p.investable_capital || p.total_capital);
  $('#mRisk').textContent = fmtPct(p.portfolio_risk_budget_pct ?? 8);
  $('#mPosition').textContent = fmtPct(p.max_position_pct ?? 20);
  $('#mSector').textContent = fmtPct(p.max_sector_pct ?? 35);
  $('#mDrawdown').textContent = fmtPct(p.max_drawdown_pct ?? 20);
  $('#mMargin').textContent = fmtPct(p.margin_limit_pct ?? 0);
  $('#profileName').textContent = p.display_name || 'Hồ sơ Nhà đầu tư';
}

function friendly(error) {
  const m = String(error?.message || '');
  if (m.includes('AUTH_REQUIRED')) return 'Phiên đăng nhập chưa sẵn sàng. Vui lòng đăng nhập lại.';
  if (m.includes('auth_user_id')) return 'Hồ sơ đang được đồng bộ. Hãy tải lại trang một lần.';
  return m || 'Chưa tải được Hồ sơ Nhà đầu tư.';
}

async function load() {
  loginMsg.textContent = 'Đang tải Hồ sơ Nhà đầu tư...';
  const { data, error } = await supabaseClient.rpc('investor_get_or_create_passport_v1');
  if (error) {
    loginMsg.textContent = friendly(error);
    return;
  }

  fill(data || {});
  loginBox.classList.add('hidden');
  app.classList.remove('hidden');
  loginMsg.textContent = '';

  if (
    nextPage &&
    /^[a-z0-9-]+\.html$/i.test(nextPage) &&
    (data?.investable_capital || data?.total_capital)
  ) {
    history.replaceState({}, '', location.pathname);
    location.href = nextPage;
  }
}

$('#googleLogin').onclick = async () => {
  loginMsg.textContent = 'Đang chuyển tới Google...';
  const redirectTo = location.origin + location.pathname + (nextPage ? `?next=${encodeURIComponent(nextPage)}` : '');
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, queryParams: { prompt: 'select_account' } }
  });
  if (error) loginMsg.textContent = friendly(error);
};

$('#editProfile').onclick = () => {
  const target = nextPage && /^[a-z0-9-]+\.html$/i.test(nextPage)
    ? `investor-profile.html?next=${encodeURIComponent(nextPage)}`
    : 'investor-profile.html';
  location.href = target;
};

$('#logout').onclick = async () => {
  await supabaseClient.auth.signOut();
  location.href = 'investor-os.html';
};

const { data } = await supabaseClient.auth.getSession();
if (data.session) await load();
