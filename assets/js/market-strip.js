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
function modeCopy(mode, updatedAt) {
  if (mode === "direct-file" || mode === "realtime") return `Đang cập nhật mỗi 1 phút${updatedAt ? ` · ${updatedAt}` : ""}`;
  if (mode === "eod") return `Dữ liệu cuối phiên${updatedAt ? ` · ${updatedAt}` : ""}`;
  return "Mẫu giao diện · chưa kết nối nguồn dữ liệu";
}
function card(index) {
  const cls = tone(Number(index.change));
  const valueText = fmt(index.value);
  const changeText = fmt(index.change);
  const pctText = fmt(index.change_pct);
  const volumeText = fmt(index.volume_m, 3);
  const valueBText = fmt(index.value_b, 1);
  return `<article class="market-index-card"><div class="market-index-line"><span class="market-index-name">${index.symbol}</span><span class="market-index-main ${cls}">${arrow(Number(index.change))} ${valueText} <small>${Number(index.change) >= 0 ? "+" : ""}${changeText} (${Number(index.change_pct) >= 0 ? "+" : ""}${pctText}%)</small></span></div><div class="market-index-sub">KL ${volumeText} triệu cp · GT ${valueBText} tỷ</div><div class="market-index-breadth"><span class="adv">▲ ${index.adv ?? "—"}</span> <em>·</em> <span class="flat">■ ${index.flat ?? "—"}</span> <em>·</em> <span class="dec">▼ ${index.dec ?? "—"}</span></div></article>`;
}

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

function isTradingWindow() {
  const { weekday, hour, minute } = getVietnamClock();
  if (["Sat", "Sun"].includes(weekday)) return false;
  const mins = hour * 60 + minute;
  return mins >= (8 * 60 + 45) && mins <= (15 * 60);
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
      const card = viewport.querySelector(".market-index-card");
      const step = card ? card.getBoundingClientRect().width + 1 : viewport.clientWidth * 0.8;
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
  section.innerHTML = `<div class="market-overview-inner"><div class="market-overview-head"><div class="market-overview-title"><i aria-hidden="true"></i><span>Thị trường Việt Nam</span></div><div class="market-overview-actions"><div class="market-overview-nav" data-market-nav><button type="button" aria-label="Chỉ số trước" data-market-dir="-1">←</button><button type="button" aria-label="Chỉ số tiếp theo" data-market-dir="1">→</button></div><div class="market-overview-status" data-market-status>Đang tải dữ liệu…</div></div></div><div class="market-index-viewport" data-market-viewport><div class="market-index-track" data-market-track></div></div></div>`;
  main.insertBefore(section, hero);
  setupCarousel(section);
  await refreshMarket(section);
  scheduleRefresh(section);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshMarket(section).then(() => scheduleRefresh(section));
    }
  });
}
