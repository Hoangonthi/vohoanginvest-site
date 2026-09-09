import json
import sys
from datetime import datetime

INDEX_MAP = {
    "VN-INDEX": "VNINDEX",
    "VN30": "VN30",
    "VN100": "VN100",
    "HNX-INDEX": "HNXINDEX",
    "UPCOM-INDEX": "UPCOMINDEX",
}


def safe_num(row, key):
    try:
        v = row.get(key)
        if v is None:
            return None
        if hasattr(v, "item"):
            v = v.item()
        if isinstance(v, float) and (v != v):
            return None
        return float(v)
    except Exception:
        return None


def norm_date(v):
    if v is None:
        return None
    try:
        if hasattr(v, "strftime"):
            return v.strftime("%Y-%m-%d")
        s = str(v)
        return s[:10]
    except Exception:
        return None


def fetch_one(market, ui_symbol, vn_symbol):
    try:
        df = market.index(vn_symbol).trade_history()
        if df is None or len(df) == 0:
            return {"symbol": ui_symbol, "ok": False, "error": "EMPTY"}

        # Prefer today's row; otherwise use the latest row returned.
        today = datetime.now().strftime("%Y-%m-%d")
        work = df
        try:
            if "trading_date" in work.columns:
                dates = work["trading_date"].astype(str).str[:10]
                today_rows = work[dates == today]
                if len(today_rows):
                    work = today_rows
        except Exception:
            pass

        row = work.iloc[-1].to_dict()
        matched_value = safe_num(row, "matched_value")
        total_value = safe_num(row, "total_value")
        matched_volume = safe_num(row, "matched_volume")
        total_volume = safe_num(row, "total_volume")
        adv = safe_num(row, "total_stock_up_price")
        dec = safe_num(row, "total_stock_down_price")
        flat = safe_num(row, "total_stock_no_change_price")
        ceiling = safe_num(row, "total_stock_ceiling")
        floor = safe_num(row, "total_stock_floor")

        return {
            "symbol": ui_symbol,
            "ok": True,
            "provider_symbol": vn_symbol,
            "trading_date": norm_date(row.get("trading_date")),
            "matched_value": matched_value,
            "total_value": total_value,
            "matched_volume": matched_volume,
            "total_volume": total_volume,
            "advance": int(adv) if adv is not None else None,
            "steady": int(flat) if flat is not None else None,
            "decline": int(dec) if dec is not None else None,
            "ceiling": int(ceiling) if ceiling is not None else None,
            "floor": int(floor) if floor is not None else None,
        }
    except Exception as exc:
        return {"symbol": ui_symbol, "ok": False, "error": str(exc)[:300]}


def main():
    try:
        from vnstock import Market
    except Exception as exc:
        print(json.dumps({"ok": False, "error": f"VNSTOCK_IMPORT:{exc}"}, ensure_ascii=False))
        return 2

    try:
        market = Market()
        rows = [fetch_one(market, ui, vn) for ui, vn in INDEX_MAP.items()]
        ok_count = sum(1 for r in rows if r.get("ok"))
        print(json.dumps({
            "ok": ok_count > 0,
            "provider": "Vnstock Unified UI public API",
            "guest_mode": True,
            "summaries": rows,
        }, ensure_ascii=False))
        return 0 if ok_count > 0 else 3
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)[:500]}, ensure_ascii=False))
        return 4


if __name__ == "__main__":
    sys.exit(main())
