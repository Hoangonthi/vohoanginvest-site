(() => {
  "use strict";

  const HOT_URL = "https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/hot-stocks-feed";
  const PS_URL = "https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/derivatives-feed";

  const nf = new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? nf.format(n) : "—";
  }

  function ensureRoot() {
    let root = document.getElementById("vh-live-intelligence");
    if (root) return root;

    const style = document.createElement("style");
    style.textContent = `
      #vh-live-intelligence{
        max-width:1180px;
        margin:28px auto;
        padding:0 20px;
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif
      }
      
      #vh-live-intelligence .vh-live-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:16px
      }

      #vh-live-intelligence .vh-live-card{
        background:rgba(12,18,30,.88);
        border:1px solid rgba(213,180,107,.26);
        border-radius:18px;
        padding:20px;
        box-shadow:0 18px 44px rgba(0,0,0,.18)
      }

      #vh-live-intelligence .vh-live-title{
        margin:0 0 14px;
        color:#f2e7ce;
        font-family:"Be Vietnam Pro",system-ui,sans-serif;
        font-size:21px;
        font-weight:700;
        line-height:1.35;
        letter-spacing:-0.02em;
      }
      #vh-live-intelligence .vh-live-status{
        margin:-6px 0 14px;
        color:rgba(255,255,255,.46);
        font-size:12px;
        font-weight:500;
      }
      
      #vh-live-intelligence .vh-live-row{
        display:flex;
        ...
      }
      #vh-live-intelligence .vh-live-row{
        display:flex;
        justify-content:space-between;
        gap:18px;
        padding:8px 0;
        border-bottom:1px solid rgba(255,255,255,.07)
      }

      #vh-live-intelligence .vh-live-row:last-child{
        border-bottom:0
      }

      #vh-live-intelligence .vh-live-label{
        color:rgba(255,255,255,.66);
        font-size:14px
      }

      #vh-live-intelligence .vh-live-value{
        color:#fff;
        font-weight:700;
        text-align:right
      }

      #vh-live-intelligence .vh-live-trend-up{
        color:#9fe0b0
      }

      #vh-live-intelligence .vh-live-trend-down{
        color:#ffaaa2
      }

      #vh-live-intelligence .vh-hot-symbols{
        font-size:20px;
        font-weight:800;
        letter-spacing:.04em;
        color:#fff;
        line-height:1.65
      }

      #vh-live-intelligence .vh-hot-cta{
        margin-top:12px;
        color:rgba(255,255,255,.72);
        font-size:14px;
        line-height:1.55
      }

      @media(max-width:760px){
        #vh-live-intelligence .vh-live-grid{
          grid-template-columns:1fr
        }

        #vh-live-intelligence{
          padding:0 14px
        }

        #vh-live-intelligence .vh-live-row{
          align-items:flex-start
        }
      }
    `;

    document.head.appendChild(style);

    root = document.createElement("section");
    root.id = "vh-live-intelligence";
    root.setAttribute("aria-label", "Dữ liệu thị trường trực tiếp");

    root.innerHTML = `
      <div class="vh-live-grid">

        <article class="vh-live-card" id="vh-derivatives-card">
          <h2 class="vh-live-title">Xu hướng phái sinh</h2>
          <div class="vh-live-status" id="vh-ps-status">—</div>

          <div class="vh-live-row">
            <span class="vh-live-label">Xu hướng</span>
            <span class="vh-live-value" id="vh-ps-trend">—</span>
          </div>

          <div class="vh-live-row">
            <span class="vh-live-label">Giá hiện tại</span>
            <span class="vh-live-value" id="vh-ps-current">—</span>
          </div>

          <div class="vh-live-row">
            <span class="vh-live-label">Giá hệ thống báo</span>
            <span class="vh-live-value" id="vh-ps-entry">—</span>
          </div>

          <div class="vh-live-row">
            <span class="vh-live-label">Mục tiêu xu hướng</span>
            <span class="vh-live-value" id="vh-ps-targets">—</span>
          </div>

          <div class="vh-live-row">
            <span class="vh-live-label">Đảo chiều xu hướng</span>
            <span class="vh-live-value" id="vh-ps-reversal">—</span>
          </div>
        </article>

        <article class="vh-live-card" id="vh-hot-card">
          <h2 class="vh-live-title">Cổ phiếu đáng chú ý hôm nay</h2>
          <div class="vh-live-status" id="vh-hot-status">—</div>

          <div class="vh-hot-symbols" id="vh-hot-symbols">—</div>

          <div class="vh-hot-cta">
            ACE cần thêm thông tin chi tiết từng mã, inbox Ad để trao đổi thêm.
          </div>
        </article>

      </div>
    `;

    const anchor = document.getElementById("market-live-blocks-anchor");

    if (anchor) {
      anchor.replaceWith(root);
    } else {
      const main = document.querySelector("main");
      const footer = document.querySelector("footer");

      if (main) {
        main.appendChild(root);
      } else if (footer && footer.parentNode) {
        footer.parentNode.insertBefore(root, footer);
      } else {
        document.body.appendChild(root);
      }
    }

    return root;
  }

  async function loadDerivatives() {
    ensureRoot();

    try {
      const r = await fetch(PS_URL, {
        cache: "no-store",
      });

      if (!r.ok) {
        throw new Error("HTTP " + r.status);
      }

      const d = await r.json();

      if (!d || !d.trend) {
      return;
      }

      const statusText =
      d.fresh === true ? "Realtime" : "Dữ liệu cuối cùng";

      const trend = String(d.trend);

      const trendEl = document.getElementById("vh-ps-trend");

      trendEl.textContent = trend;

      trendEl.className =
        "vh-live-value " +
        (trend.toLowerCase() === "tăng"
          ? "vh-live-trend-up"
          : "vh-live-trend-down");

      document.getElementById("vh-ps-current").textContent =
        num(d.last_price);

      document.getElementById("vh-ps-entry").textContent =
        num(d.system_price);

      document.getElementById("vh-ps-targets").textContent =
        `T1 ${num(d.targets?.t1)} · T2 ${num(d.targets?.t2)} · T3 ${num(d.targets?.t3)}`;

      document.getElementById("vh-ps-reversal").textContent =
        num(d.reversal_price);
      document.getElementById("vh-ps-status").textContent = statusText;
      
    } catch (_) {
      // Lỗi mạng tạm thời:
      // giữ nguyên dữ liệu lần cập nhật tốt gần nhất.
      return;
    }
  }

  async function loadHotStocks() {
    ensureRoot();

    try {
      const r = await fetch(HOT_URL, {
        cache: "no-store",
      });

      if (!r.ok) {
        throw new Error("HTTP " + r.status);
      }

      const d = await r.json();

      const symbols = Array.isArray(d?.symbols)
        ? d.symbols.filter(Boolean)
        : [];

      if (!d || symbols.length === 0) {
        // Feed chậm tạm thời:
        // giữ nguyên danh sách tốt gần nhất.
        return;
      }

      document.getElementById("vh-hot-symbols").textContent =
        symbols.join(", ");
      const statusText = d.fresh === true ? "Realtime" : "Dữ liệu cuối cùng";
      document.getElementById("vh-hot-status").textContent = statusText;

    } catch (_) {
      // Lỗi mạng tạm thời:
      // giữ nguyên danh sách cũ.
      return;
    }
  }

  function start() {
    ensureRoot();

    loadDerivatives();
    loadHotStocks();

    setInterval(loadDerivatives, 3000);
    setInterval(loadHotStocks, 60000);
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      { once: true }
    );
  } else {
    start();
  }
})();
