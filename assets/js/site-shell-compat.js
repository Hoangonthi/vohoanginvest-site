// Lớp tương thích cho các trang cũ chưa dùng host header/footer chung.
// Chỉ chuẩn hóa phần vỏ trang; không đụng nội dung và logic bên trong.

function ensureSharedShellHosts(){
  let headerHost=document.getElementById('siteHeader');
  if(!headerHost){
    const legacyHeader=document.querySelector('header.topbar, header.top, header.tool-nav');
    headerHost=document.createElement('div');
    headerHost.id='siteHeader';
    if(legacyHeader) legacyHeader.replaceWith(headerHost);
    else document.body.prepend(headerHost);
  }

  let footerHost=document.getElementById('siteFooter');
  if(!footerHost){
    const legacyFooter=document.querySelector('footer.footer');
    footerHost=document.createElement('div');
    footerHost.id='siteFooter';
    if(legacyFooter) legacyFooter.replaceWith(footerHost);
    else document.body.appendChild(footerHost);
  }
}

ensureSharedShellHosts();
import('./site-header.js?v=20260916-3').catch(err=>console.warn('Shared shell load failed',err));
