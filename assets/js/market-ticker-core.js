(() => {
  "use strict";

  const MARKET_URL =
    "https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-feed";

  const PS_URL =
    "https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/derivatives-feed";

  const ROOT_ID = "vh-market-ticker";
  const STORAGE_KEY =
    "vh_market_ticker_last_good_v2";

  const REFRESH_MS = 15000;

  /*
   * Tốc độ chạy ticker.
   * Số càng lớn chạy càng nhanh.
   * 38px/giây = khá dễ đọc.
   */
  const SPEED_PX_PER_SECOND = 38;

  const fmt2 =
    new Intl.NumberFormat(
      "vi-VN",
      {
        minimumFractionDigits:2,
        maximumFractionDigits:2
      }
    );

  const fmt1 =
    new Intl.NumberFormat(
      "vi-VN",
      {
        minimumFractionDigits:1,
        maximumFractionDigits:1
      }
    );

  const fmt0 =
    new Intl.NumberFormat(
      "vi-VN",
      {
        maximumFractionDigits:0
      }
    );

  let tickerOffset = 0;
  let lastFrameTime = 0;
  let animationFrameId = null;
  let tickerPaused = false;


  /* =========================
     TIỆN ÍCH
  ========================= */

  function numberValue(v) {
    const x = Number(v);

    return Number.isFinite(x)
      ? x
      : null;
  }


  function formatNumber(
    v,
    digits = 2
  ) {
    const x = numberValue(v);

    if (x === null) {
      return "—";
    }

    if (digits === 0) {
      return fmt0.format(x);
    }

    if (digits === 1) {
      return fmt1.format(x);
    }

    return fmt2.format(x);
  }


  function formatSignedNumber(v) {
    const x = numberValue(v);

    if (x === null) {
      return "—";
    }

    const sign =
      x > 0
        ? "+"
        : "";

    return `${sign}${fmt2.format(x)}`;
  }


  function formatPercent(v) {
    const x = numberValue(v);

    if (x === null) {
      return "—";
    }

    const sign =
      x > 0
        ? "+"
        : "";

    return `${sign}${fmt2.format(x)}%`;
  }


  function tone(v) {
    const x = numberValue(v);

    if (
      x === null ||
      x === 0
    ) {
      return "flat";
    }

    return x > 0
      ? "up"
      : "down";
  }


  function firstValue(
    obj,
    keys
  ) {
    if (!obj) {
      return null;
    }

    for (
      const key of keys
    ) {
      const value =
        key
          .split(".")
          .reduce(
            (
              acc,
              part
            ) =>
              acc?.[part],
            obj
          );

      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        return value;
      }
    }

    return null;
  }


  function esc(value) {
    return String(
      value ?? ""
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
  }


  /* =========================
     INDEX
  ========================= */

  function getIndex(
    data,
    symbol
  ) {
    if (
      !Array.isArray(
        data?.indexes
      )
    ) {
      return null;
    }

    return (
      data.indexes.find(
        item =>
          String(
            item?.symbol || ""
          ).toUpperCase() ===
          symbol.toUpperCase()
      ) || null
    );
  }


  function indexPrice(index) {
    return firstValue(
      index,
      [
        "value",
        "close",
        "last",
        "price",
        "current",
        "current_price",
        "index_value"
      ]
    );
  }


  function indexPercent(index) {
    return firstValue(
      index,
      [
        "change_pct",
        "change_percent",
        "percent_change",
        "pct_change",
        "changePercent"
      ]
    );
  }


  function indexPointChange(index) {
    /*
     * Ưu tiên điểm tăng/giảm
     * do backend gửi trực tiếp.
     */
    const direct =
      firstValue(
        index,
        [
          "change",
          "change_point",
          "change_points",
          "point_change",
          "change_value",
          "delta",
          "diff"
        ]
      );

    if (
      numberValue(direct) !== null
    ) {
      return Number(direct);
    }

    /*
     * Nếu backend chưa gửi điểm thay đổi,
     * tính ngược từ:
     * giá hiện tại + % thay đổi.
     */
    const current =
      numberValue(
        indexPrice(index)
      );

    const pct =
      numberValue(
        indexPercent(index)
      );

    if (
      current === null ||
      pct === null
    ) {
      return null;
    }

    const denominator =
      1 + pct / 100;

    if (
      denominator === 0
    ) {
      return null;
    }

    const previous =
      current / denominator;

    return (
      current -
      previous
    );
  }


  function indexVolume(index) {
    return firstValue(
      index,
      [
        "volume",
        "total_volume",
        "matched_volume",
        "match_volume",
        "trading_volume",
        "totalVolume",
        "vol"
      ]
    );
  }


  function formatVolume(v) {
    const x = numberValue(v);

    if (x === null) {
      return "—";
    }

    if (
      Math.abs(x) >=
      1000000000
    ) {
      return (
        `${fmt2.format(
          x / 1000000000
        )} tỷ`
      );
    }

    if (
      Math.abs(x) >=
      1000000
    ) {
      return (
        `${fmt1.format(
          x / 1000000
        )}tr`
      );
    }

    if (
      Math.abs(x) >=
      1000
    ) {
      return (
        `${fmt1.format(
          x / 1000
        )}k`
      );
    }

    return fmt0.format(x);
  }


  /* =========================
     PHÁI SINH
  ========================= */

  function derivativeTrend(ps) {
    return (
      firstValue(
        ps,
        [
          "trend",
          "direction",
          "signal",
          "system_trend",
          "system.direction"
        ]
      ) || "—"
    );
  }


  function derivativeCurrentPrice(ps) {
    return firstValue(
      ps,
      [
        "last_price",
        "price",
        "current_price",
        "last",
        "close"
      ]
    );
  }


  function derivativeSystemPrice(ps) {
    return firstValue(
      ps,
      [
        "system_price",
        "price_system",
        "signal_price",
        "model_price",
        "system.price",
        "systemPrice",
        "entry_price",
        "reference_price"
      ]
    );
  }


  function derivativeVolume(ps) {
    return firstValue(
      ps,
      [
        "volume",
        "total_volume",
        "matched_volume",
        "match_volume",
        "trading_volume",
        "totalVolume",
        "vol"
      ]
    );
  }


  function derivativeDifference(ps) {
    const direct =
      firstValue(
        ps,
        [
          "difference",
          "diff",
          "basis",
          "spread",
          "system_diff",
          "price_diff"
        ]
      );

    if (
      numberValue(direct) !== null
    ) {
      return Number(direct);
    }

    const systemPrice =
      numberValue(
        derivativeSystemPrice(ps)
      );

    const currentPrice =
      numberValue(
        derivativeCurrentPrice(ps)
      );

    if (
      systemPrice === null ||
      currentPrice === null
    ) {
      return null;
    }

    return (
      currentPrice -
      systemPrice
    );
  }


  /* =========================
     CSS
  ========================= */

  function ensureStyle() {
    if (
      document.getElementById(
        "vh-market-ticker-style"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "vh-market-ticker-style";

    style.textContent = `
      #${ROOT_ID}{
        position:relative;
        z-index:45;

        width:100%;
        height:44px;

        overflow:hidden;

        background:#06101b;

        border-top:
          1px solid
          rgba(255,255,255,.04);

        border-bottom:
          1px solid
          rgba(224,187,103,.18);

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
        position:relative;

        width:
          calc(100% - 20px);

        height:100%;

        margin:
          0 10px;

        overflow:hidden;

        display:flex;

        align-items:center;
      }


      #${ROOT_ID}
      .vh-ticker-track{
        display:flex;

        align-items:center;

        flex:none;

        width:max-content;

        white-space:nowrap;

        transform:
          translate3d(
            0,
            0,
            0
          );

        will-change:
          transform;
      }


      #${ROOT_ID}
      .vh-ticker-set{
        display:flex;

        align-items:center;

        flex:none;

        width:max-content;

        white-space:nowrap;
      }


      #${ROOT_ID}
      .vh-ticker-item{
        flex:none;

        display:flex;

        align-items:center;

        gap:6px;

        height:44px;

        padding:
          0 13px;

        border-right:
          1px solid
          rgba(
            255,
            255,
            255,
            .075
          );

        font-size:12px;

        line-height:1;

        white-space:nowrap;
      }


      #${ROOT_ID}
      .vh-ticker-label{
        color:
          rgba(
            255,
            255,
            255,
            .58
          );

        font-weight:600;
      }


      #${ROOT_ID}
      .vh-ticker-name{
        color:#dce5ed;

        font-weight:700;
      }


      #${ROOT_ID}
      .vh-ticker-value{
        color:#fff;

        font-weight:800;
      }


      #${ROOT_ID}
      .vh-ticker-change{
        font-weight:800;
      }


      #${ROOT_ID}
      .vh-ticker-change.up{
        color:#72d9a5;
      }


      #${ROOT_ID}
      .vh-ticker-change.down{
        color:#ff8179;
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
      .vh-ticker-separator{
        color:
          rgba(
            255,
            255,
            255,
            .22
          );
      }


      #${ROOT_ID}
      .vh-ticker-status{
        position:absolute;

        right:8px;
        top:50%;

        transform:
          translateY(-50%);

        z-index:3;

        padding:
          3px 7px;

        border-radius:999px;

        background:
          rgba(
            6,
            16,
            27,
            .94
          );

        border:
          1px solid
          rgba(
            255,
            255,
            255,
            .08
          );

        color:
          rgba(
            255,
            255,
            255,
            .48
          );

        font-size:9px;

        line-height:1;

        pointer-events:none;
      }


      @media(
        max-width:760px
      ){

        #${ROOT_ID}{
          height:42px;
        }


        #${ROOT_ID}
        .vh-ticker-viewport{
          width:
            calc(
              100% - 12px
            );

          margin:
            0 6px;
        }


        #${ROOT_ID}
        .vh-ticker-item{
          height:42px;

          padding:
            0 10px;

          font-size:11px;

          gap:5px;
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


  /* =========================
     DOM
  ========================= */

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
      document.createElement(
        "div"
      );

    root.id =
      ROOT_ID;

    root.setAttribute(
      "aria-label",
      "Chỉ số thị trường"
    );

    root.innerHTML = `
      <div
        class="vh-ticker-viewport"
      >

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

    root.addEventListener(
      "mouseenter",
      () => {
        tickerPaused = true;
      }
    );

    root.addEventListener(
      "mouseleave",
      () => {
        tickerPaused = false;
      }
    );

    return root;
  }


  /* =========================
     HTML ITEM
  ========================= */

  function indexItem(
    label,
    index
  ) {
    const price =
      numberValue(
        indexPrice(index)
      );

    const change =
      indexPointChange(index);

    const pct =
      numberValue(
        indexPercent(index)
      );

    const volume =
      indexVolume(index);

    const toneClass =
      tone(
        pct !== null
          ? pct
          : change
      );

    return `
      <div
        class="vh-ticker-item"
      >

        <span
          class="vh-ticker-name"
        >
          ${esc(label)}
        </span>

        <span
          class="vh-ticker-value"
        >
          ${formatNumber(price)}
        </span>

        <span
          class="vh-ticker-change ${toneClass}"
        >
          ${formatSignedNumber(change)}
        </span>

        <span
          class="vh-ticker-change ${toneClass}"
        >
          ${formatPercent(pct)}
        </span>

        <span
          class="vh-ticker-label"
        >
          KL
        </span>

        <span
          class="vh-ticker-value"
        >
          ${formatVolume(volume)}
        </span>

      </div>
    `;
  }


  function valueItem(
    label,
    value
  ) {
    return `
      <div
        class="vh-ticker-item"
      >

        <span
          class="vh-ticker-label"
        >
          ${esc(label)}
        </span>

        <span
          class="vh-ticker-value"
        >
          ${esc(value)}
        </span>

      </div>
    `;
  }


  function breadthItem(b) {
    if (!b) {
      return valueItem(
        "Độ rộng",
        "—"
      );
    }

    const adv =
      numberValue(b.adv);

    const dec =
      numberValue(b.dec);

    const flat =
      numberValue(b.flat);

    if (
      adv === null ||
      dec === null ||
      flat === null
    ) {
      return valueItem(
        "Độ rộng",
        b.label || "—"
      );
    }

    return `
      <div
        class="vh-ticker-item"
      >

        <span
          class="vh-ticker-label"
        >
          Độ rộng
        </span>

        <span
          class="vh-ticker-change up"
        >
          ${fmt0.format(adv)}↑
        </span>

        <span
          class="vh-ticker-value"
        >
          ${fmt0.format(flat)}→
        </span>

        <span
          class="vh-ticker-change down"
        >
          ${fmt0.format(dec)}↓
        </span>

      </div>
    `;
  }


  function stateItem(state) {
    return `
      <div
        class="vh-ticker-item"
      >

        <span
          class="vh-ticker-label"
        >
          Trạng thái
        </span>

        <span
          class="vh-ticker-state"
        >
          ${esc(
            state || "—"
          )}
        </span>

      </div>
    `;
  }


  function derivativeItem(ps) {
    const trend =
      derivativeTrend(ps);

    const systemPrice =
      numberValue(
        derivativeSystemPrice(ps)
      );

    const currentPrice =
      numberValue(
        derivativeCurrentPrice(ps)
      );

    const diff =
      derivativeDifference(ps);

    const volume =
      derivativeVolume(ps);

    const trendText =
      String(
        trend || ""
      ).toUpperCase();

    let trendClass =
      "flat";

    if (
      trendText.includes("TĂNG") ||
      trendText.includes("UP") ||
      trendText.includes("LONG")
    ) {
      trendClass =
        "up";
    }

    if (
      trendText.includes("GIẢM") ||
      trendText.includes("DOWN") ||
      trendText.includes("SHORT")
    ) {
      trendClass =
        "down";
    }

    return `
      <div
        class="vh-ticker-item"
      >

        <span
          class="vh-ticker-name"
        >
          Phái sinh
        </span>

        <span
          class="vh-ticker-label"
        >
          Xu hướng
        </span>

        <span
          class="vh-ticker-change ${trendClass}"
        >
          ${esc(trend)}
        </span>

        <span
          class="vh-ticker-separator"
        >
          |
        </span>

        <span
          class="vh-ticker-label"
        >
          Giá HT
        </span>

        <span
          class="vh-ticker-value"
        >
          ${formatNumber(
            systemPrice
          )}
        </span>

        <span
          class="vh-ticker-separator"
        >
          |
        </span>

        <span
          class="vh-ticker-label"
        >
          Hiện tại
        </span>

        <span
          class="vh-ticker-value"
        >
          ${formatNumber(
            currentPrice
          )}
        </span>

        <span
          class="vh-ticker-separator"
        >
          |
        </span>

        <span
          class="vh-ticker-label"
        >
          Lệch
        </span>

        <span
          class="vh-ticker-change ${tone(diff)}"
        >
          ${formatSignedNumber(
            diff
          )}
        </span>

        <span
          class="vh-ticker-separator"
        >
          |
        </span>

        <span
          class="vh-ticker-label"
        >
          KL
        </span>

        <span
          class="vh-ticker-value"
        >
          ${formatVolume(
            volume
          )}
        </span>

      </div>
    `;
  }


  /* =========================
     RENDER
  ========================= */

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
      data?.market_intelligence ||
      {};

    const flow =
      intel?.flow ||
      {};

    const breadth =
      intel?.breadth ||
      {};

    const state =
      intel?.state ||
      {};

    const fresh =
      intel?.freshness ||
      {};

    const html = [

      indexItem(
        "VN-Index",
        vn
      ),

      indexItem(
        "VN30",
        vn30
      ),

      indexItem(
        "HNX-Index",
        hnx
      ),

      indexItem(
        "UPCOM",
        upcom
      ),

      valueItem(
        "GTGD",
        flow?.value_b != null
          ? `${formatNumber(
              flow.value_b,
              0
            )} tỷ`
          : "—"
      ),

      breadthItem(
        breadth
      ),

      stateItem(
        state?.label
      ),

      derivativeItem(
        ps || {}
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
      status.textContent =
        source === "cache"
          ? "Dữ liệu cuối cùng"
          : (
              fresh?.label ||
              "Realtime"
            );
    }


    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          at:Date.now(),
          market:data,
          ps
        })
      );
    } catch (_) {}
  }


  /* =========================
     MARQUEE CHẠY BẰNG JS
  ========================= */

  function animateTicker(
    timestamp
  ) {
    const track =
      document.getElementById(
        "vh-ticker-track"
      );

    const setA =
      document.getElementById(
        "vh-ticker-set-a"
      );

    if (
      !track ||
      !setA
    ) {
      animationFrameId =
        requestAnimationFrame(
          animateTicker
        );

      return;
    }


    if (!lastFrameTime) {
      lastFrameTime =
        timestamp;
    }


    const deltaSeconds =
      Math.min(
        (
          timestamp -
          lastFrameTime
        ) / 1000,
        0.1
      );

    lastFrameTime =
      timestamp;


    const setWidth =
      setA.scrollWidth;


    if (
      !tickerPaused &&
      setWidth > 0
    ) {
      tickerOffset +=
        SPEED_PX_PER_SECOND *
        deltaSeconds;


      if (
        tickerOffset >=
        setWidth
      ) {
        tickerOffset -=
          setWidth;
      }


      track.style.transform =
        `translate3d(
          ${-tickerOffset}px,
          0,
          0
        )`;
    }


    animationFrameId =
      requestAnimationFrame(
        animateTicker
      );
  }


  function startAnimation() {
    if (
      animationFrameId !==
      null
    ) {
      return;
    }

    lastFrameTime = 0;

    animationFrameId =
      requestAnimationFrame(
        animateTicker
      );
  }


  /* =========================
     CACHE
  ========================= */

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

      if (
        !cached?.market
      ) {
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


  /* =========================
     LOAD DATA
  ========================= */

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


      let market =
        null;

      let ps =
        null;


      if (
        marketResp.status ===
          "fulfilled" &&
        marketResp.value.ok
      ) {
        market =
          await marketResp
            .value
            .json();
      }


      if (
        psResp.status ===
          "fulfilled" &&
        psResp.value.ok
      ) {
        ps =
          await psResp
            .value
            .json();
      }


      if (
        !market?.indexes?.length
      ) {
        if (
          !renderCache()
        ) {
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


  /* =========================
     START
  ========================= */

  function start() {
    ensureRoot();

    renderCache();

    startAnimation();

    load();

    setInterval(
      load,
      REFRESH_MS
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
