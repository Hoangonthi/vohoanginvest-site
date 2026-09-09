import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Keep bridge authentication in Supabase secrets; never commit the key.
const BRIDGE_KEY = Deno.env.get("VH_BRIDGE_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGINS = new Set([
  "https://hoangonthi.github.io",
  "https://vohoanginvest.com",
  "https://www.vohoanginvest.com"
]);

const INDEX_CODE_MAP: Record<string, string> = {
  "VN-INDEX": "VNINDEX",
  "VN30": "VN30",
  "VN100": "VN100",
  "VNALL": "VNALL",
  "VNXALL": "VNXALL",
  "VNMidcap": "VNMID",
  "VNSmallcap": "VNSML",
  "VNDIAMOND": "VNDIAMOND",
  "VNFIN LEAD": "VNFINLEAD",
  "VNFIN SELECT": "VNFINSELECT",
  "VNFIN": "VNFIN",
  "VNREAL": "VNREAL",
  "VNIND": "VNIND",
  "VNIT": "VNIT",
  "VNMAT": "VNMAT",
  "VNCONS": "VNCONS",
  "VNCOND": "VNCOND",
  "VNENE": "VNENE",
  "VNHEAL": "VNHEAL",
  "VNUTI": "VNUTI",
  "VNSI": "VNSI",
  "HNX-INDEX": "HNXIndex",
  "HNX30": "HNX30",
  "UPCOM-INDEX": "UpcomIndex"
};

const SECTOR_MAP: Record<string, string> = {
  "VNFIN": "Tài chính",
  "VNREAL": "Bất động sản",
  "VNIND": "Công nghiệp",
  "VNIT": "Công nghệ thông tin",
  "VNMAT": "Nguyên vật liệu",
  "VNCONS": "Hàng tiêu dùng thiết yếu",
  "VNCOND": "Hàng tiêu dùng không thiết yếu",
  "VNENE": "Năng lượng",
  "VNHEAL": "Y tế",
  "VNUTI": "Tiện ích"
};

let fiinCache: { at: number; items: any[] } | null = null;

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://hoangonthi.github.io";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,x-bridge-key",
    "Vary": "Origin",
    "Cache-Control": "no-store"
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" }
  });
}

function serviceHeaders(extra: Record<string, string> = {}) {
  return {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    ...extra
  };
}

function toIsoVietnam(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const s = value.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return s.replace(" ", "T") + "+07:00";
  return null;
}

