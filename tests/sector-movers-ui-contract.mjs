import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const js = readFileSync("assets/js/market-reader.js", "utf8");
const html = readFileSync("thi-truong-hom-nay.html", "utf8");

assert.match(js, /meta\?\.gainers_all/, "UI must prefer real full gainers");
assert.match(js, /meta\?\.losers_all/, "UI must prefer real full losers");
assert.match(js, /items\.slice\(0,3\)/, "visible mover list must be capped at three");
assert.match(js, /items\.slice\(3\)/, "popover must contain only remaining movers");
assert.match(js, /side==="up"\?"Tăng":"Giảm"/, "mover rows must be labelled Tăng/Giảm");
assert.match(js, /stock-detail\.html\?symbol=\$\{encodeURIComponent\(item\.symbol\)\}/, "visible stocks must link to stock detail by symbol");
assert.match(js, /<em>\$\{pct\(item\.change\)\}<\/em>/, "visible stock links must show percentage change");
assert.match(js, /closeSectorMoverPopovers\(\)/, "outside interaction must be able to close popovers");
assert.match(js, /event\.target\.closest\?\.\("\.sector-mover-line\.has-rest"\)/, "tap/click must target the full Tăng/Giảm line");
assert.match(js, /initSectorMoverInteractions\(\);/, "sector mover interactions must be initialized");
assert.doesNotMatch(js, /<small>\$\{esc\(x\.symbol\)\}/, "technical sector key must stay hidden from the visible row");

assert.match(html, /\.sector-mover-line\.has-rest:hover \.sector-more-pop/, "desktop hover must open the remaining list");
assert.match(html, /\.sector-mover-line\.has-rest\.is-open \.sector-more-pop/, "tap/click state must open the remaining list");
assert.match(html, /market-reader\.js\?v=[^"\s]+/, "page must bust the market reader cache");
assert.doesNotMatch(js, /setText\("breadthState",b\.label\|\|"—"\)/, "breadth state must not inject a dash when the label is missing");
assert.match(html, /<strong id="breadthState" hidden><\/strong>/, "breadth state placeholder must stay hidden until a real label exists");

console.log("PASS sector movers UI contract: top3 + percentages + full-list hover/tap + stock links");
