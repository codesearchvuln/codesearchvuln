import { c as B } from "./chunk-AEOMTBSW-DrAIN5Kb.js";
import { p as K } from "./treemap-KZPCXAKY-RU5UWGQG-Lo1E7Hlz.js";
import { X as Z, Y as G, V as H, j as N, Z as q, K as I, m as r, p as S, x as J, L as Q, a7 as _, a8 as ee, a9 as M, aa as te, U as ae, $ as ie, ab as le, l as re } from "./index-CRtis_Gf.js";
import "./chunk-H3VCZNTA-DXoxCplV.js";
var se = re.pie, v = { sections: /* @__PURE__ */ new Map(), showData: false }, u = v.sections, y = v.showData, oe = structuredClone(se), ne = r(() => structuredClone(oe), "getConfig"), pe = r(() => {
  u = /* @__PURE__ */ new Map(), y = v.showData, ie();
}, "clear"), de = r(({ label: e, value: a }) => {
  if (a < 0) throw new Error(`"${e}" has invalid value: ${a}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);
  u.has(e) || (u.set(e, a), S.debug(`added new section: ${e}, with value: ${a}`));
}, "addSection"), ce = r(() => u, "getSections"), ue = r((e) => {
  y = e;
}, "setShowData"), ge = r(() => y, "getShowData"), L = { getConfig: ne, clear: pe, setDiagramTitle: I, getDiagramTitle: q, setAccTitle: N, getAccTitle: H, setAccDescription: G, getAccDescription: Z, addSection: de, getSections: ce, setShowData: ue, getShowData: ge }, he = r((e, a) => {
  B(e, a), a.setShowData(e.showData), e.sections.map(a.addSection);
}, "populateDb"), me = { parse: r(async (e) => {
  let a = await K("pie", e);
  S.debug(a), he(a, L);
}, "parse") }, fe = r((e) => `
  .pieCircle{
    stroke: ${e.pieStrokeColor};
    stroke-width : ${e.pieStrokeWidth};
    opacity : ${e.pieOpacity};
  }
  .pieOuterCircle{
    stroke: ${e.pieOuterStrokeColor};
    stroke-width: ${e.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${e.pieTitleTextSize};
    fill: ${e.pieTitleTextColor};
    font-family: ${e.fontFamily};
  }
  .slice {
    font-family: ${e.fontFamily};
    fill: ${e.pieSectionTextColor};
    font-size:${e.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${e.pieLegendTextColor};
    font-family: ${e.fontFamily};
    font-size: ${e.pieLegendTextSize};
  }
`, "getStyles"), xe = fe, $e = r((e) => {
  let a = [...e.values()].reduce((l, s) => l + s, 0), D = [...e.entries()].map(([l, s]) => ({ label: l, value: s })).filter((l) => l.value / a * 100 >= 1).sort((l, s) => s.value - l.value);
  return le().value((l) => l.value)(D);
}, "createPieArcs"), we = r((e, a, D, l) => {
  S.debug(`rendering pie chart
` + e);
  let s = l.db, T = J(), b = Q(s.getConfig(), T.pie), C = 40, o = 18, d = 4, p = 450, g = p, h = _(a), n = h.append("g");
  n.attr("transform", "translate(" + g / 2 + "," + p / 2 + ")");
  let { themeVariables: i } = T, [k] = ee(i.pieOuterStrokeWidth);
  k ?? (k = 2);
  let A = b.textPosition, c = Math.min(g, p) / 2 - C, P = M().innerRadius(0).outerRadius(c), W = M().innerRadius(c * A).outerRadius(c * A);
  n.append("circle").attr("cx", 0).attr("cy", 0).attr("r", c + k / 2).attr("class", "pieOuterCircle");
  let m = s.getSections(), E = $e(m), U = [i.pie1, i.pie2, i.pie3, i.pie4, i.pie5, i.pie6, i.pie7, i.pie8, i.pie9, i.pie10, i.pie11, i.pie12], f = 0;
  m.forEach((t) => {
    f += t;
  });
  let O = E.filter((t) => (t.data.value / f * 100).toFixed(0) !== "0"), x = te(U);
  n.selectAll("mySlices").data(O).enter().append("path").attr("d", P).attr("fill", (t) => x(t.data.label)).attr("class", "pieCircle"), n.selectAll("mySlices").data(O).enter().append("text").text((t) => (t.data.value / f * 100).toFixed(0) + "%").attr("transform", (t) => "translate(" + W.centroid(t) + ")").style("text-anchor", "middle").attr("class", "slice"), n.append("text").text(s.getDiagramTitle()).attr("x", 0).attr("y", -400 / 2).attr("class", "pieTitleText");
  let z = [...m.entries()].map(([t, w]) => ({ label: t, value: w })), $ = n.selectAll(".legend").data(z).enter().append("g").attr("class", "legend").attr("transform", (t, w) => {
    let R = o + d, X = R * z.length / 2, Y = 12 * o, j = w * R - X;
    return "translate(" + Y + "," + j + ")";
  });
  $.append("rect").attr("width", o).attr("height", o).style("fill", (t) => x(t.label)).style("stroke", (t) => x(t.label)), $.append("text").attr("x", o + d).attr("y", o - d).text((t) => s.getShowData() ? `${t.label} [${t.value}]` : t.label);
  let V = Math.max(...$.selectAll("text").nodes().map((t) => (t == null ? void 0 : t.getBoundingClientRect().width) ?? 0)), F = g + C + o + d + V;
  h.attr("viewBox", `0 0 ${F} ${p}`), ae(h, p, F, b.useMaxWidth);
}, "draw"), Se = { draw: we }, be = { parser: me, db: L, renderer: Se, styles: xe };
export {
  be as diagram
};
