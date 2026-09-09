import { mountMarketLeadForm } from "./market-lead.js";
import { trackTool, toolSession } from "./tool-events.js";

let initialized = false;

function ensureStyles(){
  if(document.querySelector('link[data-growth-engine-css]')) return;
  const link=document.createElement('link');
  link.rel='stylesheet';link.href='./assets/css/growth-engine.css?v=20260909-hub3';link.dataset.growthEngineCss='';document.head.appendChild(link);
}
function ensureUnifyStyles(){
  if(document.querySelector('link[data-homepage-unify-css]')) return;
  const link=document.createElement('link');
  link.rel='stylesheet';link.href='./assets/css/homepage-unify.css?v=20260909-v2';link.dataset.homepageUnifyCss='';document.head.appendChild(link);
}
function addNavLinks(){const nav=document.querySelector('[data-nav]');if(!nav)return;const first=nav.firstElementChild;const entries=[['thi-truong-hom-nay.html','Thị trường'],['sau-phien-cua-toi.html','Sau phiên'],['investor-calculator.html','Máy tính']];entries.reverse().forEach(([href,label])=>{if(nav.querySelector(`a[href="${href}"]`))return;const a=document.createElement('a');a.href=href;a.textContent=label;a.dataset.growthNav='1';nav.insertBefore(a,first)})}

const personas={
  NEW:{label:'Mới đầu tư',title:'Bắt đầu từ vốn và rủi ro, chưa cần vội tìm mã.',href:'cong-cu-dau-tu-chung-khoan.html?persona=new',cta:'Xem lộ trình phù hợp'},
  LOSS:{label:'Đang lỗ',title:'Tách phần lỗ do thị trường và phần lỗ do danh mục/cách giao dịch.',href:'kiem-tra-nhanh-tai-khoan.html?persona=loss',cta:'Kiểm tra tài khoản 30 giây'},
  MARGIN:{label:'Đang dùng margin',title:'Biết sức chịu của tài khoản trước khi nghĩ tới mua thêm.',href:'tinh-margin-chung-khoan.html?persona=margin',cta:'Kiểm tra margin'},
  CASH:{label:'Đang cầm tiền',title:'Không cần FOMO. Xác định điều kiện nào khiến mình được phép tham gia.',href:'sang-nay-can-nhin-gi.html?persona=cash',cta:'Xem sáng nay cần nhìn gì'},
  PROFIT:{label:'Đang có lãi',title:'Giữ lợi thế mà không biến lãi thành rủi ro vì hưng phấn.',href:'sau-phien-cua-toi.html?worry=Đang+lãi+nhưng+không+biết+giữ+hay+bán',cta:'Rà lại sau phiên'},
  VETERAN:{label:'Đầu tư lâu năm',title:'Bỏ qua lời quảng cáo. Kiểm chứng bằng lịch sử Market Score và logic hệ thống.',href:'nhat-ky-he-thong.html?persona=veteran',cta:'Xem nhật ký hệ thống'}
};

const questions=[
  'Tài khoản giảm mạnh hơn thị trường — vì sao?',
  'Mã tôi đang cầm yếu thật hay chỉ điều chỉnh?',
  'Margin hiện tại có quá cao không?',
  'Tôi vừa bán vì đúng kế hoạch hay vì sợ?',
  'Ngày mai nên đứng yên hay cần hành động?',
  'Tôi lỗ vì thị trường hay vì cách mình giao dịch?'
];

