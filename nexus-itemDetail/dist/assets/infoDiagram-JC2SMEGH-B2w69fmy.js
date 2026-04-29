import { p as o } from "./treemap-KZPCXAKY-RU5UWGQG-Lo1E7Hlz.js";
import { m as e, p as s, a7 as n, U as d } from "./index-CRtis_Gf.js";
import "./chunk-H3VCZNTA-DXoxCplV.js";
var p = { parse: e(async (r) => {
  let a = await o("info", r);
  s.debug(a);
}, "parse") }, m = { version: "11.13.0" }, g = e(() => m.version, "getVersion"), v = { getVersion: g }, f = e((r, a, i) => {
  s.debug(`rendering info diagram
` + r);
  let t = n(a);
  d(t, 100, 400, true), t.append("g").append("text").attr("x", 100).attr("y", 40).attr("class", "version").attr("font-size", 32).style("text-anchor", "middle").text(`v${i}`);
}, "draw"), l = { draw: f }, u = { parser: p, db: v, renderer: l };
export {
  u as diagram
};
