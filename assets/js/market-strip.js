const DEFAULT_MARKET_ENDPOINT = window.VH_MARKET_ENDPOINT || "https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-feed";
const REFRESH_MS = 60_000;
const CACHE_KEY = "vh-market-strip-last-good-v2";
const INDEX_PRIORITY = ["VN-INDEX", "VN30", "UPCOM-INDEX", "HNX-INDEX", "VN100", "VNXALL"];

const DEMO_DATA = {
  mode: "demo",
  updated_at: null,
  indexes: [
    { symbol: "VN-INDEX", value: 1842.86, change: 12.42, change_pct: 0.68, volume_m: 143.677, value_b: 6548.2, adv: 147, flat: 61, dec: 157 },
    { symbol: "VN30", value: 1981.47, change: 12.95, change_pct: 0.66, volume_m: 65.872, value_b: 3248.6, adv: 20, flat: 1, dec: 9 },
    { symbol: "VN100", value: 1882.96, change: 9.45, change_pct: 0.50, volume_m: 131.063, value_b: 5112.4, adv: 46, flat: 8, dec: 46 },
    { symbol: "VNXALL", value: 2912.92, change: 13.51, change_pct: 0.47, volume_m: 158.125, value_b: 6210.7, adv: 123, flat: 49, dec: 131 },
    { symbol: "HNX-INDEX", value: 281.11, change: 0.51, change_pct: 0.18, volume_m: 46.572, value_b: 638.7, adv: 60, flat: 59, dec: 55 },
    { symbol: "UPCOM-INDEX", value: 127.50, change: 0.10, change_pct: 0.08, volume_m: 21.000, value_b: null, adv: null, flat: null, dec: null }
  ]
};

let refreshTimer = null;

