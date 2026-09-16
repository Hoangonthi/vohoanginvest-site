import { supabaseClient } from './assets/js/supabase-client.js';

const $ = s => document.querySelector(s);
const loginBox = $('#loginBox');
const app = $('#app');
const loginMsg = $('#loginMsg');
const saveMsg = $('#saveMsg');
const nextPage = new URLSearchParams(location.search).get('next');

const fmtMoney = v => {
  const n = Number(v || 0);
  return n > 0 ? `${new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(n)} đ` : '—';
};
const fmtPct = v => Number.isFinite(Number(v)) ? `${Number(v).toFixed(1).replace('.0','')}%` : '—';
const value = id => $(id)?.value?.trim?.() ?? '';
const number = id => Number($(id)?.value || 0);

function friendly(error){
  const m = String(error?.message || '');
  if(m.includes('AUTH_REQUIRED')) return 'Phiên đăng nhập chưa sẵn sàng. Vui lòng đăng nhập lại.';
  if(m.includes('auth_user_id')) return 'Hồ sơ đang được đồng bộ. Hãy tải lại trang một lần.';
  return m || 'Chưa tải được Hồ sơ Nhà đầu tư.';
}

function fill(p={}){
  $('#displayName').value = p.display_name || '';
  $('#totalCapital').value = p.total_capital ?? '';
  $('#investableCapital').value = p.investable_capital ?? '';
  $('#cashBuffer').value = p.cash_buffer ?? '';
  $('#marginLimit').value = p.margin_limit_pct ?? 0;
  $('#riskBudget').value = p.portfolio_risk_budget_pct ?? 8;
  $('#maxPosition').value = p.max_position_pct ?? 20;
  $('#maxSector').value = p.max_sector_pct ?? 35;
  $('#maxDrawdown').value = p.max_drawdown_pct ?? 20;
  updateSummary();
}

function validateProfile(){
  const total = number('#totalCapital');
  const investable = number('#investableCapital');
  const buffer = number('#cashBuffer');
  const margin = number('#marginLimit');
  const risk = number('#riskBudget');
  const pos = number('#maxPosition');
  const sector = number('#maxSector');
  const dd = number('#maxDrawdown');

  if(total < 0 || investable < 0 || buffer < 0) return 'Các giá trị vốn không được âm.';
  if(total > 0 && investable > total) return 'Vốn được phép đầu tư đang lớn hơn tổng tài sản tài chính.';
  if(total > 0 && buffer > total) return 'Quỹ tiền mặt dự phòng đang lớn hơn tổng tài sản tài chính.';
  if(margin < 0 || margin > 300) return 'Giới hạn margin cần nằm trong khoảng 0–300% vốn tự có.';
  if(risk <= 0 || risk > 100) return 'Ngân sách rủi ro danh mục cần lớn hơn 0 và không vượt 100%.';
  if(pos <= 0 || pos > 100 || sector <= 0 || sector > 100 || dd <= 0 || dd > 100) return 'Các giới hạn tỷ trọng và drawdown cần nằm trong khoảng 0–100%.';
  return '';
}

