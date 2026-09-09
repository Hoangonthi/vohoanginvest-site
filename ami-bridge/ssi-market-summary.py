import json, os, sys


def out(obj):
    print(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))

client_id = os.getenv("VH_SSI_CLIENT_ID", "").strip()
api_key = os.getenv("VH_SSI_API_KEY", "").strip()
api_secret = os.getenv("VH_SSI_API_SECRET", "").strip()
if not (client_id and api_key and api_secret):
    out({"ok": False, "error": "SSI_CREDENTIALS_MISSING"})
    sys.exit(2)

try:
    from ssi_sdk import Auth, Data, Config
except Exception as e:
    out({"ok": False, "error": "SSI_SDK_MISSING", "detail": str(e)})
    sys.exit(3)

try:
    cfg = Config(client_id=client_id, api_key=api_key, api_secret=api_secret)
    rows = []
    # Try common index codes exposed by SSI. Keep failures isolated so one code
    # cannot block the whole market feed.
    candidates = [
        ("VN-INDEX", ["VNINDEX"]),
        ("VN30", ["VN30"]),
        ("HNX-INDEX", ["HNXIndex", "HNXINDEX"]),
        ("UPCOM-INDEX", ["UpcomIndex", "UPCOMINDEX", "UPCOMIndex"]),
    ]
    with Auth(cfg) as auth:
        auth.authenticate()
        with Data(auth) as data:
            for symbol, codes in candidates:
                summary = None
                used = None
                err = None
                for code in codes:
                    try:
                        summary = data.market_data.get_index_summary(code)
                        used = code
                        if summary is not None:
                            break
                    except Exception as e:
                        err = str(e)
                if summary is None:
                    rows.append({"symbol": symbol, "ok": False, "error": err or "NO_SUMMARY"})
                    continue
                def g(name, default=None):
                    return getattr(summary, name, default)
                rows.append({
                    "symbol": symbol,
                    "ok": True,
                    "source_code": used,
                    "trading_date": g("trading_date"),
                    "index_value": g("index_value"),
                    "index_change": g("index_change"),
                    "index_change_percent": g("index_change_percent"),
                    "total_trade": g("total_trade"),
                    "total_trade_value": g("total_trade_value"),
                    "total_match": g("total_match"),
                    "total_match_value": g("total_match_value"),
                    "advance": g("total_advance_stock"),
                    "steady": g("total_steady_stock"),
                    "decline": g("total_decline_stock"),
                    "ceiling": g("total_ceiling_stock"),
                    "floor": g("total_floor_stock"),
                    "prop_buy": g("total_prop_buy"),
                    "prop_buy_value": g("total_prop_buy_value"),
                    "prop_sell": g("total_prop_sell"),
                    "prop_sell_value": g("total_prop_sell_value"),
                })
    out({"ok": True, "source": "SSI FastConnect", "summaries": rows})
except Exception as e:
    out({"ok": False, "error": "SSI_FETCH_FAILED", "detail": str(e)})
    sys.exit(4)
