import { mountMarketLeadForm } from "./market-lead.js";
import { trackTool, toolSession } from "./tool-events.js";

let initialized = false;

function ensureStyles(){
  if(document.querySelector('link[data-growth-engine-css]')) return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='./assets/css/growth-engine.css';
  link.dataset.growthEngineCss='';
  document.head.appendChild(link);
}

function addNavLinks(){
  const nav=document.querySelector('[data-nav]');
  if(!nav) return;
  const first=nav.firstElementChild;
  const entries=[
    ['thi-truong-hom-nay.html','Thị trường'],
    ['investor-calculator.html','Máy tính']
  ];
  entries.reverse().forEach(([href,label])=>{
    if(nav.querySelector(`a[href="${href}"]`)) return;
    const a=document.createElement('a');a.href=href;a.textContent=label;a.dataset.growthNav='1';
    nav.insertBefore(a,first);
  });
}

function addStartPaths(){
  const hero=document.querySelector('main#top .hero');
  if(!hero || document.querySelector('[data-growth-start]')) return;
  const section=document.createElement('section');
  section.className='growth-start dark-surface';
  section.dataset.growthStart='';
  section.innerHTML=`<div class="growth-start-inner">
    <div class="growth-start-head">
      <div><span>BẮT ĐẦU TỪ VIỆC CẦN LÀM</span><strong>Đừng đi vòng. Chọn đúng việc anh/chị đang cần lúc này.</strong></div>
      <div class="growth-proof"><b>Realtime</b><b>16 máy tính</b><b>17 câu đánh giá</b></div>
    </div>
    <div class="growth-path-grid">
      <a class="growth-path is-market" href="thi-truong-hom-nay.html" data-growth-action="market">
        <span>01 · TRƯỚC KHI QUYẾT ĐỊNH</span><strong>Thị trường đang ở trạng thái nào?</strong><p>Đọc điểm thị trường, độ rộng, dòng tiền, nhóm dẫn dắt và hành động hệ thống.</p><b>Mở Bộ đọc realtime →</b>
      </a>
      <a class="growth-path" href="investor-calculator.html" data-growth-action="calculator">
        <span>02 · TRƯỚC KHI BẤM LỆNH</span><strong>Con số này có đúng không?</strong><p>Tính quy mô lệnh, hòa vốn, margin, cổ tức, rủi ro danh mục và các phép tính dễ nhầm.</p><b>Mở máy tính đầu tư →</b>
      </a>
      <button class="growth-path" type="button" data-open-investor-profile data-growth-action="assessment">
        <span>03 · KHI KẾT QUẢ KHÔNG NHƯ Ý</span><strong>Tôi đang sai ở đâu?</strong><p>17 câu để nhìn lại vốn, rủi ro, danh mục, chiến lược, hành vi và hệ thống đầu tư.</p><b>Làm đánh giá 3 phút →</b>
      </button>
    </div>
  </div>`;
  hero.insertAdjacentElement('afterend',section);
}

function addLeadMagnet(){
  const contact=document.querySelector('#lien-he');
  if(!contact || document.querySelector('[data-growth-lead]')) return;
  const section=document.createElement('section');
  section.className='growth-lead dark-surface';
  section.dataset.growthLead='';
  section.innerHTML=`<div class="growth-lead-inner">
    <div class="growth-lead-copy">
      <span>GIỮ NHỊP VỚI THỊ TRƯỜNG</span>
      <h2>Nhận “Bản đồ thị trường” thay vì chạy theo từng mã.</h2>
      <p>Khi có nội dung đáng gửi, trọng tâm sẽ là: thị trường đang mạnh/yếu ở đâu, tiền đang nghiêng về nhóm nào, rủi ro nào cần tránh và việc nên làm tiếp theo.</p>
      <div class="growth-lead-points"><b>Không phím hàng</b><b>Không spam</b><b>Có hành động cụ thể</b></div>
    </div>
    <div class="growth-lead-form" data-market-lead-root data-lead-source="HOME_MARKET_BRIEF"></div>
  </div>`;
  contact.parentNode.insertBefore(section,contact);
  mountMarketLeadForm(section.querySelector('[data-market-lead-root]'),{source:'HOME_MARKET_BRIEF',metadata:{placement:'homepage'}});
}

function addStickyMobile(){
  if(document.querySelector('[data-growth-sticky]')) return;
  const bar=document.createElement('div');
  bar.className='growth-sticky';
  bar.dataset.growthSticky='';
  bar.innerHTML=`<a href="thi-truong-hom-nay.html" data-growth-action="sticky-market"><span>●</span> Thị trường</a><a href="investor-calculator.html" data-growth-action="sticky-calc">Máy tính</a><button type="button" data-open-contact data-contact-source="STICKY_CONTACT" data-growth-action="sticky-contact">Trao đổi</button>`;
  document.body.appendChild(bar);
}

function handleStartParam(){
  const params=new URLSearchParams(location.search);
  const start=(params.get('start')||'').toLowerCase();
  if(!start) return;
  setTimeout(()=>{
    if(start==='profile'||start==='assessment') document.querySelector('[data-open-investor-profile]')?.click();
    if(start==='contact'||start==='talk') document.querySelector('[data-open-contact]')?.click();
  },550);
}

function trackGrowth(){
  trackTool('WEBSITE_GROWTH','VIEW',{metadata:{path:location.pathname,session:toolSession()}});
  document.addEventListener('click',(event)=>{
    const el=event.target.closest('[data-growth-action]');
    if(!el) return;
    trackTool('WEBSITE_GROWTH','CTA_CLICK',{resultCode:String(el.dataset.growthAction||'CLICK').toUpperCase(),metadata:{path:location.pathname}});
  });
}

export function initGrowthEngine(){
  if(initialized) return; initialized=true;
  ensureStyles();
  addNavLinks();
  addStartPaths();
  addLeadMagnet();
  addStickyMobile();
  handleStartParam();
  trackGrowth();
}
