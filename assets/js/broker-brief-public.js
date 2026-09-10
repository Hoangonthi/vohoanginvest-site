(() => {
  "use strict";

  const ENDPOINT = "https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/broker-brief-public";

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (m) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[m]));
  }

  function ensureStyles() {
    if (document.getElementById("vh-broker-news-style")) return;
    const style = document.createElement("style");
    style.id = "vh-broker-news-style";
    style.textContent = `
      #vh-broker-news{margin:22px 0 28px}
      #vh-broker-news .vh-bn-shell{
        background:linear-gradient(180deg,rgba(17,25,39,.96),rgba(11,18,31,.96));
        border:1px solid rgba(214,180,106,.24);
        border-radius:20px;
        padding:22px;
        box-shadow:0 18px 46px rgba(0,0,0,.16)
      }
      #vh-broker-news .vh-bn-kicker{
        display:block;
        margin-bottom:8px;
        color:#d8b76f;
        font-family:"Be Vietnam Pro",system-ui,sans-serif;
        font-size:12px;
        font-weight:700;
        letter-spacing:.12em
      }
      #vh-broker-news .vh-bn-headline{
        margin:0 0 18px;
        color:#f5f0e6;
        font-family:"Be Vietnam Pro",system-ui,sans-serif;
        font-size:22px;
        line-height:1.45;
        font-weight:700;
        letter-spacing:-.015em
      }
      #vh-broker-news .vh-bn-list{display:grid;gap:12px}
      #vh-broker-news .vh-bn-item{
        padding:14px 0;
        border-top:1px solid rgba(255,255,255,.08)
      }
      #vh-broker-news .vh-bn-item:first-child{border-top:0;padding-top:0}
      #vh-broker-news .vh-bn-title{
        color:#fff;
        text-decoration:none;
        font-size:15px;
        line-height:1.55;
        font-weight:700
      }
      #vh-broker-news .vh-bn-title:hover{color:#e4c57e}
      #vh-broker-news .vh-bn-meta{
        margin-top:5px;
        color:rgba(255,255,255,.48);
        font-size:12px
      }
      #vh-broker-news .vh-bn-summary{
        margin:7px 0 0;
        color:rgba(255,255,255,.72);
        font-size:13px;
        line-height:1.6
      }
      @media(max-width:760px){
        #vh-broker-news .vh-bn-shell{padding:18px}
        #vh-broker-news .vh-bn-headline{font-size:19px}
      }
    `;
    document.head.appendChild(style);
  }

  function mount() {
    let root = document.getElementById("vh-broker-news");
    if (root) return root;

    root = document.createElement("section");
    root.id = "vh-broker-news";
    root.hidden = true;

    const metrics = document.querySelector(".ih-metrics");
    if (metrics?.parentNode) metrics.insertAdjacentElement("afterend", root);
    else {
      const main = document.querySelector("main");
      if (main) main.prepend(root);
      else document.body.appendChild(root);
    }
    return root;
  }

  async function load() {
    ensureStyles();
    const root = mount();

    try {
      const r = await fetch(ENDPOINT, { cache: "no-store" });
      if (!r.ok) return;
      const data = await r.json();
      if (!data?.ok || !data?.brief || !Array.isArray(data.items) || data.items.length === 0) return;

      const b = data.brief;
      const items = data.items.slice(0, 7);

      root.innerHTML = `
        <div class="vh-bn-shell">
          <span class="vh-bn-kicker">TIN CHÍNH DÀNH CHO MÔI GIỚI</span>
          <h2 class="vh-bn-headline">${esc(b.headline || "Những thông tin cần chú ý sáng nay")}</h2>
          <div class="vh-bn-list">
            ${items.map((x) => {
              const title = esc(x.title_snapshot || "");
              const source = esc(x.source_name_snapshot || "");
              const summary = x.compact_summary_snapshot ? `<p class="vh-bn-summary">${esc(x.compact_summary_snapshot)}</p>` : "";
              const href = x.source_url_snapshot ? esc(x.source_url_snapshot) : "";
              const titleHtml = href
                ? `<a class="vh-bn-title" href="${href}" target="_blank" rel="noopener noreferrer">${title}</a>`
                : `<div class="vh-bn-title">${title}</div>`;
              return `<article class="vh-bn-item">${titleHtml}<div class="vh-bn-meta">${source}</div>${summary}</article>`;
            }).join("")}
          </div>
        </div>
      `;
      root.hidden = false;
    } catch (_) {
      // Không có bản PUBLISHED hoặc mạng lỗi: không làm ảnh hưởng phần còn lại của trang.
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load, { once: true });
  } else {
    load();
  }
})();