function numberAny(obj: any, names: string[]): number | null {
  for (const name of names) {
    const raw = obj?.[name];
    if (raw === null || raw === undefined || raw === "") continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function stringAny(obj: any, names: string[]): string | null {
  for (const name of names) {
    const raw = obj?.[name];
    if (raw === null || raw === undefined || raw === "") continue;
    return String(raw);
  }
  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 2) {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function getIndex(payload: any, symbol: string) {
  return Array.isArray(payload?.indexes)
    ? payload.indexes.find((x: any) => String(x?.symbol || "") === symbol) || null
    : null;
}

function metric(payload: any, symbol: string, key: string) {
  const row = getIndex(payload, symbol);
  return numberAny(row, [key]);
}

function breadthBalance(payload: any) {
  const row = getIndex(payload, "VN-INDEX");
  const adv = numberAny(row, ["adv"]);
  const flat = numberAny(row, ["flat"]);
  const dec = numberAny(row, ["dec"]);
  if (adv === null || flat === null || dec === null) return null;
  const total = adv + flat + dec;
  if (total <= 0) return null;
  return {
    adv: Math.round(adv),
    flat: Math.round(flat),
    dec: Math.round(dec),
    total: Math.round(total),
    balance: (adv - dec) / total
  };
}

function scoreMarket(payload: any) {
  let score = 50;
  const vnPct = metric(payload, "VN-INDEX", "change_pct");
  const vn30Pct = metric(payload, "VN30", "change_pct");
  const hnxPct = metric(payload, "HNX-INDEX", "change_pct");
  const upcomPct = metric(payload, "UPCOM-INDEX", "change_pct");
  const breadth = breadthBalance(payload);

  if (vnPct !== null) score += clamp(vnPct, -2, 2) * 7;
  if (breadth) score += breadth.balance * 28;
  if (vn30Pct !== null) score += clamp(vn30Pct, -2, 2) * 4;

  const secondary = [hnxPct, upcomPct].filter((v): v is number => v !== null);
  if (secondary.length) {
    const avg = secondary.reduce((a, b) => a + b, 0) / secondary.length;
    score += clamp(avg, -2, 2) * 3;
  }

  return Math.round(clamp(score, 0, 100));
}

function stateFromScore(score: number) {
  if (score >= 72) return { code: "positive", label: "TÍCH CỰC", tone: "positive", risk_level: 1 };
  if (score >= 58) return { code: "constructive", label: "NGHIÊNG TÍCH CỰC", tone: "positive", risk_level: 2 };
  if (score >= 46) return { code: "mixed", label: "PHÂN HÓA", tone: "neutral", risk_level: 3 };
  if (score >= 32) return { code: "cautious", label: "THẬN TRỌNG", tone: "warning", risk_level: 4 };
  return { code: "risk", label: "RỦI RO CAO", tone: "danger", risk_level: 5 };
}

function breadthLabel(balance: number | null) {
  if (balance === null) return { label: "Chưa đủ dữ liệu", tone: "neutral" };
  if (balance >= 0.25) return { label: "Lan tỏa tốt", tone: "positive" };
  if (balance >= 0.08) return { label: "Nghiêng tích cực", tone: "positive" };
  if (balance > -0.08) return { label: "Cân bằng", tone: "neutral" };
  if (balance > -0.25) return { label: "Yếu", tone: "warning" };
  return { label: "Rất yếu", tone: "danger" };
}

function vietnamParts(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  return {
    date: `${year}-${month}-${day}`,
    hour,
    minute,
    minuteOfDay: hour * 60 + minute,
    weekday: get("weekday")
  };
}

function marketSessionNow() {
  const p = vietnamParts(new Date());
  if (["Sat", "Sun"].includes(p.weekday)) return "closed";
  const m = p.minuteOfDay;
  if (m >= 8 * 60 + 45 && m <= 11 * 60 + 30) return "morning";
  if (m > 11 * 60 + 30 && m < 13 * 60) return "lunch";
  if (m >= 13 * 60 && m <= 15 * 60) return "afternoon";
  return "closed";
}

function freshness(receivedAt: string | null) {
  if (!receivedAt) return { status: "unknown", label: "Chưa xác định", age_seconds: null, tone: "neutral" };
  const age = Math.max(0, Math.round((Date.now() - new Date(receivedAt).getTime()) / 1000));
  const session = marketSessionNow();
  if (session === "closed" || session === "lunch") {
    return { status: "closed", label: session === "lunch" ? "Nghỉ trưa" : "Dữ liệu gần nhất", age_seconds: age, tone: "neutral" };
  }
  if (age <= 150) return { status: "live", label: "Realtime", age_seconds: age, tone: "positive" };
  if (age <= 600) return { status: "delayed", label: "Dữ liệu chậm", age_seconds: age, tone: "warning" };
  return { status: "stale", label: "Mất đồng bộ", age_seconds: age, tone: "danger" };
}

function closestSnapshot(rows: any[], targetMinute: number, maxDiff = 4) {
  let best: any = null;
  let bestDiff = Infinity;
  for (const row of rows || []) {
    const minute = Number(row?.minute_of_day);
    if (!Number.isFinite(minute)) continue;
    const diff = Math.abs(minute - targetMinute);
    if (diff < bestDiff && diff <= maxDiff) {
      best = row;
      bestDiff = diff;
    }
  }
  return best;
}

function gtFromPayload(payload: any) {
  const row = getIndex(payload, "VN-INDEX");
  return numberAny(row, ["value_b", "total_value_b", "total_trade_value_b"]);
}

function sectorRows(payload: any, pastPayload: any = null) {
  const rows: any[] = [];
  for (const [symbol, name] of Object.entries(SECTOR_MAP)) {
    const current = getIndex(payload, symbol);
    const pct = numberAny(current, ["change_pct"]);
    if (pct === null) continue;
    const pastPct = pastPayload ? numberAny(getIndex(pastPayload, symbol), ["change_pct"]) : null;
    const delta15 = pastPct === null ? null : pct - pastPct;
    let momentum = "ổn định";
    if (delta15 !== null && delta15 >= 0.15) momentum = "mạnh lên";
    else if (delta15 !== null && delta15 <= -0.15) momentum = "yếu đi";
    rows.push({
      symbol,
      name,
      change_pct: round(pct, 2),
      delta_15m: delta15 === null ? null : round(delta15, 2),
      momentum
    });
  }
  return rows.sort((a, b) => b.change_pct - a.change_pct);
}

function buildFlow(currentPayload: any, todayRows: any[], baselineRows: any[], currentMinute: number) {
  const currentGt = gtFromPayload(currentPayload);
  const h15 = closestSnapshot(todayRows, currentMinute - 15, 5);
  const h30 = closestSnapshot(todayRows, currentMinute - 30, 5);
  const gt15 = h15 ? gtFromPayload(h15.payload) : null;
  const gt30 = h30 ? gtFromPayload(h30.payload) : null;

  let paceRatio: number | null = null;
  if (currentGt !== null && gt15 !== null && gt30 !== null) {
    const latestDelta = currentGt - gt15;
    const previousDelta = gt15 - gt30;
    if (latestDelta >= 0 && previousDelta > 0) paceRatio = latestDelta / previousDelta;
  }

  const byDate = new Map<string, any[]>();
  for (const row of baselineRows || []) {
    const date = String(row?.market_date || "");
    if (!date) continue;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(row);
  }

  const sameTimeValues: number[] = [];
  for (const rows of byDate.values()) {
    const nearest = closestSnapshot(rows, currentMinute, 4);
    if (!nearest) continue;
    const gt = gtFromPayload(nearest.payload);
    if (gt !== null && gt > 0) sameTimeValues.push(gt);
    if (sameTimeValues.length >= 20) break;
  }

  const baselineAvg = sameTimeValues.length
    ? sameTimeValues.reduce((a, b) => a + b, 0) / sameTimeValues.length
    : null;
  const baselineRatio = currentGt !== null && baselineAvg && baselineAvg > 0 ? currentGt / baselineAvg : null;

  let label = "Đang tạo chuẩn so sánh";
  let tone = "neutral";
  if (baselineRatio !== null && sameTimeValues.length >= 5) {
    if (baselineRatio >= 1.2) { label = "Cao hơn bình thường"; tone = "positive"; }
    else if (baselineRatio <= 0.8) { label = "Thấp hơn bình thường"; tone = "warning"; }
    else { label = "Gần mức bình thường"; tone = "neutral"; }
  } else if (paceRatio !== null) {
    if (paceRatio >= 1.2) { label = "Đang tăng tốc"; tone = "positive"; }
    else if (paceRatio <= 0.8) { label = "Đang chậm lại"; tone = "warning"; }
    else { label = "Nhịp tiền ổn định"; tone = "neutral"; }
  }

  return {
    value_b: currentGt === null ? null : round(currentGt, 1),
    label,
    tone,
    pace_ratio_15m: paceRatio === null ? null : round(paceRatio, 2),
    same_time_ratio: baselineRatio === null ? null : round(baselineRatio, 2),
    same_time_avg_b: baselineAvg === null ? null : round(baselineAvg, 1),
    baseline_days: sameTimeValues.length,
    baseline_target_days: 20
  };
}

function buildAlerts(payload: any, state: any, breadth: any, sectors: any[], flow: any, fresh: any) {
  const alerts: any[] = [];
  const vnPct = metric(payload, "VN-INDEX", "change_pct");
  const vn30Pct = metric(payload, "VN30", "change_pct");

  if (fresh.status === "stale" || fresh.status === "delayed") {
    alerts.push({
      level: fresh.status === "stale" ? "danger" : "warning",
      title: fresh.status === "stale" ? "Dữ liệu đang mất đồng bộ" : "Dữ liệu đang chậm",
      detail: "Không dùng trạng thái này để ra quyết định mới cho đến khi nguồn cập nhật lại."
    });
  }

  if (vnPct !== null && vnPct >= 0 && breadth?.balance !== null && breadth.balance < -0.12) {
    alerts.push({
      level: "warning",
      title: "Chỉ số tốt hơn độ rộng",
      detail: "VN-Index giữ được điểm nhưng số mã giảm đang áp đảo. Đà tăng chưa lan tỏa."
    });
  }

  if (breadth?.balance !== null && breadth.balance <= -0.25) {
    alerts.push({
      level: "danger",
      title: "Số mã giảm áp đảo",
      detail: "Độ rộng thị trường đang rất yếu. Ưu tiên quản trị vị thế hơn mở rộng rủi ro."
    });
  } else if (breadth?.balance !== null && breadth.balance >= 0.25) {
    alerts.push({
      level: "positive",
      title: "Độ rộng lan tỏa tốt",
      detail: "Số mã tăng đang chiếm ưu thế rõ rệt, tín hiệu tích cực có độ phủ tốt hơn."
    });
  }

  if (vnPct !== null && vn30Pct !== null && vn30Pct - vnPct >= 0.25) {
    alerts.push({
      level: "neutral",
      title: "Tiền nghiêng về vốn hóa lớn",
      detail: "VN30 đang khỏe hơn VN-Index đáng kể; thị trường có dấu hiệu tập trung vào nhóm lớn."
    });
  }

  if (sectors.length >= 2) {
    const dispersion = sectors[0].change_pct - sectors[sectors.length - 1].change_pct;
    if (dispersion >= 1.2) {
      alerts.push({
        level: "neutral",
        title: "Phân hóa ngành cao",
        detail: `Chênh lệch giữa nhóm mạnh nhất và yếu nhất khoảng ${round(dispersion, 2)} điểm %. Chọn đúng nhóm quan trọng hơn nhìn chỉ số chung.`
      });
    }
  }

  if (flow.same_time_ratio !== null && flow.same_time_ratio >= 1.15 && state.risk_level >= 4) {
    alerts.push({
      level: "warning",
      title: "Thanh khoản cao trong trạng thái yếu",
      detail: "Giá trị giao dịch cao không tự động là tín hiệu mua; cần quan sát xem dòng tiền đang hấp thụ hay phân phối."
    });
  }

  return alerts.slice(0, 4);
}

function actionForState(state: any, flow: any) {
  let headline = "";
  let detail = "";
  let links: any[] = [];

  if (state.risk_level === 1) {
    headline = "Có thể duy trì tỷ trọng theo kế hoạch.";
    detail = "Chỉ mở vị thế mới khi điểm mua, mức cắt lỗ và quy mô lệnh đều đạt chuẩn; không mua đuổi vì chỉ số xanh.";
    links = [
      { label: "Tính quy mô lệnh", href: "tinh-quy-mo-lenh-co-phieu.html" },
      { label: "Tính lãi / lỗ kỳ vọng", href: "tinh-ty-le-lai-lo-co-phieu.html" }
    ];
  } else if (state.risk_level === 2) {
    headline = "Có thể tham gia chọn lọc.";
    detail = "Ưu tiên nhóm đang dẫn dắt và cổ phiếu có sức mạnh riêng; giữ kỷ luật điểm mua và tỷ trọng.";
    links = [
      { label: "Tính quy mô lệnh", href: "tinh-quy-mo-lenh-co-phieu.html" },
      { label: "Kiểm tra rủi ro danh mục", href: "tinh-rui-ro-danh-muc.html" }
    ];
  } else if (state.risk_level === 3) {
    headline = "Giữ tỷ trọng vừa phải, không cần vội.";
    detail = "Thị trường phân hóa; ưu tiên vị thế đang đúng kế hoạch và chỉ mở mới khi lợi thế đủ rõ.";
    links = [
      { label: "Kiểm tra rủi ro danh mục", href: "tinh-rui-ro-danh-muc.html" },
      { label: "Tính quy mô lệnh", href: "tinh-quy-mo-lenh-co-phieu.html" }
    ];
  } else if (state.risk_level === 4) {
    headline = "Chưa mở rộng tỷ trọng.";
    detail = "Ưu tiên cổ phiếu có sức mạnh riêng, giảm giao dịch cảm tính và hạn chế tăng margin khi độ rộng chưa cải thiện.";
    links = [
      { label: "Kiểm tra sức chịu margin", href: "tinh-margin-chung-khoan.html" },
      { label: "Kiểm tra rủi ro danh mục", href: "tinh-rui-ro-danh-muc.html" }
    ];
  } else {
    headline = "Ưu tiên bảo toàn vốn.";
    detail = "Giảm đòn bẩy, xử lý vị thế vi phạm kế hoạch và tránh bình quân giá xuống chỉ vì giá đã giảm.";
    links = [
      { label: "Hạ margin", href: "tinh-ban-bao-nhieu-de-ha-margin.html" },
      { label: "Hồi phục sau thua lỗ", href: "tinh-hoi-phuc-sau-thua-lo.html" }
    ];
  }

  if (flow.same_time_ratio !== null && flow.same_time_ratio >= 1.15 && state.risk_level >= 4) {
    detail += " Thanh khoản đang cao hơn chuẩn trong trạng thái yếu: theo dõi áp lực cung trước khi hành động.";
  }

  return { headline, detail, links };
}

function buildIntelligence(payload: any, receivedAt: string | null, todayRows: any[], baselineRows: any[]) {
  const p = vietnamParts(receivedAt || new Date());
  const score = scoreMarket(payload);
  const baseState = stateFromScore(score);
  const past15 = closestSnapshot(todayRows, p.minuteOfDay - 15, 5);
  const pastScore = past15 ? scoreMarket(past15.payload) : null;
  const scoreDelta15 = pastScore === null ? null : score - pastScore;
  let trend = "ổn định";
  if (scoreDelta15 !== null && scoreDelta15 >= 4) trend = "đang cải thiện";
  else if (scoreDelta15 !== null && scoreDelta15 <= -4) trend = "đang xấu đi";

  const breadthRaw = breadthBalance(payload);
  const breadthState = breadthLabel(breadthRaw?.balance ?? null);
  const flow = buildFlow(payload, todayRows, baselineRows, p.minuteOfDay);
  const sectors = sectorRows(payload, past15?.payload || null);
  const fresh = freshness(receivedAt);
  const state = {
    ...baseState,
    score,
    trend,
    score_delta_15m: scoreDelta15 === null ? null : Math.round(scoreDelta15)
  };

  const leadership = {
    leader: sectors[0] || null,
    leaders: sectors.slice(0, 3),
    laggards: sectors.slice(-3).reverse(),
    sector_count: sectors.length,
    dispersion_pct: sectors.length >= 2 ? round(sectors[0].change_pct - sectors[sectors.length - 1].change_pct, 2) : null
  };

  const breadth = breadthRaw
    ? { ...breadthRaw, balance: round(breadthRaw.balance, 3), label: breadthState.label, tone: breadthState.tone }
    : { adv: null, flat: null, dec: null, total: null, balance: null, label: breadthState.label, tone: breadthState.tone };

  const alerts = buildAlerts(payload, state, breadth, sectors, flow, fresh);
  const action = actionForState(state, flow);

  return {
    version: "1.0",
    generated_at: new Date().toISOString(),
    state,
    freshness: fresh,
    breadth,
    flow,
    leadership,
    alerts,
    action,
    history: {
      today_points: todayRows?.length || 0,
      baseline_days: flow.baseline_days,
      baseline_target_days: 20,
      same_time_baseline_ready: flow.baseline_days >= 5
    }
  };
}

async function fetchFiinItems(): Promise<any[]> {
  const now = Date.now();
  if (fiinCache && now - fiinCache.at < 30_000) return fiinCache.items;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const r = await fetch("https://fiin-market.ssi.com.vn/MarketInDepth/GetLatestIndices?language=vi&pageSize=999999&status=1", {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://iboard.ssi.com.vn/"
      },
      signal: controller.signal
    });
    if (!r.ok) return [];
    const body = await r.json();
    const items = Array.isArray(body?.items) ? body.items : [];
    if (items.length) fiinCache = { at: now, items };
    return items;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function enrichMissingMarketMetrics(payload: any) {
  if (!Array.isArray(payload?.indexes) || !payload.indexes.length) return payload;
  const needsValue = payload.indexes.some((x: any) => x?.value_b === null || x?.value_b === undefined);
  const needsBreadth = payload.indexes.some((x: any) => x?.adv === null || x?.adv === undefined || x?.flat === null || x?.flat === undefined || x?.dec === null || x?.dec === undefined);
  if (!needsValue && !needsBreadth) return payload;

  const items = await fetchFiinItems();
  if (!items.length) return payload;

  let applied = 0;
  for (const idx of payload.indexes) {
    const code = INDEX_CODE_MAP[String(idx?.symbol || "")];
    if (!code) continue;
    const row = items.find((it: any) => {
      const c = stringAny(it, ["comGroupCode", "code", "symbol"]);
      return c && c.toLowerCase() === code.toLowerCase();
    });
    if (!row) continue;

    const matchValue = numberAny(row, ["matchValue", "totalMatchValue", "matchedValue", "totalValue"]);
    if ((idx.value_b === null || idx.value_b === undefined) && matchValue !== null && matchValue > 0) {
      idx.value_b = Math.round((matchValue / 1_000_000_000) * 1000) / 1000;
      idx.value_source = "Fiin/SSI market summary via market-feed";
    }

    const adv = numberAny(row, ["advance", "advances", "up", "totalStockUpPrice", "totalStockUp"]);
    const flat = numberAny(row, ["noChange", "unchanged", "steady", "totalStockNoChangePrice", "totalStockNoChange"]);
    const dec = numberAny(row, ["decline", "declines", "down", "totalStockDownPrice", "totalStockDown"]);
    const ceiling = numberAny(row, ["ceiling", "totalStockCeiling"]);
    const floor = numberAny(row, ["floor", "totalStockFloor"]);

    if ((idx.adv === null || idx.adv === undefined) && adv !== null) idx.adv = Math.round(adv);
    if ((idx.flat === null || idx.flat === undefined) && flat !== null) idx.flat = Math.round(flat);
    if ((idx.dec === null || idx.dec === undefined) && dec !== null) idx.dec = Math.round(dec);
    if ((idx.ceiling === null || idx.ceiling === undefined) && ceiling !== null) idx.ceiling = Math.round(ceiling);
    if ((idx.floor === null || idx.floor === undefined) && floor !== null) idx.floor = Math.round(floor);
    if (adv !== null || flat !== null || dec !== null) idx.breadth_source = idx.breadth_source || "Fiin/SSI market summary via market-feed";
    applied++;
  }

  if (applied > 0) {
    payload.market_metrics_provider = payload.market_metrics_provider || "Fiin/SSI market summary via market-feed";
    payload.market_metrics_applied = applied;
  }
  return payload;
}

async function recordHistory(payload: any, receivedAt: string, sourceUpdated: string | null) {
  const p = vietnamParts(receivedAt);
  const row = {
    market_date: p.date,
    minute_of_day: p.minuteOfDay,
    captured_at: receivedAt,
    source_updated_at: sourceUpdated,
    payload
  };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/market_realtime_history?on_conflict=market_date,minute_of_day`, {
    method: "POST",
    headers: serviceHeaders({
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates,return=minimal"
    }),
    body: JSON.stringify(row)
  });
  return r.ok;
}

async function readHistory(receivedAt: string | null) {
  const p = vietnamParts(receivedAt || new Date());
  const todayUrl = `${SUPABASE_URL}/rest/v1/market_realtime_history?market_date=eq.${encodeURIComponent(p.date)}&select=market_date,minute_of_day,captured_at,payload&order=minute_of_day.desc&limit=75`;
  const low = Math.max(0, p.minuteOfDay - 4);
  const high = Math.min(1439, p.minuteOfDay + 4);
  const baselineUrl = `${SUPABASE_URL}/rest/v1/market_realtime_history?market_date=lt.${encodeURIComponent(p.date)}&minute_of_day=gte.${low}&minute_of_day=lte.${high}&select=market_date,minute_of_day,payload&order=market_date.desc,minute_of_day.asc&limit=180`;

  const [todayResp, baselineResp] = await Promise.all([
    fetch(todayUrl, { headers: serviceHeaders() }),
    fetch(baselineUrl, { headers: serviceHeaders() })
  ]);

  let todayRows: any[] = [];
  let baselineRows: any[] = [];
  if (todayResp.ok) {
    try { todayRows = await todayResp.json(); } catch {}
  }
  if (baselineResp.ok) {
    try { baselineRows = await baselineResp.json(); } catch {}
  }
  return { todayRows, baselineRows };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });

  if (req.method === "POST") {
    if (!BRIDGE_KEY || req.headers.get("x-bridge-key") !== BRIDGE_KEY) return json(req, { ok: false, error: "UNAUTHORIZED" }, 401);

    let payload: any;
    try { payload = await req.json(); }
    catch { return json(req, { ok: false, error: "INVALID_JSON" }, 400); }

    if (!payload?.ok || !Array.isArray(payload?.indexes) || payload.indexes.length < 1) {
      return json(req, { ok: false, error: "INVALID_MARKET_PAYLOAD" }, 400);
    }

    payload = await enrichMissingMarketMetrics(payload);
    const candidate = payload.indexes.map((x: any) => x?.source_updated_at).filter(Boolean).sort().at(-1) || payload.updated_at || null;
    const sourceUpdated = toIsoVietnam(candidate);
    const receivedAt = new Date().toISOString();
    const row = { id: "vietnam", payload, source_updated_at: sourceUpdated, received_at: receivedAt };

    const r = await fetch(`${SUPABASE_URL}/rest/v1/market_realtime_snapshot?on_conflict=id`, {
      method: "POST",
      headers: serviceHeaders({
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation"
      }),
      body: JSON.stringify(row)
    });
    const text = await r.text();
    if (!r.ok) return json(req, { ok: false, error: "STORE_FAILED", status: r.status, detail: text }, 500);

    const historyStored = await recordHistory(payload, receivedAt, sourceUpdated);
    return json(req, {
      ok: true,
      stored_at: receivedAt,
      source_updated_at: sourceUpdated,
      history_stored: historyStored
    });
  }

  if (req.method === "GET") {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/market_realtime_snapshot?id=eq.vietnam&select=payload,source_updated_at,received_at&limit=1`, {
      headers: serviceHeaders()
    });
    const text = await r.text();
    if (!r.ok) return json(req, { ok: false, error: "READ_FAILED", status: r.status, detail: text }, 500);

    let rows: any[] = [];
    try { rows = JSON.parse(text); }
    catch { return json(req, { ok: false, error: "READ_PARSE_FAILED" }, 500); }

    if (!rows?.length) return json(req, { ok: false, error: "NO_DATA" }, 404);

    const row = rows[0];
    const payload = await enrichMissingMarketMetrics(row.payload);
    const { todayRows, baselineRows } = await readHistory(row.received_at || row.source_updated_at || null);
    const intelligence = buildIntelligence(payload, row.received_at || null, todayRows, baselineRows);

    return json(req, {
      ...payload,
      market_intelligence: intelligence,
      relay_received_at: row.received_at,
      relay_source_updated_at: row.source_updated_at
    }, 200);
  }

  return json(req, { ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
});
