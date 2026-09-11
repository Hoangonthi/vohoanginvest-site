(() => {
  "use strict";

  const MARKET_URL =
    "https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-feed";

  const PS_URL =
    "https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/derivatives-feed";

  const ROOT_ID = "vh-market-ticker";
  const STORAGE_KEY = "vh_market_ticker_last_good_v1";

  const fmt = new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const fmt0 = new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0
  });

  function n(v, digits = 2) {
    const x = Number(v);

    if (!Number.isFinite(x)) {
      return "—";
    }

    return digits === 0
      ? fmt0.format(x)
      : fmt.format(x);
  }

  function signed(v) {
    const x = Number(v);

    if (!Number.isFinite(x)) {
      return "—";
    }

    return `${x > 0 ? "+" : ""}${fmt.format(x)}%`;
  }

  function tone(v) {
    const x = Number(v);

    if (!Number.isFinite(x) || x === 0) {
      return "flat";
    }

    return x > 0
      ? "up"
      : "down";
  }

  function getIndex(data, symbol) {
    return Array.isArray(data?.indexes)
      ? data.indexes.find(
          x =>
            String(x?.symbol || "") ===
            symbol
        )
      : null;
  }

  function ensureStyle() {
    if (
      document.getElementById(
        "vh-market-ticker-style"
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "vh-market-ticker-style";

    style.textContent = `
      #${ROOT_ID}{
        position:relative;
        z-index:45;
        width:100%;
        height:38px;
        overflow:hidden;
        background:#06101b;
        border-top:
          1px solid
          rgba(255,255,255,.035);
        border-bottom:
          1px solid
          rgba(224,187,103,.16);
        color:#dbe3eb;
        font-family:
          "Be Vietnam Pro",
          Inter,
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
      }

      #${ROOT_ID}
      .vh-ticker-viewport{
        width:100%;
        height:100%;
        overflow:hidden;
        display:flex;
        align-items:center;
      }

      #${ROOT_ID}
      .vh-ticker-track{
        display:flex;
        align-items:center;
        width:max-content;
        white-space:nowrap;
        will-change:transform;
        transform:translate3d(0,0,0);
        animation:
          vhTickerMove
          22s linear infinite;
      }

      #${ROOT_ID}:hover
      .vh-ticker-track{
        animation-play-state:paused;
      }

      #${ROOT_ID}
      .vh-ticker-set{
        display:flex;
        align-items:center;
        flex:none;
        min-width:max-content;
      }

      #${ROOT_ID}
      .vh-ticker-item{
        display:flex;
        align-items:center;
        gap:7px;
        padding:0 18px;
        height:38px;
        border-right:
          1px solid
          rgba(255,255,255,.07);
        font-size:12px;
      }

      #${ROOT_ID}
      .vh-ticker-label{
        color:
          rgba(255,255,255,.58);
        font-weight:600;
      }

      #${ROOT_ID}
      .vh-ticker-value{
        color:#f7f8fa;
        font-weight:800;
      }

      #${ROOT_ID}
      .vh-ticker-change{
        font-weight:800;
      }

      #${ROOT_ID}
      .vh-ticker-change.up{
        color:#76d7a7;
      }

      #${ROOT_ID}
      .vh-ticker-change.down{
        color:#ff8f86;
      }

      #${ROOT_ID}
      .vh-ticker-change.flat{
        color:#aeb8c4;
      }

      #${ROOT_ID}
      .vh-ticker-state{
        color:#e0bb67;
        font-weight:800;
      }

      #${ROOT_ID}
      .vh-ticker-status{
        position:absolute;
        right:8px;
        top:7px;
        z-index:2;
        padding:3px 8px;
        border-radius:999px;
        background:
          rgba(6,16,27,.92);
        border:
          1px solid
          rgba(255,255,255,.08);
        color:
          rgba(255,255,255,.48);
        font-size:9px;
        letter-spacing:.04em;
        pointer-events:none;
      }

      @keyframes vhTickerMove{
        0%{
          transform:translate3d(0,0,0);
        }

        100%{
          transform:translate3d(-50%,0,0);
        }
      }

      @media(max-width:760px){
        #${ROOT_ID}{
          height:36px;
        }

        #${ROOT_ID}
        .vh-ticker-track{
          animation-duration:22s;
        }

        #${ROOT_ID}
        .vh-ticker-item{
          height:36px;
          padding:0 14px;
          font-size:11px;
        }

        #${ROOT_ID}
        .vh-ticker-status{
          display:none;
        }
      }

    `;

    document.head.appendChild(
      style
    );
  }

  function ensureRoot() {
    let root =
      document.getElementById(
        ROOT_ID
      );

    if (root) {
      return root;
    }

    ensureStyle();

    root =
      document.createElement("div");

    root.id =
      ROOT_ID;

    root.setAttribute(
      "aria-label",
      "Chỉ số thị trường"
    );

    root.innerHTML = `
      <div class="vh-ticker-viewport">

        <div
          class="vh-ticker-track"
          id="vh-ticker-track"
        >

          <div
            class="vh-ticker-set"
            id="vh-ticker-set-a"
          ></div>

          <div
            class="vh-ticker-set"
            id="vh-ticker-set-b"
            aria-hidden="true"
          ></div>

        </div>

      </div>

      <div
        class="vh-ticker-status"
        id="vh-ticker-status"
      >
        Đang tải
      </div>
    `;

    const header =
      document.querySelector(
        "header.topbar"
      ) ||
      document.querySelector(
        "header"
      ) ||
      document.querySelector(
        ".topbar"
      );

    if (
      header &&
      header.parentNode
    ) {
      header.insertAdjacentElement(
        "afterend",
        root
      );
    } else {
      document.body.prepend(
        root
      );
    }

    return root;
  }

  function item(
    label,
    value,
    change = null
  ) {
    return `
      <div class="vh-ticker-item">

        <span class="vh-ticker-label">
          ${label}
        </span>

        <span class="vh-ticker-value">
          ${value}
        </span>

        ${
          change === null
            ? ""
            : `
              <span
                class="vh-ticker-change ${tone(change)}"
              >
                ${signed(change)}
              </span>
            `
        }

      </div>
    `;
  }

  function stateItem(
    label,
    state
  ) {
    return `
      <div class="vh-ticker-item">

        <span class="vh-ticker-label">
          ${label}
        </span>

        <span class="vh-ticker-state">
          ${state || "—"}
        </span>

      </div>
    `;
  }

  function breadthItem(b) {
    if (!b) {
      return item(
        "Độ rộng",
        "—"
      );
    }

    const adv =
      Number.isFinite(
        Number(b.adv)
      )
        ? Number(b.adv)
        : null;

    const dec =
      Number.isFinite(
        Number(b.dec)
      )
        ? Number(b.dec)
        : null;

    const flat =
      Number.isFinite(
        Number(b.flat)
      )
        ? Number(b.flat)
        : null;

    if (
      adv === null ||
      dec === null ||
      flat === null
    ) {
      return item(
        "Độ rộng",
        b.label || "—"
      );
    }

    return `
      <div class="vh-ticker-item">

        <span class="vh-ticker-label">
          Độ rộng
        </span>

        <span class="vh-ticker-change up">
          ${fmt0.format(adv)}↑
        </span>

        <span class="vh-ticker-value">
          ${fmt0.format(flat)}→
        </span>

        <span class="vh-ticker-change down">
          ${fmt0.format(dec)}↓
        </span>

      </div>
    `;
  }

  function render(
    data,
    ps = null,
    source = "live"
  ) {
    ensureRoot();

    const vn =
      getIndex(
        data,
        "VN-INDEX"
      );

    const vn30 =
      getIndex(
        data,
        "VN30"
      );

    const hnx =
      getIndex(
        data,
        "HNX-INDEX"
      );

    const upcom =
      getIndex(
        data,
        "UPCOM-INDEX"
      );

    const intel =
      data?.market_intelligence || {};

    const flow =
      intel?.flow || {};

    const breadth =
      intel?.breadth || {};

    const state =
      intel?.state || {};

    const fresh =
      intel?.freshness || {};

    const html = [
      item(
        "VN-Index",
        n(
          vn?.value ??
          vn?.close ??
          vn?.last ??
          vn?.price
        ),
        vn?.change_pct
      ),

      item(
        "VN30",
        n(
          vn30?.value ??
          vn30?.close ??
          vn30?.last ??
          vn30?.price
        ),
        vn30?.change_pct
      ),

      item(
        "HNX-Index",
        n(
          hnx?.value ??
          hnx?.close ??
          hnx?.last ??
          hnx?.price
        ),
        hnx?.change_pct
      ),

      item(
        "UPCOM",
        n(
          upcom?.value ??
          upcom?.close ??
          upcom?.last ??
          upcom?.price
        ),
        upcom?.change_pct
      ),

      item(
        "GTGD",
        flow?.value_b != null
          ? `${n(
              flow.value_b,
              0
            )} tỷ`
          : "—"
      ),

      breadthItem(
        breadth
      ),

      stateItem(
        "Trạng thái",
        state?.label
      ),

      ps?.trend
        ? item(
            "Phái sinh",
            `${ps.trend} · ${n(
              ps.last_price
            )}`
          )
        : item(
            "Phái sinh",
            "—"
          )
    ].join("");

    const setA =
      document.getElementById(
        "vh-ticker-set-a"
      );

    const setB =
      document.getElementById(
        "vh-ticker-set-b"
      );

    if (setA) {
      setA.innerHTML =
        html;
    }

    if (setB) {
      setB.innerHTML =
        html;
    }

    const status =
      document.getElementById(
        "vh-ticker-status"
      );

    if (status) {
      const label =
        source === "cache"
          ? "Dữ liệu cuối cùng"
          : fresh?.label ||
            "Realtime";

      status.textContent =
        label;
    }

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          at: Date.now(),
          market: data,
          ps
        })
      );
    } catch (_) {}
  }

  function renderCache() {
    try {
      const raw =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (!raw) {
        return false;
      }

      const cached =
        JSON.parse(raw);

      if (!cached?.market) {
        return false;
      }

      render(
        cached.market,
        cached.ps || null,
        "cache"
      );

      return true;
    } catch (_) {
      return false;
    }
  }

  async function load() {
    ensureRoot();

    try {
      const [
        marketResp,
        psResp
      ] =
        await Promise.allSettled([
          fetch(
            MARKET_URL,
            {
              cache:
                "no-store"
            }
          ),

          fetch(
            PS_URL,
            {
              cache:
                "no-store"
            }
          )
        ]);

      let market = null;
      let ps = null;

      if (
        marketResp.status ===
          "fulfilled" &&
        marketResp.value.ok
      ) {
        market =
          await marketResp.value.json();
      }

      if (
        psResp.status ===
          "fulfilled" &&
        psResp.value.ok
      ) {
        ps =
          await psResp.value.json();
      }

      if (
        !market?.indexes?.length
      ) {
        if (!renderCache()) {
          const status =
            document.getElementById(
              "vh-ticker-status"
            );

          if (status) {
            status.textContent =
              "Chưa có dữ liệu";
          }
        }

        return;
      }

      render(
        market,
        ps,
        "live"
      );

    } catch (_) {
      renderCache();
    }
  }

  function start() {
    ensureRoot();

    renderCache();

    load();

    setInterval(
      load,
      15000
    );
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      {
        once:true
      }
    );
  } else {
    start();
  }

})();
