export function esc(v=''){
  return String(v??'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;');
}

const baseSourceMap={
  WEBSITE_CONTACT:'Liên hệ từ website',
  MARKET_READER_BRIEF:'Đăng ký từ Bản đồ thị trường',
  HOME_MARKET_BRIEF:'Bản đồ thị trường từ trang chủ',
  SERVICE_PAGE:'Trang dịch vụ số',
  INVESTOR_PROFILE_ASSESSMENT:'Bài đánh giá nhà đầu tư',
  WEBSITE_CONTACT_FORM:'Form liên hệ website',
  TOOL_GAME:'Hoạt động trên website'
};

const channelMap={
  zalo:'Zalo',
  facebook:'Facebook',
  tiktok:'TikTok',
  referral:'Giới thiệu',
  ctv:'CTV',
  website:'Website',
  email:'Email',
  phone:'Điện thoại',
  market_reader:'Thị trường hôm nay',
  morning_brief:'Sáng nay cần nhìn gì',
  watchlist:'Danh sách cổ phiếu theo dõi',
  after_session:'Sau phiên',
  cta:'Nút hành động'
};

const toolMap={
  MORNING_BRIEF:'Sáng nay cần nhìn gì',
  MARKET_READER:'Thị trường hôm nay',
  MARKET_BRIEF:'Bản đồ thị trường',
  WATCHLIST:'Danh sách cổ phiếu theo dõi',
  AFTER_SESSION:'Sau phiên',
  RISK_BUDGET:'Ngân sách rủi ro',
  TRADE_AUTOPSY:'Mổ xẻ giao dịch',
  INVESTOR_SCORE:'Điểm nhà đầu tư',
  SYSTEM_JOURNAL:'Nhật ký hệ thống',
  WEBSITE_GROWTH:'Website',
  INVESTOR_CALCULATOR:'Máy tính nhà đầu tư'
};

const eventMap={
  VIEW:'Đã xem',
  COPY_BRIEF:'Đã sao chép bản tin',
  START:'Bắt đầu sử dụng',
  CTA_CLICK:'Đã bấm hành động',
  COMPLETE:'Đã hoàn thành',
  VIEW_HOT_STOCKS:'Đã xem cổ phiếu nổi bật',
  SHARE:'Đã chia sẻ',
  LEAD_SUCCESS:'Đã để lại thông tin',
  SUBSCRIBE:'Đã đăng ký nhận nội dung'
};

const stageMap={
  NEW_LEAD:'Khách mới',
  ENGAGED:'Đã tương tác',
  QUALIFIED:'Có nhu cầu rõ',
  MEETING:'Đang hẹn',
  CLIENT:'Khách hàng',
  NURTURE:'Tiếp tục theo dõi',
  LOST:'Không tiếp tục'
};

const priorityMap={
  P1:'Cần xử lý ngay',
  P2:'Ưu tiên hôm nay',
  P3:'Theo dõi',
  P4:'Chưa cần xử lý'
};

const temperatureMap={
  HOT:'Quan tâm cao',
  WARM:'Đang quan tâm',
  COOL:'Mới tìm hiểu'
};

const leadStatusMap={
  ACTIVE:'Mới',
  CONTACTED:'Đã liên hệ',
  CONVERTED:'Đã chuyển đổi',
  UNSUBSCRIBED:'Đã dừng nhận',
  INVALID:'Không hợp lệ'
};

export function parseSource(raw=''){
  const text=String(raw||'').trim();
  if(!text)return {raw:'',base:'',baseLabel:'Chưa rõ nguồn',sourceLabel:'Chưa rõ nguồn',channel:'',campaign:'',ref:'',sessionId:''};
  const base=text.split('|')[0]||text;
  const get=k=>text.match(new RegExp('(?:^|\\|)'+k+'=([^|]+)'))?.[1]||'';
  const src=get('src');
  const med=get('med');
  const campaign=get('cmp');
  const ref=get('ref');
  const sessionId=get('sid');
  const parts=[];
  const baseLabel=baseSourceMap[base]||base.replaceAll('_',' ').toLowerCase().replace(/(^|\s)\S/g,s=>s.toUpperCase());
  parts.push(baseLabel);
  if(src)parts.push(channelMap[src.toLowerCase()]||src);
  if(ref)parts.push('Giới thiệu: '+ref);
  if(campaign)parts.push('Chiến dịch: '+campaign);
  return {
    raw:text,
    base,
    baseLabel,
    sourceLabel:parts.join(' · '),
    channel:channelMap[(med||src).toLowerCase()]||med||src||'',
    campaign,
    ref,
    sessionId
  };
}

export function sourceLabel(raw=''){return parseSource(raw).sourceLabel;}
export function toolLabel(v=''){return toolMap[String(v||'').toUpperCase()]||String(v||'').replaceAll('_',' ');}
export function eventLabel(v=''){return eventMap[String(v||'').toUpperCase()]||String(v||'').replaceAll('_',' ');}
export function stageLabel(v=''){return stageMap[String(v||'').toUpperCase()]||v||'—';}
export function priorityLabel(v=''){return priorityMap[String(v||'').toUpperCase()]||v||'—';}
export function temperatureLabel(v=''){return temperatureMap[String(v||'').toUpperCase()]||v||'—';}
export function leadStatusLabel(v=''){return leadStatusMap[String(v||'').toUpperCase()]||v||'—';}

export function severityLabel(v=''){
  return ({CRITICAL:'Rất cần ưu tiên',HIGH:'Cần ưu tiên',MEDIUM:'Cần xem thêm',LOW:'Ổn'})[String(v||'').toUpperCase()]||'Chưa có';
}

export function formatDateTime(v){
  if(!v)return '—';
  try{
    return new Intl.DateTimeFormat('vi-VN',{
      timeZone:'Asia/Ho_Chi_Minh',
      day:'2-digit',month:'2-digit',
      hour:'2-digit',minute:'2-digit',
      hour12:false
    }).format(new Date(v));
  }catch{return '—';}
}

export function formatTime(v){
  if(!v)return '—';
  try{
    return new Intl.DateTimeFormat('vi-VN',{
      timeZone:'Asia/Ho_Chi_Minh',
      hour:'2-digit',minute:'2-digit',
      hour12:false
    }).format(new Date(v));
  }catch{return '—';}
}

export function actionText(a={}){
  const tool=toolLabel(a.tool_code);
  const event=eventLabel(a.event_type);
  const result=String(a.result_code||'').trim();
  if(a.event_type==='CTA_CLICK'&&result==='CONTACT')return 'Bấm liên hệ từ '+tool;
  if(a.event_type==='CTA_CLICK'&&result==='CALCULATOR')return 'Mở máy tính từ '+tool;
  if(a.event_type==='COPY_BRIEF')return 'Sao chép nội dung ở '+tool;
  if(a.event_type==='LEAD_SUCCESS')return 'Để lại thông tin tại '+tool;
  if(a.event_type==='SUBSCRIBE')return 'Đăng ký nhận nội dung tại '+tool;
  if(a.event_type==='VIEW')return 'Xem '+tool+(result?' · trạng thái: '+result:'');
  return event+' · '+tool+(result?' · '+result:'');
}