function updateSummary(){
  const fields = ['#totalCapital','#investableCapital','#cashBuffer','#marginLimit','#riskBudget','#maxPosition','#maxSector','#maxDrawdown'];
  const filled = fields.filter(id => $(id)?.value !== '').length;
  const pct = Math.round(filled / fields.length * 100);
  $('#completionPct').textContent = `${pct}%`;
  $('#completionBar').style.width = `${pct}%`;
  $('#completionLabel').textContent = pct === 100 ? 'Đã đủ dữ liệu nền' : pct >= 60 ? 'Còn thiếu một số dữ liệu' : 'Chưa đủ dữ liệu';

  const total = number('#totalCapital');
  const investable = number('#investableCapital');
  const buffer = number('#cashBuffer');
  const risk = number('#riskBudget');
  const pos = number('#maxPosition');
  const sector = number('#maxSector');
  const dd = number('#maxDrawdown');

  $('#sCapital').textContent = fmtMoney(investable || total);
  $('#sBuffer').textContent = total > 0 ? fmtPct(buffer / total * 100) : '—';
  $('#sRisk').textContent = fmtPct(risk);
  $('#sPosition').textContent = fmtPct(pos);
  $('#sSector').textContent = fmtPct(sector);
  $('#sDrawdown').textContent = fmtPct(dd);

  const flag = $('#consistencyFlag');
  const hardError = validateProfile();
  const warnings = [];
  if(!hardError && pos > sector) warnings.push('Tỷ trọng tối đa/mã đang cao hơn tỷ trọng tối đa/ngành.');
  if(!hardError && risk > dd) warnings.push('Risk Budget danh mục đang cao hơn Max Drawdown. Hãy kiểm tra lại ý nghĩa hai giới hạn này.');
  if(!hardError && total > 0 && investable > 0 && buffer > 0 && investable + buffer > total) warnings.push('Vốn đầu tư + quỹ dự phòng đang lớn hơn tổng tài sản. Nếu hai khoản này không chồng lấp, cần kiểm tra lại số liệu.');

  if(hardError){
    flag.className = 'flag warn';
    flag.textContent = hardError;
  }else if(warnings.length){
    flag.className = 'flag warn';
    flag.textContent = warnings.join(' ');
  }else if(pct === 100){
    flag.className = 'flag good';
    flag.textContent = 'Các giới hạn nền hiện không có mâu thuẫn rõ ràng. Hệ thống có thể dùng chung bộ dữ liệu này.';
  }else{
    flag.className = 'flag';
    flag.textContent = 'Hoàn thiện các trường còn thiếu để các công cụ dùng dữ liệu nhất quán hơn.';
  }
}

async function load(){
  loginMsg.textContent = 'Đang tải Hồ sơ Nhà đầu tư...';
  const {data,error} = await supabaseClient.rpc('investor_get_or_create_passport_v1');
  if(error){ loginMsg.textContent = friendly(error); return; }
  fill(data || {});
  loginBox.classList.add('hidden');
  app.classList.remove('hidden');
  loginMsg.textContent = '';
}

$('#googleLogin').onclick = async () => {
  loginMsg.textContent = 'Đang chuyển tới Google...';
  const redirectTo = location.origin + location.pathname + location.search;
  const {error} = await supabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo,queryParams:{prompt:'select_account'}}});
  if(error) loginMsg.textContent = friendly(error);
};

$('#saveProfile').onclick = async () => {
  const validation = validateProfile();
  if(validation){ saveMsg.className='status bad'; saveMsg.textContent = validation; return; }
  const button = $('#saveProfile');
  button.disabled = true;
  saveMsg.className = 'status';
  saveMsg.textContent = 'Đang lưu...';
  const payload = {
    display_name:value('#displayName'),
    total_capital:value('#totalCapital'),
    investable_capital:value('#investableCapital'),
    cash_buffer:value('#cashBuffer'),
    margin_limit_pct:value('#marginLimit'),
    portfolio_risk_budget_pct:value('#riskBudget'),
    max_position_pct:value('#maxPosition'),
    max_sector_pct:value('#maxSector'),
    max_drawdown_pct:value('#maxDrawdown')
  };
  const {data,error} = await supabaseClient.rpc('investor_save_passport_v1',{p_payload:payload});
  if(error){
    saveMsg.className = 'status bad';
    saveMsg.textContent = `Chưa lưu được: ${friendly(error)}`;
  }else{
    if(data) fill(data);
    saveMsg.className = 'status good';
    saveMsg.textContent = 'Đã lưu. Máy tính đầu tư và Investor Decision OS sẽ dùng lại bộ giới hạn này.';
    if(nextPage && /^[a-z0-9-]+\.html$/i.test(nextPage)) setTimeout(()=>location.href=nextPage,500);
  }
  button.disabled = false;
};

$('#openCalculator').onclick = () => location.href = 'investor-calculator.html';
$('#logout').onclick = async () => { await supabaseClient.auth.signOut(); location.href='investor-profile.html'; };

['#displayName','#totalCapital','#investableCapital','#cashBuffer','#marginLimit','#riskBudget','#maxPosition','#maxSector','#maxDrawdown'].forEach(id => $(id)?.addEventListener('input',updateSummary));

const {data} = await supabaseClient.auth.getSession();
if(data.session) await load();
