const backButtons=document.querySelectorAll('[data-smart-back]');
backButtons.forEach(btn=>btn.addEventListener('click',()=>{
  const sameSite=document.referrer&&new URL(document.referrer).origin===window.location.origin;
  if(sameSite&&window.history.length>1){window.history.back();return;}
  window.location.href='./';
}));

const adminPages=new Set(['crm-hom-nay.html','admin-dich-vu.html','nguon-khach.html','admin-market-leads.html','admin-retention.html']);
const current=(window.location.pathname.split('/').pop()||'index.html').toLowerCase();
if(adminPages.has(current)){
  const nav=document.querySelector('.app-nav-links');
  if(nav&&!nav.querySelector('a[href="he-thong.html"]')){
    const link=document.createElement('a');link.href='he-thong.html';link.textContent='Trung tâm';
    const back=nav.querySelector('[data-smart-back]');if(back?.nextSibling)nav.insertBefore(link,back.nextSibling);else nav.prepend(link);
  }
  const extras=[['admin-retention.html','Giữ chân'],['admin-market-leads.html','Lead thị trường']];
  extras.forEach(([href,label])=>{if(nav&&!nav.querySelector(`a[href="${href}"]`)){const link=document.createElement('a');link.href=href;link.textContent=label;const logout=nav.querySelector('.app-nav-logout');nav.insertBefore(link,logout||null)}});
}
