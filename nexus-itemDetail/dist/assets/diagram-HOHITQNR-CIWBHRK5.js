var _a;
import { c as le } from "./chunk-AEOMTBSW-DrAIN5Kb.js";
import { p as se } from "./treemap-KZPCXAKY-RU5UWGQG-Lo1E7Hlz.js";
import { m as h, L as K, n as O, a7 as re, U as ie, aM as M, p as B, aa as H, aN as ne, aO as oe, aP as C, i as R, j as ce, V as de, K as pe, Z as he, X as me, Y as ye, l as fe, aQ as ue, $ as Se } from "./index-CRtis_Gf.js";
import { y as ge } from "./chunk-T4EQAHMB-gWQA89KS.js";
import "./chunk-H3VCZNTA-DXoxCplV.js";
var Z = (_a = class {
  constructor() {
    this.nodes = [], this.levels = /* @__PURE__ */ new Map(), this.outerNodes = [], this.classes = /* @__PURE__ */ new Map(), this.setAccTitle = ce, this.getAccTitle = de, this.setDiagramTitle = pe, this.getDiagramTitle = he, this.getAccDescription = me, this.setAccDescription = ye;
  }
  getNodes() {
    return this.nodes;
  }
  getConfig() {
    let s = fe, a = O();
    return K({ ...s.treemap, ...a.treemap ?? {} });
  }
  addNode(s, a) {
    this.nodes.push(s), this.levels.set(s, a), a === 0 && (this.outerNodes.push(s), this.root ?? (this.root = s));
  }
  getRoot() {
    return { name: "", children: this.outerNodes };
  }
  addClass(s, a) {
    let i = this.classes.get(s) ?? { id: s, styles: [], textStyles: [] }, d = a.replace(/\\,/g, "\xA7\xA7\xA7").replace(/,/g, ";").replace(/§§§/g, ",").split(";");
    d && d.forEach((o) => {
      ue(o) && ((i == null ? void 0 : i.textStyles) ? i.textStyles.push(o) : i.textStyles = [o]), (i == null ? void 0 : i.styles) ? i.styles.push(o) : i.styles = [o];
    }), this.classes.set(s, i);
  }
  getClasses() {
    return this.classes;
  }
  getStylesForClass(s) {
    var _a2;
    return ((_a2 = this.classes.get(s)) == null ? void 0 : _a2.styles) ?? [];
  }
  clear() {
    Se(), this.nodes = [], this.levels = /* @__PURE__ */ new Map(), this.outerNodes = [], this.classes = /* @__PURE__ */ new Map(), this.root = void 0;
  }
}, h(_a, "TreeMapDB"), _a);
function q(s) {
  if (!s.length) return [];
  let a = [], i = [];
  return s.forEach((d) => {
    let o = { name: d.name, children: d.type === "Leaf" ? void 0 : [] };
    for (o.classSelector = d == null ? void 0 : d.classSelector, (d == null ? void 0 : d.cssCompiledStyles) && (o.cssCompiledStyles = d.cssCompiledStyles), d.type === "Leaf" && d.value !== void 0 && (o.value = d.value); i.length > 0 && i[i.length - 1].level >= d.level; ) i.pop();
    if (i.length === 0) a.push(o);
    else {
      let r = i[i.length - 1].node;
      r.children ? r.children.push(o) : r.children = [o];
    }
    d.type !== "Leaf" && i.push({ node: o, level: d.level });
  }), a;
}
h(q, "buildHierarchy");
var xe = h((s, a) => {
  le(s, a);
  let i = [];
  for (let r of s.TreemapRows ?? []) r.$type === "ClassDefStatement" && a.addClass(r.className ?? "", r.styleText ?? "");
  for (let r of s.TreemapRows ?? []) {
    let p = r.item;
    if (!p) continue;
    let m = r.indent ? parseInt(r.indent) : 0, P = $e(p), l = p.classSelector ? a.getStylesForClass(p.classSelector) : [], w = l.length > 0 ? l : void 0, $ = { level: m, name: P, type: p.$type, value: p.value, classSelector: p.classSelector, cssCompiledStyles: w };
    i.push($);
  }
  let d = q(i), o = h((r, p) => {
    for (let m of r) a.addNode(m, p), m.children && m.children.length > 0 && o(m.children, p + 1);
  }, "addNodesRecursively");
  o(d, 0);
}, "populate"), $e = h((s) => s.name ? String(s.name) : "", "getItemName"), J = { parser: { yy: void 0 }, parse: h(async (s) => {
  var _a2;
  try {
    let a = await se("treemap", s);
    B.debug("Treemap AST:", a);
    let i = (_a2 = J.parser) == null ? void 0 : _a2.yy;
    if (!(i instanceof Z)) throw new Error("parser.parser?.yy was not a TreemapDB. This is due to a bug within Mermaid, please report this issue at https://github.com/mermaid-js/mermaid/issues.");
    xe(a, i);
  } catch (a) {
    throw B.error("Error parsing treemap:", a), a;
  }
}, "parse") }, be = 10, v = 10, F = 25, Ce = h((s, a, i, d) => {
  let o = d.db, r = o.getConfig(), p = r.padding ?? be, m = o.getDiagramTitle(), P = o.getRoot(), { themeVariables: l } = O();
  if (!P) return;
  let w = m ? 30 : 0, $ = re(a), j = r.nodeWidth ? r.nodeWidth * v : 960, I = r.nodeHeight ? r.nodeHeight * v : 500, E = j, U = I + w;
  $.attr("viewBox", `0 0 ${E} ${U}`), ie($, U, E, r.useMaxWidth);
  let b;
  try {
    let e = r.valueFormat || ",";
    if (e === "$0,0") b = h((t) => "$" + M(",")(t), "valueFormat");
    else if (e.startsWith("$") && e.includes(",")) {
      let t = /\.\d+/.exec(e), c = t ? t[0] : "";
      b = h((y) => "$" + M("," + c)(y), "valueFormat");
    } else if (e.startsWith("$")) {
      let t = e.substring(1);
      b = h((c) => "$" + M(t || "")(c), "valueFormat");
    } else b = M(e);
  } catch (e) {
    B.error("Error creating format function:", e), b = M(",");
  }
  let L = H().range(["transparent", l.cScale0, l.cScale1, l.cScale2, l.cScale3, l.cScale4, l.cScale5, l.cScale6, l.cScale7, l.cScale8, l.cScale9, l.cScale10, l.cScale11]), Q = H().range(["transparent", l.cScalePeer0, l.cScalePeer1, l.cScalePeer2, l.cScalePeer3, l.cScalePeer4, l.cScalePeer5, l.cScalePeer6, l.cScalePeer7, l.cScalePeer8, l.cScalePeer9, l.cScalePeer10, l.cScalePeer11]), N = H().range([l.cScaleLabel0, l.cScaleLabel1, l.cScaleLabel2, l.cScaleLabel3, l.cScaleLabel4, l.cScaleLabel5, l.cScaleLabel6, l.cScaleLabel7, l.cScaleLabel8, l.cScaleLabel9, l.cScaleLabel10, l.cScaleLabel11]);
  m && $.append("text").attr("x", E / 2).attr("y", w / 2).attr("class", "treemapTitle").attr("text-anchor", "middle").attr("dominant-baseline", "middle").text(m);
  let G = $.append("g").attr("transform", `translate(0, ${w})`).attr("class", "treemapContainer"), _ = ne(P).sum((e) => e.value ?? 0).sort((e, t) => (t.value ?? 0) - (e.value ?? 0)), X = oe().size([j, I]).paddingTop((e) => e.children && e.children.length > 0 ? F + v : 0).paddingInner(p).paddingLeft((e) => e.children && e.children.length > 0 ? v : 0).paddingRight((e) => e.children && e.children.length > 0 ? v : 0).paddingBottom((e) => e.children && e.children.length > 0 ? v : 0).round(true)(_), ee = X.descendants().filter((e) => e.children && e.children.length > 0), k = G.selectAll(".treemapSection").data(ee).enter().append("g").attr("class", "treemapSection").attr("transform", (e) => `translate(${e.x0},${e.y0})`);
  k.append("rect").attr("width", (e) => e.x1 - e.x0).attr("height", F).attr("class", "treemapSectionHeader").attr("fill", "none").attr("fill-opacity", 0.6).attr("stroke-width", 0.6).attr("style", (e) => e.depth === 0 ? "display: none;" : ""), k.append("clipPath").attr("id", (e, t) => `clip-section-${a}-${t}`).append("rect").attr("width", (e) => Math.max(0, e.x1 - e.x0 - 12)).attr("height", F), k.append("rect").attr("width", (e) => e.x1 - e.x0).attr("height", (e) => e.y1 - e.y0).attr("class", (e, t) => `treemapSection section${t}`).attr("fill", (e) => L(e.data.name)).attr("fill-opacity", 0.6).attr("stroke", (e) => Q(e.data.name)).attr("stroke-width", 2).attr("stroke-opacity", 0.4).attr("style", (e) => {
    if (e.depth === 0) return "display: none;";
    let t = C({ cssCompiledStyles: e.data.cssCompiledStyles });
    return t.nodeStyles + ";" + t.borderStyles.join(";");
  }), k.append("text").attr("class", "treemapSectionLabel").attr("x", 6).attr("y", F / 2).attr("dominant-baseline", "middle").text((e) => e.depth === 0 ? "" : e.data.name).attr("font-weight", "bold").attr("style", (e) => {
    if (e.depth === 0) return "display: none;";
    let t = "dominant-baseline: middle; font-size: 12px; fill:" + N(e.data.name) + "; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;", c = C({ cssCompiledStyles: e.data.cssCompiledStyles });
    return t + c.labelStyles.replace("color:", "fill:");
  }).each(function(e) {
    if (e.depth === 0) return;
    let t = R(this), c = e.data.name;
    t.text(c);
    let y = e.x1 - e.x0, S = 6, g;
    r.showValues !== false && e.value ? g = y - 10 - 30 - 10 - S : g = y - S - 6;
    let u = Math.max(15, g), f = t.node();
    if (f.getComputedTextLength() > u) {
      let n = c;
      for (; n.length > 0; ) {
        if (n = c.substring(0, n.length - 1), n.length === 0) {
          t.text("..."), f.getComputedTextLength() > u && t.text("");
          break;
        }
        if (t.text(n + "..."), f.getComputedTextLength() <= u) break;
      }
    }
  }), r.showValues !== false && k.append("text").attr("class", "treemapSectionValue").attr("x", (e) => e.x1 - e.x0 - 10).attr("y", F / 2).attr("text-anchor", "end").attr("dominant-baseline", "middle").text((e) => e.value ? b(e.value) : "").attr("font-style", "italic").attr("style", (e) => {
    if (e.depth === 0) return "display: none;";
    let t = "text-anchor: end; dominant-baseline: middle; font-size: 10px; fill:" + N(e.data.name) + "; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;", c = C({ cssCompiledStyles: e.data.cssCompiledStyles });
    return t + c.labelStyles.replace("color:", "fill:");
  });
  let te = X.leaves(), D = G.selectAll(".treemapLeafGroup").data(te).enter().append("g").attr("class", (e, t) => `treemapNode treemapLeafGroup leaf${t}${e.data.classSelector ? ` ${e.data.classSelector}` : ""}x`).attr("transform", (e) => `translate(${e.x0},${e.y0})`);
  D.append("rect").attr("width", (e) => e.x1 - e.x0).attr("height", (e) => e.y1 - e.y0).attr("class", "treemapLeaf").attr("fill", (e) => e.parent ? L(e.parent.data.name) : L(e.data.name)).attr("style", (e) => C({ cssCompiledStyles: e.data.cssCompiledStyles }).nodeStyles).attr("fill-opacity", 0.3).attr("stroke", (e) => e.parent ? L(e.parent.data.name) : L(e.data.name)).attr("stroke-width", 3), D.append("clipPath").attr("id", (e, t) => `clip-${a}-${t}`).append("rect").attr("width", (e) => Math.max(0, e.x1 - e.x0 - 4)).attr("height", (e) => Math.max(0, e.y1 - e.y0 - 4)), D.append("text").attr("class", "treemapLabel").attr("x", (e) => (e.x1 - e.x0) / 2).attr("y", (e) => (e.y1 - e.y0) / 2).attr("style", (e) => {
    let t = "text-anchor: middle; dominant-baseline: middle; font-size: 38px;fill:" + N(e.data.name) + ";", c = C({ cssCompiledStyles: e.data.cssCompiledStyles });
    return t + c.labelStyles.replace("color:", "fill:");
  }).attr("clip-path", (e, t) => `url(#clip-${a}-${t})`).text((e) => e.data.name).each(function(e) {
    let t = R(this), c = e.x1 - e.x0, y = e.y1 - e.y0, S = t.node(), g = 4, u = c - 2 * g, f = y - 2 * g;
    if (u < 10 || f < 10) {
      t.style("display", "none");
      return;
    }
    let n = parseInt(t.style("font-size"), 10), x = 8, T = 28, W = 0.6, z = 6, A = 2;
    for (; S.getComputedTextLength() > u && n > x; ) n--, t.style("font-size", `${n}px`);
    let V = Math.max(z, Math.min(T, Math.round(n * W))), Y = n + A + V;
    for (; Y > f && n > x && (n--, V = Math.max(z, Math.min(T, Math.round(n * W))), !(V < z && n === x)); ) t.style("font-size", `${n}px`), Y = n + A + V;
    t.style("font-size", `${n}px`), (S.getComputedTextLength() > u || n < x || f < n) && t.style("display", "none");
  }), r.showValues !== false && D.append("text").attr("class", "treemapValue").attr("x", (e) => (e.x1 - e.x0) / 2).attr("y", function(e) {
    return (e.y1 - e.y0) / 2;
  }).attr("style", (e) => {
    let t = "text-anchor: middle; dominant-baseline: hanging; font-size: 28px;fill:" + N(e.data.name) + ";", c = C({ cssCompiledStyles: e.data.cssCompiledStyles });
    return t + c.labelStyles.replace("color:", "fill:");
  }).attr("clip-path", (e, t) => `url(#clip-${a}-${t})`).text((e) => e.value ? b(e.value) : "").each(function(e) {
    let t = R(this), c = this.parentNode;
    if (!c) {
      t.style("display", "none");
      return;
    }
    let y = R(c).select(".treemapLabel");
    if (y.empty() || y.style("display") === "none") {
      t.style("display", "none");
      return;
    }
    let S = parseFloat(y.style("font-size")), g = 28, u = 0.6, f = 6, n = 2, x = Math.max(f, Math.min(g, Math.round(S * u)));
    t.style("font-size", `${x}px`);
    let T = (e.y1 - e.y0) / 2 + S / 2 + n;
    t.attr("y", T);
    let W = e.x1 - e.x0, z = e.y1 - e.y0 - 4, A = W - 8;
    t.node().getComputedTextLength() > A || T + x > z || x < f ? t.style("display", "none") : t.style("display", null);
  });
  let ae = r.diagramPadding ?? 8;
  ge($, ae, "flowchart", (r == null ? void 0 : r.useMaxWidth) || false);
}, "draw"), ve = h(function(s, a) {
  return a.db.getClasses();
}, "getClasses"), we = { draw: Ce, getClasses: ve }, Le = { sectionStrokeColor: "black", sectionStrokeWidth: "1", sectionFillColor: "#efefef", leafStrokeColor: "black", leafStrokeWidth: "1", leafFillColor: "#efefef", labelColor: "black", labelFontSize: "12px", valueFontSize: "10px", valueColor: "black", titleColor: "black", titleFontSize: "14px" }, ke = h(({ treemap: s } = {}) => {
  let a = K(Le, s);
  return `
  .treemapNode.section {
    stroke: ${a.sectionStrokeColor};
    stroke-width: ${a.sectionStrokeWidth};
    fill: ${a.sectionFillColor};
  }
  .treemapNode.leaf {
    stroke: ${a.leafStrokeColor};
    stroke-width: ${a.leafStrokeWidth};
    fill: ${a.leafFillColor};
  }
  .treemapLabel {
    fill: ${a.labelColor};
    font-size: ${a.labelFontSize};
  }
  .treemapValue {
    fill: ${a.valueColor};
    font-size: ${a.valueFontSize};
  }
  .treemapTitle {
    fill: ${a.titleColor};
    font-size: ${a.titleFontSize};
  }
  `;
}, "getStyles"), Te = ke, De = { parser: J, get db() {
  return new Z();
}, renderer: we, styles: Te };
export {
  De as diagram
};
