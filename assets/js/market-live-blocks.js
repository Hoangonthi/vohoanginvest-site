(() => {
  "use strict";

  const HOT_URL = "https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/hot-stocks-feed";
  const PS_URL  = "https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/derivatives-feed";

  const nf = new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
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
      #vh-live-intelligence{max-width:1180px;margin:28px auto;padding:0 20px;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      #vh-live-intelligence .vh-live-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
      #vh-live-intelligence .vh-live-card{background:rgba(12,18,30,.88);border:1px solid rgba(213,180,107,.26);border-radius:18px;padding:20px;box-shadow:0 18px 44px rgba(0,0,0,.18)}
      #vh-live-intelligence .vh-live-title{margin:0 0 14px;color:#f2e7ce;font:700 22px/1.2 Georgia,"Times New Roman",serif}
      #vh-live-intelligence .vh-live-row{display:flex;justify-content:space-between;gap:18px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.07)}
      #vh-live-intelligence .vh-live-row:last-child{border-bottom:0}
      #vh-live-intelligence .vh-live-label{color:rgba(255,255,255,.66);font-size:14px}
      #vh-live-intelligence .vh-live-value{color:#fff;font-weight:700;text-align:right}
      #vh-live-intelligence .vh-live-trend-up{color:#9fe0b0}
      #vh-live-intelligence .vh-live-trend-down{color:#ffaaa2}
      #vh-live-intelligence .vh-hot-symbols{font-size:20px;font-weight:800;letter-spacing:.04em;color:#fff;line-height:1.65}
      #vh-live-intelligence .vh-hot-cta{margin-top:12px;color:rgba(255,255,255,.72);font-size:14px;line-height:1.55}
      #vh-live-intelligence [hidden]{display:none!important}
      @media(max-width:760px){#vh-live-intelligence .vh-live-grid{grid-template-columns:1fr}#vh-live-intelligence{padding:0 14px}.vh-live-row{align-items:flex-start}}
    `;
    document.head.appendChild(style);

    root = document.createElement("section");
    root.id = "vh-live-intelligence";
    root.setAttribute("aria-label", "Dữ liệu thị trường trực tiếp");
    root.innerHTML = `
      <div class="vh-live-grid">
        <article class="vh-live-card" id="vh-derivatives-card" hidden>
          <h2 class="vh-live-title">Xu hướng phái sinh</h2>
          <div class="vh-live-row"><span class="vh-live-label">Xu hướng</span><span class="vh-live-value" id="vh-ps-trend">—</span></div>
          <div class="vh-live-row"><span class="vh-live-label">Giá hệ thống báo</span><span class="vh-live-value" id="vh-ps-entry">—</span></div>
          <div class="vh-live-row"><span class="vh-live-label">Mục tiêu xu hướng</span><span class="vh-live-value" id="vh-ps-targets">—</span></div>
          <div class="vh-live-row"><span class="vh-live-label">Đảo chiều xu hướng</span><span class="vh-live-value" id="vh-ps-reversal">—</span></div>
        </article>

        <article class="vh-live-card" id="vh-hot-card" hidden>
          <h2 class="vh-live-title">Cổ phiếu nổi bật theo dòng tiền</h2>
          <div class="vh-hot-symbols" id="vh-hot-symbols">—</div>
          <div class="vh-hot-cta">ACE cần thêm thông tin chi tiết từng mã, inbox Ad để trao đổi thêm.</div>
        </article>
      </div>
    `;

    const anchor = document.getElementById("market-live-blocks-anchor");
    if (anchor) {
      anchor.replaceWith(root);
    } else {
      const main = document.querySelector("main");
      const footer = document.querySelector("footer");
      if (main) main.appendChild(root);
      else if (footer && footer.parentNode) footer.parentNode.insertBefore(root, footer);
      else document.body.appendChild(root);
    }
    return root;
  }

  async function loadDerivatives() {
    ensureRoot();
    const card = document.getElementById("vh-derivatives-card");
    try {
      const r = await fetch(PS_URL, { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();

      if (!d || d.fresh !== true || !d.trend) {
        card.hidden = true;
        return;
      }

      const trend = String(d.trend);
      const trendEl = document.getElementById("vh-ps-trend");
      trendEl.textContent = trend;
      trendEl.className = "vh-live-value " + (trend.toLowerCase() === "tăng" ? "vh-live-trend-up" : "vh-live-trend-down");

      document.getElementById("vh-ps-entry").textContent = num(d.system_price);
      document.getElementById("vh-ps-targets").textContent =
        `T1 ${num(d.targets?.t1)} · T2 ${num(d.targets?.t2)} · T3 ${num(d.targets?.t3)}`;
      document.getElementById("vh-ps-reversal").textContent = num(d.reversal_price);
      card.hidden = false;
    } catch (_) {
      card.hidden = true;
    }
  }

  async function loadHotStocks() {
    ensureRoot();
    const card = document.getElementById("vh-hot-card");
    try {
      const r = await fetch(HOT_URL, { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();
      const symbols = Array.isArray(d?.symbols) ? d.symbols.filter(Boolean) : [];

      if (!d || d.fresh !== true || symbols.length === 0) {
        card.hidden = true;
        return;
      }

      document.getElementById("vh-hot-symbols").textContent = symbols.join(", ");
      card.hidden = false;
    } catch (_) {
      card.hidden = true;
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
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();