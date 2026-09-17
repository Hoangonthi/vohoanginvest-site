const HOT_STOCKS_URL = 'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/hot-stocks-feed';
const HOT_STOCKS_DETAIL_URL = 'co-phieu-dang-chu-y.html';

let cachedRows = [];
let cachedFresh = false;
let observer = null;
let resizeTimer = 0;

function injectStyles(){
  if(document.getElementById('vh-hotstocks-card-v2-style')) return;
  const style = document.createElement('style');
  style.id = 'vh-hotstocks-card-v2-style';
  style.textContent = `
    /* Hot stocks: dùng hết diện tích card thay vì khóa 1 hàng */
    .hot-card .hot-pills{
      display:flex!important;
      flex-wrap:wrap!important;
      align-content:flex-start!important;
      gap:8px!important;
      margin-top:12px!important;
      padding-right:0!important;
      overflow:visible!important;
      max-height:none!important;
    }
    .hot-card .stock-pill{
      min-width:54px!important;
      width:auto!important;
      height:34px!important;
      padding:0 11px!important;
      border-radius:10px!important;
      border:1px solid rgba(255,255,255,.10)!important;
      background:rgba(255,255,255,.035)!important;
      color:#d8e1ea!important;
      font-size:13px!important;
      font-weight:900!important;
      letter-spacing:.02em!important;
      box-shadow:none!important;
    }
    .hot-card .stock-pill.is-strong{
      color:#55e59b!important;
      border-color:rgba(53,224,139,.34)!important;
      background:rgba(53,224,139,.10)!important;
      box-shadow:inset 0 0 0 1px rgba(53,224,139,.035)!important;
    }
    .hot-card .stock-pill.is-forming{
      color:#f3cf74!important;
      border-color:rgba(224,187,99,.30)!important;
      background:rgba(224,187,99,.085)!important;
    }
    .hot-card .stock-pill.is-neutral{
      color:#cbd5df!important;
      border-color:rgba(255,255,255,.10)!important;
      background:rgba(255,255,255,.035)!important;
    }
    .hot-card .vh-hot-legend{
      display:flex;
      align-items:center;
      flex-wrap:wrap;
      gap:10px 14px;
      margin-top:10px;
      color:var(--muted-2,rgba(231,237,246,.56));
      font-size:10.5px;
      line-height:1.4;
    }
    .hot-card .vh-hot-legend span{display:inline-flex;align-items:center;gap:6px}
    .hot-card .vh-hot-dot{width:7px;height:7px;border-radius:50%;display:inline-block}
    .hot-card .vh-hot-dot.strong{background:#35e08b;box-shadow:0 0 0 3px rgba(53,224,139,.09)}
    .hot-card .vh-hot-dot.forming{background:#e0bb63;box-shadow:0 0 0 3px rgba(224,187,99,.08)}
    .hot-card .card-action.vh-hot-more{
      white-space:nowrap;
    }
    @media(max-width:680px){
      .hot-card .hot-pills{
        flex-wrap:wrap!important;
        overflow:visible!important;
        gap:6px!important;
      }
      .hot-card .stock-pill{
        height:32px!important;
        padding:0 9px!important;
        font-size:12px!important;
      }
      .hot-card .vh-hot-legend{font-size:9.5px;gap:8px 11px}
    }
  `;
  document.head.appendChild(style);
}

function getElements(){
  const root = document.getElementById('vh-hot-symbols');
  if(!root) return {};
  const card = root.closest('.hot-card') || root.closest('.card');
  const status = document.getElementById('vh-hot-status');
  const more = card?.querySelector('.card-action');
  return { root, card, status, more };
}

function visibleLimit(card){
  if(!card) return 12;
  const width = card.getBoundingClientRect().width || window.innerWidth;
  if(width >= 760) return 24;
  if(width >= 620) return 20;
  if(width >= 500) return 18;
  if(width >= 390) return 14;
  return 10;
}

function rowClass(row){
  const signal = String(row?.signal_class || '').toUpperCase();
  if(signal.includes('MANH')) return 'is-strong';
  if(signal.includes('THAM')) return 'is-forming';
  return 'is-neutral';
}