function addDecisionHub(){
  const hero=document.querySelector('main#top .hero');
  if(!hero||document.querySelector('[data-growth-hub]'))return;
  const saved=localStorage.getItem('vh_investor_state_v1')||'';
  const section=document.createElement('section');
  section.className='growth-hub dark-surface';section.dataset.growthHub='';
  section.innerHTML=`<div class="growth-hub-inner">
    <div class="growth-hub-intro">
      <div><span class="growth-kicker">BẮT ĐẦU TỪ CHÍNH TÌNH TRẠNG CỦA ANH/CHỊ</span><h2>Một hệ thống, nhưng không phải ai cũng cần bắt đầu ở cùng một chỗ.</h2></div>
      <p>Chọn trạng thái gần nhất. Không cần đăng nhập và có thể đổi bất cứ lúc nào.</p>
    </div>

    <div class="growth-persona-grid" data-persona-entry>
      ${Object.entries(personas).map(([code,p],i)=>`<button type="button" data-persona="${code}" class="${saved===code?'is-active':''}"><i>${String(i+1).padStart(2,'0')}</i><b>${p.label}</b><span>${p.title}</span></button>`).join('')}
    </div>
    <div class="growth-persona-next" data-persona-next></div>

    <div class="growth-hub-divider"></div>

    <div class="growth-start-head">
      <div><span class="growth-kicker">CHỌN VIỆC CẦN LÀM</span><h3>Đi thẳng vào câu hỏi đang làm anh/chị băn khoăn.</h3></div>
      <div class="growth-proof"><b>Realtime</b><b>30 giây</b><b>Sau phiên</b><b>16 máy tính</b></div>
    </div>
    <div class="growth-path-grid" data-growth-start>
      <a class="growth-path is-market" href="thi-truong-hom-nay.html" data-growth-action="market"><span>01 · TRƯỚC / TRONG PHIÊN</span><strong>Thị trường đang ở trạng thái nào?</strong><p>Đọc điểm thị trường, độ rộng, dòng tiền, nhóm dẫn dắt và hành động hệ thống.</p><b>Mở Bộ đọc realtime →</b></a>
      <a class="growth-path is-personal" href="kiem-tra-nhanh-tai-khoan.html" data-growth-action="quick-check"><span>02 · KIỂM TRA 30 GIÂY</span><strong>Tài khoản hôm nay có ổn không?</strong><p>Nhập hiệu quả tài khoản, margin và số mã để biết điều cần kiểm tra trước tiên.</p><b>Kiểm tra nhanh →</b></a>
      <a class="growth-path" href="sau-phien-cua-toi.html" data-growth-action="after-session"><span>03 · SAU PHIÊN</span><strong>Tôi lỗ/lãi vì thị trường hay vì danh mục?</strong><p>So với VN-Index, ngành, margin và hành vi để tìm nguyên nhân sâu hơn.</p><b>Mở Sau phiên của tôi →</b></a>
      <a class="growth-path" href="sang-nay-can-nhin-gi.html" data-growth-action="morning"><span>04 · SÁNG HÔM SAU</span><strong>Sáng nay cần nhìn gì?</strong><p>Ba điều cần theo dõi và điều kiện khiến quan điểm phải thay đổi.</p><b>Mở Bản đồ đầu ngày →</b></a>
    </div>

    <div class="growth-hub-divider is-soft"></div>

    <div class="growth-question-block" data-growth-questions>
      <div class="growth-question-copy"><span class="growth-kicker">SAU MỘT PHIÊN</span><h3>Điều khó nhất không phải thiếu tin, mà là không biết vấn đề nằm ở đâu.</h3><p>Nếu một câu dưới đây giống điều anh/chị đang nghĩ, bấm thẳng vào câu đó.</p></div>
      <div class="growth-question-grid">${questions.map((q,i)=>`<a href="sau-phien-cua-toi.html?worry=${encodeURIComponent(q)}&utm_source=homepage&utm_medium=worry" data-growth-action="worry-${i+1}"><span>${String(i+1).padStart(2,'0')}</span><b>${q}</b><em>Kiểm tra →</em></a>`).join('')}</div>
    </div>
  </div>`;
  hero.insertAdjacentElement('afterend',section);

  const next=section.querySelector('[data-persona-next]');
  const renderNext=code=>{const p=personas[code];if(!p){next.innerHTML='';return}next.innerHTML=`<span>GỢI Ý PHÙ HỢP</span><strong>${p.title}</strong><a href="${p.href}" data-growth-action="persona-${code.toLowerCase()}">${p.cta} →</a>`};
  renderNext(saved);
  section.querySelectorAll('[data-persona]').forEach(btn=>btn.addEventListener('click',()=>{const code=btn.dataset.persona;localStorage.setItem('vh_investor_state_v1',code);section.querySelectorAll('[data-persona]').forEach(x=>x.classList.toggle('is-active',x===btn));renderNext(code);trackTool('INVESTOR_STATE','SELECT',{resultCode:code,metadata:{path:location.pathname}})}));
}

function addLeadMagnet(){
  const contact=document.querySelector('#lien-he');if(!contact||document.querySelector('[data-growth-lead]'))return;
  const section=document.createElement('section');section.className='growth-lead dark-surface';section.dataset.growthLead='';
  section.innerHTML=`<div class="growth-lead-inner">
    <div class="growth-lead-copy"><span>GIỮ NHỊP VỚI THỊ TRƯỜNG</span><h2>Nhận “Bản đồ thị trường” khi có điều thực sự đáng chú ý.</h2><p>Không chạy theo từng mã. Nội dung tập trung vào trạng thái thị trường, dòng tiền, nhóm dẫn dắt, rủi ro và việc nên làm tiếp theo.</p><div class="growth-lead-points"><b>Không phím hàng</b><b>Không spam</b><b>Có hành động cụ thể</b></div><small>Để lại kênh liên hệ phù hợp. Anh/chị có thể yêu cầu dừng bất cứ lúc nào.</small></div>
    <div class="growth-lead-form" data-market-lead-root data-lead-source="HOME_MARKET_BRIEF"></div>
  </div>`;
  contact.parentNode.insertBefore(section,contact);
  mountMarketLeadForm(section.querySelector('[data-market-lead-root]'),{source:'HOME_MARKET_BRIEF',metadata:{placement:'homepage'}})
}

