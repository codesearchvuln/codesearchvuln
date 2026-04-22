var _a;
import { m as ge } from "./chunk-TBF5ZNIQ-IobXjXJc.js";
import { y as ue } from "./chunk-T4EQAHMB-gWQA89KS.js";
import { m as a, p as T, b as pe, c as ye, l as U, x as H, s as A, au as fe, aq as me, ar as be, as as _e } from "./index-CRtis_Gf.js";
var X = function() {
  var e = a(function(D, t, r, o) {
    for (r = r || {}, o = D.length; o--; r[D[o]] = t) ;
    return r;
  }, "o"), s = [1, 4], i = [1, 13], l = [1, 12], c = [1, 15], u = [1, 16], p = [1, 20], h = [1, 19], O = [6, 7, 8], q = [1, 26], z = [1, 24], V = [1, 25], _ = [6, 7, 11], Y = [1, 6, 13, 15, 16, 19, 22], J = [1, 33], K = [1, 34], x = [1, 6, 7, 11, 13, 15, 16, 19, 22], P = { trace: a(function() {
  }, "trace"), yy: {}, symbols_: { error: 2, start: 3, mindMap: 4, spaceLines: 5, SPACELINE: 6, NL: 7, MINDMAP: 8, document: 9, stop: 10, EOF: 11, statement: 12, SPACELIST: 13, node: 14, ICON: 15, CLASS: 16, nodeWithId: 17, nodeWithoutId: 18, NODE_DSTART: 19, NODE_DESCR: 20, NODE_DEND: 21, NODE_ID: 22, $accept: 0, $end: 1 }, terminals_: { 2: "error", 6: "SPACELINE", 7: "NL", 8: "MINDMAP", 11: "EOF", 13: "SPACELIST", 15: "ICON", 16: "CLASS", 19: "NODE_DSTART", 20: "NODE_DESCR", 21: "NODE_DEND", 22: "NODE_ID" }, productions_: [0, [3, 1], [3, 2], [5, 1], [5, 2], [5, 2], [4, 2], [4, 3], [10, 1], [10, 1], [10, 1], [10, 2], [10, 2], [9, 3], [9, 2], [12, 2], [12, 2], [12, 2], [12, 1], [12, 1], [12, 1], [12, 1], [12, 1], [14, 1], [14, 1], [18, 3], [17, 1], [17, 4]], performAction: a(function(D, t, r, o, d, n, b) {
    var g = n.length - 1;
    switch (d) {
      case 6:
      case 7:
        return o;
      case 8:
        o.getLogger().trace("Stop NL ");
        break;
      case 9:
        o.getLogger().trace("Stop EOF ");
        break;
      case 11:
        o.getLogger().trace("Stop NL2 ");
        break;
      case 12:
        o.getLogger().trace("Stop EOF2 ");
        break;
      case 15:
        o.getLogger().info("Node: ", n[g].id), o.addNode(n[g - 1].length, n[g].id, n[g].descr, n[g].type);
        break;
      case 16:
        o.getLogger().trace("Icon: ", n[g]), o.decorateNode({ icon: n[g] });
        break;
      case 17:
      case 21:
        o.decorateNode({ class: n[g] });
        break;
      case 18:
        o.getLogger().trace("SPACELIST");
        break;
      case 19:
        o.getLogger().trace("Node: ", n[g].id), o.addNode(0, n[g].id, n[g].descr, n[g].type);
        break;
      case 20:
        o.decorateNode({ icon: n[g] });
        break;
      case 25:
        o.getLogger().trace("node found ..", n[g - 2]), this.$ = { id: n[g - 1], descr: n[g - 1], type: o.getType(n[g - 2], n[g]) };
        break;
      case 26:
        this.$ = { id: n[g], descr: n[g], type: o.nodeType.DEFAULT };
        break;
      case 27:
        o.getLogger().trace("node found ..", n[g - 3]), this.$ = { id: n[g - 3], descr: n[g - 1], type: o.getType(n[g - 2], n[g]) };
        break;
    }
  }, "anonymous"), table: [{ 3: 1, 4: 2, 5: 3, 6: [1, 5], 8: s }, { 1: [3] }, { 1: [2, 1] }, { 4: 6, 6: [1, 7], 7: [1, 8], 8: s }, { 6: i, 7: [1, 10], 9: 9, 12: 11, 13: l, 14: 14, 15: c, 16: u, 17: 17, 18: 18, 19: p, 22: h }, e(O, [2, 3]), { 1: [2, 2] }, e(O, [2, 4]), e(O, [2, 5]), { 1: [2, 6], 6: i, 12: 21, 13: l, 14: 14, 15: c, 16: u, 17: 17, 18: 18, 19: p, 22: h }, { 6: i, 9: 22, 12: 11, 13: l, 14: 14, 15: c, 16: u, 17: 17, 18: 18, 19: p, 22: h }, { 6: q, 7: z, 10: 23, 11: V }, e(_, [2, 22], { 17: 17, 18: 18, 14: 27, 15: [1, 28], 16: [1, 29], 19: p, 22: h }), e(_, [2, 18]), e(_, [2, 19]), e(_, [2, 20]), e(_, [2, 21]), e(_, [2, 23]), e(_, [2, 24]), e(_, [2, 26], { 19: [1, 30] }), { 20: [1, 31] }, { 6: q, 7: z, 10: 32, 11: V }, { 1: [2, 7], 6: i, 12: 21, 13: l, 14: 14, 15: c, 16: u, 17: 17, 18: 18, 19: p, 22: h }, e(Y, [2, 14], { 7: J, 11: K }), e(x, [2, 8]), e(x, [2, 9]), e(x, [2, 10]), e(_, [2, 15]), e(_, [2, 16]), e(_, [2, 17]), { 20: [1, 35] }, { 21: [1, 36] }, e(Y, [2, 13], { 7: J, 11: K }), e(x, [2, 11]), e(x, [2, 12]), { 21: [1, 37] }, e(_, [2, 25]), e(_, [2, 27])], defaultActions: { 2: [2, 1], 6: [2, 2] }, parseError: a(function(D, t) {
    if (t.recoverable) this.trace(D);
    else {
      var r = new Error(D);
      throw r.hash = t, r;
    }
  }, "parseError"), parse: a(function(D) {
    var t = this, r = [0], o = [], d = [null], n = [], b = this.table, g = "", R = 0, Q = 0, ae = 0, le = 2, Z = 1, ce = n.slice.call(arguments, 1), y = Object.create(this.lexer), L = { yy: {} };
    for (var M in this.yy) Object.prototype.hasOwnProperty.call(this.yy, M) && (L.yy[M] = this.yy[M]);
    y.setInput(D, L.yy), L.yy.lexer = y, L.yy.parser = this, typeof y.yylloc > "u" && (y.yylloc = {});
    var B = y.yylloc;
    n.push(B);
    var he = y.options && y.options.ranges;
    typeof L.yy.parseError == "function" ? this.parseError = L.yy.parseError : this.parseError = Object.getPrototypeOf(this).parseError;
    function de(E) {
      r.length = r.length - 2 * E, d.length = d.length - E, n.length = n.length - E;
    }
    a(de, "popStack");
    function ee() {
      var E;
      return E = o.pop() || y.lex() || Z, typeof E != "number" && (E instanceof Array && (o = E, E = o.pop()), E = t.symbols_[E] || E), E;
    }
    a(ee, "lex");
    for (var m, F, v, N, Ce, j, I = {}, $, S, te, w; ; ) {
      if (v = r[r.length - 1], this.defaultActions[v] ? N = this.defaultActions[v] : ((m === null || typeof m > "u") && (m = ee()), N = b[v] && b[v][m]), typeof N > "u" || !N.length || !N[0]) {
        var G = "";
        w = [];
        for ($ in b[v]) this.terminals_[$] && $ > le && w.push("'" + this.terminals_[$] + "'");
        y.showPosition ? G = "Parse error on line " + (R + 1) + `:
` + y.showPosition() + `
Expecting ` + w.join(", ") + ", got '" + (this.terminals_[m] || m) + "'" : G = "Parse error on line " + (R + 1) + ": Unexpected " + (m == Z ? "end of input" : "'" + (this.terminals_[m] || m) + "'"), this.parseError(G, { text: y.match, token: this.terminals_[m] || m, line: y.yylineno, loc: B, expected: w });
      }
      if (N[0] instanceof Array && N.length > 1) throw new Error("Parse Error: multiple actions possible at state: " + v + ", token: " + m);
      switch (N[0]) {
        case 1:
          r.push(m), d.push(y.yytext), n.push(y.yylloc), r.push(N[1]), m = null, F ? (m = F, F = null) : (Q = y.yyleng, g = y.yytext, R = y.yylineno, B = y.yylloc, ae > 0);
          break;
        case 2:
          if (S = this.productions_[N[1]][1], I.$ = d[d.length - S], I._$ = { first_line: n[n.length - (S || 1)].first_line, last_line: n[n.length - 1].last_line, first_column: n[n.length - (S || 1)].first_column, last_column: n[n.length - 1].last_column }, he && (I._$.range = [n[n.length - (S || 1)].range[0], n[n.length - 1].range[1]]), j = this.performAction.apply(I, [g, Q, R, L.yy, N[1], d, n].concat(ce)), typeof j < "u") return j;
          S && (r = r.slice(0, -1 * S * 2), d = d.slice(0, -1 * S), n = n.slice(0, -1 * S)), r.push(this.productions_[N[1]][0]), d.push(I.$), n.push(I._$), te = b[r[r.length - 2]][r[r.length - 1]], r.push(te);
          break;
        case 3:
          return true;
      }
    }
    return true;
  }, "parse") }, oe = function() {
    var D = { EOF: 1, parseError: a(function(t, r) {
      if (this.yy.parser) this.yy.parser.parseError(t, r);
      else throw new Error(t);
    }, "parseError"), setInput: a(function(t, r) {
      return this.yy = r || this.yy || {}, this._input = t, this._more = this._backtrack = this.done = false, this.yylineno = this.yyleng = 0, this.yytext = this.matched = this.match = "", this.conditionStack = ["INITIAL"], this.yylloc = { first_line: 1, first_column: 0, last_line: 1, last_column: 0 }, this.options.ranges && (this.yylloc.range = [0, 0]), this.offset = 0, this;
    }, "setInput"), input: a(function() {
      var t = this._input[0];
      this.yytext += t, this.yyleng++, this.offset++, this.match += t, this.matched += t;
      var r = t.match(/(?:\r\n?|\n).*/g);
      return r ? (this.yylineno++, this.yylloc.last_line++) : this.yylloc.last_column++, this.options.ranges && this.yylloc.range[1]++, this._input = this._input.slice(1), t;
    }, "input"), unput: a(function(t) {
      var r = t.length, o = t.split(/(?:\r\n?|\n)/g);
      this._input = t + this._input, this.yytext = this.yytext.substr(0, this.yytext.length - r), this.offset -= r;
      var d = this.match.split(/(?:\r\n?|\n)/g);
      this.match = this.match.substr(0, this.match.length - 1), this.matched = this.matched.substr(0, this.matched.length - 1), o.length - 1 && (this.yylineno -= o.length - 1);
      var n = this.yylloc.range;
      return this.yylloc = { first_line: this.yylloc.first_line, last_line: this.yylineno + 1, first_column: this.yylloc.first_column, last_column: o ? (o.length === d.length ? this.yylloc.first_column : 0) + d[d.length - o.length].length - o[0].length : this.yylloc.first_column - r }, this.options.ranges && (this.yylloc.range = [n[0], n[0] + this.yyleng - r]), this.yyleng = this.yytext.length, this;
    }, "unput"), more: a(function() {
      return this._more = true, this;
    }, "more"), reject: a(function() {
      if (this.options.backtrack_lexer) this._backtrack = true;
      else return this.parseError("Lexical error on line " + (this.yylineno + 1) + `. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
` + this.showPosition(), { text: "", token: null, line: this.yylineno });
      return this;
    }, "reject"), less: a(function(t) {
      this.unput(this.match.slice(t));
    }, "less"), pastInput: a(function() {
      var t = this.matched.substr(0, this.matched.length - this.match.length);
      return (t.length > 20 ? "..." : "") + t.substr(-20).replace(/\n/g, "");
    }, "pastInput"), upcomingInput: a(function() {
      var t = this.match;
      return t.length < 20 && (t += this._input.substr(0, 20 - t.length)), (t.substr(0, 20) + (t.length > 20 ? "..." : "")).replace(/\n/g, "");
    }, "upcomingInput"), showPosition: a(function() {
      var t = this.pastInput(), r = new Array(t.length + 1).join("-");
      return t + this.upcomingInput() + `
` + r + "^";
    }, "showPosition"), test_match: a(function(t, r) {
      var o, d, n;
      if (this.options.backtrack_lexer && (n = { yylineno: this.yylineno, yylloc: { first_line: this.yylloc.first_line, last_line: this.last_line, first_column: this.yylloc.first_column, last_column: this.yylloc.last_column }, yytext: this.yytext, match: this.match, matches: this.matches, matched: this.matched, yyleng: this.yyleng, offset: this.offset, _more: this._more, _input: this._input, yy: this.yy, conditionStack: this.conditionStack.slice(0), done: this.done }, this.options.ranges && (n.yylloc.range = this.yylloc.range.slice(0))), d = t[0].match(/(?:\r\n?|\n).*/g), d && (this.yylineno += d.length), this.yylloc = { first_line: this.yylloc.last_line, last_line: this.yylineno + 1, first_column: this.yylloc.last_column, last_column: d ? d[d.length - 1].length - d[d.length - 1].match(/\r?\n?/)[0].length : this.yylloc.last_column + t[0].length }, this.yytext += t[0], this.match += t[0], this.matches = t, this.yyleng = this.yytext.length, this.options.ranges && (this.yylloc.range = [this.offset, this.offset += this.yyleng]), this._more = false, this._backtrack = false, this._input = this._input.slice(t[0].length), this.matched += t[0], o = this.performAction.call(this, this.yy, this, r, this.conditionStack[this.conditionStack.length - 1]), this.done && this._input && (this.done = false), o) return o;
      if (this._backtrack) {
        for (var b in n) this[b] = n[b];
        return false;
      }
      return false;
    }, "test_match"), next: a(function() {
      if (this.done) return this.EOF;
      this._input || (this.done = true);
      var t, r, o, d;
      this._more || (this.yytext = "", this.match = "");
      for (var n = this._currentRules(), b = 0; b < n.length; b++) if (o = this._input.match(this.rules[n[b]]), o && (!r || o[0].length > r[0].length)) {
        if (r = o, d = b, this.options.backtrack_lexer) {
          if (t = this.test_match(o, n[b]), t !== false) return t;
          if (this._backtrack) {
            r = false;
            continue;
          } else return false;
        } else if (!this.options.flex) break;
      }
      return r ? (t = this.test_match(r, n[d]), t !== false ? t : false) : this._input === "" ? this.EOF : this.parseError("Lexical error on line " + (this.yylineno + 1) + `. Unrecognized text.
` + this.showPosition(), { text: "", token: null, line: this.yylineno });
    }, "next"), lex: a(function() {
      var t = this.next();
      return t || this.lex();
    }, "lex"), begin: a(function(t) {
      this.conditionStack.push(t);
    }, "begin"), popState: a(function() {
      var t = this.conditionStack.length - 1;
      return t > 0 ? this.conditionStack.pop() : this.conditionStack[0];
    }, "popState"), _currentRules: a(function() {
      return this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1] ? this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules : this.conditions.INITIAL.rules;
    }, "_currentRules"), topState: a(function(t) {
      return t = this.conditionStack.length - 1 - Math.abs(t || 0), t >= 0 ? this.conditionStack[t] : "INITIAL";
    }, "topState"), pushState: a(function(t) {
      this.begin(t);
    }, "pushState"), stateStackSize: a(function() {
      return this.conditionStack.length;
    }, "stateStackSize"), options: { "case-insensitive": true }, performAction: a(function(t, r, o, d) {
      switch (o) {
        case 0:
          return t.getLogger().trace("Found comment", r.yytext), 6;
        case 1:
          return 8;
        case 2:
          this.begin("CLASS");
          break;
        case 3:
          return this.popState(), 16;
        case 4:
          this.popState();
          break;
        case 5:
          t.getLogger().trace("Begin icon"), this.begin("ICON");
          break;
        case 6:
          return t.getLogger().trace("SPACELINE"), 6;
        case 7:
          return 7;
        case 8:
          return 15;
        case 9:
          t.getLogger().trace("end icon"), this.popState();
          break;
        case 10:
          return t.getLogger().trace("Exploding node"), this.begin("NODE"), 19;
        case 11:
          return t.getLogger().trace("Cloud"), this.begin("NODE"), 19;
        case 12:
          return t.getLogger().trace("Explosion Bang"), this.begin("NODE"), 19;
        case 13:
          return t.getLogger().trace("Cloud Bang"), this.begin("NODE"), 19;
        case 14:
          return this.begin("NODE"), 19;
        case 15:
          return this.begin("NODE"), 19;
        case 16:
          return this.begin("NODE"), 19;
        case 17:
          return this.begin("NODE"), 19;
        case 18:
          return 13;
        case 19:
          return 22;
        case 20:
          return 11;
        case 21:
          this.begin("NSTR2");
          break;
        case 22:
          return "NODE_DESCR";
        case 23:
          this.popState();
          break;
        case 24:
          t.getLogger().trace("Starting NSTR"), this.begin("NSTR");
          break;
        case 25:
          return t.getLogger().trace("description:", r.yytext), "NODE_DESCR";
        case 26:
          this.popState();
          break;
        case 27:
          return this.popState(), t.getLogger().trace("node end ))"), "NODE_DEND";
        case 28:
          return this.popState(), t.getLogger().trace("node end )"), "NODE_DEND";
        case 29:
          return this.popState(), t.getLogger().trace("node end ...", r.yytext), "NODE_DEND";
        case 30:
          return this.popState(), t.getLogger().trace("node end (("), "NODE_DEND";
        case 31:
          return this.popState(), t.getLogger().trace("node end (-"), "NODE_DEND";
        case 32:
          return this.popState(), t.getLogger().trace("node end (-"), "NODE_DEND";
        case 33:
          return this.popState(), t.getLogger().trace("node end (("), "NODE_DEND";
        case 34:
          return this.popState(), t.getLogger().trace("node end (("), "NODE_DEND";
        case 35:
          return t.getLogger().trace("Long description:", r.yytext), 20;
        case 36:
          return t.getLogger().trace("Long description:", r.yytext), 20;
      }
    }, "anonymous"), rules: [/^(?:\s*%%.*)/i, /^(?:mindmap\b)/i, /^(?::::)/i, /^(?:.+)/i, /^(?:\n)/i, /^(?:::icon\()/i, /^(?:[\s]+[\n])/i, /^(?:[\n]+)/i, /^(?:[^\)]+)/i, /^(?:\))/i, /^(?:-\))/i, /^(?:\(-)/i, /^(?:\)\))/i, /^(?:\))/i, /^(?:\(\()/i, /^(?:\{\{)/i, /^(?:\()/i, /^(?:\[)/i, /^(?:[\s]+)/i, /^(?:[^\(\[\n\)\{\}]+)/i, /^(?:$)/i, /^(?:["][`])/i, /^(?:[^`"]+)/i, /^(?:[`]["])/i, /^(?:["])/i, /^(?:[^"]+)/i, /^(?:["])/i, /^(?:[\)]\))/i, /^(?:[\)])/i, /^(?:[\]])/i, /^(?:\}\})/i, /^(?:\(-)/i, /^(?:-\))/i, /^(?:\(\()/i, /^(?:\()/i, /^(?:[^\)\]\(\}]+)/i, /^(?:.+(?!\(\())/i], conditions: { CLASS: { rules: [3, 4], inclusive: false }, ICON: { rules: [8, 9], inclusive: false }, NSTR2: { rules: [22, 23], inclusive: false }, NSTR: { rules: [25, 26], inclusive: false }, NODE: { rules: [21, 24, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36], inclusive: false }, INITIAL: { rules: [0, 1, 2, 5, 6, 7, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], inclusive: true } } };
    return D;
  }();
  P.lexer = oe;
  function C() {
    this.yy = {};
  }
  return a(C, "Parser"), C.prototype = P, P.Parser = C, new C();
}();
X.parser = X;
var Ee = X, f = [];
for (let e = 0; e < 256; ++e) f.push((e + 256).toString(16).slice(1));
function ne(e, s = 0) {
  return (f[e[s + 0]] + f[e[s + 1]] + f[e[s + 2]] + f[e[s + 3]] + "-" + f[e[s + 4]] + f[e[s + 5]] + "-" + f[e[s + 6]] + f[e[s + 7]] + "-" + f[e[s + 8]] + f[e[s + 9]] + "-" + f[e[s + 10]] + f[e[s + 11]] + f[e[s + 12]] + f[e[s + 13]] + f[e[s + 14]] + f[e[s + 15]]).toLowerCase();
}
a(ne, "unsafeStringify");
var W, Ne = new Uint8Array(16);
function se() {
  if (!W) {
    if (typeof crypto > "u" || !crypto.getRandomValues) throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
    W = crypto.getRandomValues.bind(crypto);
  }
  return W(Ne);
}
a(se, "rng");
var De = typeof crypto < "u" && crypto.randomUUID && crypto.randomUUID.bind(crypto), ie = { randomUUID: De };
function re(e, s, i) {
  var _a2;
  if (ie.randomUUID && !s && !e) return ie.randomUUID();
  e = e || {};
  let l = e.random ?? ((_a2 = e.rng) == null ? void 0 : _a2.call(e)) ?? se();
  if (l.length < 16) throw new Error("Random bytes length must be >= 16");
  if (l[6] = l[6] & 15 | 64, l[8] = l[8] & 63 | 128, s) {
    if (i = i || 0, i < 0 || i + 16 > s.length) throw new RangeError(`UUID byte range ${i}:${i + 15} is out of buffer bounds`);
    for (let c = 0; c < 16; ++c) s[i + c] = l[c];
    return s;
  }
  return ne(l);
}
a(re, "v4");
var Se = re, ke = 12, k = { DEFAULT: 0, NO_BORDER: 0, ROUNDED_RECT: 1, RECT: 2, CIRCLE: 3, CLOUD: 4, BANG: 5, HEXAGON: 6 }, Le = (_a = class {
  constructor() {
    this.nodes = [], this.count = 0, this.elements = {}, this.getLogger = this.getLogger.bind(this), this.nodeType = k, this.clear(), this.getType = this.getType.bind(this), this.getElementById = this.getElementById.bind(this), this.getParent = this.getParent.bind(this), this.getMindmap = this.getMindmap.bind(this), this.addNode = this.addNode.bind(this), this.decorateNode = this.decorateNode.bind(this);
  }
  clear() {
    this.nodes = [], this.count = 0, this.elements = {}, this.baseLevel = void 0;
  }
  getParent(e) {
    for (let s = this.nodes.length - 1; s >= 0; s--) if (this.nodes[s].level < e) return this.nodes[s];
    return null;
  }
  getMindmap() {
    return this.nodes.length > 0 ? this.nodes[0] : null;
  }
  addNode(e, s, i, l) {
    var _a2, _b;
    T.info("addNode", e, s, i, l);
    let c = false;
    this.nodes.length === 0 ? (this.baseLevel = e, e = 0, c = true) : this.baseLevel !== void 0 && (e = e - this.baseLevel, c = false);
    let u = H(), p = ((_a2 = u.mindmap) == null ? void 0 : _a2.padding) ?? U.mindmap.padding;
    switch (l) {
      case this.nodeType.ROUNDED_RECT:
      case this.nodeType.RECT:
      case this.nodeType.HEXAGON:
        p *= 2;
        break;
    }
    let h = { id: this.count++, nodeId: A(s, u), level: e, descr: A(i, u), type: l, children: [], width: ((_b = u.mindmap) == null ? void 0 : _b.maxNodeWidth) ?? U.mindmap.maxNodeWidth, padding: p, isRoot: c }, O = this.getParent(e);
    if (O) O.children.push(h), this.nodes.push(h);
    else if (c) this.nodes.push(h);
    else throw new Error(`There can be only one root. No parent could be found for ("${h.descr}")`);
  }
  getType(e, s) {
    switch (T.debug("In get type", e, s), e) {
      case "[":
        return this.nodeType.RECT;
      case "(":
        return s === ")" ? this.nodeType.ROUNDED_RECT : this.nodeType.CLOUD;
      case "((":
        return this.nodeType.CIRCLE;
      case ")":
        return this.nodeType.CLOUD;
      case "))":
        return this.nodeType.BANG;
      case "{{":
        return this.nodeType.HEXAGON;
      default:
        return this.nodeType.DEFAULT;
    }
  }
  setElementForId(e, s) {
    this.elements[e] = s;
  }
  getElementById(e) {
    return this.elements[e];
  }
  decorateNode(e) {
    if (!e) return;
    let s = H(), i = this.nodes[this.nodes.length - 1];
    e.icon && (i.icon = A(e.icon, s)), e.class && (i.class = A(e.class, s));
  }
  type2Str(e) {
    switch (e) {
      case this.nodeType.DEFAULT:
        return "no-border";
      case this.nodeType.RECT:
        return "rect";
      case this.nodeType.ROUNDED_RECT:
        return "rounded-rect";
      case this.nodeType.CIRCLE:
        return "circle";
      case this.nodeType.CLOUD:
        return "cloud";
      case this.nodeType.BANG:
        return "bang";
      case this.nodeType.HEXAGON:
        return "hexgon";
      default:
        return "no-border";
    }
  }
  assignSections(e, s) {
    if (e.level === 0 ? e.section = void 0 : e.section = s, e.children) for (let [i, l] of e.children.entries()) {
      let c = e.level === 0 ? i % (ke - 1) : s;
      this.assignSections(l, c);
    }
  }
  flattenNodes(e, s) {
    let i = ["mindmap-node"];
    e.isRoot === true ? i.push("section-root", "section--1") : e.section !== void 0 && i.push(`section-${e.section}`), e.class && i.push(e.class);
    let l = i.join(" "), c = a((p) => {
      switch (p) {
        case k.CIRCLE:
          return "mindmapCircle";
        case k.RECT:
          return "rect";
        case k.ROUNDED_RECT:
          return "rounded";
        case k.CLOUD:
          return "cloud";
        case k.BANG:
          return "bang";
        case k.HEXAGON:
          return "hexagon";
        case k.DEFAULT:
          return "defaultMindmapNode";
        case k.NO_BORDER:
        default:
          return "rect";
      }
    }, "getShapeFromType"), u = { id: e.id.toString(), domId: "node_" + e.id.toString(), label: e.descr, labelType: "markdown", isGroup: false, shape: c(e.type), width: e.width, height: e.height ?? 0, padding: e.padding, cssClasses: l, cssStyles: [], look: "default", icon: e.icon, x: e.x, y: e.y, level: e.level, nodeId: e.nodeId, type: e.type, section: e.section };
    if (s.push(u), e.children) for (let p of e.children) this.flattenNodes(p, s);
  }
  generateEdges(e, s) {
    if (e.children) for (let i of e.children) {
      let l = "edge";
      i.section !== void 0 && (l += ` section-edge-${i.section}`);
      let c = e.level + 1;
      l += ` edge-depth-${c}`;
      let u = { id: `edge_${e.id}_${i.id}`, start: e.id.toString(), end: i.id.toString(), type: "normal", curve: "basis", thickness: "normal", look: "default", classes: l, depth: e.level, section: i.section };
      s.push(u), this.generateEdges(i, s);
    }
  }
  getData() {
    let e = this.getMindmap(), s = H(), i = fe().layout !== void 0, l = s;
    if (i || (l.layout = "cose-bilkent"), !e) return { nodes: [], edges: [], config: l };
    T.debug("getData: mindmapRoot", e, s), this.assignSections(e);
    let c = [], u = [];
    this.flattenNodes(e, c), this.generateEdges(e, u), T.debug(`getData: processed ${c.length} nodes and ${u.length} edges`);
    let p = /* @__PURE__ */ new Map();
    for (let h of c) p.set(h.id, { shape: h.shape, width: h.width, height: h.height, padding: h.padding });
    return { nodes: c, edges: u, config: l, rootNode: e, markers: ["point"], direction: "TB", nodeSpacing: 50, rankSpacing: 50, shapes: Object.fromEntries(p), type: "mindmap", diagramId: "mindmap-" + Se() };
  }
  getLogger() {
    return T;
  }
}, a(_a, "MindmapDB"), _a), ve = a(async (e, s, i, l) => {
  var _a2, _b;
  T.debug(`Rendering mindmap diagram
` + e);
  let c = l.db, u = c.getData(), p = ge(s, u.config.securityLevel);
  u.type = l.type, u.layoutAlgorithm = pe(u.config.layout, { fallback: "cose-bilkent" }), u.diagramId = s, c.getMindmap() && (u.nodes.forEach((h) => {
    h.shape === "rounded" ? (h.radius = 15, h.taper = 15, h.stroke = "none", h.width = 0, h.padding = 15) : h.shape === "circle" ? h.padding = 10 : h.shape === "rect" && (h.width = 0, h.padding = 10);
  }), await ye(u, p), ue(p, ((_a2 = u.config.mindmap) == null ? void 0 : _a2.padding) ?? U.mindmap.padding, "mindmapDiagram", ((_b = u.config.mindmap) == null ? void 0 : _b.useMaxWidth) ?? U.mindmap.useMaxWidth));
}, "draw"), Oe = { draw: ve }, Ie = a((e) => {
  let s = "";
  for (let i = 0; i < e.THEME_COLOR_LIMIT; i++) e["lineColor" + i] = e["lineColor" + i] || e["cScaleInv" + i], me(e["lineColor" + i]) ? e["lineColor" + i] = be(e["lineColor" + i], 20) : e["lineColor" + i] = _e(e["lineColor" + i], 20);
  for (let i = 0; i < e.THEME_COLOR_LIMIT; i++) {
    let l = "" + (17 - 3 * i);
    s += `
    .section-${i - 1} rect, .section-${i - 1} path, .section-${i - 1} circle, .section-${i - 1} polygon, .section-${i - 1} path  {
      fill: ${e["cScale" + i]};
    }
    .section-${i - 1} text {
     fill: ${e["cScaleLabel" + i]};
    }
    .node-icon-${i - 1} {
      font-size: 40px;
      color: ${e["cScaleLabel" + i]};
    }
    .section-edge-${i - 1}{
      stroke: ${e["cScale" + i]};
    }
    .edge-depth-${i - 1}{
      stroke-width: ${l};
    }
    .section-${i - 1} line {
      stroke: ${e["cScaleInv" + i]} ;
      stroke-width: 3;
    }

    .disabled, .disabled circle, .disabled text {
      fill: lightgray;
    }
    .disabled text {
      fill: #efefef;
    }
    `;
  }
  return s;
}, "genSections"), Te = a((e) => `
  .edge {
    stroke-width: 3;
  }
  ${Ie(e)}
  .section-root rect, .section-root path, .section-root circle, .section-root polygon  {
    fill: ${e.git0};
  }
  .section-root text {
    fill: ${e.gitBranchLabel0};
  }
  .section-root span {
    color: ${e.gitBranchLabel0};
  }
  .section-2 span {
    color: ${e.gitBranchLabel0};
  }
  .icon-container {
    height:100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .edge {
    fill: none;
  }
  .mindmap-node-label {
    dy: 1em;
    alignment-baseline: middle;
    text-anchor: middle;
    dominant-baseline: middle;
    text-align: center;
  }
`, "getStyles"), xe = Te, Ae = { get db() {
  return new Le();
}, renderer: Oe, parser: Ee, styles: xe };
export {
  Ae as diagram
};
