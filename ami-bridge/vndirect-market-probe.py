import json
import re
import sys
import threading
import time
from datetime import datetime

try:
    import paho.mqtt.client as mqtt
except Exception as exc:
    print(json.dumps({"ok": False, "error": f"PAHO_IMPORT:{exc}"}, ensure_ascii=False))
    sys.exit(2)

HOST = "price-streaming-free.vndirect.com.vn"
PORT = 443
PATH = "/mqtt"
USERNAME = "1d84f25b561f2575"
TOPIC_MAP = {
    "MI/10": "VN-INDEX",
    "MI/11": "VN30",
    "MI/03": "UPCOM-INDEX",
    "MI/02": "HNX-INDEX",
    "MI/13": "VNXALL",
    "MI/VN100": "VN100",
}
QUOTED = re.compile(r'"(.*?)"')


def to_float(value):
    try:
        if value in (None, ""):
            return None
        return float(value)
    except Exception:
        return None


def decode_fields(encoded):
    try:
        decoded = "".join(chr(ord(ch) + (i % 5)) for i, ch in enumerate(encoded))
        return decoded.split("|")
    except Exception:
        return []


def parse_mi_fields(fields):
    # Expected: MI | floorCode | tradingTime | status | advance | noChange |
    # decline | marketIndex | priorMarketIndex | totalShareTraded |
    # totalValueTraded | ...
    if not fields or fields[0] != "MI" or len(fields) < 11:
        return None
    body = fields[1:]
    return {
        "floor_code": body[0] if len(body) > 0 else None,
        "trading_time": body[1] if len(body) > 1 else None,
        "status": body[2] if len(body) > 2 else None,
        "advance": to_float(body[3] if len(body) > 3 else None),
        "no_change": to_float(body[4] if len(body) > 4 else None),
        "decline": to_float(body[5] if len(body) > 5 else None),
        "market_index": to_float(body[6] if len(body) > 6 else None),
        "prior_market_index": to_float(body[7] if len(body) > 7 else None),
        "total_share_traded": to_float(body[8] if len(body) > 8 else None),
        "total_value_traded": to_float(body[9] if len(body) > 9 else None),
        # Keep trailing fields for diagnostics only; the sync does not use them.
        "ceiling_stock": to_float(body[10] if len(body) > 10 else None),
        "floor_stock": to_float(body[11] if len(body) > 11 else None),
    }


def parse_payload(raw):
    text = raw.decode("utf-8", errors="replace") if isinstance(raw, (bytes, bytearray)) else str(raw)

    # Newer free feed: encoded messages embedded in quoted strings.
    candidates = QUOTED.findall(text)
    for encoded in candidates:
        item = parse_mi_fields(decode_fields(encoded))
        if item:
            return item

    # Compatibility path for plain JSON / pipe payloads.
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            if "totalValueTraded" in obj:
                return {
                    "floor_code": obj.get("floorCode"),
                    "trading_time": obj.get("tradingTime"),
                    "status": obj.get("status"),
                    "advance": to_float(obj.get("advance")),
                    "no_change": to_float(obj.get("noChange")),
                    "decline": to_float(obj.get("decline")),
                    "market_index": to_float(obj.get("marketIndex")),
                    "prior_market_index": to_float(obj.get("priorMarketIndex")),
                    "total_share_traded": to_float(obj.get("totalShareTraded")),
                    "total_value_traded": to_float(obj.get("totalValueTraded")),
                    "ceiling_stock": to_float(obj.get("ceilingStock")),
                    "floor_stock": to_float(obj.get("floorStock")),
                }
            data = obj.get("data")
            if isinstance(data, str) and "|" in data:
                fields = data.split("|")
                if fields and fields[0] != "MI":
                    fields = ["MI"] + fields
                item = parse_mi_fields(fields)
                if item:
                    return item
    except Exception:
        pass

    if "|" in text:
        fields = text.strip().split("|")
        item = parse_mi_fields(fields)
        if item:
            return item
    return None


def make_client(userdata):
    client_id = f"vh-market-probe-{int(time.time())}"
    try:
        client = mqtt.Client(
            mqtt.CallbackAPIVersion.VERSION2,
            client_id=client_id,
            userdata=userdata,
            protocol=mqtt.MQTTv5,
            transport="websockets",
        )
    except Exception:
        client = mqtt.Client(client_id=client_id, userdata=userdata, protocol=mqtt.MQTTv311, transport="websockets")
    client.username_pw_set(USERNAME)
    client.ws_set_options(path=PATH)
    client.tls_set()
    return client


def main():
    state = {
        "connected": threading.Event(),
        "rows": {},
        "errors": [],
    }
    client = make_client(state)

    def on_connect(c, userdata, flags, reason_code, properties=None):
        userdata["connected"].set()
        c.subscribe([(topic, 0) for topic in TOPIC_MAP])

    def on_message(c, userdata, msg):
        item = parse_payload(msg.payload)
        symbol = TOPIC_MAP.get(msg.topic)
        if not item or not symbol:
            return
        item["symbol"] = symbol
        item["topic"] = msg.topic
        item["received_at"] = datetime.now().isoformat(timespec="seconds")
        userdata["rows"][symbol] = item

    def on_disconnect(c, userdata, *args):
        pass

    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect

    try:
        client.connect(HOST, PORT, keepalive=30)
        client.loop_start()
        if not state["connected"].wait(10):
            raise RuntimeError("CONNECT_TIMEOUT")

        deadline = time.time() + 12
        expected = set(TOPIC_MAP.values())
        while time.time() < deadline:
            if expected.issubset(state["rows"].keys()):
                break
            time.sleep(0.20)

        rows = [state["rows"][s] for s in TOPIC_MAP.values() if s in state["rows"]]
        value_rows = [r for r in rows if r.get("total_value_traded") not in (None, 0)]
        print(json.dumps({
            "ok": bool(rows),
            "provider": "VNDIRECT realtime MI feed",
            "row_count": len(rows),
            "value_count": len(value_rows),
            "rows": rows,
        }, ensure_ascii=False))
        return 0 if rows else 3
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)[:500]}, ensure_ascii=False))
        return 4
    finally:
        try:
            client.loop_stop()
            client.disconnect()
        except Exception:
            pass


if __name__ == "__main__":
    sys.exit(main())