function addConnectHub(){
  const contact=document.querySelector('#lien-he');
  if(!contact||document.querySelector('[data-growth-connect]'))return;
  const section=document.createElement('section');
  section.className='growth-connect dark-surface';section.id='ket-noi';section.dataset.growthConnect='';
  section.innerHTML=`<div class="growth-connect-inner">
    <div class="growth-connect-head">
      <div><span class="growth-connect-kicker">KẾT NỐI & MỞ TÀI KHOẢN</span><h2>Theo dõi Võ Hoàng ở kênh anh/chị dùng hằng ngày.</h2></div>
      <p>Nếu cần mở tài khoản chứng khoán, anh/chị có thể dùng liên kết giới thiệu bên dưới để hệ thống ghi nhận đúng mã hỗ trợ.</p>
    </div>
    <div class="growth-connect-grid">
      <article class="growth-connect-card">
        <span>KÊNH CHÍNH THỨC</span><h3>Nội dung thị trường, hệ thống đầu tư và livestream</h3><p>Ưu tiên theo dõi một kênh quen thuộc; không cần chạy theo tất cả nền tảng.</p>
        <div class="growth-socials">
          <a href="https://www.facebook.com/vohoanginvest" target="_blank" rel="noopener noreferrer" data-growth-action="social-facebook">Facebook</a>
          <a href="https://www.youtube.com/@vohoanginvest" target="_blank" rel="noopener noreferrer" data-growth-action="social-youtube">YouTube</a>
          <a href="https://www.tiktok.com/@vovuhoang" target="_blank" rel="noopener noreferrer" data-growth-action="social-tiktok">TikTok</a>
        </div>
      </article>
      <article class="growth-connect-card">
        <span>MỞ TÀI KHOẢN CHỨNG KHOÁN</span><h3>Chọn công ty phù hợp với nhu cầu của anh/chị</h3><p>Đây là liên kết giới thiệu của Võ Hoàng; việc mở tài khoản không đồng nghĩa với cam kết lợi nhuận hay khuyến nghị giao dịch.</p>
        <div class="growth-brokers">
          <div class="growth-broker"><div class="growth-broker-head"><strong>VPS</strong><small>ID 7251</small></div><p>Mã giới thiệu: <b>7251</b></p><div class="growth-broker-actions"><a href="https://openaccount.vps.com.vn/?MKTID=7251" target="_blank" rel="noopener noreferrer" data-growth-action="open-vps">Mở tài khoản VPS →</a></div></div>
          <div class="growth-broker"><div class="growth-broker-head"><strong>TCBS</strong><small>ID D72226</small></div><p>Mã ID: <b>D72226</b></p><div class="growth-broker-actions"><a href="https://iwp.tcbs.com.vn/105CD72226" target="_blank" rel="noopener noreferrer" data-growth-action="open-tcbs">Mở tài khoản TCBS →</a></div></div>
        </div>
        <p class="growth-disclosure">Anh/chị nên tự xem biểu phí, sản phẩm, điều kiện giao dịch và mức độ phù hợp trước khi mở hoặc sử dụng tài khoản.</p>
      </article>
    </div>
  </div>`;
  contact.parentNode.insertBefore(section,contact);
}

function addStickyMobile(){if(document.querySelector('[data-growth-sticky]'))return;const bar=document.createElement('div');bar.className='growth-sticky';bar.dataset.growthSticky='';bar.innerHTML=`<a href="thi-truong-hom-nay.html" data-growth-action="sticky-market"><span>●</span> Thị trường</a><a href="kiem-tra-nhanh-tai-khoan.html" data-growth-action="sticky-check">Kiểm tra</a><button type="button" data-open-contact data-contact-source="STICKY_CONTACT" data-growth-action="sticky-contact">Trao đổi</button>`;document.body.appendChild(bar)}
function handleStartParam(){const params=new URLSearchParams(location.search);const start=(params.get('start')||'').toLowerCase();if(!start)return;setTimeout(()=>{if(start==='profile'||start==='assessment')document.querySelector('[data-open-investor-profile]')?.click();if(start==='contact'||start==='talk')document.querySelector('[data-open-contact]')?.click()},550)}
function trackGrowth(){trackTool('WEBSITE_GROWTH','VIEW',{metadata:{path:location.pathname,session:toolSession()}});document.addEventListener('click',event=>{const el=event.target.closest('[data-growth-action]');if(!el)return;trackTool('WEBSITE_GROWTH','CTA_CLICK',{resultCode:String(el.dataset.growthAction||'CLICK').toUpperCase(),metadata:{path:location.pathname}})})}
export function initGrowthEngine(){if(initialized)return;initialized=true;ensureStyles();addNavLinks();addDecisionHub();addLeadMagnet();addConnectHub();ensureUnifyStyles();addStickyMobile();handleStartParam();trackGrowth()}
