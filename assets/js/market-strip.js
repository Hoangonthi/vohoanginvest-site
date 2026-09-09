const DEFAULT_MARKET_ENDPOINT = window.VH_MARKET_ENDPOINT || "";

const DEMO_DATA = {
  mode: "demo",
  updated_at: null,
  indexes: [
    { symbol: "VN-INDEX", value: 1830.44, change: 8.80, change_pct: 0.48, volume_m: 559.481, value_b: 22614.9827, adv: 147, flat: 61, dec: 157 },
    { symbol: "VN30", value: 1968.52, change: 5.51, change_pct: 0.28, volume_m: 202.918, value_b: 7845.500, adv: 20, flat: 1, dec: 9 },
    { symbol: "VN100", value: 1873.51, change: 2.53, change_pct: 0.14, volume_m: 451.338, value_b: 12696.981, adv: 42, flat: 11, dec: 46 },
    { symbol: "HNX-INDEX", value: 281.11, change: 0.51, change_pct: 0.18, volume_m: 46.572, value_b: 638.746, adv: 60, flat: 59, dec: 55 }
  ]
};

function fmt(value, digits = 2) {
  return Number(value || 0).toLocaleString("vi-VN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function tone(change) { return change > 0 ? "up" : change < 0 ? "down" : "flat"; }
function arrow(change) { return change > 0 ? "▲" : change < 0 ? "▼" : "■"; }
function modeCopy(mode, updatedAt) {
  if (mode === "realtime") return `Đang cập nhật trực tiếp${updatedAt ? ` · ${updatedAt}` : ""}`;
  if (mode === "eod") return `Dữ liệu cuối phiên${updatedAt ? ` · ${updatedAt}` : ""}`;
  return "Mẫu giao diện · chưa kết nối AmiBroker";
}

function card(index) {
  const cls = tone(Number(index.change));
  return `<article class="market-index-card">
    <div class="market-index-line">
      <span class="market-index-name">${index.symbol}</span>
      <span class="market-index-main ${cls}">${arrow(Number(index.change))} ${fmt(index.value)} <small>${Number(index.change) >= 0 ? "+" : ""}${fmt(index.change)} (${Number(index.change_pct) >= 0 ? "+" : ""}${fmt(index.change_pct)}%)</small></span>
    </div>
    <div class="market-index-sub">KL ${fmt(index.volume_m, 3)} triệu cp · GT ${fmt(index.value_b, 1)} tỷ</div>
    <div class="market-index-breadth"><span class="adv">▲ ${index.adv ?? "—"}</span> <em>·</em> <span class="flat">■ ${index.flat ?? "—"}</span> <em>·</em> <span class="dec">▼ ${index.dec ?? "—"}</span></div>
  </article>`;
}

async function loadMarketData() {
  if (!DEFAULT_MARKET_ENDPOINT) return DEMO_DATA;
  try {
    const response = await fetch(`${DEFAULT_MARKET_ENDPOINT.replace(/\/$/, "")}/market/overview`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload?.indexes?.length) throw new Error("Thiếu dữ liệu chỉ số");
    return payload;
  } catch (error) {
    console.warn("AmiBridge chưa sẵn sàng, dùng mẫu giao diện", error);
    return DEMO_DATA;
  }
}

export async function initMarketStrip() {
  const main = document.querySelector("main#top");
  const hero = main?.querySelector(".hero");
  if (!main || !hero || document.querySelector("[data-market-overview]")) return;

  const section = document.createElement("section");
  section.className = "market-overview";
  section.dataset.marketOverview = "";
  section.dataset.mode = "demo";
  section.innerHTML = `<div class="market-overview-inner">
    <div class="market-overview-head">
      <div class="market-overview-title"><i aria-hidden="true"></i><span>Thị trường Việt Nam</span><button class="market-overview-toggle" type="button" data-market-toggle>Xem đủ</button></div>
      <div class="market-overview-status" data-market-status>Đang tải dữ liệu…</div>
    </div>
    <div class="market-index-grid" data-market-grid></div>
  </div>`;
  main.insertBefore(section, hero);

  const data = await loadMarketData();
  section.dataset.mode = data.mode || "demo";
  section.querySelector("[data-market-grid]").innerHTML = data.indexes.slice(0, 4).map(card).join("");
  const status = section.querySelector("[data-market-status]");
  status.innerHTML = `<strong>${modeCopy(data.mode, data.updated_at || "")}</strong>${data.mode === "demo" ? ' <span class="market-demo-note">· dữ liệu minh họa</span>' : ""}`;

  const toggle = section.querySelector("[data-market-toggle]");
  toggle?.addEventListener("click", () => {
    const expanded = section.classList.toggle("is-expanded");
    toggle.textContent = expanded ? "Thu gọn" : "Xem đủ";
  });
}
