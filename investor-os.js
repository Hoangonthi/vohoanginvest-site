import { supabaseClient } from './assets/js/supabase-client.js';

const $ = s => document.querySelector(s);
const fmtMoney = v => Number(v || 0) > 0
  ? `${new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(Number(v))} đ`
  : '—';
const fmtPct = v => Number.isFinite(Number(v)) ? `${Number(v).toFixed(1).replace('.0','')}%` : '—';
const fmtPrice = v => Number(v || 0) > 0 ? new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(Number(v)) : '—';
const fmtTime = value => {
  if(!value) return '';
  const d = new Date(value);
  if(Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d);
};

const loginBox = $('#loginBox');
const app = $('#app');
const loginMsg = $('#loginMsg');
const nextPage = new URLSearchParams(location.search).get('next');

const stageLabels = {
  PRE_BUY:'Trước khi mua',
  HOLDING:'Đang nắm giữ',
  EVENT:'Tin / biến động',
  POST_SELL:'Sau khi bán',
  WEEKLY_REVIEW:'Cuối tuần'
};

const typeLabels = {
  CALC_POSITION_SIZE:'Tính quy mô lệnh',
  CALC_RR:'Tính lãi / lỗ kỳ vọng',
  CALC_AVERAGE_DOWN:'Kiểm tra mua thêm',
  CALC_MARGIN_STRESS:'Kiểm tra sức chịu margin',
  CALC_TRUE_BREAKEVEN:'Tính giá hòa vốn',
  CALC_MARGIN_COST:'Tính chi phí margin',
  CALC_DELEVERAGE:'Tính phương án hạ margin',
  CALC_RECOVER_CAPITAL:'Tính thu hồi vốn gốc',
  CALC_DRAWDOWN_RECOVERY:'Tính mức hồi phục',
  CALC_PORTFOLIO_RISK:'Kiểm tra rủi ro danh mục',
  CALC_CASH_DIVIDEND:'Tính cổ tức tiền mặt',
  CALC_EX_RIGHTS:'Tính giá sau chia / quyền',
  THESIS_REVIEW:'Rà soát vị thế',
  EVENT_TRIAGE:'Đánh giá tin và biến động',
  TRADE_REVIEW:'Xem lại lệnh đã bán',
  WEEKLY_PATTERN:'Xem lại tuần'
};

function fillProfile(p = {}) {
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
  if(m.includes('AUTH_REQUIRED')) return 'Phiên đăng nhập chưa sẵn sàng. Vui lòng đăng nhập lại.';
  if(m.includes('auth_user_id')) return 'Hồ sơ đang được đồng bộ. Hãy tải lại trang một lần.';
  return m || 'Chưa tải được dữ liệu.';
}

function renderPositions(rows = []) {
  const list = $('#positionList');
  const count = Array.isArray(rows) ? rows.length : 0;
  $('#positionCount').textContent = `${count} VỊ THẾ`;

  if(!count){
    list.innerHTML = `
      <div class="empty-state">
        <strong>Chưa có vị thế nào được lưu.</strong>
        Khi anh/chị có một mã cần theo dõi, hãy bắt đầu từ bước kiểm tra trước khi mua hoặc rà soát vị thế đang giữ.
        <br><a href="tool-truoc-mua.html">Kiểm tra trước khi mua →</a>
      </div>`;
    return;
  }

  list.innerHTML = rows.slice(0,6).map(row => {
    const avg = Number(row.avg_price || 0);
    const cur = Number(row.market_price || 0);
    const pnl = avg > 0 && cur > 0 ? (cur / avg - 1) * 100 : null;
    const pnlClass = pnl == null ? '' : pnl >= 0 ? 'good' : 'bad';
    const pnlText = pnl == null ? 'Chưa cập nhật' : `${pnl >= 0 ? '+' : ''}${fmtPct(pnl)}`;
    return `
      <div class="position-row">
        <div class="symbol-cell"><small>Mã cổ phiếu</small><strong>${escapeHtml(row.symbol || '—')}</strong></div>
        <div><small>Giá vốn</small><b>${fmtPrice(avg)}</b></div>
        <div><small>Giá hiện tại</small><b>${fmtPrice(cur)}</b></div>
        <div><small>Lãi / lỗ</small><b class="position-pnl ${pnlClass}">${pnlText}</b></div>
        <a class="position-action" href="tool-dang-giu.html">Rà soát →</a>
      </div>`;
  }).join('');
}

