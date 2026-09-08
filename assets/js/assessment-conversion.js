const severityText={CRITICAL:'Kết quả cho thấy có điểm nên được rà soát sớm trước khi tiếp tục tăng rủi ro hoặc ra quyết định lớn.',HIGH:'Có một số điểm cần ưu tiên để tránh quyết định thiếu nhất quán hoặc rủi ro không cần thiết.',MEDIUM:'Hồ sơ có nền tảng nhưng vẫn còn điểm cần chuẩn hóa để quyết định ổn định hơn.',LOW:'Hồ sơ tương đối ổn; một buổi rà soát giúp kiểm tra xem hệ thống hiện tại có thực sự nhất quán hay không.'};

function enhance(root){
  const result=root.querySelector('.profile-assessment-result');
  if(!result||result.dataset.conversionEnhanced==='1')return;
  result.dataset.conversionEnhanced='1';
  const primary=result.querySelector('[data-open-contact]');
  if(primary){primary.textContent='Đặt lịch rà soát 1:1';primary.setAttribute('aria-label','Đặt lịch rà soát kết quả Assessment cùng Võ Hoàng')}
  const severity=[...result.querySelectorAll('.profile-result-grid *')].map(x=>x.textContent).join(' ');
  const code=severity.includes('Ưu tiên xử lý')?'CRITICAL':severity.includes('Cần ưu tiên')?'HIGH':severity.includes('Cần cải thiện')?'MEDIUM':'LOW';
  const box=document.createElement('section');
  box.className='assessment-conversion-box';
  box.innerHTML=`<div><span class="assessment-conversion-eyebrow">BƯỚC TIẾP THEO</span><h3>Đừng chỉ xem điểm rồi để đó.</h3><p>${severityText[code]}</p><ul><li>Rà lại điểm yếu nổi bật trong kết quả</li><li>Đối chiếu với danh mục và cách ra quyết định thực tế</li><li>Chốt 1–3 việc cần sửa trước, không cố thay đổi mọi thứ cùng lúc</li></ul><p class="assessment-conversion-note">Buổi trao đổi tập trung vào hệ thống ra quyết định, không phải phím mã mua bán.</p></div><button class="button button-primary" type="button" data-open-contact data-contact-source="INVESTOR_PROFILE_ASSESSMENT">Đặt lịch trao đổi về kết quả</button>`;
  const actions=result.querySelector('.profile-result-actions')||result.querySelector('.wizard-actions');
  if(actions)result.insertBefore(box,actions);else result.appendChild(box);
}

export function initAssessmentConversion(){
  if(!document.querySelector('#assessment-conversion-style')){
    const s=document.createElement('style');s.id='assessment-conversion-style';s.textContent=`.assessment-conversion-box{margin:22px 0;padding:20px;border:1px solid rgba(23,32,51,.14);border-radius:18px;background:linear-gradient(180deg,#fff,#f7f9fb);display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center}.assessment-conversion-box h3{margin:5px 0 8px;font-size:1.25rem}.assessment-conversion-box p{margin:7px 0;line-height:1.55}.assessment-conversion-box ul{margin:12px 0;padding-left:20px;line-height:1.6}.assessment-conversion-eyebrow{font-size:.75rem;font-weight:800;letter-spacing:.08em;color:#687386}.assessment-conversion-note{font-size:.86rem;color:#687386}.assessment-conversion-box>.button{white-space:nowrap}@media(max-width:720px){.assessment-conversion-box{grid-template-columns:1fr}.assessment-conversion-box>.button{width:100%}}`;document.head.appendChild(s)
  }
  const root=document.querySelector('[data-assessment-root]');if(!root)return;
  enhance(root);
  new MutationObserver(()=>enhance(root)).observe(root,{childList:true,subtree:true});
}
