(() => {
  "use strict";

  const SUPABASE_URL = "https://elmrbnewlukxscbcfizg.supabase.co";
  const SUPABASE_KEY = "sb_publishable_mmZzpw346GxIlWQRzasTHA_7JhDHC9g";
  const ADMIN_URL = `${SUPABASE_URL}/functions/v1/broker-brief-admin`;

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, detectSessionInUrl: true }
  });

  const $ = (id) => document.getElementById(id);
  let currentBrief = null;
  let currentItems = [];

  function setMessage(msg, type = "") {
    const el = $("msg");
    el.textContent = msg || "";
    el.className = "msg " + type;
  }

  function statusLabel(s) {
    return ({
      DRAFT: "BẢN NHÁP",
      REVIEWED: "ĐÃ DUYỆT",
      PUBLISHED: "ĐÃ XUẤT BẢN",
      ARCHIVED: "ĐÃ LƯU TRỮ"
    })[s] || s || "—";
  }

  async function session() {
    const { data } = await client.auth.getSession();
    return data?.session || null;
  }

  async function api(method = "GET", body = null) {
    const s = await session();
    if (!s) throw new Error("NOT_LOGGED_IN");
    const r = await fetch(ADMIN_URL, {
      method,
      cache: "no-store",
      headers: {
        "authorization": `Bearer ${s.access_token}`,
        "content-type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error(d?.error || `HTTP_${r.status}`);
      err.payload = d;
      throw err;
    }
    return d;
  }

  function renderScenarios(arr) {
    const box = $("scenarios");
    box.innerHTML = "";
    (Array.isArray(arr) ? arr : []).slice(0, 5).forEach((x, i) => {
      const wrap = document.createElement("div");
      wrap.className = "scenario";
      wrap.innerHTML = `
        <strong>Kịch bản ${i + 1}</strong>
        <input data-scen="${i}" data-key="name" placeholder="Tên kịch bản" value="${String(x?.name || "").replace(/"/g,"&quot;")}">
        <textarea data-scen="${i}" data-key="condition" placeholder="Điều kiện">${x?.condition || ""}</textarea>
        <textarea data-scen="${i}" data-key="action" placeholder="Hành động">${x?.action || ""}</textarea>
      `;
      box.appendChild(wrap);
    });
  }

  function collectScenarios() {
    const out = [];
    document.querySelectorAll(".scenario").forEach((el) => {
      out.push({
        name: el.querySelector('[data-key="name"]')?.value?.trim() || "",
        condition: el.querySelector('[data-key="condition"]')?.value?.trim() || "",
        action: el.querySelector('[data-key="action"]')?.value?.trim() || ""
      });
    });
    return out;
  }

  function renderNews(items) {
    const box = $("newsList");
    box.innerHTML = "";
    items.forEach((x) => {
      const row = document.createElement("label");
      row.className = "news-row";
      row.innerHTML = `
        <input type="checkbox" class="news-check" value="${x.id}" ${x.is_selected ? "checked" : ""}>
        <span>
          <b>${x.rank}. ${x.title_snapshot || ""}</b>
          <small>${x.source_name_snapshot || ""}</small>
          ${x.compact_summary_snapshot ? `<em>${x.compact_summary_snapshot}</em>` : ""}
        </span>
      `;
      box.appendChild(row);
    });
  }

  function render(data) {
    currentBrief = data.brief;
    currentItems = data.items || [];

    $("editor").hidden = !currentBrief;
    if (!currentBrief) {
      setMessage("Chưa có bản nháp Bản tin Môi giới hôm nay.");
      return;
    }

    $("briefDate").textContent = currentBrief.brief_date || "—";
    $("marketState").textContent = currentBrief.market_state || "—";
    $("marketScore").textContent = currentBrief.market_score ?? "—";
    $("status").textContent = statusLabel(currentBrief.status);
    $("status").dataset.status = currentBrief.status || "";

    $("headline").value = currentBrief.headline || "";
    $("voView").value = currentBrief.vo_hoang_view || "";

    const things = Array.isArray(currentBrief.three_things_to_watch)
      ? currentBrief.three_things_to_watch : [];
    [0,1,2].forEach(i => $("watch" + (i+1)).value = things[i] || "");

    renderScenarios(currentBrief.scenarios);
    renderNews(currentItems);

    $("btnReview").hidden = currentBrief.status !== "DRAFT";
    $("btnReopen").hidden = !["REVIEWED", "PUBLISHED"].includes(currentBrief.status);
    $("btnPublish").hidden = currentBrief.status !== "REVIEWED";
    $("btnSave").disabled = !["DRAFT","REVIEWED"].includes(currentBrief.status);
    setMessage("");
  }

  async function loadBrief() {
    setMessage("Đang tải bản tin…");
    try {
      const d = await api("GET");
      render(d);
    } catch (e) {
      if (e.message === "FORBIDDEN") {
        const uid = e.payload?.user_id || "";
        $("editor").hidden = true;
        setMessage(`Tài khoản đã đăng nhập nhưng chưa được cấp quyền môi giới. Mã người dùng: ${uid}`, "warn");
        return;
      }
      if (e.message === "NOT_LOGGED_IN" || e.message === "INVALID_TOKEN") {
        showLogin();
        return;
      }
      setMessage("Không tải được bản tin: " + e.message, "error");
    }
  }

  function selectedIds() {
    return [...document.querySelectorAll(".news-check:checked")].map(x => x.value);
  }

  async function save() {
    if (!currentBrief) return;
    const selected = selectedIds();
    if (selected.length < 3 || selected.length > 7) {
      setMessage("Chọn từ 3 đến 7 tin để đưa vào bản công khai.", "warn");
      return;
    }

    const body = {
      action: "save",
      brief_id: currentBrief.id,
      headline: $("headline").value,
      vo_hoang_view: $("voView").value,
      three_things_to_watch: [$("watch1").value, $("watch2").value, $("watch3").value],
      scenarios: collectScenarios(),
      selected_item_ids: selected
    };

    setMessage("Đang lưu…");
    try {
      render(await api("POST", body));
      setMessage("Đã lưu bản nháp.", "ok");
    } catch (e) {
      setMessage("Lưu thất bại: " + e.message, "error");
    }
  }

  async function action(name) {
    if (!currentBrief) return;
    setMessage("Đang xử lý…");
    try {
      render(await api("POST", { action: name, brief_id: currentBrief.id }));
      setMessage(name === "publish" ? "Đã xuất bản. Trang public sẽ chỉ đọc bản này." : "Đã cập nhật trạng thái.", "ok");
    } catch (e) {
      setMessage("Không thực hiện được: " + e.message, "error");
    }
  }

  function showLogin() {
    $("login").hidden = false;
    $("editor").hidden = true;
  }

  async function init() {
    const s = await session();
    if (!s) {
      showLogin();
      return;
    }

    $("login").hidden = true;
    $("who").textContent = s.user?.email || "Đã đăng nhập";
    $("logout").hidden = false;
    loadBrief();
  }

  $("loginForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const email = $("email").value.trim();
    if (!email) return;

    setMessage("Đang gửi liên kết đăng nhập…");
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.href }
    });

    if (error) setMessage("Không gửi được liên kết: " + error.message, "error");
    else setMessage("Đã gửi liên kết đăng nhập vào email. Mở email và bấm liên kết để quay lại trang này.", "ok");
  });

  $("logout").addEventListener("click", async () => {
    await client.auth.signOut();
    location.reload();
  });

  $("btnSave").addEventListener("click", save);
  $("btnReview").addEventListener("click", async () => { await save(); await action("review"); });
  $("btnReopen").addEventListener("click", () => action("reopen"));
  $("btnPublish").addEventListener("click", () => action("publish"));
  $("btnReload").addEventListener("click", loadBrief);

  client.auth.onAuthStateChange(() => setTimeout(init, 0));
  init();
})();
