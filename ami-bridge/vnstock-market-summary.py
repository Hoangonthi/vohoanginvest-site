import json
import sys
from datetime import datetime

INDEX_MAP = {
    "VN-INDEX": "VNINDEX",
    "VN30": "VN30",
    "VN100": "VN100",
    "VNXALL": "VNXALL",
    "HNX-INDEX": "HNXINDEX",
    "UPCOM-INDEX": "UPCOMINDEX",
}


def safe_num(row, *keys):
    for key in keys:
        try:
            v = row.get(key)
            if v is None:
                continue
            if hasattr(v, "item"):
                v = v.item()
            if isinstance(v, float) and (v != v):
                continue
            return float(v)
        except Exception:
            continue
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


def choose_latest_row(df):
    if df is None or len(df) == 0:
        return None

    work = df
    today = datetime.now().strftime("%Y-%m-%d")
    try:
        for date_col in ("trading_date", "time", "date"):
            if date_col in work.columns:
                dates = work[date_col].astype(str).str[:10]
                today_rows = work[dates == today]
                if len(today_rows):
                    work = today_rows
                    break
    except Exception:
        pass

    try:
        return work.iloc[-1].to_dict()
    except Exception:
        return None


def fetch_dataframe(index_obj, method_name):
    try:
        method = getattr(index_obj, method_name, None)
        if not callable(method):
            return None
        return method()
    except TypeError:
        # Some versions require date boundaries for trade_history.
        try:
            today = datetime.now().strftime("%Y-%m-%d")
            return method(start=today, end=today)
        except Exception:
            return None
    except Exception:
        return None


def fetch_one(market, ui_symbol, vn_symbol):
    try:
        index_obj = market.index(vn_symbol)

        # summary() is the best fit for live index turnover/breadth when available.
        # Fall back to trade_history(), then quote() for compatibility across vnstock versions.
        row = None
        provider_method = None
        for method_name in ("summary", "trade_history", "quote"):
            df = fetch_dataframe(index_obj, method_name)
            candidate = choose_latest_row(df)
            if candidate:
                row = candidate
                provider_method = method_name
                break

        if row is None:
            return {"symbol": ui_symbol, "ok": False, "error": "EMPTY"}

        matched_value = safe_num(
            row,
            "matched_value",
            "match_value",
            "total_match_value",
            "total_matched_value",
            "value_matched",
        )
        total_value = safe_num(
            row,
            "total_value",
            "trade_value",
            "total_trade_value",
            "value",
        )
        matched_volume = safe_num(
            row,
            "matched_volume",
            "match_volume",
            "total_match_volume",
            "total_matched_volume",
        )
        total_volume = safe_num(
            row,
            "total_volume",
            "trade_volume",
            "volume",
            "volume_accumulated",
        )
        adv = safe_num(row, "total_stock_up_price", "advance", "advances", "up")
        dec = safe_num(row, "total_stock_down_price", "decline", "declines", "down")
        flat = safe_num(row, "total_stock_no_change_price", "steady", "no_change", "unchanged")
        ceiling = safe_num(row, "total_stock_ceiling", "ceiling")
        floor = safe_num(row, "total_stock_floor", "floor")

        trading_date = None
        for key in ("trading_date", "time", "date"):
            if row.get(key) is not None:
                trading_date = norm_date(row.get(key))
                break

        return {
            "symbol": ui_symbol,
            "ok": True,
            "provider_symbol": vn_symbol,
            "provider_method": provider_method,
            "trading_date": trading_date,
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
        value_count = sum(
            1
            for r in rows
            if r.get("ok") and (r.get("matched_value") is not None or r.get("total_value") is not None)
        )
        print(
            json.dumps(
                {
                    "ok": ok_count > 0,
                    "provider": "Vnstock Unified UI public API",
                    "guest_mode": True,
                    "ok_count": ok_count,
                    "value_count": value_count,
                    "summaries": rows,
                },
                ensure_ascii=False,
            )
        )
        return 0 if ok_count > 0 else 3
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)[:500]}, ensure_ascii=False))
        return 4


if __name__ == "__main__":
    sys.exit(main())
