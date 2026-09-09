const DEFAULT_MARKET_ENDPOINT = window.VH_MARKET_ENDPOINT || "https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-feed";
const REFRESH_MS = 60_000;

const DEMO_DATA = {
  mode: "demo",
  updated_at: null,
  indexes: [
    { symbol: "VN-INDEX", value: 1830.44, change: 8.80, change_pct: 0.48, volume_m: 559.481, value_b: 22614.9827, adv: 147, flat: 61, dec: 157 },
    { symbol: "VN30", value: 1968.52, change: 5.51, change_pct: 0.28, volume_m: 202.918, value_b: 7845.500, adv: 20, flat: 1, dec: 9 },
    { symbol: "VN100", value: 1873.51, change: 2.53, change_pct: 0.14, volume_m: 451.338, value_b: 12696.981, adv: 42, flat: 11, dec: 46 },
    { symbol: "HNX-INDEX", value: 281.11, change: 0.51, change_pct: 0.18, volume_m: 46.572, value_b: 638.746, adv: 60, flat: 59, dec: 55 },
    { symbol: "UPCOM-INDEX", value: 127.50, change: 0.10, change_pct: 0.08, volume_m: 21.000, value_b: null, adv: null, flat: null, dec: null }
  ]
};

let refreshTimer = null;