function safeSymbol(value){
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10);
}

function ensureLegend(card, strongCount, formingCount){
  if(!card) return;
  let legend = card.querySelector('.vh-hot-legend');
  if(!legend){
    legend = document.createElement('div');
    legend.className = 'vh-hot-legend';
    const note = card.querySelector('.ps-note');
    if(note) note.before(legend);
    else card.appendChild(legend);
  }
  legend.innerHTML = `
    <span><i class="vh-hot-dot strong"></i>Mạnh ${strongCount}</span>
    <span><i class="vh-hot-dot forming"></i>Đang hình thành ${formingCount}</span>
  `;
}

function renderCached(){
  const { root, card, status, more } = getElements();
  if(!root || !cachedRows.length) return;

  const limit = visibleLimit(card);
  const visible = cachedRows.slice(0, limit);
  const hiddenCount = Math.max(0, cachedRows.length - visible.length);
  const strongCount = cachedRows.filter(r=>String(r?.signal_class||'').toUpperCase().includes('MANH')).length;
  const formingCount = cachedRows.filter(r=>String(r?.signal_class||'').toUpperCase().includes('THAM')).length;

  if(observer) observer.disconnect();

  root.innerHTML = visible.map(row=>{
    const symbol = safeSymbol(row?.symbol);
    const score = Number(row?.t_score);
    const signal = String(row?.signal_class||'').toUpperCase();
    const label = signal.includes('MANH') ? 'Tín hiệu mạnh' : signal.includes('THAM') ? 'Đang hình thành' : 'Theo dõi';
    const title = Number.isFinite(score) ? `${symbol} · ${label} · Điểm T+ ${score}` : `${symbol} · ${label}`;
    return `<span class="stock-pill ${rowClass(row)}" title="${title}">${symbol}</span>`;
  }).join('');

  if(status){
    status.textContent = `${cachedFresh ? 'Realtime' : 'Dữ liệu cuối cùng'} · ${cachedRows.length} mã`;
  }

  if(more){
    more.href = HOT_STOCKS_DETAIL_URL;
    more.classList.add('vh-hot-more');
    more.textContent = hiddenCount > 0 ? `Xem thêm ${hiddenCount} mã →` : 'Xem chi tiết →';
  }

  ensureLegend(card, strongCount, formingCount);

  if(observer) observer.observe(root,{childList:true,subtree:true});
}

async function loadHotStocksEnhanced(){
  try{
    const response = await fetch(`${HOT_STOCKS_URL}?card=2&t=${Date.now()}`,{
      cache:'no-store',
      headers:{Accept:'application/json'}
    });
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const rows = Array.isArray(data?.stocks) ? data.stocks : [];
    cachedRows = rows
      .filter(row=>/^[A-Z]{3,5}$/.test(safeSymbol(row?.symbol)))
      .sort((a,b)=>{
        const rank = x=>String(x?.signal_class||'').toUpperCase().includes('MANH') ? 2 : String(x?.signal_class||'').toUpperCase().includes('THAM') ? 1 : 0;
        return rank(b)-rank(a) || Number(b?.t_score||0)-Number(a?.t_score||0) || Number(b?.change_pct||0)-Number(a?.change_pct||0);
      });
    cachedFresh = data?.fresh === true;
    renderCached();
  }catch(error){
    console.warn('Hot-stocks enhanced card:',error);
  }
}

function start(){
  injectStyles();
  const { root } = getElements();
  if(!root){
    window.setTimeout(start,120);
    return;
  }

  observer = new MutationObserver(()=>{
    if(!cachedRows.length) return;
    window.clearTimeout(window.__vhHotStocksRepairTimer);
    window.__vhHotStocksRepairTimer = window.setTimeout(renderCached,30);
  });
  observer.observe(root,{childList:true,subtree:true});

  loadHotStocksEnhanced();
  window.setInterval(loadHotStocksEnhanced,30000);
  window.addEventListener('resize',()=>{
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(renderCached,120);
  },{passive:true});
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded',start,{once:true});
}else{
  start();
}
