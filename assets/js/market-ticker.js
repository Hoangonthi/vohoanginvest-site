(() => {
  "use strict";

  const wrapperSrc = document.currentScript?.src || new URL("assets/js/market-ticker.js", document.baseURI).href;

  async function ensureSharedLayout() {
    if (document.querySelector('script[src*="site-header.js"]')) return;

    if (!window.supabase?.createClient) {
      await new Promise((resolve, reject) => {
        const existing = document.querySelector('script[src*="@supabase/supabase-js"]');
        if (existing) {
          if (window.supabase?.createClient) return resolve();
          existing.addEventListener("load", resolve, { once:true });
          existing.addEventListener("error", reject, { once:true });
          return;
        }

        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    await import(new URL("./site-header.js?v=20260913-3", wrapperSrc).href);
  }

  ensureSharedLayout().catch((error) => {
    console.warn("[shared-layout] Không thể tải layout dùng chung", error);
  });

  const core = document.createElement("script");
  core.src = new URL("./market-ticker-core.js?v=20260911-2", wrapperSrc).href;
  core.defer = true;
  document.head.appendChild(core);
})();