function ensureStyles() {
  if (document.querySelector('link[data-market-strip-css]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./assets/css/market-strip.css";
  link.dataset.marketStripCss = "";
  document.head.appendChild(link);
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstPositiveMetric(...values) {
  for (const value of values) {
    const number = finiteNumber(value);
    if (number !== null && number > 0) return number;
  }
  return null;
}

function fmt(value, digits = 2) {
  const number = finiteNumber(value);
  if (number === null) return "—";
  return number.toLocaleString("vi-VN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function fmtTrim(value, maxDigits = 3) {
  const number = finiteNumber(value);
  if (number === null) return "—";
  return number.toLocaleString("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDigits
  });
}

function tone(change) {
  const value = finiteNumber(change) || 0;
  return value > 0 ? "up" : value < 0 ? "down" : "flat";
}

function arrow(change) {
  const value = finiteNumber(change) || 0;
  return value > 0 ? "▲" : value < 0 ? "▼" : "■";
}

function signed(value, digits = 2) {
  const number = finiteNumber(value);
  if (number === null) return "—";
  return `${number > 0 ? "+" : ""}${fmt(number, digits)}`;
}

function getVietnamClock() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const get = type => parts.find(part => part.type === type)?.value || "";
  return { weekday: get("weekday"), hour: Number(get("hour")), minute: Number(get("minute")) };
}

function marketSession() {
  const { weekday, hour, minute } = getVietnamClock();
  if (["Sat", "Sun"].includes(weekday)) return "closed";
  const mins = hour * 60 + minute;
  if (mins >= (8 * 60 + 45) && mins < (11 * 60 + 30)) return "morning";
  if (mins >= (11 * 60 + 30) && mins < (13 * 60)) return "lunch";
  if (mins >= (13 * 60) && mins <= (15 * 60)) return "afternoon";
  return "closed";
}

function isTradingWindow() {
  return ["morning", "afternoon"].includes(marketSession());
}

function sessionCopy() {
  const session = marketSession();
  if (session === "morning") return "Phiên sáng";
  if (session === "afternoon") return "Phiên chiều";
  if (session === "lunch") return "Nghỉ trưa";
  return "Ngoài giờ giao dịch";
}

function formatUpdatedAt(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const date = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(date).replace(",", " ·");
  }
  return raw;
}

function modeCopy(mode, updatedAt) {
  const updated = formatUpdatedAt(updatedAt);
  const suffix = updated ? ` · ${updated}` : "";
  if (mode === "direct-file" || mode === "realtime") return `${sessionCopy()}${suffix}`;
  if (mode === "eod") return `Dữ liệu cuối phiên${suffix}`;
  if (mode === "cached") return `Dữ liệu gần nhất${suffix}`;
  if (mode === "error") return "Chưa cập nhật được dữ liệu";
  return `Dữ liệu minh họa${suffix}`;
}

function breadthMeta(index) {
  const adv = finiteNumber(index.adv);
  const flat = finiteNumber(index.flat);
  const dec = finiteNumber(index.dec);
  if ([adv, flat, dec].some(value => value === null)) return null;
  return { adv: Math.round(adv), flat: Math.round(flat), dec: Math.round(dec) };
}

function statsHtml(index) {
  const volume = firstPositiveMetric(
    index.volume_m,
    index.api_matched_volume_m,
    index.api_total_volume_m
  );
  const tradeValue = firstPositiveMetric(
    index.value_b,
    index.total_match_value_b,
    index.total_value_b,
    index.total_trade_value_b
  );

  const volumeText = volume === null ? "—" : `${fmtTrim(volume, 3)} triệu cp`;
  const valueText = tradeValue === null ? "—" : `${fmtTrim(tradeValue, 1)} tỷ`;

  return `<div class="market-index-stats${volume === null && tradeValue === null ? " is-empty" : ""}">
    <span><b>KL</b> ${volumeText}</span>
    <span class="market-stat-sep" aria-hidden="true">·</span>
    <span><b>GT</b> ${valueText}</span>
  </div>`;
}

function breadthHtml(index) {
  const breadth = breadthMeta(index);
  if (!breadth) {
    return `<div class="market-index-breadth is-empty" aria-label="Chưa có dữ liệu độ rộng thị trường"><span class="adv">▲ —</span><span class="flat">■ —</span><span class="dec">▼ —</span></div>`;
  }
  const ceiling = finiteNumber(index.ceiling);
  const floor = finiteNumber(index.floor);
  const ceilingText = ceiling !== null && ceiling > 0 ? ` <small>(${Math.round(ceiling)})</small>` : "";
  const floorText = floor !== null && floor > 0 ? ` <small>(${Math.round(floor)})</small>` : "";
  return `<div class="market-index-breadth" aria-label="Độ rộng thị trường: tăng ${breadth.adv}, tham chiếu ${breadth.flat}, giảm ${breadth.dec}">
    <span class="adv">▲ <b>${breadth.adv}</b>${ceilingText} <em>tăng</em></span>
    <span class="flat">■ <b>${breadth.flat}</b> <em>TC</em></span>
    <span class="dec">▼ <b>${breadth.dec}</b>${floorText} <em>giảm</em></span>
  </div>`;
}

function card(index) {
  const change = finiteNumber(index.change) || 0;
  const changePct = finiteNumber(index.change_pct);
  const cls = tone(change);
  const symbol = String(index.symbol || "Chỉ số");
  return `<article class="market-index-card" data-market-symbol="${symbol}">
    <div class="market-index-headline">
      <span class="market-index-name">${symbol}</span>
      <span class="market-index-quote ${cls}">
        <span class="market-index-main">${arrow(change)} ${fmt(index.value)}</span>
        <span class="market-index-change">${signed(change)}${changePct === null ? "" : ` (${signed(changePct)}%)`}</span>
      </span>
    </div>
    ${statsHtml(index)}
    ${breadthHtml(index)}
  </article>`;
}

function sortIndexes(indexes) {
  return [...indexes].sort((a, b) => {
    const ai = INDEX_PRIORITY.indexOf(String(a?.symbol || ""));
    const bi = INDEX_PRIORITY.indexOf(String(b?.symbol || ""));
    const ar = ai === -1 ? INDEX_PRIORITY.length : ai;
    const br = bi === -1 ? INDEX_PRIORITY.length : bi;
    return ar - br;
  });
}

function readCachedData() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached?.indexes?.length) return null;
    return cached;
  } catch {
    return null;
  }
}

function writeCachedData(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {}
}

async function loadMarketData() {
  if (!DEFAULT_MARKET_ENDPOINT) return DEMO_DATA;
  try {
    const response = await fetch(DEFAULT_MARKET_ENDPOINT, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload?.indexes?.length) throw new Error("Thiếu dữ liệu chỉ số");
    writeCachedData(payload);
    return payload;
  } catch (error) {
    console.warn("Nguồn dữ liệu thị trường chưa sẵn sàng", error);
    const cached = readCachedData();
    if (cached) return { ...cached, mode: "cached" };
    return { mode: "error", updated_at: null, indexes: [], error: String(error?.message || error) };
  }
}

