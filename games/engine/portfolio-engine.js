export class PortfolioEngine {
  constructor({ cash = 600_000_000, marginLimit = 0.5 } = {}) {
    this.initialEquity = cash;
    this.cash = cash;
    this.marginDebt = 0;
    this.marginLimit = marginLimit;
    this.holdings = {};
    this.stopByAsset = {};
    this.equityPeak = cash;
    this.maxDrawdown = 0;
    this.ruleBreaks = 0;
    this.lossStreak = 0;
    this.maxLossStreak = 0;
    this.realizedPnL = 0;
    this.maxMarginUsage = 0;
    this.maxExposure = 0;
  }
  position(asset) { return this.holdings[asset] || { qty:0, avg:0 }; }
  marketValue(prices) { return Object.entries(this.holdings).reduce((s,[a,p]) => s + p.qty*(prices[a]||0), 0); }
  equity(prices) { return this.cash + this.marketValue(prices) - this.marginDebt; }
  buyingPower(prices) {
    const eq = Math.max(0, this.equity(prices));
    const maxDebt = eq * this.marginLimit;
    return Math.max(0, this.cash + (maxDebt - this.marginDebt));
  }
  buy(asset, amount, price, useMargin = false, prices = {}) {
    amount = Math.max(0, Number(amount)||0);
    if (!amount || !price) return false;
    const bp = this.buyingPower(prices);
    amount = Math.min(amount, bp);
    let cashUse = Math.min(this.cash, amount);
    let debtUse = useMargin ? Math.max(0, amount-cashUse) : 0;
    if (!useMargin) amount = cashUse;
    if (amount <= 0) return false;
    const qty = amount/price;
    const old = this.position(asset);
    const newQty = old.qty + qty;
    const avg = newQty ? (old.qty*old.avg + qty*price)/newQty : 0;
    this.cash -= cashUse;
    this.marginDebt += debtUse;
    this.holdings[asset] = { qty:newQty, avg };
    this._updateRisk(prices);
    return true;
  }
  sell(asset, fraction, price, prices = {}) {
    const p = this.position(asset);
    fraction = Math.min(1, Math.max(0, Number(fraction)||0));
    if (!p.qty || !fraction || !price) return false;
    const qty = p.qty*fraction;
    const proceeds = qty*price;
    const pnl = qty*(price-p.avg);
    this.realizedPnL += pnl;
    if (pnl < 0) { this.lossStreak += 1; this.maxLossStreak = Math.max(this.maxLossStreak,this.lossStreak); }
    else if (pnl > 0) this.lossStreak = 0;
    let debtPay = Math.min(this.marginDebt, proceeds);
    this.marginDebt -= debtPay;
    this.cash += proceeds-debtPay;
    p.qty -= qty;
    if (p.qty < 1e-8) delete this.holdings[asset]; else this.holdings[asset] = p;
    this._updateRisk(prices);
    return true;
  }
  setStop(asset, price) { if (price > 0) this.stopByAsset[asset] = Number(price); else delete this.stopByAsset[asset]; }
  checkStops(prices) {
    const hit=[];
    for (const [asset,stop] of Object.entries(this.stopByAsset)) if (this.position(asset).qty && (prices[asset]||Infinity) <= stop) hit.push(asset);
    return hit;
  }
  _updateRisk(prices) {
    const eq = Math.max(1, this.equity(prices));
    this.equityPeak = Math.max(this.equityPeak, eq);
    this.maxDrawdown = Math.max(this.maxDrawdown, (this.equityPeak-eq)/this.equityPeak);
    this.maxMarginUsage = Math.max(this.maxMarginUsage, this.marginDebt/eq);
    this.maxExposure = Math.max(this.maxExposure, this.marketValue(prices)/eq);
  }
  snapshot(prices) {
    this._updateRisk(prices);
    const equity=this.equity(prices);
    return { cash:this.cash, marginDebt:this.marginDebt, holdings:structuredClone(this.holdings), equity, buyingPower:this.buyingPower(prices), returnPct:(equity/this.initialEquity-1)*100, maxDrawdownPct:this.maxDrawdown*100, marginUsagePct:(this.marginDebt/Math.max(1,equity))*100, exposurePct:(this.marketValue(prices)/Math.max(1,equity))*100, maxMarginUsagePct:this.maxMarginUsage*100, maxExposurePct:this.maxExposure*100, ruleBreaks:this.ruleBreaks, maxLossStreak:this.maxLossStreak, realizedPnL:this.realizedPnL };
  }
}
