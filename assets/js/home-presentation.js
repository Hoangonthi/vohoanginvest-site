(() => {
  "use strict";

  const PAGE = (
    location.pathname.split("/").pop() || "index.html"
  ).toLowerCase();

  if (PAGE !== "index.html" && PAGE !== "") return;

  const ROOT_ID = "vh-home-presentation";

  if (document.getElementById(ROOT_ID)) return;

  const style = document.createElement("style");

  style.id = "vh-home-presentation-style";

  style.textContent = `
    #${ROOT_ID}{
      max-width:1180px;
      margin:34px auto 42px;
      padding:0 20px;
      font-family:"Be Vietnam Pro",Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    }

    #${ROOT_ID} .vh-wrap{
      display:grid;
      gap:18px;
    }

    #${ROOT_ID} .vh-intro{
      text-align:center;
      max-width:840px;
      margin:0 auto 4px;
    }

    #${ROOT_ID} .vh-kicker{
      display:inline-block;
      margin-bottom:10px;
      color:#d5b46b;
      font-size:12px;
      font-weight:800;
      letter-spacing:.12em;
    }

    #${ROOT_ID} h2{
      margin:0;
      color:#f2e7ce;
      font-size:clamp(26px,3.5vw,42px);
      line-height:1.2;
      letter-spacing:-.03em;
    }

    #${ROOT_ID} .vh-intro p{
      margin:13px auto 0;
      max-width:680px;
      color:rgba(255,255,255,.68);
      font-size:15px;
      line-height:1.7;
    }

    #${ROOT_ID} .vh-needs{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:14px;
    }

    #${ROOT_ID} .vh-card{
      border:1px solid rgba(213,180,107,.22);
      border-radius:18px;
      background:rgba(10,16,28,.86);
      padding:20px;
      box-shadow:0 18px 44px rgba(0,0,0,.14);
    }

    #${ROOT_ID} .vh-need-number{
      width:34px;
      height:34px;
      display:grid;
      place-items:center;
      border-radius:999px;
      border:1px solid rgba(213,180,107,.42);
      color:#d5b46b;
      font-weight:800;
      margin-bottom:14px;
    }

    #${ROOT_ID} .vh-card h3{
      margin:0 0 8px;
      color:#fff;
      font-size:18px;
      line-height:1.35;
    }

    #${ROOT_ID} .vh-card p{
      margin:0;
      color:rgba(255,255,255,.62);
      font-size:14px;
      line-height:1.65;
    }

    #${ROOT_ID} .vh-system{
      display:grid;
      grid-template-columns:minmax(0,1.05fr) minmax(330px,.95fr);
      gap:16px;
      align-items:stretch;
    }

    #${ROOT_ID} .vh-system-copy{
      display:flex;
      flex-direction:column;
      justify-content:center;
    }

    #${ROOT_ID} .vh-system-copy h3{
      font-size:26px;
      margin-bottom:10px;
    }

    #${ROOT_ID} .vh-system-copy p{
      max-width:620px;
    }

    #${ROOT_ID} .vh-quote{
      margin-top:16px;
      padding:14px 16px;
      border-left:3px solid rgba(213,180,107,.75);
      background:rgba(213,180,107,.05);
      color:#f2e7ce;
      font-size:15px;
      line-height:1.6;
    }

    #${ROOT_ID} .vh-metrics{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:10px;
    }

    #${ROOT_ID} .vh-metric{
      min-height:92px;
      padding:14px;
      border-radius:14px;
      border:1px solid rgba(255,255,255,.08);
      background:rgba(255,255,255,.035);
    }

    #${ROOT_ID} .vh-metric span{
      display:block;
      color:rgba(255,255,255,.48);
      font-size:12px;
      margin-bottom:8px;
    }

    #${ROOT_ID} .vh-metric strong{
      display:block;
      color:#fff;
      font-size:16px;
      line-height:1.35;
    }

    #${ROOT_ID} .vh-note{
      margin-top:10px;
      color:rgba(255,255,255,.42);
      font-size:12px;
      line-height:1.55;
    }

    #${ROOT_ID} .vh-actions{
      display:flex;
      flex-wrap:wrap;
      gap:10px;
      justify-content:center;
      margin-top:2px;
    }

    #${ROOT_ID} .vh-btn{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-height:44px;
      padding:10px 16px;
      border-radius:11px;
      text-decoration:none;
      font-size:14px;
      font-weight:800;
      transition:.2s ease;
    }

    #${ROOT_ID} .vh-btn-primary{
      background:#d5b46b;
      color:#111827;
    }

    #${ROOT_ID} .vh-btn-secondary{
      border:1px solid rgba(213,180,107,.34);
      color:#f2e7ce;
      background:rgba(255,255,255,.025);
    }

    #${ROOT_ID} .vh-btn:hover{
      transform:translateY(-1px);
    }

    #${ROOT_ID} .vh-ecosystem{
      text-align:center;
      margin-top:4px;
      color:rgba(255,255,255,.42);
      font-size:12px;
    }

    #${ROOT_ID} .vh-ecosystem a{
      color:#d5b46b;
      text-decoration:none;
      font-weight:700;
    }

    @media(max-width:820px){
      #${ROOT_ID}{
        padding:0 14px;
      }

      #${ROOT_ID} .vh-needs,
      #${ROOT_ID} .vh-system{
        grid-template-columns:1fr;
      }
    }

    @media(max-width:520px){
      #${ROOT_ID} .vh-metrics{
        grid-template-columns:1fr 1fr;
      }

      #${ROOT_ID} .vh-card{
        padding:17px;
      }
    }
  `;

  document.head.appendChild(style);

  const root = document.createElement("section");

  root.id = ROOT_ID;

  root.setAttribute(
    "aria-label",
    "Đầu tư có hệ thống và gia tăng tài sản"
  );

  root.innerHTML = `
    <div class="vh-wrap">

      <div class="vh-intro">
        <span class="vh-kicker">
          ĐẦU TƯ CHUẨN HỆ THỐNG
        </span>

        <h2>
          Tiền cần một kế hoạch trước khi cần một mã cổ phiếu.
        </h2>

        <p>
          Mục tiêu không phải đúng mọi lệnh.
          Mục tiêu là giữ được vốn, tạo lợi nhuận
          và gia tăng tài sản theo một cách có thể lặp lại.
        </p>
      </div>

      <div class="vh-needs">

        <article class="vh-card">
          <div class="vh-need-number">1</div>

          <h3>Giữ tiền</h3>

          <p>
            Một quyết định sai không được phép
            làm hỏng cả tài khoản.
            Quản trị vốn đi trước câu chuyện lợi nhuận.
          </p>
        </article>

        <article class="vh-card">
          <div class="vh-need-number">2</div>

          <h3>Sinh lời</h3>

          <p>
            Tiền nhàn rỗi phải có nhiệm vụ rõ ràng:
            đầu tư, chờ cơ hội hay giữ an toàn.
          </p>
        </article>

        <article class="vh-card">
          <div class="vh-need-number">3</div>

          <h3>Gia tăng tài sản</h3>

          <p>
            Không nhìn một lệnh.
            Nhìn cả hành trình:
            tỷ trọng, dòng tiền, rủi ro
            và hiệu quả theo thời gian.
          </p>
        </article>

      </div>

      <div class="vh-system">

        <article class="vh-card vh-system-copy">
          <span class="vh-kicker">
            DANH MỤC THEO HỆ THỐNG
          </span>

          <h3>
            Không phải danh sách phím hàng.
          </h3>

          <p>
            Một danh mục cần cho thấy
            tiền đang nằm ở đâu,
            tỷ trọng bao nhiêu,
            mức rủi ro thế nào
            và khi nào cần thay đổi.
          </p>

          <div class="vh-quote">
            “Không cần đúng mọi lần.
            Cần sai nhỏ và đúng đủ lớn.”
          </div>
        </article>

        <article class="vh-card">

          <div class="vh-metrics">

            <div class="vh-metric">
              <span>Tỷ trọng cổ phiếu</span>
              <strong>
                Quản trị theo kế hoạch
              </strong>
            </div>

            <div class="vh-metric">
              <span>Tiền mặt</span>
              <strong>
                Luôn có vai trò rõ ràng
              </strong>
            </div>

            <div class="vh-metric">
              <span>Rủi ro danh mục</span>
              <strong>
                Được theo dõi trước lợi nhuận
              </strong>
            </div>

            <div class="vh-metric">
              <span>Hiệu quả</span>
              <strong>
                Đo theo thời gian,
                không theo cảm giác
              </strong>
            </div>

          </div>

          <div class="vh-note">
            Khối này chưa hiển thị số liệu hiệu suất giả.
            Khi có dữ liệu danh mục thật,
            có thể nối trực tiếp vào đây.
          </div>

        </article>

      </div>

      <div class="vh-actions">

        <a
          class="vh-btn vh-btn-primary"
          href="kiem-tra-nhanh-tai-khoan.html"
        >
          Kiểm tra tình trạng đầu tư
        </a>

        <a
          class="vh-btn vh-btn-secondary"
          href="sang-nay-can-nhin-gi.html"
        >
          Xem bản tin sáng
        </a>

      </div>

      <div class="vh-ecosystem">
        Một sản phẩm khác trong hệ sinh thái Võ Hoàng:

        <a
          href="https://onthiplus.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Ôn Thi Plus
        </a>
      </div>

    </div>
  `;

  const hero =
    document.querySelector("main");

  const firstSection =
    hero?.querySelector("section");

  if (
    firstSection &&
    firstSection.parentNode
  ) {
    firstSection.insertAdjacentElement(
      "afterend",
      root
    );
  } else if (hero) {
    hero.prepend(root);
  } else {
    document.body.prepend(root);
  }

})();