function renderHistory(rows = []) {
  const list = $('#historyList');
  if(!Array.isArray(rows) || !rows.length){
    list.innerHTML = `
      <div class="empty-state">
        <strong>Chưa có quyết định nào được ghi lại.</strong>
        Hãy dùng các công cụ khi anh/chị chuẩn bị mua, đang giữ, gặp biến động hoặc vừa bán xong. Lịch sử sẽ hình thành từ chính những lần sử dụng đó.
      </div>`;
    return;
  }

  list.innerHTML = rows.slice(0,7).map(row => {
    const stage = stageLabels[row.decision_stage] || 'Quyết định';
    const title = typeLabels[row.decision_type] || stage;
    const next = row.next_best_action || 'Đã lưu lại để xem lại khi cần.';
    return `
      <div class="history-row">
        <div><span class="history-stage">${escapeHtml(stage)}</span></div>
        <div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(next)}</p></div>
        <div class="history-time">${escapeHtml(fmtTime(row.created_at))}</div>
      </div>`;
  }).join('');
}

function setNextAction(profile, positions = [], history = []) {
  const title = $('#nextTitle');
  const text = $('#nextText');
  const link = $('#nextLink');
  const capital = Number(profile?.investable_capital || profile?.total_capital || 0);

  if(capital <= 0){
    title.textContent = 'Hoàn thiện Hồ sơ Nhà đầu tư';
    text.textContent = 'Nhập vốn và các giới hạn chính trước khi dùng các công cụ tính toán và kiểm tra giao dịch.';
    link.textContent = 'Mở Hồ sơ Nhà đầu tư →';
    link.href = 'investor-profile.html';
    return;
  }

  if(Array.isArray(positions) && positions.length){
    title.textContent = `Rà soát ${positions.length} vị thế đang giữ`;
    text.textContent = 'Kiểm tra xem dữ kiện mới, mức giá hiện tại hoặc rủi ro có làm kế hoạch ban đầu cần thay đổi hay không.';
    link.textContent = 'Rà soát vị thế →';
    link.href = 'tool-dang-giu.html';
    return;
  }

  const weekAgo = Date.now() - 7 * 86400000;
  const recent = Array.isArray(history) ? history.filter(r => new Date(r.created_at).getTime() >= weekAgo) : [];
  const reviewedThisWeek = recent.some(r => r.decision_stage === 'WEEKLY_REVIEW');
  if(recent.length >= 3 && !reviewedThisWeek){
    title.textContent = 'Đã đến lúc xem lại tuần';
    text.textContent = 'Anh/chị đã có đủ một số quyết định gần đây để nhìn lại điều gì đang làm tốt và lỗi nào đang lặp.';
    link.textContent = 'Xem lại tuần →';
    link.href = 'tool-review-tuan.html';
    return;
  }

  if(Array.isArray(history) && history.length){
    title.textContent = 'Chuẩn bị cho quyết định tiếp theo';
    text.textContent = 'Nếu sắp mua một mã mới, hãy kiểm tra lý do mua, mức sai và số tiền được phép vào trước khi đặt lệnh.';
    link.textContent = 'Kiểm tra trước khi mua →';
    link.href = 'tool-truoc-mua.html';
    return;
  }

  title.textContent = 'Bắt đầu từ một lệnh thật';
  text.textContent = 'Khi có mã đang quan tâm, hãy kiểm tra lệnh trước khi mua. Đây sẽ là điểm bắt đầu cho lịch sử quyết định của anh/chị.';
  link.textContent = 'Kiểm tra trước khi mua →';
  link.href = 'tool-truoc-mua.html';
}

function escapeHtml(value){
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

async function load() {
  loginMsg.textContent = 'Đang tải thông tin của anh/chị...';

  const [profileRes, positionRes, historyRes] = await Promise.all([
    supabaseClient.rpc('investor_get_or_create_passport_v1'),
    supabaseClient.rpc('investor_list_positions_v1'),
    supabaseClient.rpc('investor_get_decision_history_v1',{p_limit:20})
  ]);

  if(profileRes.error){
    loginMsg.textContent = friendly(profileRes.error);
    return;
  }

  const profile = profileRes.data || {};
  const positions = positionRes.error ? [] : (positionRes.data || []);
  const history = historyRes.error ? [] : (historyRes.data || []);

  fillProfile(profile);
  renderPositions(positions);
  renderHistory(history);
  setNextAction(profile, positions, history);

  loginBox.classList.add('hidden');
  app.classList.remove('hidden');
  loginMsg.textContent = '';

  if(nextPage && /^[a-z0-9-]+\.html$/i.test(nextPage) && (profile.investable_capital || profile.total_capital)){
    history.replaceState({}, '', location.pathname);
    location.href = nextPage;
  }
}

$('#googleLogin').onclick = async () => {
  loginMsg.textContent = 'Đang chuyển tới Google...';
  const redirectTo = location.origin + location.pathname + (nextPage ? `?next=${encodeURIComponent(nextPage)}` : '');
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider:'google',
    options:{redirectTo,queryParams:{prompt:'select_account'}}
  });
  if(error) loginMsg.textContent = friendly(error);
};

$('#editProfile').onclick = () => {
  location.href = 'investor-profile.html';
};

$('#logout').onclick = async () => {
  await supabaseClient.auth.signOut();
  location.href = 'investor-os.html';
};

const { data } = await supabaseClient.auth.getSession();
if(data.session) await load();
