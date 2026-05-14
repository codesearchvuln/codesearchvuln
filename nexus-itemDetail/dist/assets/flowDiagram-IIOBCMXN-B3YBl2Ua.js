var _a;
import { o as Xt } from "./chunk-KSICW3F5-D9HcVv8f.js";
import { m as A, z as Ot, p as Y, x as p1, i as R1, b as qt, c as Zt, d as it, j as Jt, Y as Yt, K as Qt, V as te, X as ee, Z as se, a as ie, A as re, g as ae, e as ue, J as st, k as ne, $ as le, R as oe, Q as ce, G as he } from "./index-CRtis_Gf.js";
import { T as de } from "./chunk-W2A4CRWB-Bgnwky-k.js";
import { m as pe } from "./chunk-TBF5ZNIQ-IobXjXJc.js";
import { y as ge } from "./chunk-T4EQAHMB-gWQA89KS.js";
var fe = "flowchart-", Ae = (_a = class {
  constructor() {
    this.vertexCounter = 0, this.config = p1(), this.vertices = /* @__PURE__ */ new Map(), this.edges = [], this.classes = /* @__PURE__ */ new Map(), this.subGraphs = [], this.subGraphLookup = /* @__PURE__ */ new Map(), this.tooltips = /* @__PURE__ */ new Map(), this.subCount = 0, this.firstGraphFlag = true, this.secCount = -1, this.posCrossRef = [], this.funs = [], this.setAccTitle = Jt, this.setAccDescription = Yt, this.setDiagramTitle = Qt, this.getAccTitle = te, this.getAccDescription = ee, this.getDiagramTitle = se, this.funs.push(this.setupToolTips.bind(this)), this.addVertex = this.addVertex.bind(this), this.firstGraph = this.firstGraph.bind(this), this.setDirection = this.setDirection.bind(this), this.addSubGraph = this.addSubGraph.bind(this), this.addLink = this.addLink.bind(this), this.setLink = this.setLink.bind(this), this.updateLink = this.updateLink.bind(this), this.addClass = this.addClass.bind(this), this.setClass = this.setClass.bind(this), this.destructLink = this.destructLink.bind(this), this.setClickEvent = this.setClickEvent.bind(this), this.setTooltip = this.setTooltip.bind(this), this.updateLinkInterpolate = this.updateLinkInterpolate.bind(this), this.setClickFun = this.setClickFun.bind(this), this.bindFunctions = this.bindFunctions.bind(this), this.lex = { firstGraph: this.firstGraph.bind(this) }, this.clear(), this.setGen("gen-2");
  }
  sanitizeText(t) {
    return ie.sanitizeText(t, this.config);
  }
  sanitizeNodeLabelType(t) {
    switch (t) {
      case "markdown":
      case "string":
      case "text":
        return t;
      default:
        return "markdown";
    }
  }
  lookUpDomId(t) {
    for (let i of this.vertices.values()) if (i.id === t) return i.domId;
    return t;
  }
  addVertex(t, i, r, u, a, h, p = {}, o) {
    var _a2, _b;
    if (!t || t.trim().length === 0) return;
    let c;
    if (o !== void 0) {
      let x;
      o.includes(`
`) ? x = o + `
` : x = `{
` + o + `
}`, c = re(x, { schema: ae });
    }
    let f = this.edges.find((x) => x.id === t);
    if (f) {
      let x = c;
      (x == null ? void 0 : x.animate) !== void 0 && (f.animate = x.animate), (x == null ? void 0 : x.animation) !== void 0 && (f.animation = x.animation), (x == null ? void 0 : x.curve) !== void 0 && (f.interpolate = x.curve);
      return;
    }
    let F, g = this.vertices.get(t);
    if (g === void 0 && (g = { id: t, labelType: "text", domId: fe + t + "-" + this.vertexCounter, styles: [], classes: [] }, this.vertices.set(t, g)), this.vertexCounter++, i !== void 0 ? (this.config = p1(), F = this.sanitizeText(i.text.trim()), g.labelType = i.type, F.startsWith('"') && F.endsWith('"') && (F = F.substring(1, F.length - 1)), g.text = F) : g.text === void 0 && (g.text = t), r !== void 0 && (g.type = r), u == null ? void 0 : u.forEach((x) => {
      g.styles.push(x);
    }), a == null ? void 0 : a.forEach((x) => {
      g.classes.push(x);
    }), h !== void 0 && (g.dir = h), g.props === void 0 ? g.props = p : p !== void 0 && Object.assign(g.props, p), c !== void 0) {
      if (c.shape) {
        if (c.shape !== c.shape.toLowerCase() || c.shape.includes("_")) throw new Error(`No such shape: ${c.shape}. Shape names should be lowercase.`);
        if (!ue(c.shape)) throw new Error(`No such shape: ${c.shape}.`);
        g.type = c == null ? void 0 : c.shape;
      }
      (c == null ? void 0 : c.label) && (g.text = c == null ? void 0 : c.label, g.labelType = this.sanitizeNodeLabelType(c == null ? void 0 : c.labelType)), (c == null ? void 0 : c.icon) && (g.icon = c == null ? void 0 : c.icon, !((_a2 = c.label) == null ? void 0 : _a2.trim()) && g.text === t && (g.text = "")), (c == null ? void 0 : c.form) && (g.form = c == null ? void 0 : c.form), (c == null ? void 0 : c.pos) && (g.pos = c == null ? void 0 : c.pos), (c == null ? void 0 : c.img) && (g.img = c == null ? void 0 : c.img, !((_b = c.label) == null ? void 0 : _b.trim()) && g.text === t && (g.text = "")), (c == null ? void 0 : c.constraint) && (g.constraint = c.constraint), c.w && (g.assetWidth = Number(c.w)), c.h && (g.assetHeight = Number(c.h));
    }
  }
  addSingleLink(t, i, r, u) {
    let a = { start: t, end: i, type: void 0, text: "", labelType: "text", classes: [], isUserDefinedId: false, interpolate: this.edges.defaultInterpolate };
    Y.info("abc78 Got edge...", a);
    let h = r.text;
    if (h !== void 0 && (a.text = this.sanitizeText(h.text.trim()), a.text.startsWith('"') && a.text.endsWith('"') && (a.text = a.text.substring(1, a.text.length - 1)), a.labelType = this.sanitizeNodeLabelType(h.type)), r !== void 0 && (a.type = r.type, a.stroke = r.stroke, a.length = r.length > 10 ? 10 : r.length), u && !this.edges.some((p) => p.id === u)) a.id = u, a.isUserDefinedId = true;
    else {
      let p = this.edges.filter((o) => o.start === a.start && o.end === a.end);
      p.length === 0 ? a.id = st(a.start, a.end, { counter: 0, prefix: "L" }) : a.id = st(a.start, a.end, { counter: p.length + 1, prefix: "L" });
    }
    if (this.edges.length < (this.config.maxEdges ?? 500)) Y.info("Pushing edge..."), this.edges.push(a);
    else throw new Error(`Edge limit exceeded. ${this.edges.length} edges found, but the limit is ${this.config.maxEdges}.

Initialize mermaid with maxEdges set to a higher number to allow more edges.
You cannot set this config via configuration inside the diagram as it is a secure config.
You have to call mermaid.initialize.`);
  }
  isLinkData(t) {
    return t !== null && typeof t == "object" && "id" in t && typeof t.id == "string";
  }
  addLink(t, i, r) {
    let u = this.isLinkData(r) ? r.id.replace("@", "") : void 0;
    Y.info("addLink", t, i, u);
    for (let a of t) for (let h of i) {
      let p = a === t[t.length - 1], o = h === i[0];
      p && o ? this.addSingleLink(a, h, r, u) : this.addSingleLink(a, h, r, void 0);
    }
  }
  updateLinkInterpolate(t, i) {
    t.forEach((r) => {
      r === "default" ? this.edges.defaultInterpolate = i : this.edges[r].interpolate = i;
    });
  }
  updateLink(t, i) {
    t.forEach((r) => {
      var _a2, _b, _c, _d, _e, _f;
      if (typeof r == "number" && r >= this.edges.length) throw new Error(`The index ${r} for linkStyle is out of bounds. Valid indices for linkStyle are between 0 and ${this.edges.length - 1}. (Help: Ensure that the index is within the range of existing edges.)`);
      r === "default" ? this.edges.defaultStyle = i : (this.edges[r].style = i, (((_b = (_a2 = this.edges[r]) == null ? void 0 : _a2.style) == null ? void 0 : _b.length) ?? 0) > 0 && !((_d = (_c = this.edges[r]) == null ? void 0 : _c.style) == null ? void 0 : _d.some((u) => u == null ? void 0 : u.startsWith("fill"))) && ((_f = (_e = this.edges[r]) == null ? void 0 : _e.style) == null ? void 0 : _f.push("fill:none")));
    });
  }
  addClass(t, i) {
    let r = i.join().replace(/\\,/g, "\xA7\xA7\xA7").replace(/,/g, ";").replace(/§§§/g, ",").split(";");
    t.split(",").forEach((u) => {
      let a = this.classes.get(u);
      a === void 0 && (a = { id: u, styles: [], textStyles: [] }, this.classes.set(u, a)), r == null ? void 0 : r.forEach((h) => {
        if (/color/.exec(h)) {
          let p = h.replace("fill", "bgFill");
          a.textStyles.push(p);
        }
        a.styles.push(h);
      });
    });
  }
  setDirection(t) {
    this.direction = t.trim(), /.*</.exec(this.direction) && (this.direction = "RL"), /.*\^/.exec(this.direction) && (this.direction = "BT"), /.*>/.exec(this.direction) && (this.direction = "LR"), /.*v/.exec(this.direction) && (this.direction = "TB"), this.direction === "TD" && (this.direction = "TB");
  }
  setClass(t, i) {
    for (let r of t.split(",")) {
      let u = this.vertices.get(r);
      u && u.classes.push(i);
      let a = this.edges.find((p) => p.id === r);
      a && a.classes.push(i);
      let h = this.subGraphLookup.get(r);
      h && h.classes.push(i);
    }
  }
  setTooltip(t, i) {
    if (i !== void 0) {
      i = this.sanitizeText(i);
      for (let r of t.split(",")) this.tooltips.set(this.version === "gen-1" ? this.lookUpDomId(r) : r, i);
    }
  }
  setClickFun(t, i, r) {
    let u = this.lookUpDomId(t);
    if (p1().securityLevel !== "loose" || i === void 0) return;
    let a = [];
    if (typeof r == "string") {
      a = r.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      for (let p = 0; p < a.length; p++) {
        let o = a[p].trim();
        o.startsWith('"') && o.endsWith('"') && (o = o.substr(1, o.length - 2)), a[p] = o;
      }
    }
    a.length === 0 && a.push(t);
    let h = this.vertices.get(t);
    h && (h.haveCallback = true, this.funs.push(() => {
      let p = document.querySelector(`[id="${u}"]`);
      p !== null && p.addEventListener("click", () => {
        it.runFunc(i, ...a);
      }, false);
    }));
  }
  setLink(t, i, r) {
    t.split(",").forEach((u) => {
      let a = this.vertices.get(u);
      a !== void 0 && (a.link = it.formatUrl(i, this.config), a.linkTarget = r);
    }), this.setClass(t, "clickable");
  }
  getTooltip(t) {
    return this.tooltips.get(t);
  }
  setClickEvent(t, i, r) {
    t.split(",").forEach((u) => {
      this.setClickFun(u, i, r);
    }), this.setClass(t, "clickable");
  }
  bindFunctions(t) {
    this.funs.forEach((i) => {
      i(t);
    });
  }
  getDirection() {
    var _a2;
    return (_a2 = this.direction) == null ? void 0 : _a2.trim();
  }
  getVertices() {
    return this.vertices;
  }
  getEdges() {
    return this.edges;
  }
  getClasses() {
    return this.classes;
  }
  setupToolTips(t) {
    let i = de();
    R1(t).select("svg").selectAll("g.node").on("mouseover", (r) => {
      var _a2;
      let u = R1(r.currentTarget), a = u.attr("title");
      if (a === null) return;
      let h = (_a2 = r.currentTarget) == null ? void 0 : _a2.getBoundingClientRect();
      i.transition().duration(200).style("opacity", ".9"), i.text(u.attr("title")).style("left", window.scrollX + h.left + (h.right - h.left) / 2 + "px").style("top", window.scrollY + h.bottom + "px"), i.html(ne.sanitize(a)), u.classed("hover", true);
    }).on("mouseout", (r) => {
      i.transition().duration(500).style("opacity", 0), R1(r.currentTarget).classed("hover", false);
    });
  }
  clear(t = "gen-2") {
    this.vertices = /* @__PURE__ */ new Map(), this.classes = /* @__PURE__ */ new Map(), this.edges = [], this.funs = [this.setupToolTips.bind(this)], this.subGraphs = [], this.subGraphLookup = /* @__PURE__ */ new Map(), this.subCount = 0, this.tooltips = /* @__PURE__ */ new Map(), this.firstGraphFlag = true, this.version = t, this.config = p1(), le();
  }
  setGen(t) {
    this.version = t || "gen-2";
  }
  defaultStyle() {
    return "fill:#ffa;stroke: #f66; stroke-width: 3px; stroke-dasharray: 5, 5;fill:#ffa;stroke: #666;";
  }
  addSubGraph(t, i, r) {
    let u = t.text.trim(), a = r.text;
    t === r && /\s/.exec(r.text) && (u = void 0);
    let h = A((F) => {
      let g = { boolean: {}, number: {}, string: {} }, x = [], K;
      return { nodeList: F.filter(function(b) {
        let C = typeof b;
        return b.stmt && b.stmt === "dir" ? (K = b.value, false) : b.trim() === "" ? false : C in g ? g[C].hasOwnProperty(b) ? false : g[C][b] = true : x.includes(b) ? false : x.push(b);
      }), dir: K };
    }, "uniq")(i.flat()), p = h.nodeList, o = h.dir, c = p1().flowchart ?? {};
    if (o = o ?? (c.inheritDir ? this.getDirection() ?? p1().direction ?? void 0 : void 0), this.version === "gen-1") for (let F = 0; F < p.length; F++) p[F] = this.lookUpDomId(p[F]);
    u = u ?? "subGraph" + this.subCount, a = a || "", a = this.sanitizeText(a), this.subCount = this.subCount + 1;
    let f = { id: u, nodes: p, title: a.trim(), classes: [], dir: o, labelType: this.sanitizeNodeLabelType(r == null ? void 0 : r.type) };
    return Y.info("Adding", f.id, f.nodes, f.dir), f.nodes = this.makeUniq(f, this.subGraphs).nodes, this.subGraphs.push(f), this.subGraphLookup.set(u, f), u;
  }
  getPosForId(t) {
    for (let [i, r] of this.subGraphs.entries()) if (r.id === t) return i;
    return -1;
  }
  indexNodes2(t, i) {
    let r = this.subGraphs[i].nodes;
    if (this.secCount = this.secCount + 1, this.secCount > 2e3) return { result: false, count: 0 };
    if (this.posCrossRef[this.secCount] = i, this.subGraphs[i].id === t) return { result: true, count: 0 };
    let u = 0, a = 1;
    for (; u < r.length; ) {
      let h = this.getPosForId(r[u]);
      if (h >= 0) {
        let p = this.indexNodes2(t, h);
        if (p.result) return { result: true, count: a + p.count };
        a = a + p.count;
      }
      u = u + 1;
    }
    return { result: false, count: a };
  }
  getDepthFirstPos(t) {
    return this.posCrossRef[t];
  }
  indexNodes() {
    this.secCount = -1, this.subGraphs.length > 0 && this.indexNodes2("none", this.subGraphs.length - 1);
  }
  getSubGraphs() {
    return this.subGraphs;
  }
  firstGraph() {
    return this.firstGraphFlag ? (this.firstGraphFlag = false, true) : false;
  }
  destructStartLink(t) {
    let i = t.trim(), r = "arrow_open";
    switch (i[0]) {
      case "<":
        r = "arrow_point", i = i.slice(1);
        break;
      case "x":
        r = "arrow_cross", i = i.slice(1);
        break;
      case "o":
        r = "arrow_circle", i = i.slice(1);
        break;
    }
    let u = "normal";
    return i.includes("=") && (u = "thick"), i.includes(".") && (u = "dotted"), { type: r, stroke: u };
  }
  countChar(t, i) {
    let r = i.length, u = 0;
    for (let a = 0; a < r; ++a) i[a] === t && ++u;
    return u;
  }
  destructEndLink(t) {
    let i = t.trim(), r = i.slice(0, -1), u = "arrow_open";
    switch (i.slice(-1)) {
      case "x":
        u = "arrow_cross", i.startsWith("x") && (u = "double_" + u, r = r.slice(1));
        break;
      case ">":
        u = "arrow_point", i.startsWith("<") && (u = "double_" + u, r = r.slice(1));
        break;
      case "o":
        u = "arrow_circle", i.startsWith("o") && (u = "double_" + u, r = r.slice(1));
        break;
    }
    let a = "normal", h = r.length - 1;
    r.startsWith("=") && (a = "thick"), r.startsWith("~") && (a = "invisible");
    let p = this.countChar(".", r);
    return p && (a = "dotted", h = p), { type: u, stroke: a, length: h };
  }
  destructLink(t, i) {
    let r = this.destructEndLink(t), u;
    if (i) {
      if (u = this.destructStartLink(i), u.stroke !== r.stroke) return { type: "INVALID", stroke: "INVALID" };
      if (u.type === "arrow_open") u.type = r.type;
      else {
        if (u.type !== r.type) return { type: "INVALID", stroke: "INVALID" };
        u.type = "double_" + u.type;
      }
      return u.type === "double_arrow" && (u.type = "double_arrow_point"), u.length = r.length, u;
    }
    return r;
  }
  exists(t, i) {
    for (let r of t) if (r.nodes.includes(i)) return true;
    return false;
  }
  makeUniq(t, i) {
    let r = [];
    return t.nodes.forEach((u, a) => {
      this.exists(i, u) || r.push(t.nodes[a]);
    }), { nodes: r };
  }
  getTypeFromVertex(t) {
    if (t.img) return "imageSquare";
    if (t.icon) return t.form === "circle" ? "iconCircle" : t.form === "square" ? "iconSquare" : t.form === "rounded" ? "iconRounded" : "icon";
    switch (t.type) {
      case "square":
      case void 0:
        return "squareRect";
      case "round":
        return "roundedRect";
      case "ellipse":
        return "ellipse";
      default:
        return t.type;
    }
  }
  findNode(t, i) {
    return t.find((r) => r.id === i);
  }
  destructEdgeType(t) {
    let i = "none", r = "arrow_point";
    switch (t) {
      case "arrow_point":
      case "arrow_circle":
      case "arrow_cross":
        r = t;
        break;
      case "double_arrow_point":
      case "double_arrow_circle":
      case "double_arrow_cross":
        i = t.replace("double_", ""), r = i;
        break;
    }
    return { arrowTypeStart: i, arrowTypeEnd: r };
  }
  addNodeFromVertex(t, i, r, u, a, h) {
    var _a2;
    let p = r.get(t.id), o = u.get(t.id) ?? false, c = this.findNode(i, t.id);
    if (c) c.cssStyles = t.styles, c.cssCompiledStyles = this.getCompiledStyles(t.classes), c.cssClasses = t.classes.join(" ");
    else {
      let f = { id: t.id, label: t.text, labelType: t.labelType, labelStyle: "", parentId: p, padding: ((_a2 = a.flowchart) == null ? void 0 : _a2.padding) || 8, cssStyles: t.styles, cssCompiledStyles: this.getCompiledStyles(["default", "node", ...t.classes]), cssClasses: "default " + t.classes.join(" "), dir: t.dir, domId: t.domId, look: h, link: t.link, linkTarget: t.linkTarget, tooltip: this.getTooltip(t.id), icon: t.icon, pos: t.pos, img: t.img, assetWidth: t.assetWidth, assetHeight: t.assetHeight, constraint: t.constraint };
      o ? i.push({ ...f, isGroup: true, shape: "rect" }) : i.push({ ...f, isGroup: false, shape: this.getTypeFromVertex(t) });
    }
  }
  getCompiledStyles(t) {
    let i = [];
    for (let r of t) {
      let u = this.classes.get(r);
      (u == null ? void 0 : u.styles) && (i = [...i, ...u.styles ?? []].map((a) => a.trim())), (u == null ? void 0 : u.textStyles) && (i = [...i, ...u.textStyles ?? []].map((a) => a.trim()));
    }
    return i;
  }
  getData() {
    let t = p1(), i = [], r = [], u = this.getSubGraphs(), a = /* @__PURE__ */ new Map(), h = /* @__PURE__ */ new Map();
    for (let o = u.length - 1; o >= 0; o--) {
      let c = u[o];
      c.nodes.length > 0 && h.set(c.id, true);
      for (let f of c.nodes) a.set(f, c.id);
    }
    for (let o = u.length - 1; o >= 0; o--) {
      let c = u[o];
      i.push({ id: c.id, label: c.title, labelStyle: "", labelType: c.labelType, parentId: a.get(c.id), padding: 8, cssCompiledStyles: this.getCompiledStyles(c.classes), cssClasses: c.classes.join(" "), shape: "rect", dir: c.dir, isGroup: true, look: t.look });
    }
    this.getVertices().forEach((o) => {
      this.addNodeFromVertex(o, i, a, h, t, t.look || "classic");
    });
    let p = this.getEdges();
    return p.forEach((o, c) => {
      var _a2;
      let { arrowTypeStart: f, arrowTypeEnd: F } = this.destructEdgeType(o.type), g = [...p.defaultStyle ?? []];
      o.style && g.push(...o.style);
      let x = { id: st(o.start, o.end, { counter: c, prefix: "L" }, o.id), isUserDefinedId: o.isUserDefinedId, start: o.start, end: o.end, type: o.type ?? "normal", label: o.text, labelType: o.labelType, labelpos: "c", thickness: o.stroke, minlen: o.length, classes: (o == null ? void 0 : o.stroke) === "invisible" ? "" : "edge-thickness-normal edge-pattern-solid flowchart-link", arrowTypeStart: (o == null ? void 0 : o.stroke) === "invisible" || (o == null ? void 0 : o.type) === "arrow_open" ? "none" : f, arrowTypeEnd: (o == null ? void 0 : o.stroke) === "invisible" || (o == null ? void 0 : o.type) === "arrow_open" ? "none" : F, arrowheadStyle: "fill: #333", cssCompiledStyles: this.getCompiledStyles(o.classes), labelStyle: g, style: g, pattern: o.stroke, look: t.look, animate: o.animate, animation: o.animation, curve: o.interpolate || this.edges.defaultInterpolate || ((_a2 = t.flowchart) == null ? void 0 : _a2.curve) };
      r.push(x);
    }), { nodes: i, edges: r, other: {}, config: t };
  }
  defaultConfig() {
    return oe.flowchart;
  }
}, A(_a, "FlowDB"), _a), be = A(function(t, i) {
  return i.db.getClasses();
}, "getClasses"), ke = A(async function(t, i, r, u) {
  var _a2;
  Y.info("REF0:"), Y.info("Drawing state diagram (v2)", i);
  let { securityLevel: a, flowchart: h, layout: p } = p1(), o;
  a === "sandbox" && (o = R1("#i" + i));
  let c = a === "sandbox" ? o.nodes()[0].contentDocument : document;
  Y.debug("Before getData: ");
  let f = u.db.getData();
  Y.debug("Data: ", f);
  let F = pe(i, a), g = u.db.getDirection();
  f.type = u.type, f.layoutAlgorithm = qt(p), f.layoutAlgorithm === "dagre" && p === "elk" && Y.warn("flowchart-elk was moved to an external package in Mermaid v11. Please refer [release notes](https://github.com/mermaid-js/mermaid/releases/tag/v11.0.0) for more details. This diagram will be rendered using `dagre` layout as a fallback."), f.direction = g, f.nodeSpacing = (h == null ? void 0 : h.nodeSpacing) || 50, f.rankSpacing = (h == null ? void 0 : h.rankSpacing) || 50, f.markers = ["point", "circle", "cross"], f.diagramId = i, Y.debug("REF1:", f), await Zt(f, F);
  let x = ((_a2 = f.config.flowchart) == null ? void 0 : _a2.diagramPadding) ?? 8;
  it.insertTitle(F, "flowchartTitleText", (h == null ? void 0 : h.titleTopMargin) || 0, u.db.getDiagramTitle()), ge(F, x, "flowchart", (h == null ? void 0 : h.useMaxWidth) || false);
  for (let K of f.nodes) {
    let b = R1(`#${i} [id="${K.id}"]`);
    if (!b || !K.link) continue;
    let C = c.createElementNS("http://www.w3.org/2000/svg", "a");
    C.setAttributeNS("http://www.w3.org/2000/svg", "class", K.cssClasses), C.setAttributeNS("http://www.w3.org/2000/svg", "rel", "noopener"), a === "sandbox" ? C.setAttributeNS("http://www.w3.org/2000/svg", "target", "_top") : K.linkTarget && C.setAttributeNS("http://www.w3.org/2000/svg", "target", K.linkTarget);
    let g1 = b.insert(function() {
      return C;
    }, ":first-child"), f1 = b.select(".label-container");
    f1 && g1.append(function() {
      return f1.node();
    });
    let A1 = b.select(".label");
    A1 && g1.append(function() {
      return A1.node();
    });
  }
}, "draw"), ye = { getClasses: be, draw: ke }, rt = function() {
  var t = A(function(J, l, d, n) {
    for (d = d || {}, n = J.length; n--; d[J[n]] = l) ;
    return d;
  }, "o"), i = [1, 4], r = [1, 3], u = [1, 5], a = [1, 8, 9, 10, 11, 27, 34, 36, 38, 44, 60, 84, 85, 86, 87, 88, 89, 102, 105, 106, 109, 111, 114, 115, 116, 121, 122, 123, 124, 125], h = [2, 2], p = [1, 13], o = [1, 14], c = [1, 15], f = [1, 16], F = [1, 23], g = [1, 25], x = [1, 26], K = [1, 27], b = [1, 50], C = [1, 49], g1 = [1, 29], f1 = [1, 30], A1 = [1, 31], P1 = [1, 32], G1 = [1, 33], v = [1, 45], w = [1, 47], $ = [1, 43], L = [1, 48], I = [1, 44], N = [1, 51], R = [1, 46], P = [1, 52], G = [1, 53], O1 = [1, 34], M1 = [1, 35], U1 = [1, 36], V1 = [1, 37], z1 = [1, 38], h1 = [1, 58], D = [1, 8, 9, 10, 11, 27, 32, 34, 36, 38, 44, 60, 84, 85, 86, 87, 88, 89, 102, 105, 106, 109, 111, 114, 115, 116, 121, 122, 123, 124, 125], Q = [1, 62], t1 = [1, 61], e1 = [1, 63], m1 = [8, 9, 11, 75, 77, 78], at = [1, 79], E1 = [1, 92], x1 = [1, 97], C1 = [1, 96], T1 = [1, 93], D1 = [1, 89], S1 = [1, 95], F1 = [1, 91], _1 = [1, 98], B1 = [1, 94], v1 = [1, 99], w1 = [1, 90], b1 = [8, 9, 10, 11, 40, 75, 77, 78], M = [8, 9, 10, 11, 40, 46, 75, 77, 78], H = [8, 9, 10, 11, 29, 40, 44, 46, 48, 50, 52, 54, 56, 58, 60, 63, 65, 67, 68, 70, 75, 77, 78, 89, 102, 105, 106, 109, 111, 114, 115, 116], ut = [8, 9, 11, 44, 60, 75, 77, 78, 89, 102, 105, 106, 109, 111, 114, 115, 116], $1 = [44, 60, 89, 102, 105, 106, 109, 111, 114, 115, 116], nt = [1, 122], lt = [1, 123], W1 = [1, 125], K1 = [1, 124], ot = [44, 60, 62, 74, 89, 102, 105, 106, 109, 111, 114, 115, 116], ct = [1, 134], ht = [1, 148], dt = [1, 149], pt = [1, 150], gt = [1, 151], ft = [1, 136], At = [1, 138], bt = [1, 142], kt = [1, 143], yt = [1, 144], mt = [1, 145], Et = [1, 146], xt = [1, 147], Ct = [1, 152], Tt = [1, 153], Dt = [1, 132], St = [1, 133], Ft = [1, 140], _t = [1, 135], Bt = [1, 139], vt = [1, 137], q1 = [8, 9, 10, 11, 27, 32, 34, 36, 38, 44, 60, 84, 85, 86, 87, 88, 89, 102, 105, 106, 109, 111, 114, 115, 116, 121, 122, 123, 124, 125], wt = [1, 155], $t = [1, 157], _ = [8, 9, 11], j = [8, 9, 10, 11, 14, 44, 60, 89, 105, 106, 109, 111, 114, 115, 116], k = [1, 177], U = [1, 173], V = [1, 174], y = [1, 178], m = [1, 175], E = [1, 176], L1 = [77, 116, 119], S = [8, 9, 10, 11, 12, 14, 27, 29, 32, 44, 60, 75, 84, 85, 86, 87, 88, 89, 90, 105, 109, 111, 114, 115, 116], Lt = [10, 106], d1 = [31, 49, 51, 53, 55, 57, 62, 64, 66, 67, 69, 71, 116, 117, 118], s1 = [1, 248], i1 = [1, 246], r1 = [1, 250], a1 = [1, 244], u1 = [1, 245], n1 = [1, 247], l1 = [1, 249], o1 = [1, 251], I1 = [1, 269], It = [8, 9, 11, 106], Z = [8, 9, 10, 11, 60, 84, 105, 106, 109, 110, 111, 112], Z1 = { trace: A(function() {
  }, "trace"), yy: {}, symbols_: { error: 2, start: 3, graphConfig: 4, document: 5, line: 6, statement: 7, SEMI: 8, NEWLINE: 9, SPACE: 10, EOF: 11, GRAPH: 12, NODIR: 13, DIR: 14, FirstStmtSeparator: 15, ending: 16, endToken: 17, spaceList: 18, spaceListNewline: 19, vertexStatement: 20, separator: 21, styleStatement: 22, linkStyleStatement: 23, classDefStatement: 24, classStatement: 25, clickStatement: 26, subgraph: 27, textNoTags: 28, SQS: 29, text: 30, SQE: 31, end: 32, direction: 33, acc_title: 34, acc_title_value: 35, acc_descr: 36, acc_descr_value: 37, acc_descr_multiline_value: 38, shapeData: 39, SHAPE_DATA: 40, link: 41, node: 42, styledVertex: 43, AMP: 44, vertex: 45, STYLE_SEPARATOR: 46, idString: 47, DOUBLECIRCLESTART: 48, DOUBLECIRCLEEND: 49, PS: 50, PE: 51, "(-": 52, "-)": 53, STADIUMSTART: 54, STADIUMEND: 55, SUBROUTINESTART: 56, SUBROUTINEEND: 57, VERTEX_WITH_PROPS_START: 58, "NODE_STRING[field]": 59, COLON: 60, "NODE_STRING[value]": 61, PIPE: 62, CYLINDERSTART: 63, CYLINDEREND: 64, DIAMOND_START: 65, DIAMOND_STOP: 66, TAGEND: 67, TRAPSTART: 68, TRAPEND: 69, INVTRAPSTART: 70, INVTRAPEND: 71, linkStatement: 72, arrowText: 73, TESTSTR: 74, START_LINK: 75, edgeText: 76, LINK: 77, LINK_ID: 78, edgeTextToken: 79, STR: 80, MD_STR: 81, textToken: 82, keywords: 83, STYLE: 84, LINKSTYLE: 85, CLASSDEF: 86, CLASS: 87, CLICK: 88, DOWN: 89, UP: 90, textNoTagsToken: 91, stylesOpt: 92, "idString[vertex]": 93, "idString[class]": 94, CALLBACKNAME: 95, CALLBACKARGS: 96, HREF: 97, LINK_TARGET: 98, "STR[link]": 99, "STR[tooltip]": 100, alphaNum: 101, DEFAULT: 102, numList: 103, INTERPOLATE: 104, NUM: 105, COMMA: 106, style: 107, styleComponent: 108, NODE_STRING: 109, UNIT: 110, BRKT: 111, PCT: 112, idStringToken: 113, MINUS: 114, MULT: 115, UNICODE_TEXT: 116, TEXT: 117, TAGSTART: 118, EDGE_TEXT: 119, alphaNumToken: 120, direction_tb: 121, direction_bt: 122, direction_rl: 123, direction_lr: 124, direction_td: 125, $accept: 0, $end: 1 }, terminals_: { 2: "error", 8: "SEMI", 9: "NEWLINE", 10: "SPACE", 11: "EOF", 12: "GRAPH", 13: "NODIR", 14: "DIR", 27: "subgraph", 29: "SQS", 31: "SQE", 32: "end", 34: "acc_title", 35: "acc_title_value", 36: "acc_descr", 37: "acc_descr_value", 38: "acc_descr_multiline_value", 40: "SHAPE_DATA", 44: "AMP", 46: "STYLE_SEPARATOR", 48: "DOUBLECIRCLESTART", 49: "DOUBLECIRCLEEND", 50: "PS", 51: "PE", 52: "(-", 53: "-)", 54: "STADIUMSTART", 55: "STADIUMEND", 56: "SUBROUTINESTART", 57: "SUBROUTINEEND", 58: "VERTEX_WITH_PROPS_START", 59: "NODE_STRING[field]", 60: "COLON", 61: "NODE_STRING[value]", 62: "PIPE", 63: "CYLINDERSTART", 64: "CYLINDEREND", 65: "DIAMOND_START", 66: "DIAMOND_STOP", 67: "TAGEND", 68: "TRAPSTART", 69: "TRAPEND", 70: "INVTRAPSTART", 71: "INVTRAPEND", 74: "TESTSTR", 75: "START_LINK", 77: "LINK", 78: "LINK_ID", 80: "STR", 81: "MD_STR", 84: "STYLE", 85: "LINKSTYLE", 86: "CLASSDEF", 87: "CLASS", 88: "CLICK", 89: "DOWN", 90: "UP", 93: "idString[vertex]", 94: "idString[class]", 95: "CALLBACKNAME", 96: "CALLBACKARGS", 97: "HREF", 98: "LINK_TARGET", 99: "STR[link]", 100: "STR[tooltip]", 102: "DEFAULT", 104: "INTERPOLATE", 105: "NUM", 106: "COMMA", 109: "NODE_STRING", 110: "UNIT", 111: "BRKT", 112: "PCT", 114: "MINUS", 115: "MULT", 116: "UNICODE_TEXT", 117: "TEXT", 118: "TAGSTART", 119: "EDGE_TEXT", 121: "direction_tb", 122: "direction_bt", 123: "direction_rl", 124: "direction_lr", 125: "direction_td" }, productions_: [0, [3, 2], [5, 0], [5, 2], [6, 1], [6, 1], [6, 1], [6, 1], [6, 1], [4, 2], [4, 2], [4, 2], [4, 3], [16, 2], [16, 1], [17, 1], [17, 1], [17, 1], [15, 1], [15, 1], [15, 2], [19, 2], [19, 2], [19, 1], [19, 1], [18, 2], [18, 1], [7, 2], [7, 2], [7, 2], [7, 2], [7, 2], [7, 2], [7, 9], [7, 6], [7, 4], [7, 1], [7, 2], [7, 2], [7, 1], [21, 1], [21, 1], [21, 1], [39, 2], [39, 1], [20, 4], [20, 3], [20, 4], [20, 2], [20, 2], [20, 1], [42, 1], [42, 6], [42, 5], [43, 1], [43, 3], [45, 4], [45, 4], [45, 6], [45, 4], [45, 4], [45, 4], [45, 8], [45, 4], [45, 4], [45, 4], [45, 6], [45, 4], [45, 4], [45, 4], [45, 4], [45, 4], [45, 1], [41, 2], [41, 3], [41, 3], [41, 1], [41, 3], [41, 4], [76, 1], [76, 2], [76, 1], [76, 1], [72, 1], [72, 2], [73, 3], [30, 1], [30, 2], [30, 1], [30, 1], [83, 1], [83, 1], [83, 1], [83, 1], [83, 1], [83, 1], [83, 1], [83, 1], [83, 1], [83, 1], [83, 1], [28, 1], [28, 2], [28, 1], [28, 1], [24, 5], [25, 5], [26, 2], [26, 4], [26, 3], [26, 5], [26, 3], [26, 5], [26, 5], [26, 7], [26, 2], [26, 4], [26, 2], [26, 4], [26, 4], [26, 6], [22, 5], [23, 5], [23, 5], [23, 9], [23, 9], [23, 7], [23, 7], [103, 1], [103, 3], [92, 1], [92, 3], [107, 1], [107, 2], [108, 1], [108, 1], [108, 1], [108, 1], [108, 1], [108, 1], [108, 1], [108, 1], [113, 1], [113, 1], [113, 1], [113, 1], [113, 1], [113, 1], [113, 1], [113, 1], [113, 1], [113, 1], [113, 1], [82, 1], [82, 1], [82, 1], [82, 1], [91, 1], [91, 1], [91, 1], [91, 1], [91, 1], [91, 1], [91, 1], [91, 1], [91, 1], [91, 1], [91, 1], [79, 1], [79, 1], [120, 1], [120, 1], [120, 1], [120, 1], [120, 1], [120, 1], [120, 1], [120, 1], [120, 1], [120, 1], [120, 1], [47, 1], [47, 2], [101, 1], [101, 2], [33, 1], [33, 1], [33, 1], [33, 1], [33, 1]], performAction: A(function(J, l, d, n, T, e, W) {
    var s = e.length - 1;
    switch (T) {
      case 2:
        this.$ = [];
        break;
      case 3:
        (!Array.isArray(e[s]) || e[s].length > 0) && e[s - 1].push(e[s]), this.$ = e[s - 1];
        break;
      case 4:
      case 183:
        this.$ = e[s];
        break;
      case 11:
        n.setDirection("TB"), this.$ = "TB";
        break;
      case 12:
        n.setDirection(e[s - 1]), this.$ = e[s - 1];
        break;
      case 27:
        this.$ = e[s - 1].nodes;
        break;
      case 28:
      case 29:
      case 30:
      case 31:
      case 32:
        this.$ = [];
        break;
      case 33:
        this.$ = n.addSubGraph(e[s - 6], e[s - 1], e[s - 4]);
        break;
      case 34:
        this.$ = n.addSubGraph(e[s - 3], e[s - 1], e[s - 3]);
        break;
      case 35:
        this.$ = n.addSubGraph(void 0, e[s - 1], void 0);
        break;
      case 37:
        this.$ = e[s].trim(), n.setAccTitle(this.$);
        break;
      case 38:
      case 39:
        this.$ = e[s].trim(), n.setAccDescription(this.$);
        break;
      case 43:
        this.$ = e[s - 1] + e[s];
        break;
      case 44:
        this.$ = e[s];
        break;
      case 45:
        n.addVertex(e[s - 1][e[s - 1].length - 1], void 0, void 0, void 0, void 0, void 0, void 0, e[s]), n.addLink(e[s - 3].stmt, e[s - 1], e[s - 2]), this.$ = { stmt: e[s - 1], nodes: e[s - 1].concat(e[s - 3].nodes) };
        break;
      case 46:
        n.addLink(e[s - 2].stmt, e[s], e[s - 1]), this.$ = { stmt: e[s], nodes: e[s].concat(e[s - 2].nodes) };
        break;
      case 47:
        n.addLink(e[s - 3].stmt, e[s - 1], e[s - 2]), this.$ = { stmt: e[s - 1], nodes: e[s - 1].concat(e[s - 3].nodes) };
        break;
      case 48:
        this.$ = { stmt: e[s - 1], nodes: e[s - 1] };
        break;
      case 49:
        n.addVertex(e[s - 1][e[s - 1].length - 1], void 0, void 0, void 0, void 0, void 0, void 0, e[s]), this.$ = { stmt: e[s - 1], nodes: e[s - 1], shapeData: e[s] };
        break;
      case 50:
        this.$ = { stmt: e[s], nodes: e[s] };
        break;
      case 51:
        this.$ = [e[s]];
        break;
      case 52:
        n.addVertex(e[s - 5][e[s - 5].length - 1], void 0, void 0, void 0, void 0, void 0, void 0, e[s - 4]), this.$ = e[s - 5].concat(e[s]);
        break;
      case 53:
        this.$ = e[s - 4].concat(e[s]);
        break;
      case 54:
        this.$ = e[s];
        break;
      case 55:
        this.$ = e[s - 2], n.setClass(e[s - 2], e[s]);
        break;
      case 56:
        this.$ = e[s - 3], n.addVertex(e[s - 3], e[s - 1], "square");
        break;
      case 57:
        this.$ = e[s - 3], n.addVertex(e[s - 3], e[s - 1], "doublecircle");
        break;
      case 58:
        this.$ = e[s - 5], n.addVertex(e[s - 5], e[s - 2], "circle");
        break;
      case 59:
        this.$ = e[s - 3], n.addVertex(e[s - 3], e[s - 1], "ellipse");
        break;
      case 60:
        this.$ = e[s - 3], n.addVertex(e[s - 3], e[s - 1], "stadium");
        break;
      case 61:
        this.$ = e[s - 3], n.addVertex(e[s - 3], e[s - 1], "subroutine");
        break;
      case 62:
        this.$ = e[s - 7], n.addVertex(e[s - 7], e[s - 1], "rect", void 0, void 0, void 0, Object.fromEntries([[e[s - 5], e[s - 3]]]));
        break;
      case 63:
        this.$ = e[s - 3], n.addVertex(e[s - 3], e[s - 1], "cylinder");
        break;
      case 64:
        this.$ = e[s - 3], n.addVertex(e[s - 3], e[s - 1], "round");
        break;
      case 65:
        this.$ = e[s - 3], n.addVertex(e[s - 3], e[s - 1], "diamond");
        break;
      case 66:
        this.$ = e[s - 5], n.addVertex(e[s - 5], e[s - 2], "hexagon");
        break;
      case 67:
        this.$ = e[s - 3], n.addVertex(e[s - 3], e[s - 1], "odd");
        break;
      case 68:
        this.$ = e[s - 3], n.addVertex(e[s - 3], e[s - 1], "trapezoid");
        break;
      case 69:
        this.$ = e[s - 3], n.addVertex(e[s - 3], e[s - 1], "inv_trapezoid");
        break;
      case 70:
        this.$ = e[s - 3], n.addVertex(e[s - 3], e[s - 1], "lean_right");
        break;
      case 71:
        this.$ = e[s - 3], n.addVertex(e[s - 3], e[s - 1], "lean_left");
        break;
      case 72:
        this.$ = e[s], n.addVertex(e[s]);
        break;
      case 73:
        e[s - 1].text = e[s], this.$ = e[s - 1];
        break;
      case 74:
      case 75:
        e[s - 2].text = e[s - 1], this.$ = e[s - 2];
        break;
      case 76:
        this.$ = e[s];
        break;
      case 77:
        var B = n.destructLink(e[s], e[s - 2]);
        this.$ = { type: B.type, stroke: B.stroke, length: B.length, text: e[s - 1] };
        break;
      case 78:
        var B = n.destructLink(e[s], e[s - 2]);
        this.$ = { type: B.type, stroke: B.stroke, length: B.length, text: e[s - 1], id: e[s - 3] };
        break;
      case 79:
        this.$ = { text: e[s], type: "text" };
        break;
      case 80:
        this.$ = { text: e[s - 1].text + "" + e[s], type: e[s - 1].type };
        break;
      case 81:
        this.$ = { text: e[s], type: "string" };
        break;
      case 82:
        this.$ = { text: e[s], type: "markdown" };
        break;
      case 83:
        var B = n.destructLink(e[s]);
        this.$ = { type: B.type, stroke: B.stroke, length: B.length };
        break;
      case 84:
        var B = n.destructLink(e[s]);
        this.$ = { type: B.type, stroke: B.stroke, length: B.length, id: e[s - 1] };
        break;
      case 85:
        this.$ = e[s - 1];
        break;
      case 86:
        this.$ = { text: e[s], type: "text" };
        break;
      case 87:
        this.$ = { text: e[s - 1].text + "" + e[s], type: e[s - 1].type };
        break;
      case 88:
        this.$ = { text: e[s], type: "string" };
        break;
      case 89:
      case 104:
        this.$ = { text: e[s], type: "markdown" };
        break;
      case 101:
        this.$ = { text: e[s], type: "text" };
        break;
      case 102:
        this.$ = { text: e[s - 1].text + "" + e[s], type: e[s - 1].type };
        break;
      case 103:
        this.$ = { text: e[s], type: "text" };
        break;
      case 105:
        this.$ = e[s - 4], n.addClass(e[s - 2], e[s]);
        break;
      case 106:
        this.$ = e[s - 4], n.setClass(e[s - 2], e[s]);
        break;
      case 107:
      case 115:
        this.$ = e[s - 1], n.setClickEvent(e[s - 1], e[s]);
        break;
      case 108:
      case 116:
        this.$ = e[s - 3], n.setClickEvent(e[s - 3], e[s - 2]), n.setTooltip(e[s - 3], e[s]);
        break;
      case 109:
        this.$ = e[s - 2], n.setClickEvent(e[s - 2], e[s - 1], e[s]);
        break;
      case 110:
        this.$ = e[s - 4], n.setClickEvent(e[s - 4], e[s - 3], e[s - 2]), n.setTooltip(e[s - 4], e[s]);
        break;
      case 111:
        this.$ = e[s - 2], n.setLink(e[s - 2], e[s]);
        break;
      case 112:
        this.$ = e[s - 4], n.setLink(e[s - 4], e[s - 2]), n.setTooltip(e[s - 4], e[s]);
        break;
      case 113:
        this.$ = e[s - 4], n.setLink(e[s - 4], e[s - 2], e[s]);
        break;
      case 114:
        this.$ = e[s - 6], n.setLink(e[s - 6], e[s - 4], e[s]), n.setTooltip(e[s - 6], e[s - 2]);
        break;
      case 117:
        this.$ = e[s - 1], n.setLink(e[s - 1], e[s]);
        break;
      case 118:
        this.$ = e[s - 3], n.setLink(e[s - 3], e[s - 2]), n.setTooltip(e[s - 3], e[s]);
        break;
      case 119:
        this.$ = e[s - 3], n.setLink(e[s - 3], e[s - 2], e[s]);
        break;
      case 120:
        this.$ = e[s - 5], n.setLink(e[s - 5], e[s - 4], e[s]), n.setTooltip(e[s - 5], e[s - 2]);
        break;
      case 121:
        this.$ = e[s - 4], n.addVertex(e[s - 2], void 0, void 0, e[s]);
        break;
      case 122:
        this.$ = e[s - 4], n.updateLink([e[s - 2]], e[s]);
        break;
      case 123:
        this.$ = e[s - 4], n.updateLink(e[s - 2], e[s]);
        break;
      case 124:
        this.$ = e[s - 8], n.updateLinkInterpolate([e[s - 6]], e[s - 2]), n.updateLink([e[s - 6]], e[s]);
        break;
      case 125:
        this.$ = e[s - 8], n.updateLinkInterpolate(e[s - 6], e[s - 2]), n.updateLink(e[s - 6], e[s]);
        break;
      case 126:
        this.$ = e[s - 6], n.updateLinkInterpolate([e[s - 4]], e[s]);
        break;
      case 127:
        this.$ = e[s - 6], n.updateLinkInterpolate(e[s - 4], e[s]);
        break;
      case 128:
      case 130:
        this.$ = [e[s]];
        break;
      case 129:
      case 131:
        e[s - 2].push(e[s]), this.$ = e[s - 2];
        break;
      case 133:
        this.$ = e[s - 1] + e[s];
        break;
      case 181:
        this.$ = e[s];
        break;
      case 182:
        this.$ = e[s - 1] + "" + e[s];
        break;
      case 184:
        this.$ = e[s - 1] + "" + e[s];
        break;
      case 185:
        this.$ = { stmt: "dir", value: "TB" };
        break;
      case 186:
        this.$ = { stmt: "dir", value: "BT" };
        break;
      case 187:
        this.$ = { stmt: "dir", value: "RL" };
        break;
      case 188:
        this.$ = { stmt: "dir", value: "LR" };
        break;
      case 189:
        this.$ = { stmt: "dir", value: "TD" };
        break;
    }
  }, "anonymous"), table: [{ 3: 1, 4: 2, 9: i, 10: r, 12: u }, { 1: [3] }, t(a, h, { 5: 6 }), { 4: 7, 9: i, 10: r, 12: u }, { 4: 8, 9: i, 10: r, 12: u }, { 13: [1, 9], 14: [1, 10] }, { 1: [2, 1], 6: 11, 7: 12, 8: p, 9: o, 10: c, 11: f, 20: 17, 22: 18, 23: 19, 24: 20, 25: 21, 26: 22, 27: F, 33: 24, 34: g, 36: x, 38: K, 42: 28, 43: 39, 44: b, 45: 40, 47: 41, 60: C, 84: g1, 85: f1, 86: A1, 87: P1, 88: G1, 89: v, 102: w, 105: $, 106: L, 109: I, 111: N, 113: 42, 114: R, 115: P, 116: G, 121: O1, 122: M1, 123: U1, 124: V1, 125: z1 }, t(a, [2, 9]), t(a, [2, 10]), t(a, [2, 11]), { 8: [1, 55], 9: [1, 56], 10: h1, 15: 54, 18: 57 }, t(D, [2, 3]), t(D, [2, 4]), t(D, [2, 5]), t(D, [2, 6]), t(D, [2, 7]), t(D, [2, 8]), { 8: Q, 9: t1, 11: e1, 21: 59, 41: 60, 72: 64, 75: [1, 65], 77: [1, 67], 78: [1, 66] }, { 8: Q, 9: t1, 11: e1, 21: 68 }, { 8: Q, 9: t1, 11: e1, 21: 69 }, { 8: Q, 9: t1, 11: e1, 21: 70 }, { 8: Q, 9: t1, 11: e1, 21: 71 }, { 8: Q, 9: t1, 11: e1, 21: 72 }, { 8: Q, 9: t1, 10: [1, 73], 11: e1, 21: 74 }, t(D, [2, 36]), { 35: [1, 75] }, { 37: [1, 76] }, t(D, [2, 39]), t(m1, [2, 50], { 18: 77, 39: 78, 10: h1, 40: at }), { 10: [1, 80] }, { 10: [1, 81] }, { 10: [1, 82] }, { 10: [1, 83] }, { 14: E1, 44: x1, 60: C1, 80: [1, 87], 89: T1, 95: [1, 84], 97: [1, 85], 101: 86, 105: D1, 106: S1, 109: F1, 111: _1, 114: B1, 115: v1, 116: w1, 120: 88 }, t(D, [2, 185]), t(D, [2, 186]), t(D, [2, 187]), t(D, [2, 188]), t(D, [2, 189]), t(b1, [2, 51]), t(b1, [2, 54], { 46: [1, 100] }), t(M, [2, 72], { 113: 113, 29: [1, 101], 44: b, 48: [1, 102], 50: [1, 103], 52: [1, 104], 54: [1, 105], 56: [1, 106], 58: [1, 107], 60: C, 63: [1, 108], 65: [1, 109], 67: [1, 110], 68: [1, 111], 70: [1, 112], 89: v, 102: w, 105: $, 106: L, 109: I, 111: N, 114: R, 115: P, 116: G }), t(H, [2, 181]), t(H, [2, 142]), t(H, [2, 143]), t(H, [2, 144]), t(H, [2, 145]), t(H, [2, 146]), t(H, [2, 147]), t(H, [2, 148]), t(H, [2, 149]), t(H, [2, 150]), t(H, [2, 151]), t(H, [2, 152]), t(a, [2, 12]), t(a, [2, 18]), t(a, [2, 19]), { 9: [1, 114] }, t(ut, [2, 26], { 18: 115, 10: h1 }), t(D, [2, 27]), { 42: 116, 43: 39, 44: b, 45: 40, 47: 41, 60: C, 89: v, 102: w, 105: $, 106: L, 109: I, 111: N, 113: 42, 114: R, 115: P, 116: G }, t(D, [2, 40]), t(D, [2, 41]), t(D, [2, 42]), t($1, [2, 76], { 73: 117, 62: [1, 119], 74: [1, 118] }), { 76: 120, 79: 121, 80: nt, 81: lt, 116: W1, 119: K1 }, { 75: [1, 126], 77: [1, 127] }, t(ot, [2, 83]), t(D, [2, 28]), t(D, [2, 29]), t(D, [2, 30]), t(D, [2, 31]), t(D, [2, 32]), { 10: ct, 12: ht, 14: dt, 27: pt, 28: 128, 32: gt, 44: ft, 60: At, 75: bt, 80: [1, 130], 81: [1, 131], 83: 141, 84: kt, 85: yt, 86: mt, 87: Et, 88: xt, 89: Ct, 90: Tt, 91: 129, 105: Dt, 109: St, 111: Ft, 114: _t, 115: Bt, 116: vt }, t(q1, h, { 5: 154 }), t(D, [2, 37]), t(D, [2, 38]), t(m1, [2, 48], { 44: wt }), t(m1, [2, 49], { 18: 156, 10: h1, 40: $t }), t(b1, [2, 44]), { 44: b, 47: 158, 60: C, 89: v, 102: w, 105: $, 106: L, 109: I, 111: N, 113: 42, 114: R, 115: P, 116: G }, { 102: [1, 159], 103: 160, 105: [1, 161] }, { 44: b, 47: 162, 60: C, 89: v, 102: w, 105: $, 106: L, 109: I, 111: N, 113: 42, 114: R, 115: P, 116: G }, { 44: b, 47: 163, 60: C, 89: v, 102: w, 105: $, 106: L, 109: I, 111: N, 113: 42, 114: R, 115: P, 116: G }, t(_, [2, 107], { 10: [1, 164], 96: [1, 165] }), { 80: [1, 166] }, t(_, [2, 115], { 120: 168, 10: [1, 167], 14: E1, 44: x1, 60: C1, 89: T1, 105: D1, 106: S1, 109: F1, 111: _1, 114: B1, 115: v1, 116: w1 }), t(_, [2, 117], { 10: [1, 169] }), t(j, [2, 183]), t(j, [2, 170]), t(j, [2, 171]), t(j, [2, 172]), t(j, [2, 173]), t(j, [2, 174]), t(j, [2, 175]), t(j, [2, 176]), t(j, [2, 177]), t(j, [2, 178]), t(j, [2, 179]), t(j, [2, 180]), { 44: b, 47: 170, 60: C, 89: v, 102: w, 105: $, 106: L, 109: I, 111: N, 113: 42, 114: R, 115: P, 116: G }, { 30: 171, 67: k, 80: U, 81: V, 82: 172, 116: y, 117: m, 118: E }, { 30: 179, 67: k, 80: U, 81: V, 82: 172, 116: y, 117: m, 118: E }, { 30: 181, 50: [1, 180], 67: k, 80: U, 81: V, 82: 172, 116: y, 117: m, 118: E }, { 30: 182, 67: k, 80: U, 81: V, 82: 172, 116: y, 117: m, 118: E }, { 30: 183, 67: k, 80: U, 81: V, 82: 172, 116: y, 117: m, 118: E }, { 30: 184, 67: k, 80: U, 81: V, 82: 172, 116: y, 117: m, 118: E }, { 109: [1, 185] }, { 30: 186, 67: k, 80: U, 81: V, 82: 172, 116: y, 117: m, 118: E }, { 30: 187, 65: [1, 188], 67: k, 80: U, 81: V, 82: 172, 116: y, 117: m, 118: E }, { 30: 189, 67: k, 80: U, 81: V, 82: 172, 116: y, 117: m, 118: E }, { 30: 190, 67: k, 80: U, 81: V, 82: 172, 116: y, 117: m, 118: E }, { 30: 191, 67: k, 80: U, 81: V, 82: 172, 116: y, 117: m, 118: E }, t(H, [2, 182]), t(a, [2, 20]), t(ut, [2, 25]), t(m1, [2, 46], { 39: 192, 18: 193, 10: h1, 40: at }), t($1, [2, 73], { 10: [1, 194] }), { 10: [1, 195] }, { 30: 196, 67: k, 80: U, 81: V, 82: 172, 116: y, 117: m, 118: E }, { 77: [1, 197], 79: 198, 116: W1, 119: K1 }, t(L1, [2, 79]), t(L1, [2, 81]), t(L1, [2, 82]), t(L1, [2, 168]), t(L1, [2, 169]), { 76: 199, 79: 121, 80: nt, 81: lt, 116: W1, 119: K1 }, t(ot, [2, 84]), { 8: Q, 9: t1, 10: ct, 11: e1, 12: ht, 14: dt, 21: 201, 27: pt, 29: [1, 200], 32: gt, 44: ft, 60: At, 75: bt, 83: 141, 84: kt, 85: yt, 86: mt, 87: Et, 88: xt, 89: Ct, 90: Tt, 91: 202, 105: Dt, 109: St, 111: Ft, 114: _t, 115: Bt, 116: vt }, t(S, [2, 101]), t(S, [2, 103]), t(S, [2, 104]), t(S, [2, 157]), t(S, [2, 158]), t(S, [2, 159]), t(S, [2, 160]), t(S, [2, 161]), t(S, [2, 162]), t(S, [2, 163]), t(S, [2, 164]), t(S, [2, 165]), t(S, [2, 166]), t(S, [2, 167]), t(S, [2, 90]), t(S, [2, 91]), t(S, [2, 92]), t(S, [2, 93]), t(S, [2, 94]), t(S, [2, 95]), t(S, [2, 96]), t(S, [2, 97]), t(S, [2, 98]), t(S, [2, 99]), t(S, [2, 100]), { 6: 11, 7: 12, 8: p, 9: o, 10: c, 11: f, 20: 17, 22: 18, 23: 19, 24: 20, 25: 21, 26: 22, 27: F, 32: [1, 203], 33: 24, 34: g, 36: x, 38: K, 42: 28, 43: 39, 44: b, 45: 40, 47: 41, 60: C, 84: g1, 85: f1, 86: A1, 87: P1, 88: G1, 89: v, 102: w, 105: $, 106: L, 109: I, 111: N, 113: 42, 114: R, 115: P, 116: G, 121: O1, 122: M1, 123: U1, 124: V1, 125: z1 }, { 10: h1, 18: 204 }, { 44: [1, 205] }, t(b1, [2, 43]), { 10: [1, 206], 44: b, 60: C, 89: v, 102: w, 105: $, 106: L, 109: I, 111: N, 113: 113, 114: R, 115: P, 116: G }, { 10: [1, 207] }, { 10: [1, 208], 106: [1, 209] }, t(Lt, [2, 128]), { 10: [1, 210], 44: b, 60: C, 89: v, 102: w, 105: $, 106: L, 109: I, 111: N, 113: 113, 114: R, 115: P, 116: G }, { 10: [1, 211], 44: b, 60: C, 89: v, 102: w, 105: $, 106: L, 109: I, 111: N, 113: 113, 114: R, 115: P, 116: G }, { 80: [1, 212] }, t(_, [2, 109], { 10: [1, 213] }), t(_, [2, 111], { 10: [1, 214] }), { 80: [1, 215] }, t(j, [2, 184]), { 80: [1, 216], 98: [1, 217] }, t(b1, [2, 55], { 113: 113, 44: b, 60: C, 89: v, 102: w, 105: $, 106: L, 109: I, 111: N, 114: R, 115: P, 116: G }), { 31: [1, 218], 67: k, 82: 219, 116: y, 117: m, 118: E }, t(d1, [2, 86]), t(d1, [2, 88]), t(d1, [2, 89]), t(d1, [2, 153]), t(d1, [2, 154]), t(d1, [2, 155]), t(d1, [2, 156]), { 49: [1, 220], 67: k, 82: 219, 116: y, 117: m, 118: E }, { 30: 221, 67: k, 80: U, 81: V, 82: 172, 116: y, 117: m, 118: E }, { 51: [1, 222], 67: k, 82: 219, 116: y, 117: m, 118: E }, { 53: [1, 223], 67: k, 82: 219, 116: y, 117: m, 118: E }, { 55: [1, 224], 67: k, 82: 219, 116: y, 117: m, 118: E }, { 57: [1, 225], 67: k, 82: 219, 116: y, 117: m, 118: E }, { 60: [1, 226] }, { 64: [1, 227], 67: k, 82: 219, 116: y, 117: m, 118: E }, { 66: [1, 228], 67: k, 82: 219, 116: y, 117: m, 118: E }, { 30: 229, 67: k, 80: U, 81: V, 82: 172, 116: y, 117: m, 118: E }, { 31: [1, 230], 67: k, 82: 219, 116: y, 117: m, 118: E }, { 67: k, 69: [1, 231], 71: [1, 232], 82: 219, 116: y, 117: m, 118: E }, { 67: k, 69: [1, 234], 71: [1, 233], 82: 219, 116: y, 117: m, 118: E }, t(m1, [2, 45], { 18: 156, 10: h1, 40: $t }), t(m1, [2, 47], { 44: wt }), t($1, [2, 75]), t($1, [2, 74]), { 62: [1, 235], 67: k, 82: 219, 116: y, 117: m, 118: E }, t($1, [2, 77]), t(L1, [2, 80]), { 77: [1, 236], 79: 198, 116: W1, 119: K1 }, { 30: 237, 67: k, 80: U, 81: V, 82: 172, 116: y, 117: m, 118: E }, t(q1, h, { 5: 238 }), t(S, [2, 102]), t(D, [2, 35]), { 43: 239, 44: b, 45: 40, 47: 41, 60: C, 89: v, 102: w, 105: $, 106: L, 109: I, 111: N, 113: 42, 114: R, 115: P, 116: G }, { 10: h1, 18: 240 }, { 10: s1, 60: i1, 84: r1, 92: 241, 105: a1, 107: 242, 108: 243, 109: u1, 110: n1, 111: l1, 112: o1 }, { 10: s1, 60: i1, 84: r1, 92: 252, 104: [1, 253], 105: a1, 107: 242, 108: 243, 109: u1, 110: n1, 111: l1, 112: o1 }, { 10: s1, 60: i1, 84: r1, 92: 254, 104: [1, 255], 105: a1, 107: 242, 108: 243, 109: u1, 110: n1, 111: l1, 112: o1 }, { 105: [1, 256] }, { 10: s1, 60: i1, 84: r1, 92: 257, 105: a1, 107: 242, 108: 243, 109: u1, 110: n1, 111: l1, 112: o1 }, { 44: b, 47: 258, 60: C, 89: v, 102: w, 105: $, 106: L, 109: I, 111: N, 113: 42, 114: R, 115: P, 116: G }, t(_, [2, 108]), { 80: [1, 259] }, { 80: [1, 260], 98: [1, 261] }, t(_, [2, 116]), t(_, [2, 118], { 10: [1, 262] }), t(_, [2, 119]), t(M, [2, 56]), t(d1, [2, 87]), t(M, [2, 57]), { 51: [1, 263], 67: k, 82: 219, 116: y, 117: m, 118: E }, t(M, [2, 64]), t(M, [2, 59]), t(M, [2, 60]), t(M, [2, 61]), { 109: [1, 264] }, t(M, [2, 63]), t(M, [2, 65]), { 66: [1, 265], 67: k, 82: 219, 116: y, 117: m, 118: E }, t(M, [2, 67]), t(M, [2, 68]), t(M, [2, 70]), t(M, [2, 69]), t(M, [2, 71]), t([10, 44, 60, 89, 102, 105, 106, 109, 111, 114, 115, 116], [2, 85]), t($1, [2, 78]), { 31: [1, 266], 67: k, 82: 219, 116: y, 117: m, 118: E }, { 6: 11, 7: 12, 8: p, 9: o, 10: c, 11: f, 20: 17, 22: 18, 23: 19, 24: 20, 25: 21, 26: 22, 27: F, 32: [1, 267], 33: 24, 34: g, 36: x, 38: K, 42: 28, 43: 39, 44: b, 45: 40, 47: 41, 60: C, 84: g1, 85: f1, 86: A1, 87: P1, 88: G1, 89: v, 102: w, 105: $, 106: L, 109: I, 111: N, 113: 42, 114: R, 115: P, 116: G, 121: O1, 122: M1, 123: U1, 124: V1, 125: z1 }, t(b1, [2, 53]), { 43: 268, 44: b, 45: 40, 47: 41, 60: C, 89: v, 102: w, 105: $, 106: L, 109: I, 111: N, 113: 42, 114: R, 115: P, 116: G }, t(_, [2, 121], { 106: I1 }), t(It, [2, 130], { 108: 270, 10: s1, 60: i1, 84: r1, 105: a1, 109: u1, 110: n1, 111: l1, 112: o1 }), t(Z, [2, 132]), t(Z, [2, 134]), t(Z, [2, 135]), t(Z, [2, 136]), t(Z, [2, 137]), t(Z, [2, 138]), t(Z, [2, 139]), t(Z, [2, 140]), t(Z, [2, 141]), t(_, [2, 122], { 106: I1 }), { 10: [1, 271] }, t(_, [2, 123], { 106: I1 }), { 10: [1, 272] }, t(Lt, [2, 129]), t(_, [2, 105], { 106: I1 }), t(_, [2, 106], { 113: 113, 44: b, 60: C, 89: v, 102: w, 105: $, 106: L, 109: I, 111: N, 114: R, 115: P, 116: G }), t(_, [2, 110]), t(_, [2, 112], { 10: [1, 273] }), t(_, [2, 113]), { 98: [1, 274] }, { 51: [1, 275] }, { 62: [1, 276] }, { 66: [1, 277] }, { 8: Q, 9: t1, 11: e1, 21: 278 }, t(D, [2, 34]), t(b1, [2, 52]), { 10: s1, 60: i1, 84: r1, 105: a1, 107: 279, 108: 243, 109: u1, 110: n1, 111: l1, 112: o1 }, t(Z, [2, 133]), { 14: E1, 44: x1, 60: C1, 89: T1, 101: 280, 105: D1, 106: S1, 109: F1, 111: _1, 114: B1, 115: v1, 116: w1, 120: 88 }, { 14: E1, 44: x1, 60: C1, 89: T1, 101: 281, 105: D1, 106: S1, 109: F1, 111: _1, 114: B1, 115: v1, 116: w1, 120: 88 }, { 98: [1, 282] }, t(_, [2, 120]), t(M, [2, 58]), { 30: 283, 67: k, 80: U, 81: V, 82: 172, 116: y, 117: m, 118: E }, t(M, [2, 66]), t(q1, h, { 5: 284 }), t(It, [2, 131], { 108: 270, 10: s1, 60: i1, 84: r1, 105: a1, 109: u1, 110: n1, 111: l1, 112: o1 }), t(_, [2, 126], { 120: 168, 10: [1, 285], 14: E1, 44: x1, 60: C1, 89: T1, 105: D1, 106: S1, 109: F1, 111: _1, 114: B1, 115: v1, 116: w1 }), t(_, [2, 127], { 120: 168, 10: [1, 286], 14: E1, 44: x1, 60: C1, 89: T1, 105: D1, 106: S1, 109: F1, 111: _1, 114: B1, 115: v1, 116: w1 }), t(_, [2, 114]), { 31: [1, 287], 67: k, 82: 219, 116: y, 117: m, 118: E }, { 6: 11, 7: 12, 8: p, 9: o, 10: c, 11: f, 20: 17, 22: 18, 23: 19, 24: 20, 25: 21, 26: 22, 27: F, 32: [1, 288], 33: 24, 34: g, 36: x, 38: K, 42: 28, 43: 39, 44: b, 45: 40, 47: 41, 60: C, 84: g1, 85: f1, 86: A1, 87: P1, 88: G1, 89: v, 102: w, 105: $, 106: L, 109: I, 111: N, 113: 42, 114: R, 115: P, 116: G, 121: O1, 122: M1, 123: U1, 124: V1, 125: z1 }, { 10: s1, 60: i1, 84: r1, 92: 289, 105: a1, 107: 242, 108: 243, 109: u1, 110: n1, 111: l1, 112: o1 }, { 10: s1, 60: i1, 84: r1, 92: 290, 105: a1, 107: 242, 108: 243, 109: u1, 110: n1, 111: l1, 112: o1 }, t(M, [2, 62]), t(D, [2, 33]), t(_, [2, 124], { 106: I1 }), t(_, [2, 125], { 106: I1 })], defaultActions: {}, parseError: A(function(J, l) {
    if (l.recoverable) this.trace(J);
    else {
      var d = new Error(J);
      throw d.hash = l, d;
    }
  }, "parseError"), parse: A(function(J) {
    var l = this, d = [0], n = [], T = [null], e = [], W = this.table, s = "", B = 0, Nt = 0, zt = 0, Wt = 2, Rt = 1, Kt = e.slice.call(arguments, 1), O = Object.create(this.lexer), k1 = { yy: {} };
    for (var J1 in this.yy) Object.prototype.hasOwnProperty.call(this.yy, J1) && (k1.yy[J1] = this.yy[J1]);
    O.setInput(J, k1.yy), k1.yy.lexer = O, k1.yy.parser = this, typeof O.yylloc > "u" && (O.yylloc = {});
    var Y1 = O.yylloc;
    e.push(Y1);
    var Ht = O.options && O.options.ranges;
    typeof k1.yy.parseError == "function" ? this.parseError = k1.yy.parseError : this.parseError = Object.getPrototypeOf(this).parseError;
    function jt(X) {
      d.length = d.length - 2 * X, T.length = T.length - X, e.length = e.length - X;
    }
    A(jt, "popStack");
    function Pt() {
      var X;
      return X = n.pop() || O.lex() || Rt, typeof X != "number" && (X instanceof Array && (n = X, X = n.pop()), X = l.symbols_[X] || X), X;
    }
    A(Pt, "lex");
    for (var z, Q1, y1, q, Te, tt, N1 = {}, j1, c1, Gt, X1; ; ) {
      if (y1 = d[d.length - 1], this.defaultActions[y1] ? q = this.defaultActions[y1] : ((z === null || typeof z > "u") && (z = Pt()), q = W[y1] && W[y1][z]), typeof q > "u" || !q.length || !q[0]) {
        var et = "";
        X1 = [];
        for (j1 in W[y1]) this.terminals_[j1] && j1 > Wt && X1.push("'" + this.terminals_[j1] + "'");
        O.showPosition ? et = "Parse error on line " + (B + 1) + `:
` + O.showPosition() + `
Expecting ` + X1.join(", ") + ", got '" + (this.terminals_[z] || z) + "'" : et = "Parse error on line " + (B + 1) + ": Unexpected " + (z == Rt ? "end of input" : "'" + (this.terminals_[z] || z) + "'"), this.parseError(et, { text: O.match, token: this.terminals_[z] || z, line: O.yylineno, loc: Y1, expected: X1 });
      }
      if (q[0] instanceof Array && q.length > 1) throw new Error("Parse Error: multiple actions possible at state: " + y1 + ", token: " + z);
      switch (q[0]) {
        case 1:
          d.push(z), T.push(O.yytext), e.push(O.yylloc), d.push(q[1]), z = null, Q1 ? (z = Q1, Q1 = null) : (Nt = O.yyleng, s = O.yytext, B = O.yylineno, Y1 = O.yylloc, zt > 0);
          break;
        case 2:
          if (c1 = this.productions_[q[1]][1], N1.$ = T[T.length - c1], N1._$ = { first_line: e[e.length - (c1 || 1)].first_line, last_line: e[e.length - 1].last_line, first_column: e[e.length - (c1 || 1)].first_column, last_column: e[e.length - 1].last_column }, Ht && (N1._$.range = [e[e.length - (c1 || 1)].range[0], e[e.length - 1].range[1]]), tt = this.performAction.apply(N1, [s, Nt, B, k1.yy, q[1], T, e].concat(Kt)), typeof tt < "u") return tt;
          c1 && (d = d.slice(0, -1 * c1 * 2), T = T.slice(0, -1 * c1), e = e.slice(0, -1 * c1)), d.push(this.productions_[q[1]][0]), T.push(N1.$), e.push(N1._$), Gt = W[d[d.length - 2]][d[d.length - 1]], d.push(Gt);
          break;
        case 3:
          return true;
      }
    }
    return true;
  }, "parse") }, Vt = function() {
    var J = { EOF: 1, parseError: A(function(l, d) {
      if (this.yy.parser) this.yy.parser.parseError(l, d);
      else throw new Error(l);
    }, "parseError"), setInput: A(function(l, d) {
      return this.yy = d || this.yy || {}, this._input = l, this._more = this._backtrack = this.done = false, this.yylineno = this.yyleng = 0, this.yytext = this.matched = this.match = "", this.conditionStack = ["INITIAL"], this.yylloc = { first_line: 1, first_column: 0, last_line: 1, last_column: 0 }, this.options.ranges && (this.yylloc.range = [0, 0]), this.offset = 0, this;
    }, "setInput"), input: A(function() {
      var l = this._input[0];
      this.yytext += l, this.yyleng++, this.offset++, this.match += l, this.matched += l;
      var d = l.match(/(?:\r\n?|\n).*/g);
      return d ? (this.yylineno++, this.yylloc.last_line++) : this.yylloc.last_column++, this.options.ranges && this.yylloc.range[1]++, this._input = this._input.slice(1), l;
    }, "input"), unput: A(function(l) {
      var d = l.length, n = l.split(/(?:\r\n?|\n)/g);
      this._input = l + this._input, this.yytext = this.yytext.substr(0, this.yytext.length - d), this.offset -= d;
      var T = this.match.split(/(?:\r\n?|\n)/g);
      this.match = this.match.substr(0, this.match.length - 1), this.matched = this.matched.substr(0, this.matched.length - 1), n.length - 1 && (this.yylineno -= n.length - 1);
      var e = this.yylloc.range;
      return this.yylloc = { first_line: this.yylloc.first_line, last_line: this.yylineno + 1, first_column: this.yylloc.first_column, last_column: n ? (n.length === T.length ? this.yylloc.first_column : 0) + T[T.length - n.length].length - n[0].length : this.yylloc.first_column - d }, this.options.ranges && (this.yylloc.range = [e[0], e[0] + this.yyleng - d]), this.yyleng = this.yytext.length, this;
    }, "unput"), more: A(function() {
      return this._more = true, this;
    }, "more"), reject: A(function() {
      if (this.options.backtrack_lexer) this._backtrack = true;
      else return this.parseError("Lexical error on line " + (this.yylineno + 1) + `. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
` + this.showPosition(), { text: "", token: null, line: this.yylineno });
      return this;
    }, "reject"), less: A(function(l) {
      this.unput(this.match.slice(l));
    }, "less"), pastInput: A(function() {
      var l = this.matched.substr(0, this.matched.length - this.match.length);
      return (l.length > 20 ? "..." : "") + l.substr(-20).replace(/\n/g, "");
    }, "pastInput"), upcomingInput: A(function() {
      var l = this.match;
      return l.length < 20 && (l += this._input.substr(0, 20 - l.length)), (l.substr(0, 20) + (l.length > 20 ? "..." : "")).replace(/\n/g, "");
    }, "upcomingInput"), showPosition: A(function() {
      var l = this.pastInput(), d = new Array(l.length + 1).join("-");
      return l + this.upcomingInput() + `
` + d + "^";
    }, "showPosition"), test_match: A(function(l, d) {
      var n, T, e;
      if (this.options.backtrack_lexer && (e = { yylineno: this.yylineno, yylloc: { first_line: this.yylloc.first_line, last_line: this.last_line, first_column: this.yylloc.first_column, last_column: this.yylloc.last_column }, yytext: this.yytext, match: this.match, matches: this.matches, matched: this.matched, yyleng: this.yyleng, offset: this.offset, _more: this._more, _input: this._input, yy: this.yy, conditionStack: this.conditionStack.slice(0), done: this.done }, this.options.ranges && (e.yylloc.range = this.yylloc.range.slice(0))), T = l[0].match(/(?:\r\n?|\n).*/g), T && (this.yylineno += T.length), this.yylloc = { first_line: this.yylloc.last_line, last_line: this.yylineno + 1, first_column: this.yylloc.last_column, last_column: T ? T[T.length - 1].length - T[T.length - 1].match(/\r?\n?/)[0].length : this.yylloc.last_column + l[0].length }, this.yytext += l[0], this.match += l[0], this.matches = l, this.yyleng = this.yytext.length, this.options.ranges && (this.yylloc.range = [this.offset, this.offset += this.yyleng]), this._more = false, this._backtrack = false, this._input = this._input.slice(l[0].length), this.matched += l[0], n = this.performAction.call(this, this.yy, this, d, this.conditionStack[this.conditionStack.length - 1]), this.done && this._input && (this.done = false), n) return n;
      if (this._backtrack) {
        for (var W in e) this[W] = e[W];
        return false;
      }
      return false;
    }, "test_match"), next: A(function() {
      if (this.done) return this.EOF;
      this._input || (this.done = true);
      var l, d, n, T;
      this._more || (this.yytext = "", this.match = "");
      for (var e = this._currentRules(), W = 0; W < e.length; W++) if (n = this._input.match(this.rules[e[W]]), n && (!d || n[0].length > d[0].length)) {
        if (d = n, T = W, this.options.backtrack_lexer) {
          if (l = this.test_match(n, e[W]), l !== false) return l;
          if (this._backtrack) {
            d = false;
            continue;
          } else return false;
        } else if (!this.options.flex) break;
      }
      return d ? (l = this.test_match(d, e[T]), l !== false ? l : false) : this._input === "" ? this.EOF : this.parseError("Lexical error on line " + (this.yylineno + 1) + `. Unrecognized text.
` + this.showPosition(), { text: "", token: null, line: this.yylineno });
    }, "next"), lex: A(function() {
      var l = this.next();
      return l || this.lex();
    }, "lex"), begin: A(function(l) {
      this.conditionStack.push(l);
    }, "begin"), popState: A(function() {
      var l = this.conditionStack.length - 1;
      return l > 0 ? this.conditionStack.pop() : this.conditionStack[0];
    }, "popState"), _currentRules: A(function() {
      return this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1] ? this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules : this.conditions.INITIAL.rules;
    }, "_currentRules"), topState: A(function(l) {
      return l = this.conditionStack.length - 1 - Math.abs(l || 0), l >= 0 ? this.conditionStack[l] : "INITIAL";
    }, "topState"), pushState: A(function(l) {
      this.begin(l);
    }, "pushState"), stateStackSize: A(function() {
      return this.conditionStack.length;
    }, "stateStackSize"), options: {}, performAction: A(function(l, d, n, T) {
      switch (n) {
        case 0:
          return this.begin("acc_title"), 34;
        case 1:
          return this.popState(), "acc_title_value";
        case 2:
          return this.begin("acc_descr"), 36;
        case 3:
          return this.popState(), "acc_descr_value";
        case 4:
          this.begin("acc_descr_multiline");
          break;
        case 5:
          this.popState();
          break;
        case 6:
          return "acc_descr_multiline_value";
        case 7:
          return this.pushState("shapeData"), d.yytext = "", 40;
        case 8:
          return this.pushState("shapeDataStr"), 40;
        case 9:
          return this.popState(), 40;
        case 10:
          let e = /\n\s*/g;
          return d.yytext = d.yytext.replace(e, "<br/>"), 40;
        case 11:
          return 40;
        case 12:
          this.popState();
          break;
        case 13:
          this.begin("callbackname");
          break;
        case 14:
          this.popState();
          break;
        case 15:
          this.popState(), this.begin("callbackargs");
          break;
        case 16:
          return 95;
        case 17:
          this.popState();
          break;
        case 18:
          return 96;
        case 19:
          return "MD_STR";
        case 20:
          this.popState();
          break;
        case 21:
          this.begin("md_string");
          break;
        case 22:
          return "STR";
        case 23:
          this.popState();
          break;
        case 24:
          this.pushState("string");
          break;
        case 25:
          return 84;
        case 26:
          return 102;
        case 27:
          return 85;
        case 28:
          return 104;
        case 29:
          return 86;
        case 30:
          return 87;
        case 31:
          return 97;
        case 32:
          this.begin("click");
          break;
        case 33:
          this.popState();
          break;
        case 34:
          return 88;
        case 35:
          return l.lex.firstGraph() && this.begin("dir"), 12;
        case 36:
          return l.lex.firstGraph() && this.begin("dir"), 12;
        case 37:
          return l.lex.firstGraph() && this.begin("dir"), 12;
        case 38:
          return 27;
        case 39:
          return 32;
        case 40:
          return 98;
        case 41:
          return 98;
        case 42:
          return 98;
        case 43:
          return 98;
        case 44:
          return this.popState(), 13;
        case 45:
          return this.popState(), 14;
        case 46:
          return this.popState(), 14;
        case 47:
          return this.popState(), 14;
        case 48:
          return this.popState(), 14;
        case 49:
          return this.popState(), 14;
        case 50:
          return this.popState(), 14;
        case 51:
          return this.popState(), 14;
        case 52:
          return this.popState(), 14;
        case 53:
          return this.popState(), 14;
        case 54:
          return this.popState(), 14;
        case 55:
          return 121;
        case 56:
          return 122;
        case 57:
          return 123;
        case 58:
          return 124;
        case 59:
          return 125;
        case 60:
          return 78;
        case 61:
          return 105;
        case 62:
          return 111;
        case 63:
          return 46;
        case 64:
          return 60;
        case 65:
          return 44;
        case 66:
          return 8;
        case 67:
          return 106;
        case 68:
          return 115;
        case 69:
          return this.popState(), 77;
        case 70:
          return this.pushState("edgeText"), 75;
        case 71:
          return 119;
        case 72:
          return this.popState(), 77;
        case 73:
          return this.pushState("thickEdgeText"), 75;
        case 74:
          return 119;
        case 75:
          return this.popState(), 77;
        case 76:
          return this.pushState("dottedEdgeText"), 75;
        case 77:
          return 119;
        case 78:
          return 77;
        case 79:
          return this.popState(), 53;
        case 80:
          return "TEXT";
        case 81:
          return this.pushState("ellipseText"), 52;
        case 82:
          return this.popState(), 55;
        case 83:
          return this.pushState("text"), 54;
        case 84:
          return this.popState(), 57;
        case 85:
          return this.pushState("text"), 56;
        case 86:
          return 58;
        case 87:
          return this.pushState("text"), 67;
        case 88:
          return this.popState(), 64;
        case 89:
          return this.pushState("text"), 63;
        case 90:
          return this.popState(), 49;
        case 91:
          return this.pushState("text"), 48;
        case 92:
          return this.popState(), 69;
        case 93:
          return this.popState(), 71;
        case 94:
          return 117;
        case 95:
          return this.pushState("trapText"), 68;
        case 96:
          return this.pushState("trapText"), 70;
        case 97:
          return 118;
        case 98:
          return 67;
        case 99:
          return 90;
        case 100:
          return "SEP";
        case 101:
          return 89;
        case 102:
          return 115;
        case 103:
          return 111;
        case 104:
          return 44;
        case 105:
          return 109;
        case 106:
          return 114;
        case 107:
          return 116;
        case 108:
          return this.popState(), 62;
        case 109:
          return this.pushState("text"), 62;
        case 110:
          return this.popState(), 51;
        case 111:
          return this.pushState("text"), 50;
        case 112:
          return this.popState(), 31;
        case 113:
          return this.pushState("text"), 29;
        case 114:
          return this.popState(), 66;
        case 115:
          return this.pushState("text"), 65;
        case 116:
          return "TEXT";
        case 117:
          return "QUOTE";
        case 118:
          return 9;
        case 119:
          return 10;
        case 120:
          return 11;
      }
    }, "anonymous"), rules: [/^(?:accTitle\s*:\s*)/, /^(?:(?!\n||)*[^\n]*)/, /^(?:accDescr\s*:\s*)/, /^(?:(?!\n||)*[^\n]*)/, /^(?:accDescr\s*\{\s*)/, /^(?:[\}])/, /^(?:[^\}]*)/, /^(?:@\{)/, /^(?:["])/, /^(?:["])/, /^(?:[^\"]+)/, /^(?:[^}^"]+)/, /^(?:\})/, /^(?:call[\s]+)/, /^(?:\([\s]*\))/, /^(?:\()/, /^(?:[^(]*)/, /^(?:\))/, /^(?:[^)]*)/, /^(?:[^`"]+)/, /^(?:[`]["])/, /^(?:["][`])/, /^(?:[^"]+)/, /^(?:["])/, /^(?:["])/, /^(?:style\b)/, /^(?:default\b)/, /^(?:linkStyle\b)/, /^(?:interpolate\b)/, /^(?:classDef\b)/, /^(?:class\b)/, /^(?:href[\s])/, /^(?:click[\s]+)/, /^(?:[\s\n])/, /^(?:[^\s\n]*)/, /^(?:flowchart-elk\b)/, /^(?:graph\b)/, /^(?:flowchart\b)/, /^(?:subgraph\b)/, /^(?:end\b\s*)/, /^(?:_self\b)/, /^(?:_blank\b)/, /^(?:_parent\b)/, /^(?:_top\b)/, /^(?:(\r?\n)*\s*\n)/, /^(?:\s*LR\b)/, /^(?:\s*RL\b)/, /^(?:\s*TB\b)/, /^(?:\s*BT\b)/, /^(?:\s*TD\b)/, /^(?:\s*BR\b)/, /^(?:\s*<)/, /^(?:\s*>)/, /^(?:\s*\^)/, /^(?:\s*v\b)/, /^(?:.*direction\s+TB[^\n]*)/, /^(?:.*direction\s+BT[^\n]*)/, /^(?:.*direction\s+RL[^\n]*)/, /^(?:.*direction\s+LR[^\n]*)/, /^(?:.*direction\s+TD[^\n]*)/, /^(?:[^\s\"]+@(?=[^\{\"]))/, /^(?:[0-9]+)/, /^(?:#)/, /^(?::::)/, /^(?::)/, /^(?:&)/, /^(?:;)/, /^(?:,)/, /^(?:\*)/, /^(?:\s*[xo<]?--+[-xo>]\s*)/, /^(?:\s*[xo<]?--\s*)/, /^(?:[^-]|-(?!-)+)/, /^(?:\s*[xo<]?==+[=xo>]\s*)/, /^(?:\s*[xo<]?==\s*)/, /^(?:[^=]|=(?!))/, /^(?:\s*[xo<]?-?\.+-[xo>]?\s*)/, /^(?:\s*[xo<]?-\.\s*)/, /^(?:[^\.]|\.(?!))/, /^(?:\s*~~[\~]+\s*)/, /^(?:[-/\)][\)])/, /^(?:[^\(\)\[\]\{\}]|!\)+)/, /^(?:\(-)/, /^(?:\]\))/, /^(?:\(\[)/, /^(?:\]\])/, /^(?:\[\[)/, /^(?:\[\|)/, /^(?:>)/, /^(?:\)\])/, /^(?:\[\()/, /^(?:\)\)\))/, /^(?:\(\(\()/, /^(?:[\\(?=\])][\]])/, /^(?:\/(?=\])\])/, /^(?:\/(?!\])|\\(?!\])|[^\\\[\]\(\)\{\}\/]+)/, /^(?:\[\/)/, /^(?:\[\\)/, /^(?:<)/, /^(?:>)/, /^(?:\^)/, /^(?:\\\|)/, /^(?:v\b)/, /^(?:\*)/, /^(?:#)/, /^(?:&)/, /^(?:([A-Za-z0-9!"\#$%&'*+\.`?\\_\/]|-(?=[^\>\-\.])|(?!))+)/, /^(?:-)/, /^(?:[\u00AA\u00B5\u00BA\u00C0-\u00D6\u00D8-\u00F6]|[\u00F8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377]|[\u037A-\u037D\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5]|[\u03F7-\u0481\u048A-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA]|[\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE]|[\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA]|[\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0]|[\u08A2-\u08AC\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0977]|[\u0979-\u097F\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2]|[\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A]|[\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39]|[\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8]|[\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C]|[\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C]|[\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99]|[\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0]|[\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C3D]|[\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3]|[\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10]|[\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1]|[\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81]|[\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3]|[\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6]|[\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A]|[\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081]|[\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D]|[\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0]|[\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310]|[\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C]|[\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u1700-\u170C\u170E-\u1711]|[\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7]|[\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191C]|[\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16]|[\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF]|[\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC]|[\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D]|[\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D]|[\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3]|[\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F]|[\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128]|[\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2183\u2184]|[\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3]|[\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6]|[\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE]|[\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005\u3006\u3031-\u3035\u303B\u303C]|[\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D]|[\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC]|[\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B]|[\uA640-\uA66E\uA67F-\uA697\uA6A0-\uA6E5\uA717-\uA71F\uA722-\uA788]|[\uA78B-\uA78E\uA790-\uA793\uA7A0-\uA7AA\uA7F8-\uA801\uA803-\uA805]|[\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB]|[\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uAA00-\uAA28]|[\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA80-\uAAAF\uAAB1\uAAB5]|[\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4]|[\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E]|[\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D]|[\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36]|[\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D]|[\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC]|[\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF]|[\uFFD2-\uFFD7\uFFDA-\uFFDC])/, /^(?:\|)/, /^(?:\|)/, /^(?:\))/, /^(?:\()/, /^(?:\])/, /^(?:\[)/, /^(?:(\}))/, /^(?:\{)/, /^(?:[^\[\]\(\)\{\}\|\"]+)/, /^(?:")/, /^(?:(\r?\n)+)/, /^(?:\s)/, /^(?:$)/], conditions: { shapeDataEndBracket: { rules: [21, 24, 78, 81, 83, 85, 89, 91, 95, 96, 109, 111, 113, 115], inclusive: false }, shapeDataStr: { rules: [9, 10, 21, 24, 78, 81, 83, 85, 89, 91, 95, 96, 109, 111, 113, 115], inclusive: false }, shapeData: { rules: [8, 11, 12, 21, 24, 78, 81, 83, 85, 89, 91, 95, 96, 109, 111, 113, 115], inclusive: false }, callbackargs: { rules: [17, 18, 21, 24, 78, 81, 83, 85, 89, 91, 95, 96, 109, 111, 113, 115], inclusive: false }, callbackname: { rules: [14, 15, 16, 21, 24, 78, 81, 83, 85, 89, 91, 95, 96, 109, 111, 113, 115], inclusive: false }, href: { rules: [21, 24, 78, 81, 83, 85, 89, 91, 95, 96, 109, 111, 113, 115], inclusive: false }, click: { rules: [21, 24, 33, 34, 78, 81, 83, 85, 89, 91, 95, 96, 109, 111, 113, 115], inclusive: false }, dottedEdgeText: { rules: [21, 24, 75, 77, 78, 81, 83, 85, 89, 91, 95, 96, 109, 111, 113, 115], inclusive: false }, thickEdgeText: { rules: [21, 24, 72, 74, 78, 81, 83, 85, 89, 91, 95, 96, 109, 111, 113, 115], inclusive: false }, edgeText: { rules: [21, 24, 69, 71, 78, 81, 83, 85, 89, 91, 95, 96, 109, 111, 113, 115], inclusive: false }, trapText: { rules: [21, 24, 78, 81, 83, 85, 89, 91, 92, 93, 94, 95, 96, 109, 111, 113, 115], inclusive: false }, ellipseText: { rules: [21, 24, 78, 79, 80, 81, 83, 85, 89, 91, 95, 96, 109, 111, 113, 115], inclusive: false }, text: { rules: [21, 24, 78, 81, 82, 83, 84, 85, 88, 89, 90, 91, 95, 96, 108, 109, 110, 111, 112, 113, 114, 115, 116], inclusive: false }, vertex: { rules: [21, 24, 78, 81, 83, 85, 89, 91, 95, 96, 109, 111, 113, 115], inclusive: false }, dir: { rules: [21, 24, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 78, 81, 83, 85, 89, 91, 95, 96, 109, 111, 113, 115], inclusive: false }, acc_descr_multiline: { rules: [5, 6, 21, 24, 78, 81, 83, 85, 89, 91, 95, 96, 109, 111, 113, 115], inclusive: false }, acc_descr: { rules: [3, 21, 24, 78, 81, 83, 85, 89, 91, 95, 96, 109, 111, 113, 115], inclusive: false }, acc_title: { rules: [1, 21, 24, 78, 81, 83, 85, 89, 91, 95, 96, 109, 111, 113, 115], inclusive: false }, md_string: { rules: [19, 20, 21, 24, 78, 81, 83, 85, 89, 91, 95, 96, 109, 111, 113, 115], inclusive: false }, string: { rules: [21, 22, 23, 24, 78, 81, 83, 85, 89, 91, 95, 96, 109, 111, 113, 115], inclusive: false }, INITIAL: { rules: [0, 2, 4, 7, 13, 21, 24, 25, 26, 27, 28, 29, 30, 31, 32, 35, 36, 37, 38, 39, 40, 41, 42, 43, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 72, 73, 75, 76, 78, 81, 83, 85, 86, 87, 89, 91, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 109, 111, 113, 115, 117, 118, 119, 120], inclusive: true } } };
    return J;
  }();
  Z1.lexer = Vt;
  function H1() {
    this.yy = {};
  }
  return A(H1, "Parser"), H1.prototype = Z1, Z1.Parser = H1, new H1();
}();
rt.parser = rt;
var Mt = rt, Ut = Object.assign({}, Mt);
Ut.parse = (t) => {
  let i = t.replace(/}\s*\n/g, `}
`);
  return Mt.parse(i);
};
var me = Ut, Ee = A((t, i) => {
  let r = he, u = r(t, "r"), a = r(t, "g"), h = r(t, "b");
  return ce(u, a, h, i);
}, "fade"), xe = A((t) => `.label {
    font-family: ${t.fontFamily};
    color: ${t.nodeTextColor || t.textColor};
  }
  .cluster-label text {
    fill: ${t.titleColor};
  }
  .cluster-label span {
    color: ${t.titleColor};
  }
  .cluster-label span p {
    background-color: transparent;
  }

  .label text,span {
    fill: ${t.nodeTextColor || t.textColor};
    color: ${t.nodeTextColor || t.textColor};
  }

  .node rect,
  .node circle,
  .node ellipse,
  .node polygon,
  .node path {
    fill: ${t.mainBkg};
    stroke: ${t.nodeBorder};
    stroke-width: 1px;
  }
  .rough-node .label text , .node .label text, .image-shape .label, .icon-shape .label {
    text-anchor: middle;
  }
  // .flowchart-label .text-outer-tspan {
  //   text-anchor: middle;
  // }
  // .flowchart-label .text-inner-tspan {
  //   text-anchor: start;
  // }

  .node .katex path {
    fill: #000;
    stroke: #000;
    stroke-width: 1px;
  }

  .rough-node .label,.node .label, .image-shape .label, .icon-shape .label {
    text-align: center;
  }
  .node.clickable {
    cursor: pointer;
  }


  .root .anchor path {
    fill: ${t.lineColor} !important;
    stroke-width: 0;
    stroke: ${t.lineColor};
  }

  .arrowheadPath {
    fill: ${t.arrowheadColor};
  }

  .edgePath .path {
    stroke: ${t.lineColor};
    stroke-width: 2.0px;
  }

  .flowchart-link {
    stroke: ${t.lineColor};
    fill: none;
  }

  .edgeLabel {
    background-color: ${t.edgeLabelBackground};
    p {
      background-color: ${t.edgeLabelBackground};
    }
    rect {
      opacity: 0.5;
      background-color: ${t.edgeLabelBackground};
      fill: ${t.edgeLabelBackground};
    }
    text-align: center;
  }

  /* For html labels only */
  .labelBkg {
    background-color: ${Ee(t.edgeLabelBackground, 0.5)};
    // background-color:
  }

  .cluster rect {
    fill: ${t.clusterBkg};
    stroke: ${t.clusterBorder};
    stroke-width: 1px;
  }

  .cluster text {
    fill: ${t.titleColor};
  }

  .cluster span {
    color: ${t.titleColor};
  }
  /* .cluster div {
    color: ${t.titleColor};
  } */

  div.mermaidTooltip {
    position: absolute;
    text-align: center;
    max-width: 200px;
    padding: 2px;
    font-family: ${t.fontFamily};
    font-size: 12px;
    background: ${t.tertiaryColor};
    border: 1px solid ${t.border2};
    border-radius: 2px;
    pointer-events: none;
    z-index: 100;
  }

  .flowchartTitleText {
    text-anchor: middle;
    font-size: 18px;
    fill: ${t.textColor};
  }

  rect.text {
    fill: none;
    stroke-width: 0;
  }

  .icon-shape, .image-shape {
    background-color: ${t.edgeLabelBackground};
    p {
      background-color: ${t.edgeLabelBackground};
      padding: 2px;
    }
    .label rect {
      opacity: 0.5;
      background-color: ${t.edgeLabelBackground};
      fill: ${t.edgeLabelBackground};
    }
    text-align: center;
  }
  ${Xt()}
`, "getStyles"), Ce = xe, ve = { parser: me, get db() {
  return new Ae();
}, renderer: ye, styles: Ce, init: A((t) => {
  t.flowchart || (t.flowchart = {}), t.layout && Ot({ layout: t.layout }), t.flowchart.arrowMarkerAbsolute = t.arrowMarkerAbsolute, Ot({ flowchart: { arrowMarkerAbsolute: t.arrowMarkerAbsolute } });
}, "init") };
export {
  ve as diagram
};