function updateCarouselControls(section) {
  const viewport = section.querySelector("[data-market-viewport]");
  const prev = section.querySelector('[data-market-dir="-1"]');
  const next = section.querySelector('[data-market-dir="1"]');
  if (!viewport || !prev || !next) return;
  const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  const hasOverflow = maxScroll > 4;
  prev.hidden = !hasOverflow;
  next.hidden = !hasOverflow;
  if (!hasOverflow) return;
  prev.disabled = viewport.scrollLeft <= 4;
  next.disabled = viewport.scrollLeft >= maxScroll - 4;
}

function renderMarket(section, data) {
  section.dataset.mode = data.mode || "demo";
  const indexes = sortIndexes(Array.isArray(data.indexes) ? data.indexes : []);
  const track = section.querySelector("[data-market-track]");
  if (track) {
    track.innerHTML = indexes.length
      ? indexes.map(card).join("")
      : '<div class="market-strip-empty">Chưa cập nhật được dữ liệu thị trường.</div>';
  }
  const status = section.querySelector("[data-market-status]");
  if (status) status.textContent = modeCopy(data.mode, data.updated_at || "");
  document.dispatchEvent(new CustomEvent("vh:market-data", { detail: data }));
  requestAnimationFrame(() => updateCarouselControls(section));
}

async function refreshMarket(section) {
  const data = await loadMarketData();
  renderMarket(section, data);
}

function scheduleRefresh(section) {
  if (refreshTimer) clearTimeout(refreshTimer);
  if (!DEFAULT_MARKET_ENDPOINT || !isTradingWindow()) return;
  refreshTimer = setTimeout(async () => {
    await refreshMarket(section);
    scheduleRefresh(section);
  }, REFRESH_MS);
}

function setupCarousel(section) {
  const viewport = section.querySelector("[data-market-viewport]");
  if (!viewport) return;

  const stepSize = () => {
    const cardEl = viewport.querySelector(".market-index-card");
    if (!cardEl) return viewport.clientWidth * 0.86;
    const styles = getComputedStyle(viewport.querySelector("[data-market-track]") || viewport);
    const gap = parseFloat(styles.columnGap || styles.gap || "1") || 1;
    return cardEl.getBoundingClientRect().width + gap;
  };

  section.querySelectorAll("[data-market-dir]").forEach(button => {
    button.addEventListener("click", () => {
      const direction = Number(button.dataset.marketDir || 1);
      viewport.scrollBy({ left: direction * stepSize(), behavior: "smooth" });
    });
  });

  let scrollFrame = null;
  viewport.addEventListener("scroll", () => {
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => updateCarouselControls(section));
  }, { passive: true });

  window.addEventListener("resize", () => updateCarouselControls(section), { passive: true });
}

export async function initMarketStrip() {
  ensureStyles();
  const main = document.querySelector("main#top");
  const hero = main?.querySelector(".hero");
  if (!main || !hero || document.querySelector("[data-market-overview]")) return;

  const section = document.createElement("section");
  section.className = "market-overview";
  section.dataset.marketOverview = "";
  section.dataset.mode = "demo";
  section.innerHTML = `<div class="market-overview-inner">
    <div class="market-overview-head">
      <div class="market-overview-title"><i aria-hidden="true"></i><span>Thị trường Việt Nam</span></div>
      <div class="market-overview-status" data-market-status aria-live="polite">Đang tải dữ liệu…</div>
    </div>
    <div class="market-index-shell">
      <button class="market-edge-nav is-prev" type="button" aria-label="Chỉ số trước" data-market-dir="-1" hidden>‹</button>
      <div class="market-index-viewport" data-market-viewport>
        <div class="market-index-track" data-market-track></div>
      </div>
      <button class="market-edge-nav is-next" type="button" aria-label="Chỉ số tiếp theo" data-market-dir="1" hidden>›</button>
    </div>
  </div>`;

  main.insertBefore(section, hero);
  setupCarousel(section);
  await refreshMarket(section);
  scheduleRefresh(section);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshMarket(section).then(() => scheduleRefresh(section));
  });
}
