function fixHotStocksMoreLink() {
  const hotSymbols = document.getElementById('vh-hot-symbols');
  if (!hotSymbols) return;

  const card = hotSymbols.closest('.card');
  const link = card?.querySelector('.card-action[href="watchlist.html"]');
  if (!link) return;

  link.setAttribute('href', 'co-phieu-dang-chu-y.html');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', fixHotStocksMoreLink, { once: true });
} else {
  fixHotStocksMoreLink();
}
