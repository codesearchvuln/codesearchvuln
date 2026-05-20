var _a;
import { m as h, x as lt, a8 as ut, a7 as yt, aK as dt, $ as pt, a as gt, K as et, V as ft, j as kt, X as mt, Y as wt, Z as xt, U as bt } from "./index-CRtis_Gf.js";
var J = function() {
  var e = h(function(v, t, i, l) {
    for (i = i || {}, l = v.length; l--; i[v[l]] = t) ;
    return i;
  }, "o"), u = [1, 4], s = [1, 14], n = [1, 12], a = [1, 13], o = [6, 7, 8], f = [1, 20], c = [1, 18], p = [1, 19], d = [6, 7, 11], w = [1, 6, 13, 14], k = [1, 23], $ = [1, 24], _ = [1, 6, 7, 11, 13, 14], B = { trace: h(function() {
  }, "trace"), yy: {}, symbols_: { error: 2, start: 3, ishikawa: 4, spaceLines: 5, SPACELINE: 6, NL: 7, ISHIKAWA: 8, document: 9, stop: 10, EOF: 11, statement: 12, SPACELIST: 13, TEXT: 14, $accept: 0, $end: 1 }, terminals_: { 2: "error", 6: "SPACELINE", 7: "NL", 8: "ISHIKAWA", 11: "EOF", 13: "SPACELIST", 14: "TEXT" }, productions_: [0, [3, 1], [3, 2], [5, 1], [5, 2], [5, 2], [4, 2], [4, 3], [10, 1], [10, 1], [10, 1], [10, 2], [10, 2], [9, 3], [9, 2], [12, 2], [12, 1], [12, 1], [12, 1]], performAction: h(function(v, t, i, l, y, r, m) {
    var x = r.length - 1;
    switch (y) {
      case 6:
      case 7:
        return l;
      case 15:
        l.addNode(r[x - 1].length, r[x].trim());
        break;
      case 16:
        l.addNode(0, r[x].trim());
        break;
    }
  }, "anonymous"), table: [{ 3: 1, 4: 2, 5: 3, 6: [1, 5], 8: u }, { 1: [3] }, { 1: [2, 1] }, { 4: 6, 6: [1, 7], 7: [1, 8], 8: u }, { 6: s, 7: [1, 10], 9: 9, 12: 11, 13: n, 14: a }, e(o, [2, 3]), { 1: [2, 2] }, e(o, [2, 4]), e(o, [2, 5]), { 1: [2, 6], 6: s, 12: 15, 13: n, 14: a }, { 6: s, 9: 16, 12: 11, 13: n, 14: a }, { 6: f, 7: c, 10: 17, 11: p }, e(d, [2, 18], { 14: [1, 21] }), e(d, [2, 16]), e(d, [2, 17]), { 6: f, 7: c, 10: 22, 11: p }, { 1: [2, 7], 6: s, 12: 15, 13: n, 14: a }, e(w, [2, 14], { 7: k, 11: $ }), e(_, [2, 8]), e(_, [2, 9]), e(_, [2, 10]), e(d, [2, 15]), e(w, [2, 13], { 7: k, 11: $ }), e(_, [2, 11]), e(_, [2, 12])], defaultActions: { 2: [2, 1], 6: [2, 2] }, parseError: h(function(v, t) {
    if (t.recoverable) this.trace(v);
    else {
      var i = new Error(v);
      throw i.hash = t, i;
    }
  }, "parseError"), parse: h(function(v) {
    var t = this, i = [0], l = [], y = [null], r = [], m = this.table, x = "", b = 0, C = 0, S = 0, M = 2, P = 1, W = r.slice.call(arguments, 1), g = Object.create(this.lexer), I = { yy: {} };
    for (var R in this.yy) Object.prototype.hasOwnProperty.call(this.yy, R) && (I.yy[R] = this.yy[R]);
    g.setInput(v, I.yy), I.yy.lexer = g, I.yy.parser = this, typeof g.yylloc > "u" && (g.yylloc = {});
    var F = g.yylloc;
    r.push(F);
    var U = g.options && g.options.ranges;
    typeof I.yy.parseError == "function" ? this.parseError = I.yy.parseError : this.parseError = Object.getPrototypeOf(this).parseError;
    function ct(T) {
      i.length = i.length - 2 * T, y.length = y.length - T, r.length = r.length - T;
    }
    h(ct, "popStack");
    function V() {
      var T;
      return T = l.pop() || g.lex() || P, typeof T != "number" && (T instanceof Array && (l = T, T = l.pop()), T = t.symbols_[T] || T), T;
    }
    h(V, "lex");
    for (var E, G, K, N, Wt, H, j = {}, Y, L, tt, Z; ; ) {
      if (K = i[i.length - 1], this.defaultActions[K] ? N = this.defaultActions[K] : ((E === null || typeof E > "u") && (E = V()), N = m[K] && m[K][E]), typeof N > "u" || !N.length || !N[0]) {
        var q = "";
        Z = [];
        for (Y in m[K]) this.terminals_[Y] && Y > M && Z.push("'" + this.terminals_[Y] + "'");
        g.showPosition ? q = "Parse error on line " + (b + 1) + `:
` + g.showPosition() + `
Expecting ` + Z.join(", ") + ", got '" + (this.terminals_[E] || E) + "'" : q = "Parse error on line " + (b + 1) + ": Unexpected " + (E == P ? "end of input" : "'" + (this.terminals_[E] || E) + "'"), this.parseError(q, { text: g.match, token: this.terminals_[E] || E, line: g.yylineno, loc: F, expected: Z });
      }
      if (N[0] instanceof Array && N.length > 1) throw new Error("Parse Error: multiple actions possible at state: " + K + ", token: " + E);
      switch (N[0]) {
        case 1:
          i.push(E), y.push(g.yytext), r.push(g.yylloc), i.push(N[1]), E = null, G ? (E = G, G = null) : (C = g.yyleng, x = g.yytext, b = g.yylineno, F = g.yylloc, S > 0);
          break;
        case 2:
          if (L = this.productions_[N[1]][1], j.$ = y[y.length - L], j._$ = { first_line: r[r.length - (L || 1)].first_line, last_line: r[r.length - 1].last_line, first_column: r[r.length - (L || 1)].first_column, last_column: r[r.length - 1].last_column }, U && (j._$.range = [r[r.length - (L || 1)].range[0], r[r.length - 1].range[1]]), H = this.performAction.apply(j, [x, C, b, I.yy, N[1], y, r].concat(W)), typeof H < "u") return H;
          L && (i = i.slice(0, -1 * L * 2), y = y.slice(0, -1 * L), r = r.slice(0, -1 * L)), i.push(this.productions_[N[1]][0]), y.push(j.$), r.push(j._$), tt = m[i[i.length - 2]][i[i.length - 1]], i.push(tt);
          break;
        case 3:
          return true;
      }
    }
    return true;
  }, "parse") }, A = function() {
    var v = { EOF: 1, parseError: h(function(t, i) {
      if (this.yy.parser) this.yy.parser.parseError(t, i);
      else throw new Error(t);
    }, "parseError"), setInput: h(function(t, i) {
      return this.yy = i || this.yy || {}, this._input = t, this._more = this._backtrack = this.done = false, this.yylineno = this.yyleng = 0, this.yytext = this.matched = this.match = "", this.conditionStack = ["INITIAL"], this.yylloc = { first_line: 1, first_column: 0, last_line: 1, last_column: 0 }, this.options.ranges && (this.yylloc.range = [0, 0]), this.offset = 0, this;
    }, "setInput"), input: h(function() {
      var t = this._input[0];
      this.yytext += t, this.yyleng++, this.offset++, this.match += t, this.matched += t;
      var i = t.match(/(?:\r\n?|\n).*/g);
      return i ? (this.yylineno++, this.yylloc.last_line++) : this.yylloc.last_column++, this.options.ranges && this.yylloc.range[1]++, this._input = this._input.slice(1), t;
    }, "input"), unput: h(function(t) {
      var i = t.length, l = t.split(/(?:\r\n?|\n)/g);
      this._input = t + this._input, this.yytext = this.yytext.substr(0, this.yytext.length - i), this.offset -= i;
      var y = this.match.split(/(?:\r\n?|\n)/g);
      this.match = this.match.substr(0, this.match.length - 1), this.matched = this.matched.substr(0, this.matched.length - 1), l.length - 1 && (this.yylineno -= l.length - 1);
      var r = this.yylloc.range;
      return this.yylloc = { first_line: this.yylloc.first_line, last_line: this.yylineno + 1, first_column: this.yylloc.first_column, last_column: l ? (l.length === y.length ? this.yylloc.first_column : 0) + y[y.length - l.length].length - l[0].length : this.yylloc.first_column - i }, this.options.ranges && (this.yylloc.range = [r[0], r[0] + this.yyleng - i]), this.yyleng = this.yytext.length, this;
    }, "unput"), more: h(function() {
      return this._more = true, this;
    }, "more"), reject: h(function() {
      if (this.options.backtrack_lexer) this._backtrack = true;
      else return this.parseError("Lexical error on line " + (this.yylineno + 1) + `. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
` + this.showPosition(), { text: "", token: null, line: this.yylineno });
      return this;
    }, "reject"), less: h(function(t) {
      this.unput(this.match.slice(t));
    }, "less"), pastInput: h(function() {
      var t = this.matched.substr(0, this.matched.length - this.match.length);
      return (t.length > 20 ? "..." : "") + t.substr(-20).replace(/\n/g, "");
    }, "pastInput"), upcomingInput: h(function() {
      var t = this.match;
      return t.length < 20 && (t += this._input.substr(0, 20 - t.length)), (t.substr(0, 20) + (t.length > 20 ? "..." : "")).replace(/\n/g, "");
    }, "upcomingInput"), showPosition: h(function() {
      var t = this.pastInput(), i = new Array(t.length + 1).join("-");
      return t + this.upcomingInput() + `
` + i + "^";
    }, "showPosition"), test_match: h(function(t, i) {
      var l, y, r;
      if (this.options.backtrack_lexer && (r = { yylineno: this.yylineno, yylloc: { first_line: this.yylloc.first_line, last_line: this.last_line, first_column: this.yylloc.first_column, last_column: this.yylloc.last_column }, yytext: this.yytext, match: this.match, matches: this.matches, matched: this.matched, yyleng: this.yyleng, offset: this.offset, _more: this._more, _input: this._input, yy: this.yy, conditionStack: this.conditionStack.slice(0), done: this.done }, this.options.ranges && (r.yylloc.range = this.yylloc.range.slice(0))), y = t[0].match(/(?:\r\n?|\n).*/g), y && (this.yylineno += y.length), this.yylloc = { first_line: this.yylloc.last_line, last_line: this.yylineno + 1, first_column: this.yylloc.last_column, last_column: y ? y[y.length - 1].length - y[y.length - 1].match(/\r?\n?/)[0].length : this.yylloc.last_column + t[0].length }, this.yytext += t[0], this.match += t[0], this.matches = t, this.yyleng = this.yytext.length, this.options.ranges && (this.yylloc.range = [this.offset, this.offset += this.yyleng]), this._more = false, this._backtrack = false, this._input = this._input.slice(t[0].length), this.matched += t[0], l = this.performAction.call(this, this.yy, this, i, this.conditionStack[this.conditionStack.length - 1]), this.done && this._input && (this.done = false), l) return l;
      if (this._backtrack) {
        for (var m in r) this[m] = r[m];
        return false;
      }
      return false;
    }, "test_match"), next: h(function() {
      if (this.done) return this.EOF;
      this._input || (this.done = true);
      var t, i, l, y;
      this._more || (this.yytext = "", this.match = "");
      for (var r = this._currentRules(), m = 0; m < r.length; m++) if (l = this._input.match(this.rules[r[m]]), l && (!i || l[0].length > i[0].length)) {
        if (i = l, y = m, this.options.backtrack_lexer) {
          if (t = this.test_match(l, r[m]), t !== false) return t;
          if (this._backtrack) {
            i = false;
            continue;
          } else return false;
        } else if (!this.options.flex) break;
      }
      return i ? (t = this.test_match(i, r[y]), t !== false ? t : false) : this._input === "" ? this.EOF : this.parseError("Lexical error on line " + (this.yylineno + 1) + `. Unrecognized text.
` + this.showPosition(), { text: "", token: null, line: this.yylineno });
    }, "next"), lex: h(function() {
      var t = this.next();
      return t || this.lex();
    }, "lex"), begin: h(function(t) {
      this.conditionStack.push(t);
    }, "begin"), popState: h(function() {
      var t = this.conditionStack.length - 1;
      return t > 0 ? this.conditionStack.pop() : this.conditionStack[0];
    }, "popState"), _currentRules: h(function() {
      return this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1] ? this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules : this.conditions.INITIAL.rules;
    }, "_currentRules"), topState: h(function(t) {
      return t = this.conditionStack.length - 1 - Math.abs(t || 0), t >= 0 ? this.conditionStack[t] : "INITIAL";
    }, "topState"), pushState: h(function(t) {
      this.begin(t);
    }, "pushState"), stateStackSize: h(function() {
      return this.conditionStack.length;
    }, "stateStackSize"), options: { "case-insensitive": true }, performAction: h(function(t, i, l, y) {
      switch (l) {
        case 0:
          return 6;
        case 1:
          return 8;
        case 2:
          return 8;
        case 3:
          return 6;
        case 4:
          return 7;
        case 5:
          return 13;
        case 6:
          return 14;
        case 7:
          return 11;
      }
    }, "anonymous"), rules: [/^(?:\s*%%.*)/i, /^(?:ishikawa-beta\b)/i, /^(?:ishikawa\b)/i, /^(?:[\s]+[\n])/i, /^(?:[\n]+)/i, /^(?:[\s]+)/i, /^(?:[^\n]+)/i, /^(?:$)/i], conditions: { INITIAL: { rules: [0, 1, 2, 3, 4, 5, 6, 7], inclusive: true } } };
    return v;
  }();
  B.lexer = A;
  function D() {
    this.yy = {};
  }
  return h(D, "Parser"), D.prototype = B, B.Parser = D, new D();
}();
J.parser = J;
var _t = J, vt = (_a = class {
  constructor() {
    this.stack = [], this.clear = this.clear.bind(this), this.addNode = this.addNode.bind(this), this.getRoot = this.getRoot.bind(this);
  }
  clear() {
    this.root = void 0, this.stack = [], this.baseLevel = void 0, pt();
  }
  getRoot() {
    return this.root;
  }
  addNode(e, u) {
    let s = gt.sanitizeText(u, lt());
    if (!this.root) {
      this.baseLevel = e, this.root = { text: s, children: [] }, this.stack = [{ level: 0, node: this.root }], et(s);
      return;
    }
    let n = e - (this.baseLevel ?? 0);
    for (n <= 0 && (n = 1); this.stack.length > 1 && this.stack[this.stack.length - 1].level >= n; ) this.stack.pop();
    let a = this.stack[this.stack.length - 1].node, o = { text: s, children: [] };
    a.children.push(o), this.stack.push({ level: n, node: o });
  }
  getAccTitle() {
    return ft();
  }
  setAccTitle(e) {
    kt(e);
  }
  getAccDescription() {
    return mt();
  }
  setAccDescription(e) {
    wt(e);
  }
  getDiagramTitle() {
    return xt();
  }
  setDiagramTitle(e) {
    et(e);
  }
}, h(_a, "IshikawaDB"), _a), St = 14, O = 250, $t = 30, It = 60, Et = 5, ht = 82 * Math.PI / 180, it = Math.cos(ht), st = Math.sin(ht), nt = h((e, u, s) => {
  let n = e.node().getBBox(), a = n.width + u * 2, o = n.height + u * 2;
  bt(e, o, a, s), e.attr("viewBox", `${n.x - u} ${n.y - u} ${a} ${o}`);
}, "applyPaddedViewBox"), At = h((e, u, s, n) => {
  var _a2, _b;
  let a = n.db.getRoot();
  if (!a) return;
  let o = lt(), { look: f, handDrawnSeed: c, themeVariables: p } = o, d = ut(o.fontSize)[0] ?? St, w = f === "handDrawn", k = a.children ?? [], $ = ((_a2 = o.ishikawa) == null ? void 0 : _a2.diagramPadding) ?? 20, _ = ((_b = o.ishikawa) == null ? void 0 : _b.useMaxWidth) ?? false, B = yt(u), A = B.append("g").attr("class", "ishikawa"), D = w ? dt.svg(B.node()) : void 0, v = D ? { roughSvg: D, seed: c ?? 0, lineColor: (p == null ? void 0 : p.lineColor) ?? "#333", fillColor: (p == null ? void 0 : p.mainBkg) ?? "#fff" } : void 0, t = `ishikawa-arrow-${u}`;
  w || A.append("defs").append("marker").attr("id", t).attr("viewBox", "0 0 10 10").attr("refX", 0).attr("refY", 5).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto").append("path").attr("d", "M 10 0 L 0 5 L 10 10 Z").attr("class", "ishikawa-arrow");
  let i = 0, l = O, y = w ? void 0 : X(A, i, l, i, l, "ishikawa-spine");
  if (Mt(A, i, l, a.text, d, v), !k.length) {
    w && X(A, i, l, i, l, "ishikawa-spine", v), nt(B, $, _);
    return;
  }
  i -= 20;
  let r = k.filter((g, I) => I % 2 === 0), m = k.filter((g, I) => I % 2 === 1), x = at(r), b = at(m), C = x.total + b.total, S = O, M = O;
  if (C > 0) {
    let g = O * 2, I = O * 0.3;
    S = Math.max(I, g * (x.total / C)), M = Math.max(I, g * (b.total / C));
  }
  let P = d * 2;
  S = Math.max(S, x.max * P), M = Math.max(M, b.max * P), l = Math.max(S, O), y && y.attr("y1", l).attr("y2", l), A.select(".ishikawa-head-group").attr("transform", `translate(0,${l})`);
  let W = Math.ceil(k.length / 2);
  for (let g = 0; g < W; g++) {
    let I = A.append("g").attr("class", "ishikawa-pair");
    for (let [R, F, U] of [[k[g * 2], -1, S], [k[g * 2 + 1], 1, M]]) R && Ct(I, R, i, l, F, U, d, v);
    i = I.selectAll("text").nodes().reduce((R, F) => Math.min(R, F.getBBox().x), 1 / 0);
  }
  if (w) X(A, i, l, 0, l, "ishikawa-spine", v);
  else {
    y.attr("x1", i);
    let g = `url(#${t})`;
    A.selectAll("line.ishikawa-branch, line.ishikawa-sub-branch").attr("marker-start", g);
  }
  nt(B, $, _);
}, "draw"), at = h((e) => {
  let u = h((s) => s.children.reduce((n, a) => n + 1 + u(a), 0), "countDescendants");
  return e.reduce((s, n) => {
    let a = u(n);
    return s.total += a, s.max = Math.max(s.max, a), s;
  }, { total: 0, max: 0 });
}, "sideStats"), Mt = h((e, u, s, n, a, o) => {
  let f = Math.max(6, Math.floor(110 / (a * 0.6))), c = e.append("g").attr("class", "ishikawa-head-group").attr("transform", `translate(${u},${s})`), p = z(c, ot(n, f), 0, 0, "ishikawa-head-label", "start", a), d = p.node().getBBox(), w = Math.max(60, d.width + 6), k = Math.max(40, d.height * 2 + 40), $ = `M 0 ${-k / 2} L 0 ${k / 2} Q ${w * 2.4} 0 0 ${-k / 2} Z`;
  if (o) {
    let _ = o.roughSvg.path($, { roughness: 1.5, seed: o.seed, fill: o.fillColor, fillStyle: "hachure", fillWeight: 2.5, hachureGap: 5, stroke: o.lineColor, strokeWidth: 2 });
    c.insert(() => _, ":first-child").attr("class", "ishikawa-head");
  } else c.insert("path", ":first-child").attr("class", "ishikawa-head").attr("d", $);
  p.attr("transform", `translate(${(w - d.width) / 2 - d.x + 3},${-d.y - d.height / 2})`);
}, "drawHead"), Pt = h((e, u) => {
  let s = [], n = [], a = h((o, f, c) => {
    let p = u === -1 ? [...o].reverse() : o;
    for (let d of p) {
      let w = s.length, k = d.children ?? [];
      s.push({ depth: c, text: ot(d.text, 15), parentIndex: f, childCount: k.length }), c % 2 === 0 ? (n.push(w), k.length && a(k, w, c + 1)) : (k.length && a(k, w, c + 1), n.push(w));
    }
  }, "walk");
  return a(e, -1, 2), { entries: s, yOrder: n };
}, "flattenTree"), Bt = h((e, u, s, n, a, o, f) => {
  let c = e.append("g").attr("class", "ishikawa-label-group"), p = z(c, u, s, n + 11 * a, "ishikawa-label cause", "middle", o).node().getBBox();
  if (f) {
    let d = f.roughSvg.rectangle(p.x - 20, p.y - 2, p.width + 40, p.height + 4, { roughness: 1.5, seed: f.seed, fill: f.fillColor, fillStyle: "hachure", fillWeight: 2.5, hachureGap: 5, stroke: f.lineColor, strokeWidth: 2 });
    c.insert(() => d, ":first-child").attr("class", "ishikawa-label-box");
  } else c.insert("rect", ":first-child").attr("class", "ishikawa-label-box").attr("x", p.x - 20).attr("y", p.y - 2).attr("width", p.width + 40).attr("height", p.height + 4);
}, "drawCauseLabel"), Q = h((e, u, s, n, a, o) => {
  let f = Math.sqrt(n * n + a * a);
  if (f === 0) return;
  let c = n / f, p = a / f, d = 6, w = -p * d, k = c * d, $ = u, _ = s, B = `M ${$} ${_} L ${$ - c * d * 2 + w} ${_ - p * d * 2 + k} L ${$ - c * d * 2 - w} ${_ - p * d * 2 - k} Z`, A = o.roughSvg.path(B, { roughness: 1, seed: o.seed, fill: o.lineColor, fillStyle: "solid", stroke: o.lineColor, strokeWidth: 1 });
  e.append(() => A);
}, "drawArrowMarker"), Ct = h((e, u, s, n, a, o, f, c) => {
  let p = u.children ?? [], d = o * (p.length ? 1 : 0.2), w = -it * d, k = st * d * a, $ = s + w, _ = n + k;
  if (X(e, s, n, $, _, "ishikawa-branch", c), c && Q(e, s, n, s - $, n - _, c), Bt(e, u.text, $, _, a, f, c), !p.length) return;
  let { entries: B, yOrder: A } = Pt(p, a), D = B.length, v = new Array(D);
  for (let [r, m] of A.entries()) v[m] = n + k * ((r + 1) / (D + 1));
  let t = /* @__PURE__ */ new Map();
  t.set(-1, { x0: s, y0: n, x1: $, y1: _, childCount: p.length, childrenDrawn: 0 });
  let i = -it, l = st * a, y = a < 0 ? "ishikawa-label up" : "ishikawa-label down";
  for (let [r, m] of B.entries()) {
    let x = v[r], b = t.get(m.parentIndex), C = e.append("g").attr("class", "ishikawa-sub-group"), S = 0, M = 0, P = 0;
    if (m.depth % 2 === 0) {
      let W = b.y1 - b.y0;
      S = rt(b.x0, b.x1, W ? (x - b.y0) / W : 0.5), M = x, P = S - (m.childCount > 0 ? It + m.childCount * Et : $t), X(C, S, x, P, x, "ishikawa-sub-branch", c), c && Q(C, S, x, 1, 0, c), z(C, m.text, P, x, "ishikawa-label align", "end", f);
    } else {
      let W = b.childrenDrawn++;
      S = rt(b.x0, b.x1, (b.childCount - W) / (b.childCount + 1)), M = b.y0, P = S + i * ((x - M) / l), X(C, S, M, P, x, "ishikawa-sub-branch", c), c && Q(C, S, M, S - P, M - x, c), z(C, m.text, P, x, y, "end", f);
    }
    m.childCount > 0 && t.set(r, { x0: S, y0: M, x1: P, y1: x, childCount: m.childCount, childrenDrawn: 0 });
  }
}, "drawBranch"), Tt = h((e) => e.split(/<br\s*\/?>|\n/), "splitLines"), ot = h((e, u) => {
  if (e.length <= u) return e;
  let s = [];
  for (let n of e.split(/\s+/)) {
    let a = s.length - 1;
    a >= 0 && s[a].length + 1 + n.length <= u ? s[a] += " " + n : s.push(n);
  }
  return s.join(`
`);
}, "wrapText"), z = h((e, u, s, n, a, o, f) => {
  let c = Tt(u), p = f * 1.05, d = e.append("text").attr("class", a).attr("text-anchor", o).attr("x", s).attr("y", n - (c.length - 1) * p / 2);
  for (let [w, k] of c.entries()) d.append("tspan").attr("x", s).attr("dy", w === 0 ? 0 : p).text(k);
  return d;
}, "drawMultilineText"), rt = h((e, u, s) => e + (u - e) * s, "lerp"), X = h((e, u, s, n, a, o, f) => {
  if (f) {
    let c = f.roughSvg.line(u, s, n, a, { roughness: 1.5, seed: f.seed, stroke: f.lineColor, strokeWidth: 2 });
    e.append(() => c).attr("class", o);
    return;
  }
  return e.append("line").attr("class", o).attr("x1", u).attr("y1", s).attr("x2", n).attr("y2", a);
}, "drawLine"), Nt = { draw: At }, Dt = h((e) => `
.ishikawa .ishikawa-spine,
.ishikawa .ishikawa-branch,
.ishikawa .ishikawa-sub-branch {
  stroke: ${e.lineColor};
  stroke-width: 2;
  fill: none;
}

.ishikawa .ishikawa-sub-branch {
  stroke-width: 1;
}

.ishikawa .ishikawa-arrow {
  fill: ${e.lineColor};
}

.ishikawa .ishikawa-head {
  fill: ${e.mainBkg};
  stroke: ${e.lineColor};
  stroke-width: 2;
}

.ishikawa .ishikawa-label-box {
  fill: ${e.mainBkg};
  stroke: ${e.lineColor};
  stroke-width: 2;
}

.ishikawa text {
  font-family: ${e.fontFamily};
  font-size: ${e.fontSize};
  fill: ${e.textColor};
}

.ishikawa .ishikawa-head-label {
  font-weight: 600;
  text-anchor: middle;
  dominant-baseline: middle;
  font-size: 14px;
}

.ishikawa .ishikawa-label {
  text-anchor: end;
}

.ishikawa .ishikawa-label.cause {
  text-anchor: middle;
  dominant-baseline: middle;
}

.ishikawa .ishikawa-label.align {
  text-anchor: end;
  dominant-baseline: middle;
}

.ishikawa .ishikawa-label.up {
  dominant-baseline: baseline;
}

.ishikawa .ishikawa-label.down {
  dominant-baseline: hanging;
}
`, "getStyles"), Lt = Dt, Ft = { parser: _t, get db() {
  return new vt();
}, renderer: Nt, styles: Lt };
export {
  Ft as diagram
};
