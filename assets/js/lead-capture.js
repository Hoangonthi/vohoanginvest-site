(() => {
  "use strict";

  const ENDPOINT =
    "https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/lead-capture";

  const ROOT_ID = "vh-lead-capture";

  const page = (
    location.pathname.split("/").pop() || "index.html"
  ).toLowerCase();

  const config = {
    "index.html": {
      eyebrow: "NHẬN BẢN TIN & HỖ TRỢ",
      title: "Để Võ Hoàng theo dõi cùng bạn",
      text:
        "Nhận bản tin thị trường và để lại thông tin nếu bạn muốn được trao đổi sát hơn theo tài khoản.",
      button: "Nhận cập nhật",
      intent: "HOME_CONTACT"
    },

    "sang-nay-can-nhin-gi.html": {
      eyebrow: "NHẬN BẢN TIN ĐẦU NGÀY",
      title: "Muốn nhận bản tin và góc nhìn khi có thay đổi?",
      text:
        "Để lại thông tin. Khi thị trường có điểm đáng chú ý, Võ Hoàng có thể chủ động cập nhật và trao đổi thêm với bạn.",
      button: "Nhận bản tin",
      intent: "MORNING_BRIEF"
    },

    "thi-truong-hom-nay.html": {
      eyebrow: "THEO DÕI THỊ TRƯỜNG",
      title: "Cần được báo khi trạng thái thị trường thay đổi?",
      text:
        "Để lại thông tin để nhận cập nhật quan trọng thay vì phải tự canh màn hình liên tục.",
      button: "Nhận cập nhật",
      intent: "MARKET_ALERT"
    },

    "watchlist.html": {
      eyebrow: "WATCHLIST CÁ NHÂN",
      title:
        "Muốn được trao đổi kỹ hơn về mã bạn đang theo dõi?",
      text:
        "Gửi thông tin để Võ Hoàng nắm nhu cầu và trao đổi sát hơn theo danh mục hoặc nhóm cổ phiếu bạn quan tâm.",
      button: "Trao đổi thêm",
      intent: "WATCHLIST_HELP"
    },

    "investor-calculator.html": {
      eyebrow: "TRƯỚC KHI BẤM LỆNH",
      title:
        "Muốn kiểm tra lại kế hoạch lệnh trước khi vào tiền?",
      text:
        "Để lại thông tin nếu bạn muốn Võ Hoàng hỗ trợ rà lại mức vốn, rủi ro và kịch bản trước khi giao dịch.",
      button: "Nhờ rà lại",
      intent: "ORDER_PLAN_REVIEW"
    },

    "kiem-tra-nhanh-tai-khoan.html": {
      eyebrow: "KIỂM TRA TÀI KHOẢN",
      title:
        "Muốn được xem sát hơn theo tình trạng tài khoản?",
      text:
        "Để lại thông tin để Võ Hoàng nắm đúng nhu cầu và trao đổi theo vấn đề thực tế của tài khoản.",
      button: "Đăng ký trao đổi",
      intent: "ACCOUNT_REVIEW"
    },

    "sau-phien-cua-toi.html": {
      eyebrow: "SAU PHIÊN",
      title:
        "Muốn nhận phần tổng kết và việc cần làm cho phiên tới?",
      text:
        "Để lại thông tin để nhận cập nhật và trao đổi khi có điểm cần lưu ý.",
      button: "Nhận cập nhật",
      intent: "AFTER_MARKET"
    }
  }[page] || {
    eyebrow: "VÕ HOÀNG · ĐẦU TƯ CHUẨN HỆ THỐNG",
    title:
      "Cần trao đổi sát hơn theo tài khoản của bạn?",
    text:
      "Để lại thông tin để Võ Hoàng nắm nhu cầu và chủ động liên hệ khi phù hợp.",
    button: "Để lại thông tin",
    intent: "GENERAL_CONTACT"
  };

  function getSessionId() {
    const key = "vh_session_id";

    let id = localStorage.getItem(key);

    if (!id) {
      if (
        window.crypto &&
        typeof window.crypto.randomUUID === "function"
      ) {
        id = window.crypto.randomUUID();
      } else {
        id =
          "vh-" +
          Date.now() +
          "-" +
          Math.random().toString(16).slice(2);
      }

      localStorage.setItem(key, id);
    }

    return id;
  }

  function esc(s) {
    return String(s ?? "").replace(
      /[&<>"']/g,
      ch =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;"
        })[ch]
    );
  }

  function ensureStyle() {
    if (
      document.getElementById(
        "vh-lead-capture-style"
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "vh-lead-capture-style";

    style.textContent = `
      #${ROOT_ID}{
        max-width:1180px;
        margin:30px auto 36px;
        padding:0 20px;
        font-family:"Be Vietnam Pro",Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      #${ROOT_ID} .vh-lead-box{
        display:grid;
        grid-template-columns:
          minmax(0,1.05fr)
          minmax(360px,.95fr);
        gap:24px;
        padding:26px;
        border:
          1px solid
          rgba(213,180,107,.34);
        border-radius:20px;
        background:
          radial-gradient(
            circle at 10% 0%,
            rgba(213,180,107,.08),
            transparent 34%
          ),
          rgba(10,16,28,.94);
        box-shadow:
          0 20px 55px
          rgba(0,0,0,.20);
      }

      #${ROOT_ID} .vh-lead-copy{
        align-self:center;
      }

      #${ROOT_ID} .vh-lead-eyebrow{
        display:block;
        margin-bottom:9px;
        color:#d5b46b;
        font-size:12px;
        font-weight:800;
        letter-spacing:.10em;
      }

      #${ROOT_ID} h2{
        margin:0 0 10px;
        color:#f2e7ce;
        font-size:25px;
        line-height:1.35;
        letter-spacing:-.02em;
      }

      #${ROOT_ID} p{
        margin:0;
        color:
          rgba(255,255,255,.70);
        line-height:1.7;
        font-size:14px;
      }

      #${ROOT_ID} .vh-lead-form{
        display:grid;
        gap:10px;
      }

      #${ROOT_ID} .vh-lead-fields{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
      }

      #${ROOT_ID} input{
        width:100%;
        box-sizing:border-box;
        min-height:46px;
        padding:11px 13px;
        border-radius:11px;
        border:
          1px solid
          rgba(255,255,255,.12);
        outline:none;
        background:
          rgba(255,255,255,.045);
        color:#fff;
        font:inherit;
      }

      #${ROOT_ID} input::placeholder{
        color:
          rgba(255,255,255,.42);
      }

      #${ROOT_ID} input:focus{
        border-color:
          rgba(213,180,107,.70);
        box-shadow:
          0 0 0 3px
          rgba(213,180,107,.08);
      }

      #${ROOT_ID} button{
        min-height:46px;
        border:0;
        border-radius:11px;
        padding:11px 18px;
        background:#d5b46b;
        color:#111827;
        font:inherit;
        font-weight:800;
        cursor:pointer;
      }

      #${ROOT_ID} button:disabled{
        opacity:.62;
        cursor:wait;
      }

      #${ROOT_ID} .vh-lead-note,
      #${ROOT_ID} .vh-lead-result{
        font-size:12px;
        line-height:1.55;
      }

      #${ROOT_ID} .vh-lead-note{
        color:
          rgba(255,255,255,.46);
      }

      #${ROOT_ID} .vh-lead-result{
        min-height:19px;
        color:#9fe0b0;
      }

      #${ROOT_ID} .vh-hp{
        position:absolute !important;
        left:-9999px !important;
        opacity:0 !important;
        pointer-events:none !important;
      }

      @media(max-width:800px){
        #${ROOT_ID}{
          padding:0 14px;
        }

        #${ROOT_ID} .vh-lead-box{
          grid-template-columns:1fr;
          padding:20px;
        }
      }

      @media(max-width:520px){
        #${ROOT_ID} .vh-lead-fields{
          grid-template-columns:1fr;
        }

        #${ROOT_ID} h2{
          font-size:21px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function mount() {
    if (
      document.getElementById(ROOT_ID)
    ) {
      return;
    }

    ensureStyle();

    const root =
      document.createElement("section");

    root.id = ROOT_ID;

    root.setAttribute(
      "aria-label",
      "Đăng ký nhận cập nhật và liên hệ"
    );

    root.innerHTML = `
      <div class="vh-lead-box">

        <div class="vh-lead-copy">
          <span class="vh-lead-eyebrow">
            ${esc(config.eyebrow)}
          </span>

          <h2>
            ${esc(config.title)}
          </h2>

          <p>
            ${esc(config.text)}
          </p>
        </div>

        <form
          class="vh-lead-form"
          id="vh-lead-form"
          novalidate
        >

          <div class="vh-lead-fields">

            <input
              id="vh-lead-name"
              name="full_name"
              autocomplete="name"
              maxlength="160"
              placeholder="Họ và tên"
              required
            >

            <input
              id="vh-lead-phone"
              name="phone"
              inputmode="tel"
              autocomplete="tel"
              maxlength="20"
              placeholder="Số điện thoại / Zalo"
              required
            >

          </div>

          <input
            id="vh-lead-email"
            name="email"
            type="email"
            autocomplete="email"
            maxlength="220"
            placeholder="Email (không bắt buộc)"
          >

          <input
            class="vh-hp"
            name="company"
            tabindex="-1"
            autocomplete="off"
            aria-hidden="true"
          >

          <button
            id="vh-lead-submit"
            type="submit"
          >
            ${esc(config.button)}
          </button>

          <div class="vh-lead-note">
            Thông tin chỉ dùng để gửi cập nhật
            và liên hệ theo nhu cầu bạn đã đăng ký.
          </div>

          <div
            class="vh-lead-result"
            id="vh-lead-result"
            role="status"
            aria-live="polite"
          ></div>

        </form>

      </div>
    `;

  const liveBlock =
    document.getElementById("vh-live-intelligence");
  
  const footer =
    document.querySelector("footer");
  
  const main =
    document.querySelector("main");
  
  if (
    liveBlock &&
    liveBlock.parentNode
  ) {
    liveBlock.insertAdjacentElement(
      "afterend",
      root
    );
  } else if (
    footer &&
    footer.parentNode
  ) {
    footer.parentNode.insertBefore(
      root,
      footer
    );
  } else if (main) {
    main.appendChild(root);
  } else {
    document.body.appendChild(root);
  }

    document
      .getElementById("vh-lead-form")
      ?.addEventListener(
        "submit",
        submit
      );
  }

  async function submit(ev) {
    ev.preventDefault();

    const form =
      ev.currentTarget;

    const btn =
      document.getElementById(
        "vh-lead-submit"
      );

    const result =
      document.getElementById(
        "vh-lead-result"
      );

    const name =
      String(
        form.full_name?.value || ""
      ).trim();

    const phone =
      String(
        form.phone?.value || ""
      ).trim();

    const email =
      String(
        form.email?.value || ""
      ).trim();

    const company =
      String(
        form.company?.value || ""
      ).trim();

    if (name.length < 2) {
      result.textContent =
        "Bạn nhập giúp họ tên.";
      return;
    }

    if (
      phone.replace(/\D/g, "")
        .length < 9
    ) {
      result.textContent =
        "Bạn kiểm tra lại số điện thoại/Zalo.";
      return;
    }

    const params =
      new URLSearchParams(
        location.search
      );

    const payload = {
      full_name: name,
      phone,
      email,
      company,

      page,

      placement:
        "universal_lead_card",

      intent:
        config.intent,

      session_id:
        getSessionId(),

      referrer:
        document.referrer || "",

      utm_source:
        params.get("utm_source") || "",

      utm_medium:
        params.get("utm_medium") || "",

      utm_campaign:
        params.get("utm_campaign") || ""
    };

    btn.disabled = true;

    btn.textContent =
      "Đang gửi…";

    result.textContent = "";

    try {
      const r =
        await fetch(
          ENDPOINT,
          {
            method: "POST",

            headers: {
              "content-type":
                "application/json"
            },

            body:
              JSON.stringify(payload)
          }
        );

      const d =
        await r
          .json()
          .catch(() => ({}));

      if (
        !r.ok ||
        !d?.ok
      ) {
        throw new Error(
          d?.error ||
          ("HTTP " + r.status)
        );
      }

      result.textContent =
        "Đã nhận thông tin. Võ Hoàng sẽ xem nhu cầu và liên hệ lại khi phù hợp.";

      btn.textContent =
        "Đã gửi";

      form.full_name.disabled = true;
      form.phone.disabled = true;
      form.email.disabled = true;

      btn.disabled = true;

    } catch (_) {
      result.textContent =
        "Chưa gửi được. Bạn thử lại sau ít phút.";

      btn.disabled = false;

      btn.textContent =
        config.button;
    }
  }

  function start() {
    const lower =
      location.pathname.toLowerCase();

    if (
      lower.includes("admin") ||
      lower.includes(
        "tao-ban-tin-moi-gioi"
      )
    ) {
      return;
    }

    mount();
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      { once: true }
    );
  } else {
    start();
  }

})();
