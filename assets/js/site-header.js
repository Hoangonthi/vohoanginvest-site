import { pendingAssessmentKey, pendingClaimTokenKey, supabaseClient } from "./supabase-client.js";

const HEADER_HOST_ID = "siteHeader";
const FOOTER_HOST_ID = "siteFooter";
const TURNSTILE_SITE_KEY = "0x4AAAAAAEYKnha19nmpaSeM";
const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

const navItems = [
  ["thi-truong-hom-nay.html", "Thị trường"],
  ["sang-nay-can-nhin-gi.html", "Sáng nay"],
  ["sau-phien-cua-toi.html", "Sau phiên"],
  ["watchlist.html", "Watchlist"],
  ["./", "Trang chủ"],
  ["kien-thuc.html", "Kiến thức"],
  ["investor-calculator.html", "Công cụ"],
  ["ve-toi.html", "Về tôi"],
];

const searchIndex = [
  ["Sáng nay cần nhìn gì?", "Bản tin đầu ngày, bối cảnh và biến số quan trọng.", "sang-nay-can-nhin-gi.html", ["sáng nay","bản tin","thị trường","đầu ngày"]],
  ["Thị trường hôm nay", "Trạng thái thị trường, dòng tiền và tín hiệu trong phiên.", "thi-truong-hom-nay.html", ["thị trường","dòng tiền","vnindex","vni"]],
  ["Sau phiên của tôi", "Review quyết định và cách thực thi sau phiên.", "sau-phien-cua-toi.html", ["sau phiên","review","nhật ký"]],
  ["Watchlist", "Theo dõi cổ phiếu và điều kiện hành động.", "watchlist.html", ["watchlist","cổ phiếu","theo dõi"]],
  ["Kiến thức", "Nền tảng kiến thức đầu tư có hệ thống.", "kien-thuc.html", ["kiến thức","học","đầu tư"]],
  ["Bộ công cụ đầu tư", "Các phép tính vốn, margin, hòa vốn, cổ tức và quyết định.", "investor-calculator.html", ["công cụ","calculator","margin","hòa vốn","cổ tức","vốn"]],
  ["Kiểm tra nhanh tài khoản", "Xác định điểm mạnh, điểm hở và vấn đề cần ưu tiên.", "kiem-tra-nhanh-tai-khoan.html", ["đánh giá","tài khoản","kiểm tra","rủi ro"]],
  ["Về Võ Hoàng", "Phương pháp, VH6 và cách làm việc.", "ve-toi.html", ["võ hoàng","vh6","về tôi"]],
  ["Liên hệ", "Gmail, điện thoại, Zalo và các kênh liên hệ.", "lien-he.html", ["liên hệ","gmail","điện thoại","zalo"]],
];

const normalize = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

let turnstileLoaderPromise = null;

function loadTurnstile() {
  if (window.turnstile?.render) return Promise.resolve(window.turnstile);
  if (turnstileLoaderPromise) return turnstileLoaderPromise;

  turnstileLoaderPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-vh-turnstile]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.turnstile), { once: true });
      existing.addEventListener('error', () => reject(new Error('TURNSTILE_LOAD_FAILED')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.defer = true;
    script.dataset.vhTurnstile = '';
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => reject(new Error('TURNSTILE_LOAD_FAILED'));
    document.head.appendChild(script);
  });

  return turnstileLoaderPromise;
}

function currentPage() {
  const page = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  return page === "" ? "index.html" : page;
}

function isActive(href) {
  const page = currentPage();
  if (href === "./") return page === "index.html";
  return page === href.toLowerCase();
}

function navHtml() {
  return navItems
    .map(([href, label]) => `<a${isActive(href) ? ' class="active"' : ""} href="${href}">${label}</a>`)
    .join("");
}

function mobileNavHtml() {
  return navItems
    .map(([href, label]) => `<a href="${href}">${label}</a>`)
    .join("");
}

function iconSearch() {
  return `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M10.5 3a7.5 7.5 0 1 1 0 15a7.5 7.5 0 0 1 0-15Zm0 2a5.5 5.5 0 1 0 0 11a5.5 5.5 0 0 0 0-11Zm10.2 13.8-3.2-3.2-1.4 1.4 3.2 3.2a1 1 0 0 0 1.4-1.4Z"/>
    </svg>`;
}

function iconMenu() {
  return `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
    </svg>`;
}

function headerHtml() {
  return `
  <header class="topbar" data-shared-header>
    <div class="topbar-inner">
      <a class="brand" href="./">
        <img src="LOGO.webp" alt="Võ Hoàng logo">
        <div class="brand-text">
          <strong>VÕ HOÀNG</strong>
          <span>Đầu tư chuẩn hệ thống</span>
        </div>
      </a>

      <nav class="nav" aria-label="Điều hướng chính">
        ${navHtml()}
      </nav>

      <div class="topbar-actions">
        <button class="search-btn" type="button" aria-label="Tìm kiếm" data-site-search-open>
          ${iconSearch()}
        </button>

        <button class="menu-btn" type="button" aria-label="Mở menu" aria-expanded="false" aria-controls="mobileDrawer" data-menu-btn>
          ${iconMenu()}
        </button>

        <div class="vh-account" data-account-root>
          <a class="login-btn" href="dang-nhap.html" data-account-trigger>Đăng nhập</a>

          <div class="vh-account-menu" data-account-menu hidden>
            <div class="vh-account-head">
              <div class="vh-account-avatar" data-account-avatar>V</div>
              <div class="vh-account-copy">
                <strong data-account-name>Tài khoản</strong>
                <span data-account-email></span>
              </div>
            </div>
            <div class="vh-account-links">
              <a href="kiem-tra-nhanh-tai-khoan.html">Hồ sơ đánh giá</a>
              <a href="dang-nhap.html">Quản lý tài khoản</a>
              <button type="button" data-change-password>Đổi mật khẩu</button>
              <button type="button" data-sign-out>Đăng xuất</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mobile-drawer" id="mobileDrawer" data-mobile-drawer>
      <div class="wrap">
        <div class="mobile-links">
          ${mobileNavHtml()}
        </div>
      </div>
    </div>
  </header>`;
}

