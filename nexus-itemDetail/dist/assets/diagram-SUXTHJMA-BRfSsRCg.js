var _a;
import { c as B } from "./chunk-AEOMTBSW-DrAIN5Kb.js";
import { p as v } from "./treemap-KZPCXAKY-RU5UWGQG-Lo1E7Hlz.js";
import { m as f, L as u, a7 as C, U as P, p as m, j as z, V as F, K as S, Z as D, X as W, Y as E, l as T, n as L, $ as Y } from "./index-CRtis_Gf.js";
import "./chunk-H3VCZNTA-DXoxCplV.js";
var A = T.packet, w = (_a = class {
  constructor() {
    this.packet = [], this.setAccTitle = z, this.getAccTitle = F, this.setDiagramTitle = S, this.getDiagramTitle = D, this.getAccDescription = W, this.setAccDescription = E;
  }
  getConfig() {
    let t = u({ ...A, ...L().packet });
    return t.showBits && (t.paddingY += 10), t;
  }
  getPacket() {
    return this.packet;
  }
  pushWord(t) {
    t.length > 0 && this.packet.push(t);
  }
  clear() {
    Y(), this.packet = [];
  }
}, f(_a, "PacketDB"), _a), R = 1e4, j = f((t, e) => {
  B(t, e);
  let r = -1, i = [], l = 1, { bitsPerRow: n } = e.getConfig();
  for (let { start: a, end: s, bits: c, label: d } of t.blocks) {
    if (a !== void 0 && s !== void 0 && s < a) throw new Error(`Packet block ${a} - ${s} is invalid. End must be greater than start.`);
    if (a ?? (a = r + 1), a !== r + 1) throw new Error(`Packet block ${a} - ${s ?? a} is not contiguous. It should start from ${r + 1}.`);
    if (c === 0) throw new Error(`Packet block ${a} is invalid. Cannot have a zero bit field.`);
    for (s ?? (s = a + (c ?? 1) - 1), c ?? (c = s - a + 1), r = s, m.debug(`Packet block ${a} - ${r} with label ${d}`); i.length <= n + 1 && e.getPacket().length < R; ) {
      let [p, o] = M({ start: a, end: s, bits: c, label: d }, l, n);
      if (i.push(p), p.end + 1 === l * n && (e.pushWord(i), i = [], l++), !o) break;
      ({ start: a, end: s, bits: c, label: d } = o);
    }
  }
  e.pushWord(i);
}, "populate"), M = f((t, e, r) => {
  if (t.start === void 0) throw new Error("start should have been set during first phase");
  if (t.end === void 0) throw new Error("end should have been set during first phase");
  if (t.start > t.end) throw new Error(`Block start ${t.start} is greater than block end ${t.end}.`);
  if (t.end + 1 <= e * r) return [t, void 0];
  let i = e * r - 1, l = e * r;
  return [{ start: t.start, end: i, label: t.label, bits: i - t.start }, { start: l, end: t.end, label: t.label, bits: t.end - l }];
}, "getNextFittingBlock"), $ = { parser: { yy: void 0 }, parse: f(async (t) => {
  var _a2;
  let e = await v("packet", t), r = (_a2 = $.parser) == null ? void 0 : _a2.yy;
  if (!(r instanceof w)) throw new Error("parser.parser?.yy was not a PacketDB. This is due to a bug within Mermaid, please report this issue at https://github.com/mermaid-js/mermaid/issues.");
  m.debug(e), j(e, r);
}, "parse") }, V = f((t, e, r, i) => {
  let l = i.db, n = l.getConfig(), { rowHeight: a, paddingY: s, bitWidth: c, bitsPerRow: d } = n, p = l.getPacket(), o = l.getDiagramTitle(), b = a + s, h = b * (p.length + 1) - (o ? 0 : a), k = c * d + 2, g = C(e);
  g.attr("viewBox", `0 0 ${k} ${h}`), P(g, h, k, n.useMaxWidth);
  for (let [y, x] of p.entries()) X(g, x, y, n);
  g.append("text").text(o).attr("x", k / 2).attr("y", h - b / 2).attr("dominant-baseline", "middle").attr("text-anchor", "middle").attr("class", "packetTitle");
}, "draw"), X = f((t, e, r, { rowHeight: i, paddingX: l, paddingY: n, bitWidth: a, bitsPerRow: s, showBits: c }) => {
  let d = t.append("g"), p = r * (i + n) + n;
  for (let o of e) {
    let b = o.start % s * a + 1, h = (o.end - o.start + 1) * a - l;
    if (d.append("rect").attr("x", b).attr("y", p).attr("width", h).attr("height", i).attr("class", "packetBlock"), d.append("text").attr("x", b + h / 2).attr("y", p + i / 2).attr("class", "packetLabel").attr("dominant-baseline", "middle").attr("text-anchor", "middle").text(o.label), !c) continue;
    let k = o.end === o.start, g = p - 2;
    d.append("text").attr("x", b + (k ? h / 2 : 0)).attr("y", g).attr("class", "packetByte start").attr("dominant-baseline", "auto").attr("text-anchor", k ? "middle" : "start").text(o.start), k || d.append("text").attr("x", b + h).attr("y", g).attr("class", "packetByte end").attr("dominant-baseline", "auto").attr("text-anchor", "end").text(o.end);
  }
}, "drawWord"), H = { draw: V }, K = { byteFontSize: "10px", startByteColor: "black", endByteColor: "black", labelColor: "black", labelFontSize: "12px", titleColor: "black", titleFontSize: "14px", blockStrokeColor: "black", blockStrokeWidth: "1", blockFillColor: "#efefef" }, N = f(({ packet: t } = {}) => {
  let e = u(K, t);
  return `
	.packetByte {
		font-size: ${e.byteFontSize};
	}
	.packetByte.start {
		fill: ${e.startByteColor};
	}
	.packetByte.end {
		fill: ${e.endByteColor};
	}
	.packetLabel {
		fill: ${e.labelColor};
		font-size: ${e.labelFontSize};
	}
	.packetTitle {
		fill: ${e.titleColor};
		font-size: ${e.titleFontSize};
	}
	.packetBlock {
		stroke: ${e.blockStrokeColor};
		stroke-width: ${e.blockStrokeWidth};
		fill: ${e.blockFillColor};
	}
	`;
}, "styles"), I = { parser: $, get db() {
  return new w();
}, renderer: H, styles: N };
export {
  I as diagram
};
