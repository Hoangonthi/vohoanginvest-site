const ENDPOINT = window.VH_MARKET_ENDPOINT || "https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-feed";

let initialized = false;

function ensureStyles() {
  if (document.querySelector('link[data-market-intelligence-css]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./assets/css/market-intelligence.css";
  link.dataset.marketIntelligenceCss = "";
  document.head.appendChild(link);
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function fmt(value, digits = 1) {
  const n = num(value);
  if (n === null) return "—";
  return n.toLocaleString("vi-VN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtPct(value) {
  const n = num(value);
  if (n === null) return "—";
  return `${n > 0 ? "+" : ""}${n.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%`;
}

function tone(value) {
  const t = String(value || "neutral");
  if (["positive", "warning", "danger", "neutral"].includes(t)) return t;
  return "neutral";
}

function safeHref(value) {
  const href = String(value || "");
  return /^[a-z0-9-]+\.html(?:[?#].*)?$/i.test(href) ? href : "#";
}

function ensurePanel() {
  const market = document.querySelector("[data-market-overview]");
  const inner = market?.querySelector(".market-overview-inner");
  if (!inner) return null;
  let panel = inner.querySelector("[data-market-intelligence]");
  if (panel) return panel;
  panel = document.createElement("section");
  panel.className = "market-intelligence";
  panel.dataset.marketIntelligence = "";
  panel.setAttribute("aria-label", "Bộ đọc trạng thái thị trường");
  inner.appendChild(panel);
  return panel;
}

function metricCard(label, value, sub, metricTone = "neutral") {
  return `<div class="mi-metric is-${tone(metricTone)}">
    <span class="mi-metric-label">${esc(label)}</span>
    <strong>${esc(value)}</strong>
    <small>${esc(sub)}</small>
  </div>`;
}

function sectorItem(item, rank) {
  if (!item) return "";
  const pct = num(item.change_pct);
  const cls = pct === null ? "flat" : pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  const momentum = item.delta_15m === null || item.delta_15m === undefined
    ? ""
    : `<small>${esc(item.momentum || "")}${num(item.delta_15m) === null ? "" : ` · ${fmtPct(item.delta_15m)}`}</small>`;
  return `<li>
    <span class="mi-sector-rank">${rank}</span>
    <span class="mi-sector-name"><b>${esc(item.name)}</b>${momentum}</span>
    <strong class="${cls}">${fmtPct(item.change_pct)}</strong>
  </li>`;
}

function alertItem(item) {
  return `<li class="mi-alert is-${tone(item?.level)}">
    <b>${esc(item?.title || "Lưu ý")}</b>
    <span>${esc(item?.detail || "")}</span>
  </li>`;
}

function renderIntelligence(data) {
  const panel = ensurePanel();
  if (!panel) return;

  const mi = data?.market_intelligence;
  if (!mi?.state) {
    panel.innerHTML = `<div class="mi-loading">
      <span class="mi-kicker">BỘ ĐỌC THỊ TRƯỜNG</span>
      <strong>Đang tạo trạng thái từ dữ liệu realtime…</strong>
    </div>`;
    return;
  }

  const state = mi.state || {};
  const breadth = mi.breadth || {};
  const flow = mi.flow || {};
  const leader = mi.leadership?.leader || null;
  const fresh = mi.freshness || {};
  const alerts = Array.isArray(mi.alerts) ? mi.alerts : [];
  const leaders = Array.isArray(mi.leadership?.leaders) ? mi.leadership.leaders : [];
  const laggards = Array.isArray(mi.leadership?.laggards) ? mi.leadership.laggards : [];
  const links = Array.isArray(mi.action?.links) ? mi.action.links : [];
  const score = Math.max(0, Math.min(100, Number(state.score) || 0));
  const breadthNet = breadth.balance === null || breadth.balance === undefined
    ? "Chưa đủ dữ liệu"
    : `${breadth.adv ?? "—"} tăng · ${breadth.flat ?? "—"} TC · ${breadth.dec ?? "—"} giảm`;
  const flowSub = flow.same_time_ratio !== null && flow.same_time_ratio !== undefined && (flow.baseline_days || 0) >= 5
    ? `${Math.round(Number(flow.same_time_ratio) * 100)}% TB cùng thời điểm · ${flow.baseline_days} phiên`
    : flow.pace_ratio_15m !== null && flow.pace_ratio_15m !== undefined
      ? `Nhịp 15 phút: ${Math.round(Number(flow.pace_ratio_15m) * 100)}% nhịp trước`
      : `Đang tích lũy chuẩn ${flow.baseline_days || 0}/${flow.baseline_target_days || 20} phiên`;
  const leaderValue = leader ? `${leader.name} ${fmtPct(leader.change_pct)}` : "Chưa xác định";
  const leaderSub = leader?.delta_15m === null || leader?.delta_15m === undefined
    ? (leader?.momentum || "Đang theo dõi")
    : `${leader.momentum || "ổn định"} · 15 phút ${fmtPct(leader.delta_15m)}`;

  panel.dataset.tone = tone(state.tone);
  panel.innerHTML = `
    <div class="mi-summary">
      <div class="mi-state-block">
        <div class="mi-state-topline">
          <span class="mi-kicker">BỘ ĐỌC THỊ TRƯỜNG</span>
          <span class="mi-fresh is-${tone(fresh.tone)}"><i></i>${esc(fresh.label || "")}</span>
        </div>
        <div class="mi-state-row">
          <strong class="mi-state-label">${esc(state.label || "—")}</strong>
          <span class="mi-score-number">${score}<small>/100</small></span>
        </div>
        <div class="mi-score-track" aria-label="Điểm trạng thái thị trường ${score} trên 100">
          <i style="width:${score}%"></i>
        </div>
        <small class="mi-state-trend">${esc(state.trend || "ổn định")}${state.score_delta_15m === null || state.score_delta_15m === undefined ? "" : ` · 15 phút ${state.score_delta_15m > 0 ? "+" : ""}${esc(state.score_delta_15m)} điểm`}</small>
      </div>

      <div class="mi-metrics">
        ${metricCard("Độ rộng", breadth.label || "—", breadthNet, breadth.tone)}
        ${metricCard("Dòng tiền", flow.value_b === null || flow.value_b === undefined ? "—" : `${fmt(flow.value_b, 1)} tỷ`, flow.label ? `${flow.label} · ${flowSub}` : flowSub, flow.tone)}
        ${metricCard("Nhóm dẫn dắt", leaderValue, leaderSub, leader && num(leader.change_pct) > 0 ? "positive" : leader && num(leader.change_pct) < 0 ? "warning" : "neutral")}
      </div>
    </div>

    <div class="mi-action-row">
      <div class="mi-action-copy">
        <span>HÀNH ĐỘNG</span>
        <div>
          <strong>${esc(mi.action?.headline || "Theo dõi thêm dữ liệu.")}</strong>
          <p>${esc(mi.action?.detail || "")}</p>
        </div>
      </div>
      <div class="mi-action-links">
        ${links.slice(0, 2).map(link => `<a href="${safeHref(link?.href)}">${esc(link?.label || "Mở công cụ")}</a>`).join("")}
        <a class="is-detail" href="thi-truong-hom-nay.html">Mở bộ đọc đầy đủ</a>
      </div>
    </div>

    <details class="mi-details">
      <summary>Chi tiết dòng tiền, nhóm ngành & cảnh báo <span>+</span></summary>
      <div class="mi-details-grid">
        <div class="mi-detail-card">
          <div class="mi-detail-head"><b>Nhóm mạnh</b><small>Thay đổi trong phiên</small></div>
          <ol class="mi-sector-list">${leaders.map((item, i) => sectorItem(item, i + 1)).join("") || "<li>Chưa có dữ liệu ngành.</li>"}</ol>
        </div>
        <div class="mi-detail-card">
          <div class="mi-detail-head"><b>Nhóm yếu</b><small>Ưu tiên tránh nhầm sức mạnh</small></div>
          <ol class="mi-sector-list">${laggards.map((item, i) => sectorItem(item, i + 1)).join("") || "<li>Chưa có dữ liệu ngành.</li>"}</ol>
        </div>
        <div class="mi-detail-card">
          <div class="mi-detail-head"><b>Cảnh báo hệ thống</b><small>Chỉ hiển thị khi có điều đáng chú ý</small></div>
          <ul class="mi-alert-list">${alerts.length ? alerts.map(alertItem).join("") : '<li class="mi-alert is-neutral"><b>Chưa có cảnh báo lớn</b><span>Tiếp tục theo dõi sự thay đổi của độ rộng, dòng tiền và nhóm dẫn dắt.</span></li>'}</ul>
        </div>
      </div>
      <div class="mi-history-note">
        <span>Chuẩn thanh khoản cùng thời điểm:</span>
        <strong>${esc(mi.history?.baseline_days ?? 0)}/${esc(mi.history?.baseline_target_days ?? 20)} phiên</strong>
        <small>${mi.history?.same_time_baseline_ready ? "Đã đủ dữ liệu tối thiểu để so sánh." : "Hệ thống đang tự tích lũy. Khi đủ tối thiểu 5 phiên sẽ bắt đầu so sánh tự động."}</small>
      </div>
    </details>
  `;
}

async function refreshFromEndpoint() {
  if (!document.querySelector("[data-market-overview]")) return;
  try {
    const response = await fetch(ENDPOINT, { cache: "no-store" });
    if (!response.ok) return;
    renderIntelligence(await response.json());
  } catch {}
}

export function initMarketIntelligence() {
  if (initialized) return;
  initialized = true;
  ensureStyles();

  document.addEventListener("vh:market-data", (event) => {
    renderIntelligence(event.detail || {});
  });

  setTimeout(refreshFromEndpoint, 700);
  setInterval(() => {
    if (!document.hidden) refreshFromEndpoint();
  }, 60_000);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshFromEndpoint();
  });
}