function ensureStyles(){
  if(document.querySelector('link[data-market-strip-css]')) return;
  const link=document.createElement('link');
  link.rel='stylesheet';link.href='./assets/css/market-strip.css';link.dataset.marketStripCss='';
  document.head.appendChild(link);
}
function fmt(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("vi-VN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function tone(change) { return change > 0 ? "up" : change < 0 ? "down" : "flat"; }
function arrow(change) { return change > 0 ? "▲" : change < 0 ? "▼" : "■"; }
function getVietnamClock() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const get = type => parts.find(p => p.type === type)?.value || "";
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
function isTradingWindow() { return ["morning", "afternoon"].includes(marketSession()); }
function sessionCopy() {
  const s = marketSession();
  if (s === "morning") return "Phiên sáng";
  if (s === "afternoon") return "Phiên chiều";
  if (s === "lunch") return "Nghỉ trưa · tự cập nhật lại lúc 13:00";
  return "Ngoài giờ giao dịch";
}
function modeCopy(mode, updatedAt) {
  const suffix = updatedAt ? ` · ${updatedAt}` : "";
  if (mode === "direct-file" || mode === "realtime") return `${sessionCopy()}${isTradingWindow() ? " · cập nhật mỗi 1 phút" : ""}${suffix}`;
  if (mode === "eod") return `Dữ liệu cuối phiên${suffix}`;
  return "Mẫu giao diện · chưa kết nối nguồn dữ liệu";
}
function breadthMeta(index) {
  const adv = Number(index.adv), flat = Number(index.flat), dec = Number(index.dec);
  if (![adv, flat, dec].every(Number.isFinite)) return null;
  const total = adv + flat + dec;
  if (!total) return null;
  return {
    adv, flat, dec, total,
    advPct: Math.max(0, adv / total * 100),
    flatPct: Math.max(0, flat / total * 100),
    decPct: Math.max(0, dec / total * 100),
    spread: adv - dec
  };
}
function card(index) {
  const cls = tone(Number(index.change));
  const valueText = fmt(index.value);
  const changeText = fmt(index.change);
  const pctText = fmt(index.change_pct);
  const volumeText = fmt(index.volume_m, 3);
  const valueBText = fmt(index.value_b, 1);
  const b = breadthMeta(index);
  const breadthHtml = b ? `
    <div class="market-index-breadth-labels">
      <span class="adv"><b>Tăng</b> ${b.adv}</span>
      <span class="flat"><b>TC</b> ${b.flat}</span>
      <span class="dec"><b>Giảm</b> ${b.dec}</span>
    </div>
    <div class="market-breadth-bar" aria-label="Độ rộng thị trường: tăng ${b.adv}, tham chiếu ${b.flat}, giảm ${b.dec}">
      <i class="adv" style="width:${b.advPct}%"></i><i class="flat" style="width:${b.flatPct}%"></i><i class="dec" style="width:${b.decPct}%"></i>
    </div>
    <div class="market-index-spread ${tone(b.spread)}">Độ rộng ${b.spread >= 0 ? "+" : ""}${b.spread}</div>` : `<div class="market-index-breadth-empty">Độ rộng: —</div>`;
  const ceilingFloor = (index.ceiling !== null && index.ceiling !== undefined) || (index.floor !== null && index.floor !== undefined)
    ? `<div class="market-index-extra"><span>Trần ${index.ceiling ?? "—"}</span><span>Sàn ${index.floor ?? "—"}</span></div>` : "";
  return `<article class="market-index-card">
    <div class="market-index-line"><span class="market-index-name">${index.symbol}</span><span class="market-index-main ${cls}">${arrow(Number(index.change))} ${valueText}</span></div>
    <div class="market-index-change ${cls}">${Number(index.change) >= 0 ? "+" : ""}${changeText} điểm · ${Number(index.change_pct) >= 0 ? "+" : ""}${pctText}%</div>
    <div class="market-index-stats"><span><b>KL</b> ${volumeText} triệu cp</span><span><b>GT</b> ${valueBText} tỷ</span></div>
    ${breadthHtml}${ceilingFloor}
  </article>`;
}

async function loadMarketData() {
  if (!DEFAULT_MARKET_ENDPOINT) return DEMO_DATA;
  try {
    const response = await fetch(DEFAULT_MARKET_ENDPOINT, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload?.indexes?.length) throw new Error("Thiếu dữ liệu chỉ số");
    return payload;
  } catch (error) {
    console.warn("Nguồn dữ liệu thị trường chưa sẵn sàng, dùng mẫu giao diện", error);
    return DEMO_DATA;
  }
}

function renderMarket(section, data) {
  section.dataset.mode = data.mode || "demo";
  const track = section.querySelector("[data-market-track]");
  if (track) track.innerHTML = data.indexes.map(card).join("");
  const status = section.querySelector("[data-market-status]");
  if (status) status.innerHTML = `<strong>${modeCopy(data.mode, data.updated_at || "")}</strong>${data.mode === "demo" ? ' <span class="market-demo-note">· dữ liệu minh họa</span>' : ""}`;
  const nav = section.querySelector("[data-market-nav]");
  if (nav) nav.hidden = data.indexes.length <= 4;
  const provider = section.querySelector("[data-market-provider]");
  if (provider) {
    const p = data.market_metrics_provider || "Ami/DataTick";
    provider.textContent = `Nguồn: ${p}`;
  }
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
  section.querySelectorAll("[data-market-dir]").forEach(btn => {
    btn.addEventListener("click", () => {
      const direction = Number(btn.dataset.marketDir || 1);
      const cardEl = viewport.querySelector(".market-index-card");
      const step = cardEl ? cardEl.getBoundingClientRect().width + 1 : viewport.clientWidth * 0.8;
      viewport.scrollBy({ left: direction * step, behavior: "smooth" });
    });
  });
}

export async function initMarketStrip() {
  ensureStyles();
  const main = document.querySelector("main#top");
  const hero = main?.querySelector(".hero");
  if (!main || !hero || document.querySelector("[data-market-overview]")) return;
  const section = document.createElement("section");
  section.className = "market-overview";section.dataset.marketOverview = "";section.dataset.mode = "demo";
  section.innerHTML = `<div class="market-overview-inner"><div class="market-overview-head"><div class="market-overview-title"><i aria-hidden="true"></i><span>Thị trường Việt Nam</span><small data-market-provider>Nguồn: Ami/DataTick</small></div><div class="market-overview-actions"><div class="market-overview-nav" data-market-nav><button type="button" aria-label="Chỉ số trước" data-market-dir="-1">←</button><button type="button" aria-label="Chỉ số tiếp theo" data-market-dir="1">→</button></div><div class="market-overview-status" data-market-status>Đang tải dữ liệu…</div></div></div><div class="market-index-viewport" data-market-viewport><div class="market-index-track" data-market-track></div></div></div>`;
  main.insertBefore(section, hero);
  setupCarousel(section);
  await refreshMarket(section);
  scheduleRefresh(section);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshMarket(section).then(() => scheduleRefresh(section));
  });
}