function iconYouTube() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M23 12s0-3.5-.4-5.2a2.8 2.8 0 0 0-2-2C18.9 4.4 12 4.4 12 4.4s-6.9 0-8.6.4a2.8 2.8 0 0 0-2 2C1 8.5 1 12 1 12s0 3.5.4 5.2a2.8 2.8 0 0 0 2 2c1.7.4 8.6.4 8.6.4s6.9 0 8.6-.4a2.8 2.8 0 0 0 2-2C23 15.5 23 12 23 12ZM10 15.5v-7l6 3.5z"/>
    </svg>`;
}

function iconFacebook() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.5 1.6-1.5h1.7V5a23 23 0 0 0-2.5-.1c-2.5 0-4.2 1.5-4.2 4.4V11H7v3h2.8v8z"/>
    </svg>`;
}

function iconWebsite() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20Zm6.9 9h-3.1a15.5 15.5 0 0 0-1.3-5A8 8 0 0 1 18.9 11ZM12 4.1c.9 1.1 1.8 3.4 2 6.9h-4c.2-3.5 1.1-5.8 2-6.9ZM9.5 6A15.5 15.5 0 0 0 8.2 11H5.1A8 8 0 0 1 9.5 6Zm-4.4 7h3.1a15.6 15.6 0 0 0 1.3 5A8 8 0 0 1 5.1 13Zm4.9 0h4a13.6 13.6 0 0 1-1.1 4.9a13.6 13.6 0 0 1-1.8 0A13.6 13.6 0 0 1 10 13Zm4.5 5A15.6 15.6 0 0 0 15.8 13h3.1a8 8 0 0 1-4.4 5Z"/>
    </svg>`;
}

function iconDocument() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h9l5 5v13H6zM14 4.5V9h4.5"/>
    </svg>`;
}

function footerNavHtml() {
  return navItems
    .map(([href, label]) => `<a href="${href}">${label}</a>`)
    .join("");
}

function footerHtml() {
  return `
  <footer class="footer" data-shared-footer>
    <div class="wrap">
      <div class="footer-main">

        <div class="footer-brand-block">
          <a class="brand footer-brand-link" href="./">
            <img src="LOGO.webp" alt="Võ Hoàng logo">
            <div class="brand-text">
              <strong>VÕ HOÀNG</strong>
              <span>Đầu tư chuẩn hệ thống</span>
            </div>
          </a>

          <p class="footer-slogan">
            Kiến thức tạo nền tảng.
            Hệ thống tạo khác biệt.
            Tài sản tạo tự do.
          </p>

          <div class="footer-gold-line" aria-hidden="true"></div>

          <p class="footer-risk">
            Đầu tư chứng khoán rủi ro thường trực.
            Kết quả trong quá khứ không đảm bảo kết quả trong tương lai.
          </p>
        </div>

        <div class="footer-col footer-nav-col footer-nav-all">
          <h4>Đi nhanh</h4>
          <div class="footer-links quick-links">
            ${footerNavHtml()}
          </div>
        </div>

        <div class="footer-col footer-connect">
          <h4>Kết nối với Võ Hoàng</h4>
          <div class="footer-socials">

            <a class="social"
               href="https://www.youtube.com/@vohoanginvest"
               target="_blank"
               rel="noopener noreferrer"
               aria-label="YouTube">
              ${iconYouTube()}
              YouTube
            </a>

            <a class="social"
               href="https://www.facebook.com/vohoanginvest"
               target="_blank"
               rel="noopener noreferrer"
               aria-label="Facebook">
              ${iconFacebook()}
              Facebook
            </a>

            <a class="social"
               href="./"
               aria-label="Website">
              ${iconWebsite()}
              Website
            </a>

            <a class="social"
               href="https://onthiplus.com"
               target="_blank"
               rel="noopener noreferrer"
               aria-label="Ôn Thi Plus">
              ${iconDocument()}
              Ôn Thi Plus
            </a>

          </div>
        </div>

      </div>

      <div class="footer-bottom">
        <div class="footer-bottom-row">

          <div class="footer-copyright">
            © 2026 <strong>VÕ HOÀNG</strong>.
            All rights reserved.
          </div>

          <div class="footer-legal">
            <a href="mien-tru-trach-nhiem.html">Miễn trừ trách nhiệm</a>
            <span aria-hidden="true">•</span>
            <a href="chinh-sach-bao-mat.html">Chính sách bảo mật</a>
            <span aria-hidden="true">•</span>
            <a href="dieu-khoan-su-dung.html">Điều khoản sử dụng</a>
            <span aria-hidden="true">•</span>
            <a href="du-lieu-bai-danh-gia.html">Dữ liệu bài đánh giá</a>
            <span aria-hidden="true">•</span>
            <a href="lien-he.html">Liên hệ</a>
          </div>

        </div>
      </div>
    </div>
  </footer>`;
}

