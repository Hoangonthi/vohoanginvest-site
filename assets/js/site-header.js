import { supabaseClient } from "./supabase-client.js";

const HEADER_HOST_ID = "siteHeader";

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

function injectSupportStyles() {
  if (document.getElementById("vhSharedHeaderSupport")) return;

  const style = document.createElement("style");
  style.id = "vhSharedHeaderSupport";
  style.textContent = `
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

    @media(max-width:680px){
      .vh-account-menu{position:fixed;left:10px;right:10px;top:74px;width:auto}
      .login-btn .vh-login-label{max-width:84px}
      .vh-search-backdrop{padding:0}
      .vh-search-panel{width:100%;height:100%;border:0;border-radius:0}
      .vh-search-results{max-height:calc(100vh - 64px)}
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

    if (!user) return; // giữ href="dang-nhap.html" làm fallback

    event.preventDefault();
    if (accountMenu) accountMenu.hidden = !accountMenu.hidden;
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
  const host = document.getElementById(HEADER_HOST_ID);
  if (!host) {
    console.warn(`[site-header] Không tìm thấy #${HEADER_HOST_ID}.`);
    return;
  }

  injectSupportStyles();
  host.innerHTML = headerHtml();
  createSearchOverlay();
  bindHeaderEvents();
  await refreshAuth();

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    renderAccount(session?.user || null);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSiteHeader, { once: true });
} else {
  initSiteHeader();
}