function injectSupportStyles() {
  if (document.getElementById("vhSharedHeaderSupport")) return;

  const style = document.createElement("style");
  style.id = "vhSharedHeaderSupport";
  style.textContent = `
    /* HEADER DÙNG CHUNG */
    .topbar{
      position:sticky;top:0;z-index:100;
      backdrop-filter:blur(10px);
      background:rgba(3,11,20,.88);
      border-bottom:1px solid rgba(255,255,255,.06);
    }
    .topbar-inner{
      width:min(calc(100% - 24px),1340px);margin:0 auto;min-height:78px;
      display:flex;align-items:center;justify-content:space-between;gap:16px;
    }
    .brand{min-width:0;display:flex;align-items:center;gap:12px;color:inherit;text-decoration:none}
    .brand img{width:46px;height:46px;object-fit:contain;flex:0 0 auto}
    .brand-text{min-width:0;line-height:normal;overflow:visible;padding:1px 0 2px}
    .brand-text strong{
      display:block;font-size:17px;line-height:1.35;font-weight:800;color:#f3cf74;
      letter-spacing:.035em;white-space:nowrap;
    }
    .brand-text span{
      display:block;margin-top:1px;font-size:9.5px;line-height:1.45;color:#e8cf8f;
      letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;
    }
    .nav{display:flex;align-items:center;justify-content:center;gap:26px;flex:1 1 auto;min-width:0}
    .nav a{
      position:relative;padding:28px 0 24px;font-size:14px;color:rgba(255,255,255,.82);
      white-space:nowrap;text-decoration:none;transition:.2s ease;
    }
    .nav a:hover{color:#fff}
    .nav a.active{color:#fff;font-weight:700}
    .nav a.active::after{
      content:"";position:absolute;left:0;right:0;bottom:-1px;margin:auto;width:100%;height:3px;
      border-radius:999px;background:linear-gradient(90deg,#e0bb63,#f3cf74);
    }
    .topbar-actions{display:flex;align-items:center;gap:12px;flex:0 0 auto}
    .search-btn,.menu-btn{
      width:42px;height:42px;padding:0;border-radius:12px;border:1px solid rgba(255,255,255,.10);
      background:rgba(255,255,255,.02);color:#fff;display:grid;place-items:center;cursor:pointer;
    }
    .menu-btn{display:none}
    .login-btn{
      height:42px;padding:0 18px;border-radius:12px;border:1px solid rgba(224,187,99,.44);
      background:linear-gradient(180deg,#f0cf79,#d8b254);color:#1f1604;font-size:14px;font-weight:800;
      display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;text-decoration:none;
      box-shadow:0 10px 24px rgba(224,187,99,.16);
    }
    .mobile-drawer{display:none;border-top:1px solid rgba(255,255,255,.06);background:#071423}
    .mobile-drawer.open{display:block}
    .mobile-drawer .wrap{width:min(calc(100% - 32px),1240px);margin:0 auto;padding:14px 0 18px;display:grid;gap:12px}
    .mobile-links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .mobile-links a{
      padding:12px 14px;border:1px solid rgba(255,255,255,.08);border-radius:14px;
      background:rgba(255,255,255,.02);color:#f6f8fc;font-size:14px;font-weight:600;
      text-align:center;text-decoration:none;
    }

    .vh-account{position:relative;display:flex;align-items:center}
    .vh-account-menu{
      position:absolute;
      z-index:220;
      top:calc(100% + 10px);
      right:0;
      width:260px;
      padding:10px;
      border:1px solid rgba(224,187,99,.20);
      border-radius:15px;
      background:#07192b;
      box-shadow:0 18px 44px rgba(0,0,0,.38);
    }
    .vh-account-menu[hidden]{display:none!important}
    .vh-account-head{
      display:grid;
      grid-template-columns:40px minmax(0,1fr);
      gap:10px;
      align-items:center;
      padding:8px 8px 12px;
      border-bottom:1px solid rgba(255,255,255,.07)
    }
    .vh-account-avatar{
      width:38px;height:38px;display:grid;place-items:center;border-radius:50%;
      border:1px solid rgba(224,187,99,.28);background:rgba(224,187,99,.08);
      color:#f3cf74;font-weight:800
    }
    .vh-account-copy{min-width:0}
    .vh-account-copy strong,.vh-account-copy span{
      display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap
    }
    .vh-account-copy strong{font-size:12px;color:#fff}
    .vh-account-copy span{margin-top:2px;font-size:9px;color:rgba(231,237,246,.55)}
    .vh-account-links{display:grid;gap:3px;padding-top:7px}
    .vh-account-links a,.vh-account-links button{
      width:100%;border:0;border-radius:9px;background:transparent;color:#eef3f9;
      padding:9px 10px;text-align:left;font:inherit;font-size:10.5px;cursor:pointer
    }
    .vh-account-links a:hover,.vh-account-links button:hover{background:rgba(224,187,99,.06);color:#f3cf74}
    .login-btn[data-signed-in="true"]{gap:7px;max-width:190px}
    .login-btn .vh-login-avatar{
      width:24px;height:24px;display:grid;place-items:center;border-radius:50%;
      background:rgba(31,22,4,.13);font-size:10px;font-weight:900;flex:0 0 auto
    }
    .login-btn .vh-login-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:125px}


    .vh-auth-backdrop{
      position:fixed;inset:0;z-index:560;display:grid;place-items:center;
      padding:18px;background:rgba(2,8,15,.78);backdrop-filter:blur(9px)
    }
    .vh-auth-backdrop[hidden]{display:none!important}
    .vh-auth-panel{
      width:min(430px,100%);border:1px solid rgba(224,187,99,.24);border-radius:20px;
      background:linear-gradient(180deg,#091c31,#061522);box-shadow:0 26px 80px rgba(0,0,0,.55);
      padding:22px;position:relative
    }
    .vh-auth-close{
      position:absolute;right:12px;top:12px;width:34px;height:34px;border:0;border-radius:10px;
      background:rgba(255,255,255,.05);color:#fff;font-size:20px;cursor:pointer
    }
    .vh-auth-kicker{font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#f3cf74}
    .vh-auth-panel h2{margin:7px 36px 5px 0;font-size:24px;line-height:1.2;color:#fff}
    .vh-auth-panel>p{margin:0 0 16px;font-size:11px;line-height:1.55;color:rgba(231,237,246,.62)}
    .vh-auth-form{display:grid;gap:11px}
    .vh-auth-field{display:grid;gap:5px}
    .vh-auth-field label{font-size:10px;font-weight:700;color:rgba(255,255,255,.78)}
    .vh-auth-field input{
      width:100%;min-height:44px;border:1px solid rgba(255,255,255,.10);border-radius:11px;
      background:rgba(255,255,255,.035);color:#fff;padding:0 12px;outline:0;font:inherit;font-size:12px
    }
    .vh-auth-field input:focus{border-color:rgba(224,187,99,.52);box-shadow:0 0 0 3px rgba(224,187,99,.08)}
    .vh-auth-submit,.vh-auth-google,.vh-auth-secondary{
      width:100%;min-height:44px;border-radius:11px;font:inherit;font-size:11.5px;font-weight:800;cursor:pointer
    }
    .vh-auth-submit{border:1px solid rgba(224,187,99,.45);background:linear-gradient(180deg,#f0cf79,#d8b254);color:#201703}
    .vh-auth-google{border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.035);color:#fff}
    .vh-auth-secondary{border:1px solid rgba(224,187,99,.24);background:rgba(224,187,99,.055);color:#f3cf74}
    .vh-auth-submit:disabled,.vh-auth-google:disabled,.vh-auth-secondary:disabled{opacity:.62;cursor:wait}
    .vh-auth-otp-box{display:grid;gap:9px;padding:10px;border:1px solid rgba(224,187,99,.13);border-radius:12px;background:rgba(224,187,99,.025)}
    .vh-auth-otp-box[hidden]{display:none!important}
    .vh-auth-mini{margin:0!important;font-size:9px!important;line-height:1.45;color:rgba(231,237,246,.46)!important}
    .vh-turnstile{min-height:65px;display:flex;justify-content:center;align-items:center;overflow:hidden}
    .vh-auth-divider{display:flex;align-items:center;gap:9px;color:rgba(231,237,246,.35);font-size:9px;text-transform:uppercase}
    .vh-auth-divider::before,.vh-auth-divider::after{content:"";height:1px;flex:1;background:rgba(255,255,255,.08)}
    .vh-auth-message{min-height:16px;font-size:10px;line-height:1.45;color:#f3cf74}
    .vh-auth-message.is-error{color:#ff8b91}
    .vh-auth-message.is-success{color:#62dfa0}
    .vh-auth-links{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:2px}
    .vh-auth-links a{color:rgba(231,237,246,.68);font-size:10px;text-decoration:none}
    .vh-auth-links a:hover{color:#f3cf74}
    .vh-auth-note{margin-top:13px!important;padding-top:12px;border-top:1px solid rgba(255,255,255,.07);font-size:9px!important;color:rgba(231,237,246,.44)!important}
    @media(max-width:680px){
      .vh-auth-backdrop{padding:10px;place-items:end center}
      .vh-auth-panel{width:100%;max-height:calc(100vh - 20px);overflow:auto;border-radius:18px 18px 12px 12px;padding:20px 16px}
      .vh-auth-panel h2{font-size:21px}
    }

    .vh-search-backdrop{
      position:fixed;inset:0;z-index:500;display:grid;place-items:start center;
      padding:10vh 16px 24px;background:rgba(2,8,15,.72);backdrop-filter:blur(8px)
    }
    .vh-search-backdrop[hidden]{display:none!important}
    .vh-search-panel{
      width:min(720px,100%);border:1px solid rgba(224,187,99,.22);border-radius:20px;
      background:#07192b;box-shadow:0 24px 70px rgba(0,0,0,.50);overflow:hidden
    }
    .vh-search-top{
      display:grid;grid-template-columns:24px minmax(0,1fr) 34px;gap:9px;align-items:center;
      padding:14px 15px;border-bottom:1px solid rgba(255,255,255,.07)
    }
    .vh-search-top svg{color:#f3cf74}
    .vh-search-top input{
      width:100%;border:0;outline:0;background:transparent;color:#fff;font:inherit;font-size:14px
    }
    .vh-search-top input::placeholder{color:rgba(231,237,246,.40)}
    .vh-search-close{
      width:32px;height:32px;border:0;border-radius:9px;background:rgba(255,255,255,.04);
      color:#fff;cursor:pointer;font-size:18px
    }
    .vh-search-results{max-height:58vh;overflow:auto;padding:8px}
    .vh-search-item{
      display:block;padding:11px 12px;border-radius:11px;border:1px solid transparent
    }
    .vh-search-item:hover{background:rgba(224,187,99,.045);border-color:rgba(224,187,99,.12)}
    .vh-search-item strong{display:block;font-size:12px;color:#fff}
    .vh-search-item span{display:block;margin-top:3px;font-size:10px;line-height:1.45;color:rgba(231,237,246,.55)}
    .vh-search-empty{padding:24px 14px;text-align:center;color:rgba(231,237,246,.48);font-size:11px}

    /* FOOTER DÙNG CHUNG */
    .footer{
      margin-top:30px;
      border-top:1px solid rgba(255,255,255,.07);
      background:
        radial-gradient(circle at 10% 0%,rgba(224,187,99,.045),transparent 28%),
        linear-gradient(180deg,rgba(3,12,22,.88),rgba(2,8,15,.98));
    }
    .footer .wrap{
      width:min(calc(100% - 32px),1240px);
      margin:0 auto;
    }
    .footer .footer-main{
      padding:34px 0 24px;
      display:grid;
      grid-template-columns:minmax(280px,1.25fr) minmax(300px,1fr) minmax(270px,1fr);
      gap:28px 44px;
      align-items:start;
    }
    .footer-brand-block{min-width:0}
    .footer-brand-link{
      width:max-content;
      max-width:100%;
      display:flex;
      align-items:center;
      gap:12px;
    }
    .footer-brand-link img{
      width:46px;
      height:46px;
      object-fit:contain;
      flex:0 0 auto;
    }
    .footer-brand-link .brand-text{
      min-width:0;
      line-height:normal;
      padding:1px 0 2px;
    }
    .footer-brand-link .brand-text strong{
      display:block;
      font-size:17px;
      line-height:1.35;
      font-weight:800;
      color:#f3cf74;
      letter-spacing:.035em;
      white-space:nowrap;
    }
    .footer-brand-link .brand-text span{
      display:block;
      margin-top:1px;
      font-size:9.5px;
      line-height:1.45;
      color:#e8cf8f;
      letter-spacing:.08em;
      text-transform:uppercase;
      white-space:nowrap;
    }
    .footer .footer-slogan{
      margin:13px 0 0;
      max-width:340px;
      font-size:13px;
      line-height:1.65;
      color:rgba(231,237,246,.80);
    }
    .footer .footer-gold-line{
      width:100%;
      max-width:340px;
      height:1px;
      margin:11px 0 8px;
      background:linear-gradient(90deg,rgba(224,187,99,.88) 0%,rgba(224,187,99,.34) 58%,rgba(224,187,99,0) 100%);
    }
    .footer .footer-risk{
      margin:0;
      max-width:340px;
      font-size:10px;
      line-height:1.55;
      color:rgba(231,237,246,.44);
    }
    .footer .footer-col h4{
      margin:2px 0 13px;
      color:#f3cf74;
      font-size:13px;
      line-height:1.2;
      font-weight:800;
      letter-spacing:.08em;
      text-transform:uppercase;
    }
    .footer a{
      color:inherit;
      text-decoration:none;
    }
    .footer .footer-links a{
      color:rgba(255,255,255,.82);
      transition:color .2s ease;
    }
    .footer .footer-links a:hover{color:#fff}
    .footer .footer-nav-all .quick-links{
      display:grid;
      grid-template-columns:repeat(2,max-content);
      gap:9px 28px;
      justify-content:start;
    }
    .footer .footer-nav-all .quick-links a{
      width:auto;
      padding:0;
      border:0;
      background:none;
      font-size:13px;
      line-height:1.45;
    }
    .footer .footer-socials{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:8px;
    }
    .footer .footer-socials .social{
      min-width:0;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:10px;
      padding:9px 11px;
      border:1px solid rgba(255,255,255,.10);
      border-radius:12px;
      background:rgba(255,255,255,.03);
      color:#fff;
      font-size:12px;
      font-weight:700;
      white-space:nowrap;
    }
    .footer .footer-socials .social svg{
      width:18px;
      height:18px;
      fill:currentColor;
      flex:0 0 auto;
    }
    .footer .footer-bottom{
      width:100%;
      padding:13px 0 17px;
      border-top:1px solid rgba(224,187,99,.15);
    }
    .footer .footer-bottom-row{
      width:100%;
      display:flex;
      align-items:center;
      justify-content:center;
      gap:10px 18px;
      flex-wrap:wrap;
      text-align:center;
    }
    .footer .footer-copyright{
      flex:0 0 auto;
      color:rgba(231,237,246,.68);
      font-size:13px;
      line-height:1.5;
      white-space:nowrap;
    }
    .footer .footer-copyright strong{
      color:rgba(255,255,255,.86);
      font-weight:700;
    }
    .footer .footer-legal{
      display:flex;
      align-items:center;
      justify-content:center;
      flex-wrap:wrap;
      gap:6px 10px;
      min-width:0;
    }
    .footer .footer-legal a{
      color:rgba(231,237,246,.68);
      font-size:13px;
      line-height:1.45;
      white-space:nowrap;
    }
    .footer .footer-legal a:hover{color:#f1cf78}
    .footer .footer-legal span{
      color:rgba(224,187,99,.66);
      font-size:8px;
    }

    @media(min-width:681px){
      .footer .footer-nav-all h4,
      .footer .footer-connect h4{
        text-align:center;
      }

      .footer .footer-nav-all .quick-links{
        justify-content:center;
      }
    }

    @media(max-width:860px){
      .topbar-inner{width:min(calc(100% - 20px),100%);min-height:74px}
      .nav,.topbar-actions .search-btn{display:none}
      .menu-btn{display:grid}
      .brand img{width:42px;height:42px}
      .brand-text strong{font-size:14px}
      .brand-text span{font-size:10px}
    }

    @media(max-width:680px){
      .brand{flex:1 1 auto;min-width:0}
      .brand-text{overflow:hidden}
      .brand-text strong,.brand-text span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .topbar-inner{gap:10px}
      .topbar-actions{gap:8px}
      .login-btn{height:40px;padding:0 13px;font-size:12px}
      .mobile-drawer .wrap{width:min(calc(100% - 20px),1240px)}
      .vh-account-menu{position:fixed;left:10px;right:10px;top:74px;width:auto}
      .login-btn .vh-login-label{max-width:84px}
  
    .vh-search-backdrop{padding:0}
      .vh-search-panel{width:100%;height:100%;border:0;border-radius:0}
      .vh-search-results{max-height:calc(100vh - 64px)}

      .footer .wrap{
        width:min(calc(100% - 20px),1240px);
      }
      .footer .footer-main{
        padding:26px 0 19px;
        grid-template-columns:1fr;
        gap:18px;
        text-align:center;
      }
      .footer .footer-brand-link{
        margin:0 auto;
        justify-content:center;
      }
      .footer .footer-slogan{
        max-width:320px;
        margin-left:auto;
        margin-right:auto;
        text-align:center;
      }
      .footer .footer-gold-line{
        width:170px;
        margin:11px auto 8px;
      }
      .footer .footer-risk{
        max-width:300px;
        margin-left:auto;
        margin-right:auto;
        font-size:9px;
        line-height:1.5;
        text-align:center;
      }
      .footer .footer-col h4{
        margin-bottom:9px;
      }
      .footer .footer-nav-all .quick-links{
        width:100%;
        grid-template-columns:repeat(4,max-content);
        justify-content:center;
        align-items:center;
        gap:8px 12px;
      }
      .footer .footer-nav-all .quick-links a{
        font-size:11px;
        line-height:1.35;
        text-align:center;
        white-space:nowrap;
      }
      .footer .footer-socials{
        width:min(100%,360px);
        margin:0 auto;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:8px;
      }
      .footer .footer-bottom{
        padding:12px 0 15px;
      }
      .footer .footer-bottom-row{
        flex-direction:column;
        gap:7px;
        text-align:center;
      }
      .footer .footer-copyright{
        width:100%;
        font-size:10px;
        line-height:1.45;
        text-align:center;
        white-space:normal;
      }
      .footer .footer-legal{
        width:100%;
        column-gap:7px;
        row-gap:5px;
      }
      .footer .footer-legal a{
        font-size:10px;
        line-height:1.4;
      }
      .footer .footer-legal span{
        font-size:7px;
      }
    }
  `;
  document.head.appendChild(style);
}

function createSearchOverlay() {
  if (document.querySelector("[data-site-search]")) return;

  const overlay = document.createElement("div");
  overlay.className = "vh-search-backdrop";
  overlay.setAttribute("data-site-search", "");
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="vh-search-panel" role="dialog" aria-modal="true" aria-label="Tìm kiếm website">
      <div class="vh-search-top">
        ${iconSearch()}
        <input type="search" placeholder="Tìm nội dung, công cụ..." autocomplete="off" data-site-search-input>
        <button class="vh-search-close" type="button" aria-label="Đóng tìm kiếm" data-site-search-close>×</button>
      </div>
      <div class="vh-search-results" data-site-search-results></div>
    </div>`;
  document.body.appendChild(overlay);

  const input = overlay.querySelector("[data-site-search-input]");
  const results = overlay.querySelector("[data-site-search-results]");

  const render = (query = "") => {
    const q = normalize(query);
    const rows = !q
      ? searchIndex.slice(0, 6)
      : searchIndex.filter(([title, desc, , keywords]) => {
          const haystack = normalize([title, desc, ...(keywords || [])].join(" "));
          return haystack.includes(q);
        });

    results.innerHTML = rows.length
      ? rows.map(([title, desc, href]) => `
          <a class="vh-search-item" href="${href}">
            <strong>${title}</strong>
            <span>${desc}</span>
          </a>`).join("")
      : `<div class="vh-search-empty">Chưa tìm thấy nội dung phù hợp.</div>`;
  };

  input.addEventListener("input", () => render(input.value));
  overlay.querySelector("[data-site-search-close]").addEventListener("click", closeSearch);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeSearch();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) closeSearch();
  });

  function closeSearch() {
    overlay.hidden = true;
    document.body.style.overflow = "";
  }

  window.VHSearch = {
    open() {
      overlay.hidden = false;
      document.body.style.overflow = "hidden";
      input.value = "";
      render("");
      requestAnimationFrame(() => input.focus());
    },
    close: closeSearch,
  };
}


async function claimPendingAssessmentAfterLogin() {
  const assessmentId = localStorage.getItem(pendingAssessmentKey);
  const claimToken = localStorage.getItem(pendingClaimTokenKey);
  if (!assessmentId || !claimToken) return;

  try {
    const { error } = await supabaseClient.rpc("claim_guest_assessment", {
      p_assessment_id: assessmentId,
      p_claim_token: claimToken,
    });
    if (!error) {
      localStorage.removeItem(pendingAssessmentKey);
      localStorage.removeItem(pendingClaimTokenKey);
    }
  } catch (error) {
    console.warn("Không thể lưu hồ sơ guest vào tài khoản.", error);
  }
}

function createAccountDialogs() {
  if (document.querySelector("[data-vh-auth-dialogs]")) return;

  const host = document.createElement("div");
  host.setAttribute("data-vh-auth-dialogs", "");
  host.innerHTML = `
    <div class="vh-auth-backdrop" data-login-dialog hidden>
      <section class="vh-auth-panel" role="dialog" aria-modal="true" aria-labelledby="vhLoginTitle">
        <button class="vh-auth-close" type="button" aria-label="Đóng" data-auth-close>×</button>
        <div class="vh-auth-kicker">VÕ HOÀNG ACCOUNT</div>
        <h2 id="vhLoginTitle">Đăng nhập</h2>
        <p>Đăng nhập nhanh mà không rời trang đang xem.</p>
        <form class="vh-auth-form" data-popup-login-form novalidate>
          <div class="vh-auth-field">
            <label>Email</label>
            <input name="email" type="email" autocomplete="email" required placeholder="email@example.com">
          </div>
          <div class="vh-auth-field">
            <label>Mật khẩu</label>
            <input name="password" type="password" autocomplete="current-password" required placeholder="Nhập mật khẩu">
          </div>
          <div class="vh-turnstile" data-popup-turnstile></div>
          <div class="vh-auth-message" data-popup-login-message aria-live="polite"></div>
          <button class="vh-auth-submit" type="submit" data-popup-login-submit>Đăng nhập</button>

          <button class="vh-auth-secondary" type="button" data-popup-otp-send>Đăng nhập bằng mã OTP email</button>
          <div class="vh-auth-otp-box" data-popup-otp-box hidden>
            <div class="vh-auth-field">
              <label>Mã OTP</label>
              <input name="otp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="Nhập mã trong email">
            </div>
            <button class="vh-auth-secondary" type="button" data-popup-otp-verify>Xác nhận mã OTP</button>
            <p class="vh-auth-mini">Mã/link xác thực chỉ dùng một lần. Không chia sẻ cho người khác.</p>
          </div>

          <div class="vh-auth-divider">hoặc</div>
          <button class="vh-auth-google" type="button" data-popup-google>Tiếp tục với Google</button>
          <div class="vh-auth-links">
            <a href="dang-nhap.html?mode=forgot">Quên mật khẩu?</a>
            <a href="dang-nhap.html">Trang tài khoản đầy đủ →</a>
          </div>
        </form>
        <p class="vh-auth-note">Không lưu mật khẩu trên website. Không cung cấp mật khẩu hoặc mã OTP cho bất kỳ ai.</p>
      </section>
    </div>

    <div class="vh-auth-backdrop" data-password-dialog hidden>
      <section class="vh-auth-panel" role="dialog" aria-modal="true" aria-labelledby="vhPasswordTitle">
        <button class="vh-auth-close" type="button" aria-label="Đóng" data-auth-close>×</button>
        <div class="vh-auth-kicker">BẢO MẬT TÀI KHOẢN</div>
        <h2 id="vhPasswordTitle">Đổi mật khẩu</h2>
        <p>Hệ thống xác minh lại mật khẩu hiện tại trước khi đổi.</p>
        <form class="vh-auth-form" data-password-form novalidate>
          <div class="vh-auth-field"><label>Mật khẩu hiện tại</label><input name="currentPassword" type="password" autocomplete="current-password" required></div>
          <div class="vh-auth-field"><label>Mật khẩu mới</label><input name="newPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="Tối thiểu 8 ký tự"></div>
          <div class="vh-auth-field"><label>Nhập lại mật khẩu mới</label><input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required></div>
          <div class="vh-auth-message" data-password-message aria-live="polite"></div>
          <button class="vh-auth-submit" type="submit" data-password-submit>Cập nhật mật khẩu</button>
          <div class="vh-auth-links"><a href="dang-nhap.html?mode=forgot">Không nhớ mật khẩu? Đặt lại qua email</a></div>
        </form>
        <p class="vh-auth-note">Đổi thành công sẽ đăng xuất các phiên để giảm rủi ro tài khoản còn mở trên thiết bị khác.</p>
      </section>
    </div>`;

  document.body.appendChild(host);

  const loginDialog = host.querySelector("[data-login-dialog]");
  const passwordDialog = host.querySelector("[data-password-dialog]");
  const loginForm = host.querySelector("[data-popup-login-form]");
  const loginMessage = host.querySelector("[data-popup-login-message]");
  const loginSubmit = host.querySelector("[data-popup-login-submit]");
  const googleButton = host.querySelector("[data-popup-google]");
  const otpSendButton = host.querySelector("[data-popup-otp-send]");
  const otpVerifyButton = host.querySelector("[data-popup-otp-verify]");
  const otpBox = host.querySelector("[data-popup-otp-box]");
  const otpInput = host.querySelector('[data-popup-otp-box] input[name="otp"]');
  const turnstileBox = host.querySelector("[data-popup-turnstile]");
  const passwordForm = host.querySelector("[data-password-form]");
  let popupTurnstileId = null;
  let popupCaptchaToken = "";

  const ensurePopupTurnstile = async () => {
    try {
      const api = await loadTurnstile();
      if (popupTurnstileId !== null || !turnstileBox || !api?.render) return;
      popupTurnstileId = api.render(turnstileBox, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "dark",
        size: "flexible",
        callback: (token) => { popupCaptchaToken = token || ""; },
        "expired-callback": () => { popupCaptchaToken = ""; },
        "error-callback": () => { popupCaptchaToken = ""; },
      });
    } catch (error) {
      console.warn("Không tải được Turnstile.", error);
    }
  };

  const resetPopupTurnstile = () => {
    popupCaptchaToken = "";
    if (popupTurnstileId !== null && window.turnstile?.reset) {
      try { window.turnstile.reset(popupTurnstileId); } catch (_) {}
    }
  };

  const requirePopupCaptcha = () => {
    if (popupCaptchaToken) return true;
    setMessage(loginMessage, "Vui lòng hoàn tất bước xác minh bảo mật.", "error");
    ensurePopupTurnstile();
    return false;
  };
  const passwordMessage = host.querySelector("[data-password-message]");
  const passwordSubmit = host.querySelector("[data-password-submit]");

  const setMessage = (el, value = "", type = "") => {
    if (!el) return;
    el.textContent = value;
    el.classList.remove("is-error", "is-success");
    if (type) el.classList.add(`is-${type}`);
  };

  const closeDialog = (dialog) => {
    if (!dialog) return;
    dialog.hidden = true;
    document.body.style.overflow = "";
    dialog.querySelectorAll('input[type="password"]').forEach((input) => { input.value = ""; });
  };

  const openDialog = (dialog) => {
    if (!dialog) return;
    host.querySelectorAll(".vh-auth-backdrop").forEach((item) => { item.hidden = true; });
    dialog.hidden = false;
    document.body.style.overflow = "hidden";
  };

  host.querySelectorAll("[data-auth-close]").forEach((button) => {
    button.addEventListener("click", () => closeDialog(button.closest(".vh-auth-backdrop")));
  });
  host.querySelectorAll(".vh-auth-backdrop").forEach((dialog) => {
    dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(dialog); });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!loginDialog.hidden) closeDialog(loginDialog);
    if (!passwordDialog.hidden) closeDialog(passwordDialog);
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(loginMessage);
    const data = new FormData(loginForm);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");

    if (!email || !password) {
      setMessage(loginMessage, "Vui lòng nhập đầy đủ email và mật khẩu.", "error");
      return;
    }
    if (!requirePopupCaptcha()) return;

    loginSubmit.disabled = true;
    loginSubmit.textContent = "Đang đăng nhập...";
    const result = await supabaseClient.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: popupCaptchaToken },
    });
    resetPopupTurnstile();
    loginSubmit.disabled = false;
    loginSubmit.textContent = "Đăng nhập";

    if (result.error) {
      setMessage(loginMessage, "Email hoặc mật khẩu chưa đúng. Vui lòng kiểm tra lại.", "error");
      return;
    }

    await claimPendingAssessmentAfterLogin();
    renderAccount(result.data.user);
    setMessage(loginMessage, "Đăng nhập thành công.", "success");
    window.setTimeout(() => closeDialog(loginDialog), 300);
  });

  otpSendButton?.addEventListener("click", async () => {
    setMessage(loginMessage);
    const email = String(new FormData(loginForm).get("email") || "").trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage(loginMessage, "Vui lòng nhập email hợp lệ trước khi gửi OTP.", "error");
      return;
    }
    if (!requirePopupCaptcha()) return;

    otpSendButton.disabled = true;
    otpSendButton.textContent = "Đang gửi mã...";
    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
        captchaToken: popupCaptchaToken,
      },
    });
    resetPopupTurnstile();

    if (error) {
      otpSendButton.disabled = false;
      otpSendButton.textContent = "Đăng nhập bằng mã OTP email";
      setMessage(loginMessage, "Chưa thể gửi mã xác thực. Vui lòng thử lại sau.", "error");
      return;
    }

    otpBox.hidden = false;
    otpSendButton.textContent = "Đã gửi mã / liên kết xác thực";
    setMessage(loginMessage, "Hãy kiểm tra email. Nếu email có mã OTP, nhập mã bên dưới; nếu có liên kết xác thực, bạn có thể bấm trực tiếp liên kết đó.", "success");
    requestAnimationFrame(() => otpInput?.focus());
    window.setTimeout(() => {
      otpSendButton.disabled = false;
      otpSendButton.textContent = "Gửi lại mã OTP";
    }, 60000);
  });

  otpVerifyButton?.addEventListener("click", async () => {
    setMessage(loginMessage);
    const email = String(new FormData(loginForm).get("email") || "").trim();
    const token = String(otpInput?.value || "").trim();
    if (!email || !token) {
      setMessage(loginMessage, "Vui lòng nhập email và mã OTP.", "error");
      return;
    }

    otpVerifyButton.disabled = true;
    otpVerifyButton.textContent = "Đang xác minh...";
    const { data, error } = await supabaseClient.auth.verifyOtp({ email, token, type: "email" });
    otpVerifyButton.disabled = false;
    otpVerifyButton.textContent = "Xác nhận mã OTP";

    if (error || !data.user) {
      setMessage(loginMessage, "Mã OTP chưa đúng hoặc đã hết hạn. Vui lòng kiểm tra lại.", "error");
      return;
    }

    await claimPendingAssessmentAfterLogin();
    renderAccount(data.user);
    setMessage(loginMessage, "Đăng nhập thành công.", "success");
    window.setTimeout(() => closeDialog(loginDialog), 300);
  });

  googleButton.addEventListener("click", async () => {
    setMessage(loginMessage);
    googleButton.disabled = true;
    googleButton.textContent = "Đang chuyển đến Google...";
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      googleButton.disabled = false;
      googleButton.textContent = "Tiếp tục với Google";
      setMessage(loginMessage, "Không thể đăng nhập Google. Vui lòng thử lại.", "error");
    }
  });

  passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(passwordMessage);
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const user = sessionData.session?.user;

    if (!user?.email) {
      closeDialog(passwordDialog);
      window.VHAccount?.openLogin();
      return;
    }

    const data = new FormData(passwordForm);
    const currentPassword = String(data.get("currentPassword") || "");
    const newPassword = String(data.get("newPassword") || "");
    const confirmPassword = String(data.get("confirmPassword") || "");

    if (!currentPassword) { setMessage(passwordMessage, "Vui lòng nhập mật khẩu hiện tại.", "error"); return; }
    if (newPassword.length < 8) { setMessage(passwordMessage, "Mật khẩu mới cần có ít nhất 8 ký tự.", "error"); return; }
    if (newPassword !== confirmPassword) { setMessage(passwordMessage, "Mật khẩu nhập lại chưa khớp.", "error"); return; }
    if (currentPassword === newPassword) { setMessage(passwordMessage, "Mật khẩu mới cần khác mật khẩu hiện tại.", "error"); return; }

    passwordSubmit.disabled = true;
    passwordSubmit.textContent = "Đang xác minh...";

    const verified = await supabaseClient.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (verified.error) {
      passwordSubmit.disabled = false;
      passwordSubmit.textContent = "Cập nhật mật khẩu";
      setMessage(passwordMessage, "Mật khẩu hiện tại chưa đúng. Nếu dùng Google, hãy đặt lại mật khẩu qua email.", "error");
      return;
    }

    passwordSubmit.textContent = "Đang cập nhật...";
    const updated = await supabaseClient.auth.updateUser({ password: newPassword });
    if (updated.error) {
      passwordSubmit.disabled = false;
      passwordSubmit.textContent = "Cập nhật mật khẩu";
      setMessage(passwordMessage, "Chưa thể đổi mật khẩu. Vui lòng thử lại hoặc đặt lại qua email.", "error");
      return;
    }

    setMessage(passwordMessage, "Đã đổi mật khẩu. Bạn cần đăng nhập lại.", "success");
    await supabaseClient.auth.signOut({ scope: "global" });
    renderAccount(null);
    passwordForm.reset();
    passwordSubmit.disabled = false;
    passwordSubmit.textContent = "Cập nhật mật khẩu";

    window.setTimeout(() => {
      closeDialog(passwordDialog);
      window.VHAccount?.openLogin(user.email);
    }, 700);
  });

  window.VHAccount = {
    openLogin(email = "") {
      setMessage(loginMessage);
      openDialog(loginDialog);
      ensurePopupTurnstile();
      const input = loginDialog.querySelector('input[name="email"]');
      if (email && input) input.value = email;
      requestAnimationFrame(() => input?.focus());
    },
    openPasswordChange() {
      setMessage(passwordMessage);
      openDialog(passwordDialog);
      requestAnimationFrame(() => passwordDialog.querySelector('input[name="currentPassword"]')?.focus());
    },
    close() {
      closeDialog(loginDialog);
      closeDialog(passwordDialog);
    },
  };
}

function getUserLabel(user) {
  return user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email
    || "Tài khoản";
}

function renderAccount(user) {
  const trigger = document.querySelector("[data-account-trigger]");
  const menu = document.querySelector("[data-account-menu]");
  const name = document.querySelector("[data-account-name]");
  const email = document.querySelector("[data-account-email]");
  const avatar = document.querySelector("[data-account-avatar]");

  if (!trigger) return;

  if (!user) {
    trigger.href = "dang-nhap.html";
    trigger.dataset.signedIn = "false";
    trigger.innerHTML = "Đăng nhập";
    if (menu) menu.hidden = true;
    return;
  }

  const label = getUserLabel(user);
  const initial = label.charAt(0).toUpperCase();

  trigger.href = "#";
  trigger.dataset.signedIn = "true";
  trigger.innerHTML = `
    <span class="vh-login-avatar">${initial}</span>
    <span class="vh-login-label">${label}</span>`;

  if (name) name.textContent = label;
  if (email) email.textContent = user.email || "";
  if (avatar) avatar.textContent = initial;
}

function bindHeaderEvents() {
  const menuBtn = document.querySelector("[data-menu-btn]");
  const drawer = document.querySelector("[data-mobile-drawer]");
  const searchBtn = document.querySelector("[data-site-search-open]");
  const accountTrigger = document.querySelector("[data-account-trigger]");
  const accountMenu = document.querySelector("[data-account-menu]");
  const signOut = document.querySelector("[data-sign-out]");
  const changePassword = document.querySelector("[data-change-password]");

  menuBtn?.addEventListener("click", () => {
    const open = drawer?.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(Boolean(open)));
  });

  searchBtn?.addEventListener("click", () => {
    window.VHSearch?.open();
  });

  accountTrigger?.addEventListener("click", async (event) => {
    const { data } = await supabaseClient.auth.getSession();
    const user = data.session?.user || null;

    if (!user) {
      if (currentPage() === "dang-nhap.html") return;
      event.preventDefault();
      window.VHAccount?.openLogin();
      return;
    }

    event.preventDefault();
    if (accountMenu) accountMenu.hidden = !accountMenu.hidden;
  });

  changePassword?.addEventListener("click", () => {
    if (accountMenu) accountMenu.hidden = true;
    window.VHAccount?.openPasswordChange();
  });

  signOut?.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    if (accountMenu) accountMenu.hidden = true;
    renderAccount(null);
  });

  document.addEventListener("click", (event) => {
    const root = document.querySelector("[data-account-root]");
    if (!root || root.contains(event.target)) return;
    if (accountMenu) accountMenu.hidden = true;
  });
}

async function refreshAuth() {
  const { data } = await supabaseClient.auth.getSession();
  renderAccount(data.session?.user || null);
}

export async function initSiteHeader() {
  let headerHost = document.getElementById(HEADER_HOST_ID);
  let footerHost = document.getElementById(FOOTER_HOST_ID);

  // Tương thích các trang cũ: nếu còn header/footer HTML tĩnh,
  // tự thay bằng host dùng chung mà không đụng phần nội dung giữa trang.
  if (!headerHost) {
    const legacyHeader = document.querySelector("header.topbar");
    if (legacyHeader) {
      headerHost = document.createElement("div");
      headerHost.id = HEADER_HOST_ID;
      legacyHeader.replaceWith(headerHost);
    }
  }

  if (!footerHost) {
    const legacyFooter = document.querySelector("footer.footer");
    if (legacyFooter) {
      footerHost = document.createElement("div");
      footerHost.id = FOOTER_HOST_ID;
      legacyFooter.replaceWith(footerHost);
    }
  }

  if (!headerHost && !footerHost) {
    return;
  }

  injectSupportStyles();

  if (headerHost) {
    headerHost.innerHTML = headerHtml();
    createSearchOverlay();
    createAccountDialogs();
    bindHeaderEvents();
    await refreshAuth();

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      renderAccount(session?.user || null);
    });
  }

  if (footerHost) {
    footerHost.innerHTML = footerHtml();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSiteHeader, { once: true });
} else {
  initSiteHeader();
}
