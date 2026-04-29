var _a, _b, _c, _d, _e, _f, _g, _h, _i2, _j;
import { Y as ii, X as ei, Z as Lt, K as si, V as ai, j as ni, m as a, p as Pt, a7 as hi, U as oi, $ as ri, n as xt, s as li, L as vt, l as ci, ac as gi, ad as Tt, u as Rt, ae as ui, af as Dt } from "./index-CRtis_Gf.js";
var lt = function() {
  var t = a(function(E, h, l, c) {
    for (l = l || {}, c = E.length; c--; l[E[c]] = h) ;
    return l;
  }, "o"), i = [1, 10, 12, 14, 16, 18, 19, 21, 23], e = [2, 6], s = [1, 3], r = [1, 5], f = [1, 6], u = [1, 7], A = [1, 5, 10, 12, 14, 16, 18, 19, 21, 23, 34, 35, 36], L = [1, 25], B = [1, 26], M = [1, 28], T = [1, 29], P = [1, 30], z = [1, 31], W = [1, 32], R = [1, 33], $ = [1, 34], p = [1, 35], S = [1, 36], o = [1, 37], v = [1, 43], X = [1, 42], N = [1, 47], g = [1, 50], d = [1, 10, 12, 14, 16, 18, 19, 21, 23, 34, 35, 36], _ = [1, 10, 12, 14, 16, 18, 19, 21, 23, 24, 26, 27, 28, 34, 35, 36], m = [1, 10, 12, 14, 16, 18, 19, 21, 23, 24, 26, 27, 28, 34, 35, 36, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50], K = [1, 64], U = { trace: a(function() {
  }, "trace"), yy: {}, symbols_: { error: 2, start: 3, eol: 4, XYCHART: 5, chartConfig: 6, document: 7, CHART_ORIENTATION: 8, statement: 9, title: 10, text: 11, X_AXIS: 12, parseXAxis: 13, Y_AXIS: 14, parseYAxis: 15, LINE: 16, plotData: 17, BAR: 18, acc_title: 19, acc_title_value: 20, acc_descr: 21, acc_descr_value: 22, acc_descr_multiline_value: 23, SQUARE_BRACES_START: 24, commaSeparatedNumbers: 25, SQUARE_BRACES_END: 26, NUMBER_WITH_DECIMAL: 27, COMMA: 28, xAxisData: 29, bandData: 30, ARROW_DELIMITER: 31, commaSeparatedTexts: 32, yAxisData: 33, NEWLINE: 34, SEMI: 35, EOF: 36, alphaNum: 37, STR: 38, MD_STR: 39, alphaNumToken: 40, AMP: 41, NUM: 42, ALPHA: 43, PLUS: 44, EQUALS: 45, MULT: 46, DOT: 47, BRKT: 48, MINUS: 49, UNDERSCORE: 50, $accept: 0, $end: 1 }, terminals_: { 2: "error", 5: "XYCHART", 8: "CHART_ORIENTATION", 10: "title", 12: "X_AXIS", 14: "Y_AXIS", 16: "LINE", 18: "BAR", 19: "acc_title", 20: "acc_title_value", 21: "acc_descr", 22: "acc_descr_value", 23: "acc_descr_multiline_value", 24: "SQUARE_BRACES_START", 26: "SQUARE_BRACES_END", 27: "NUMBER_WITH_DECIMAL", 28: "COMMA", 31: "ARROW_DELIMITER", 34: "NEWLINE", 35: "SEMI", 36: "EOF", 38: "STR", 39: "MD_STR", 41: "AMP", 42: "NUM", 43: "ALPHA", 44: "PLUS", 45: "EQUALS", 46: "MULT", 47: "DOT", 48: "BRKT", 49: "MINUS", 50: "UNDERSCORE" }, productions_: [0, [3, 2], [3, 3], [3, 2], [3, 1], [6, 1], [7, 0], [7, 2], [9, 2], [9, 2], [9, 2], [9, 2], [9, 2], [9, 3], [9, 2], [9, 3], [9, 2], [9, 2], [9, 1], [17, 3], [25, 3], [25, 1], [13, 1], [13, 2], [13, 1], [29, 1], [29, 3], [30, 3], [32, 3], [32, 1], [15, 1], [15, 2], [15, 1], [33, 3], [4, 1], [4, 1], [4, 1], [11, 1], [11, 1], [11, 1], [37, 1], [37, 2], [40, 1], [40, 1], [40, 1], [40, 1], [40, 1], [40, 1], [40, 1], [40, 1], [40, 1], [40, 1]], performAction: a(function(E, h, l, c, b, n, k) {
    var x = n.length - 1;
    switch (b) {
      case 5:
        c.setOrientation(n[x]);
        break;
      case 9:
        c.setDiagramTitle(n[x].text.trim());
        break;
      case 12:
        c.setLineData({ text: "", type: "text" }, n[x]);
        break;
      case 13:
        c.setLineData(n[x - 1], n[x]);
        break;
      case 14:
        c.setBarData({ text: "", type: "text" }, n[x]);
        break;
      case 15:
        c.setBarData(n[x - 1], n[x]);
        break;
      case 16:
        this.$ = n[x].trim(), c.setAccTitle(this.$);
        break;
      case 17:
      case 18:
        this.$ = n[x].trim(), c.setAccDescription(this.$);
        break;
      case 19:
        this.$ = n[x - 1];
        break;
      case 20:
        this.$ = [Number(n[x - 2]), ...n[x]];
        break;
      case 21:
        this.$ = [Number(n[x])];
        break;
      case 22:
        c.setXAxisTitle(n[x]);
        break;
      case 23:
        c.setXAxisTitle(n[x - 1]);
        break;
      case 24:
        c.setXAxisTitle({ type: "text", text: "" });
        break;
      case 25:
        c.setXAxisBand(n[x]);
        break;
      case 26:
        c.setXAxisRangeData(Number(n[x - 2]), Number(n[x]));
        break;
      case 27:
        this.$ = n[x - 1];
        break;
      case 28:
        this.$ = [n[x - 2], ...n[x]];
        break;
      case 29:
        this.$ = [n[x]];
        break;
      case 30:
        c.setYAxisTitle(n[x]);
        break;
      case 31:
        c.setYAxisTitle(n[x - 1]);
        break;
      case 32:
        c.setYAxisTitle({ type: "text", text: "" });
        break;
      case 33:
        c.setYAxisRangeData(Number(n[x - 2]), Number(n[x]));
        break;
      case 37:
        this.$ = { text: n[x], type: "text" };
        break;
      case 38:
        this.$ = { text: n[x], type: "text" };
        break;
      case 39:
        this.$ = { text: n[x], type: "markdown" };
        break;
      case 40:
        this.$ = n[x];
        break;
      case 41:
        this.$ = n[x - 1] + "" + n[x];
        break;
    }
  }, "anonymous"), table: [t(i, e, { 3: 1, 4: 2, 7: 4, 5: s, 34: r, 35: f, 36: u }), { 1: [3] }, t(i, e, { 4: 2, 7: 4, 3: 8, 5: s, 34: r, 35: f, 36: u }), t(i, e, { 4: 2, 7: 4, 6: 9, 3: 10, 5: s, 8: [1, 11], 34: r, 35: f, 36: u }), { 1: [2, 4], 9: 12, 10: [1, 13], 12: [1, 14], 14: [1, 15], 16: [1, 16], 18: [1, 17], 19: [1, 18], 21: [1, 19], 23: [1, 20] }, t(A, [2, 34]), t(A, [2, 35]), t(A, [2, 36]), { 1: [2, 1] }, t(i, e, { 4: 2, 7: 4, 3: 21, 5: s, 34: r, 35: f, 36: u }), { 1: [2, 3] }, t(A, [2, 5]), t(i, [2, 7], { 4: 22, 34: r, 35: f, 36: u }), { 11: 23, 37: 24, 38: L, 39: B, 40: 27, 41: M, 42: T, 43: P, 44: z, 45: W, 46: R, 47: $, 48: p, 49: S, 50: o }, { 11: 39, 13: 38, 24: v, 27: X, 29: 40, 30: 41, 37: 24, 38: L, 39: B, 40: 27, 41: M, 42: T, 43: P, 44: z, 45: W, 46: R, 47: $, 48: p, 49: S, 50: o }, { 11: 45, 15: 44, 27: N, 33: 46, 37: 24, 38: L, 39: B, 40: 27, 41: M, 42: T, 43: P, 44: z, 45: W, 46: R, 47: $, 48: p, 49: S, 50: o }, { 11: 49, 17: 48, 24: g, 37: 24, 38: L, 39: B, 40: 27, 41: M, 42: T, 43: P, 44: z, 45: W, 46: R, 47: $, 48: p, 49: S, 50: o }, { 11: 52, 17: 51, 24: g, 37: 24, 38: L, 39: B, 40: 27, 41: M, 42: T, 43: P, 44: z, 45: W, 46: R, 47: $, 48: p, 49: S, 50: o }, { 20: [1, 53] }, { 22: [1, 54] }, t(d, [2, 18]), { 1: [2, 2] }, t(d, [2, 8]), t(d, [2, 9]), t(_, [2, 37], { 40: 55, 41: M, 42: T, 43: P, 44: z, 45: W, 46: R, 47: $, 48: p, 49: S, 50: o }), t(_, [2, 38]), t(_, [2, 39]), t(m, [2, 40]), t(m, [2, 42]), t(m, [2, 43]), t(m, [2, 44]), t(m, [2, 45]), t(m, [2, 46]), t(m, [2, 47]), t(m, [2, 48]), t(m, [2, 49]), t(m, [2, 50]), t(m, [2, 51]), t(d, [2, 10]), t(d, [2, 22], { 30: 41, 29: 56, 24: v, 27: X }), t(d, [2, 24]), t(d, [2, 25]), { 31: [1, 57] }, { 11: 59, 32: 58, 37: 24, 38: L, 39: B, 40: 27, 41: M, 42: T, 43: P, 44: z, 45: W, 46: R, 47: $, 48: p, 49: S, 50: o }, t(d, [2, 11]), t(d, [2, 30], { 33: 60, 27: N }), t(d, [2, 32]), { 31: [1, 61] }, t(d, [2, 12]), { 17: 62, 24: g }, { 25: 63, 27: K }, t(d, [2, 14]), { 17: 65, 24: g }, t(d, [2, 16]), t(d, [2, 17]), t(m, [2, 41]), t(d, [2, 23]), { 27: [1, 66] }, { 26: [1, 67] }, { 26: [2, 29], 28: [1, 68] }, t(d, [2, 31]), { 27: [1, 69] }, t(d, [2, 13]), { 26: [1, 70] }, { 26: [2, 21], 28: [1, 71] }, t(d, [2, 15]), t(d, [2, 26]), t(d, [2, 27]), { 11: 59, 32: 72, 37: 24, 38: L, 39: B, 40: 27, 41: M, 42: T, 43: P, 44: z, 45: W, 46: R, 47: $, 48: p, 49: S, 50: o }, t(d, [2, 33]), t(d, [2, 19]), { 25: 73, 27: K }, { 26: [2, 28] }, { 26: [2, 20] }], defaultActions: { 8: [2, 1], 10: [2, 3], 21: [2, 2], 72: [2, 28], 73: [2, 20] }, parseError: a(function(E, h) {
    if (h.recoverable) this.trace(E);
    else {
      var l = new Error(E);
      throw l.hash = h, l;
    }
  }, "parseError"), parse: a(function(E) {
    var h = this, l = [0], c = [], b = [null], n = [], k = this.table, x = "", J = 0, wt = 0, Zt = 0, Kt = 2, Ct = 1, qt = n.slice.call(arguments, 1), w = Object.create(this.lexer), F = { yy: {} };
    for (var at in this.yy) Object.prototype.hasOwnProperty.call(this.yy, at) && (F.yy[at] = this.yy[at]);
    w.setInput(E, F.yy), F.yy.lexer = w, F.yy.parser = this, typeof w.yylloc > "u" && (w.yylloc = {});
    var nt = w.yylloc;
    n.push(nt);
    var Jt = w.options && w.options.ranges;
    typeof F.yy.parseError == "function" ? this.parseError = F.yy.parseError : this.parseError = Object.getPrototypeOf(this).parseError;
    function ti(D) {
      l.length = l.length - 2 * D, b.length = b.length - D, n.length = n.length - D;
    }
    a(ti, "popStack");
    function _t() {
      var D;
      return D = c.pop() || w.lex() || Ct, typeof D != "number" && (D instanceof Array && (c = D, D = c.pop()), D = h.symbols_[D] || D), D;
    }
    a(_t, "lex");
    for (var C, ht, V, I, Ti, ot, j = {}, tt, O, kt, it; ; ) {
      if (V = l[l.length - 1], this.defaultActions[V] ? I = this.defaultActions[V] : ((C === null || typeof C > "u") && (C = _t()), I = k[V] && k[V][C]), typeof I > "u" || !I.length || !I[0]) {
        var rt = "";
        it = [];
        for (tt in k[V]) this.terminals_[tt] && tt > Kt && it.push("'" + this.terminals_[tt] + "'");
        w.showPosition ? rt = "Parse error on line " + (J + 1) + `:
` + w.showPosition() + `
Expecting ` + it.join(", ") + ", got '" + (this.terminals_[C] || C) + "'" : rt = "Parse error on line " + (J + 1) + ": Unexpected " + (C == Ct ? "end of input" : "'" + (this.terminals_[C] || C) + "'"), this.parseError(rt, { text: w.match, token: this.terminals_[C] || C, line: w.yylineno, loc: nt, expected: it });
      }
      if (I[0] instanceof Array && I.length > 1) throw new Error("Parse Error: multiple actions possible at state: " + V + ", token: " + C);
      switch (I[0]) {
        case 1:
          l.push(C), b.push(w.yytext), n.push(w.yylloc), l.push(I[1]), C = null, ht ? (C = ht, ht = null) : (wt = w.yyleng, x = w.yytext, J = w.yylineno, nt = w.yylloc, Zt > 0);
          break;
        case 2:
          if (O = this.productions_[I[1]][1], j.$ = b[b.length - O], j._$ = { first_line: n[n.length - (O || 1)].first_line, last_line: n[n.length - 1].last_line, first_column: n[n.length - (O || 1)].first_column, last_column: n[n.length - 1].last_column }, Jt && (j._$.range = [n[n.length - (O || 1)].range[0], n[n.length - 1].range[1]]), ot = this.performAction.apply(j, [x, wt, J, F.yy, I[1], b, n].concat(qt)), typeof ot < "u") return ot;
          O && (l = l.slice(0, -1 * O * 2), b = b.slice(0, -1 * O), n = n.slice(0, -1 * O)), l.push(this.productions_[I[1]][0]), b.push(j.$), n.push(j._$), kt = k[l[l.length - 2]][l[l.length - 1]], l.push(kt);
          break;
        case 3:
          return true;
      }
    }
    return true;
  }, "parse") }, q = function() {
    var E = { EOF: 1, parseError: a(function(h, l) {
      if (this.yy.parser) this.yy.parser.parseError(h, l);
      else throw new Error(h);
    }, "parseError"), setInput: a(function(h, l) {
      return this.yy = l || this.yy || {}, this._input = h, this._more = this._backtrack = this.done = false, this.yylineno = this.yyleng = 0, this.yytext = this.matched = this.match = "", this.conditionStack = ["INITIAL"], this.yylloc = { first_line: 1, first_column: 0, last_line: 1, last_column: 0 }, this.options.ranges && (this.yylloc.range = [0, 0]), this.offset = 0, this;
    }, "setInput"), input: a(function() {
      var h = this._input[0];
      this.yytext += h, this.yyleng++, this.offset++, this.match += h, this.matched += h;
      var l = h.match(/(?:\r\n?|\n).*/g);
      return l ? (this.yylineno++, this.yylloc.last_line++) : this.yylloc.last_column++, this.options.ranges && this.yylloc.range[1]++, this._input = this._input.slice(1), h;
    }, "input"), unput: a(function(h) {
      var l = h.length, c = h.split(/(?:\r\n?|\n)/g);
      this._input = h + this._input, this.yytext = this.yytext.substr(0, this.yytext.length - l), this.offset -= l;
      var b = this.match.split(/(?:\r\n?|\n)/g);
      this.match = this.match.substr(0, this.match.length - 1), this.matched = this.matched.substr(0, this.matched.length - 1), c.length - 1 && (this.yylineno -= c.length - 1);
      var n = this.yylloc.range;
      return this.yylloc = { first_line: this.yylloc.first_line, last_line: this.yylineno + 1, first_column: this.yylloc.first_column, last_column: c ? (c.length === b.length ? this.yylloc.first_column : 0) + b[b.length - c.length].length - c[0].length : this.yylloc.first_column - l }, this.options.ranges && (this.yylloc.range = [n[0], n[0] + this.yyleng - l]), this.yyleng = this.yytext.length, this;
    }, "unput"), more: a(function() {
      return this._more = true, this;
    }, "more"), reject: a(function() {
      if (this.options.backtrack_lexer) this._backtrack = true;
      else return this.parseError("Lexical error on line " + (this.yylineno + 1) + `. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
` + this.showPosition(), { text: "", token: null, line: this.yylineno });
      return this;
    }, "reject"), less: a(function(h) {
      this.unput(this.match.slice(h));
    }, "less"), pastInput: a(function() {
      var h = this.matched.substr(0, this.matched.length - this.match.length);
      return (h.length > 20 ? "..." : "") + h.substr(-20).replace(/\n/g, "");
    }, "pastInput"), upcomingInput: a(function() {
      var h = this.match;
      return h.length < 20 && (h += this._input.substr(0, 20 - h.length)), (h.substr(0, 20) + (h.length > 20 ? "..." : "")).replace(/\n/g, "");
    }, "upcomingInput"), showPosition: a(function() {
      var h = this.pastInput(), l = new Array(h.length + 1).join("-");
      return h + this.upcomingInput() + `
` + l + "^";
    }, "showPosition"), test_match: a(function(h, l) {
      var c, b, n;
      if (this.options.backtrack_lexer && (n = { yylineno: this.yylineno, yylloc: { first_line: this.yylloc.first_line, last_line: this.last_line, first_column: this.yylloc.first_column, last_column: this.yylloc.last_column }, yytext: this.yytext, match: this.match, matches: this.matches, matched: this.matched, yyleng: this.yyleng, offset: this.offset, _more: this._more, _input: this._input, yy: this.yy, conditionStack: this.conditionStack.slice(0), done: this.done }, this.options.ranges && (n.yylloc.range = this.yylloc.range.slice(0))), b = h[0].match(/(?:\r\n?|\n).*/g), b && (this.yylineno += b.length), this.yylloc = { first_line: this.yylloc.last_line, last_line: this.yylineno + 1, first_column: this.yylloc.last_column, last_column: b ? b[b.length - 1].length - b[b.length - 1].match(/\r?\n?/)[0].length : this.yylloc.last_column + h[0].length }, this.yytext += h[0], this.match += h[0], this.matches = h, this.yyleng = this.yytext.length, this.options.ranges && (this.yylloc.range = [this.offset, this.offset += this.yyleng]), this._more = false, this._backtrack = false, this._input = this._input.slice(h[0].length), this.matched += h[0], c = this.performAction.call(this, this.yy, this, l, this.conditionStack[this.conditionStack.length - 1]), this.done && this._input && (this.done = false), c) return c;
      if (this._backtrack) {
        for (var k in n) this[k] = n[k];
        return false;
      }
      return false;
    }, "test_match"), next: a(function() {
      if (this.done) return this.EOF;
      this._input || (this.done = true);
      var h, l, c, b;
      this._more || (this.yytext = "", this.match = "");
      for (var n = this._currentRules(), k = 0; k < n.length; k++) if (c = this._input.match(this.rules[n[k]]), c && (!l || c[0].length > l[0].length)) {
        if (l = c, b = k, this.options.backtrack_lexer) {
          if (h = this.test_match(c, n[k]), h !== false) return h;
          if (this._backtrack) {
            l = false;
            continue;
          } else return false;
        } else if (!this.options.flex) break;
      }
      return l ? (h = this.test_match(l, n[b]), h !== false ? h : false) : this._input === "" ? this.EOF : this.parseError("Lexical error on line " + (this.yylineno + 1) + `. Unrecognized text.
` + this.showPosition(), { text: "", token: null, line: this.yylineno });
    }, "next"), lex: a(function() {
      var h = this.next();
      return h || this.lex();
    }, "lex"), begin: a(function(h) {
      this.conditionStack.push(h);
    }, "begin"), popState: a(function() {
      var h = this.conditionStack.length - 1;
      return h > 0 ? this.conditionStack.pop() : this.conditionStack[0];
    }, "popState"), _currentRules: a(function() {
      return this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1] ? this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules : this.conditions.INITIAL.rules;
    }, "_currentRules"), topState: a(function(h) {
      return h = this.conditionStack.length - 1 - Math.abs(h || 0), h >= 0 ? this.conditionStack[h] : "INITIAL";
    }, "topState"), pushState: a(function(h) {
      this.begin(h);
    }, "pushState"), stateStackSize: a(function() {
      return this.conditionStack.length;
    }, "stateStackSize"), options: { "case-insensitive": true }, performAction: a(function(h, l, c, b) {
      switch (c) {
        case 0:
          break;
        case 1:
          break;
        case 2:
          return this.popState(), 34;
        case 3:
          return this.popState(), 34;
        case 4:
          return 34;
        case 5:
          break;
        case 6:
          return 10;
        case 7:
          return this.pushState("acc_title"), 19;
        case 8:
          return this.popState(), "acc_title_value";
        case 9:
          return this.pushState("acc_descr"), 21;
        case 10:
          return this.popState(), "acc_descr_value";
        case 11:
          this.pushState("acc_descr_multiline");
          break;
        case 12:
          this.popState();
          break;
        case 13:
          return "acc_descr_multiline_value";
        case 14:
          return 5;
        case 15:
          return 5;
        case 16:
          return 8;
        case 17:
          return this.pushState("axis_data"), "X_AXIS";
        case 18:
          return this.pushState("axis_data"), "Y_AXIS";
        case 19:
          return this.pushState("axis_band_data"), 24;
        case 20:
          return 31;
        case 21:
          return this.pushState("data"), 16;
        case 22:
          return this.pushState("data"), 18;
        case 23:
          return this.pushState("data_inner"), 24;
        case 24:
          return 27;
        case 25:
          return this.popState(), 26;
        case 26:
          this.popState();
          break;
        case 27:
          this.pushState("string");
          break;
        case 28:
          this.popState();
          break;
        case 29:
          return "STR";
        case 30:
          return 24;
        case 31:
          return 26;
        case 32:
          return 43;
        case 33:
          return "COLON";
        case 34:
          return 44;
        case 35:
          return 28;
        case 36:
          return 45;
        case 37:
          return 46;
        case 38:
          return 48;
        case 39:
          return 50;
        case 40:
          return 47;
        case 41:
          return 41;
        case 42:
          return 49;
        case 43:
          return 42;
        case 44:
          break;
        case 45:
          return 35;
        case 46:
          return 36;
      }
    }, "anonymous"), rules: [/^(?:%%(?!\{)[^\n]*)/i, /^(?:[^\}]%%[^\n]*)/i, /^(?:(\r?\n))/i, /^(?:(\r?\n))/i, /^(?:[\n\r]+)/i, /^(?:%%[^\n]*)/i, /^(?:title\b)/i, /^(?:accTitle\s*:\s*)/i, /^(?:(?!\n||)*[^\n]*)/i, /^(?:accDescr\s*:\s*)/i, /^(?:(?!\n||)*[^\n]*)/i, /^(?:accDescr\s*\{\s*)/i, /^(?:\})/i, /^(?:[^\}]*)/i, /^(?:xychart-beta\b)/i, /^(?:xychart\b)/i, /^(?:(?:vertical|horizontal))/i, /^(?:x-axis\b)/i, /^(?:y-axis\b)/i, /^(?:\[)/i, /^(?:-->)/i, /^(?:line\b)/i, /^(?:bar\b)/i, /^(?:\[)/i, /^(?:[+-]?(?:\d+(?:\.\d+)?|\.\d+))/i, /^(?:\])/i, /^(?:(?:`\)                                    \{ this\.pushState\(md_string\); \}\n<md_string>\(\?:\(\?!`"\)\.\)\+                  \{ return MD_STR; \}\n<md_string>\(\?:`))/i, /^(?:["])/i, /^(?:["])/i, /^(?:[^"]*)/i, /^(?:\[)/i, /^(?:\])/i, /^(?:[A-Za-z]+)/i, /^(?::)/i, /^(?:\+)/i, /^(?:,)/i, /^(?:=)/i, /^(?:\*)/i, /^(?:#)/i, /^(?:[\_])/i, /^(?:\.)/i, /^(?:&)/i, /^(?:-)/i, /^(?:[0-9]+)/i, /^(?:\s+)/i, /^(?:;)/i, /^(?:$)/i], conditions: { data_inner: { rules: [0, 1, 4, 5, 6, 7, 9, 11, 14, 15, 16, 17, 18, 21, 22, 24, 25, 26, 27, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46], inclusive: true }, data: { rules: [0, 1, 3, 4, 5, 6, 7, 9, 11, 14, 15, 16, 17, 18, 21, 22, 23, 26, 27, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46], inclusive: true }, axis_band_data: { rules: [0, 1, 4, 5, 6, 7, 9, 11, 14, 15, 16, 17, 18, 21, 22, 25, 26, 27, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46], inclusive: true }, axis_data: { rules: [0, 1, 2, 4, 5, 6, 7, 9, 11, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24, 26, 27, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46], inclusive: true }, acc_descr_multiline: { rules: [12, 13], inclusive: false }, acc_descr: { rules: [10], inclusive: false }, acc_title: { rules: [8], inclusive: false }, title: { rules: [], inclusive: false }, md_string: { rules: [], inclusive: false }, string: { rules: [28, 29], inclusive: false }, INITIAL: { rules: [0, 1, 4, 5, 6, 7, 9, 11, 14, 15, 16, 17, 18, 21, 22, 26, 27, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46], inclusive: true } } };
    return E;
  }();
  U.lexer = q;
  function Y() {
    this.yy = {};
  }
  return a(Y, "Parser"), Y.prototype = U, U.Parser = Y, new Y();
}();
lt.parser = lt;
var xi = lt;
function ct(t) {
  return t.type === "bar";
}
a(ct, "isBarPlot");
function dt(t) {
  return t.type === "band";
}
a(dt, "isBandAxisData");
function H(t) {
  return t.type === "linear";
}
a(H, "isLinearAxisData");
var Et = (_a = class {
  constructor(t) {
    this.parentGroup = t;
  }
  getMaxDimension(t, i) {
    if (!this.parentGroup) return { width: t.reduce((r, f) => Math.max(f.length, r), 0) * i, height: i };
    let e = { width: 0, height: 0 }, s = this.parentGroup.append("g").attr("visibility", "hidden").attr("font-size", i);
    for (let r of t) {
      let f = ui(s, 1, r), u = f ? f.width : r.length * i, A = f ? f.height : i;
      e.width = Math.max(e.width, u), e.height = Math.max(e.height, A);
    }
    return s.remove(), e;
  }
}, a(_a, "TextDimensionCalculatorWithFont"), _a), It = (_b = class {
  constructor(t, i, e, s) {
    this.axisConfig = t, this.title = i, this.textDimensionCalculator = e, this.axisThemeConfig = s, this.boundingRect = { x: 0, y: 0, width: 0, height: 0 }, this.axisPosition = "left", this.showTitle = false, this.showLabel = false, this.showTick = false, this.showAxisLine = false, this.outerPadding = 0, this.titleTextHeight = 0, this.labelTextHeight = 0, this.range = [0, 10], this.boundingRect = { x: 0, y: 0, width: 0, height: 0 }, this.axisPosition = "left";
  }
  setRange(t) {
    this.range = t, this.axisPosition === "left" || this.axisPosition === "right" ? this.boundingRect.height = t[1] - t[0] : this.boundingRect.width = t[1] - t[0], this.recalculateScale();
  }
  getRange() {
    return [this.range[0] + this.outerPadding, this.range[1] - this.outerPadding];
  }
  setAxisPosition(t) {
    this.axisPosition = t, this.setRange(this.range);
  }
  getTickDistance() {
    let t = this.getRange();
    return Math.abs(t[0] - t[1]) / this.getTickValues().length;
  }
  getAxisOuterPadding() {
    return this.outerPadding;
  }
  getLabelDimension() {
    return this.textDimensionCalculator.getMaxDimension(this.getTickValues().map((t) => t.toString()), this.axisConfig.labelFontSize);
  }
  recalculateOuterPaddingToDrawBar() {
    0.7 * this.getTickDistance() > this.outerPadding * 2 && (this.outerPadding = Math.floor(0.7 * this.getTickDistance() / 2)), this.recalculateScale();
  }
  calculateSpaceIfDrawnHorizontally(t) {
    let i = t.height;
    if (this.axisConfig.showAxisLine && i > this.axisConfig.axisLineWidth && (i -= this.axisConfig.axisLineWidth, this.showAxisLine = true), this.axisConfig.showLabel) {
      let e = this.getLabelDimension(), s = 0.2 * t.width;
      this.outerPadding = Math.min(e.width / 2, s);
      let r = e.height + this.axisConfig.labelPadding * 2;
      this.labelTextHeight = e.height, r <= i && (i -= r, this.showLabel = true);
    }
    if (this.axisConfig.showTick && i >= this.axisConfig.tickLength && (this.showTick = true, i -= this.axisConfig.tickLength), this.axisConfig.showTitle && this.title) {
      let e = this.textDimensionCalculator.getMaxDimension([this.title], this.axisConfig.titleFontSize), s = e.height + this.axisConfig.titlePadding * 2;
      this.titleTextHeight = e.height, s <= i && (i -= s, this.showTitle = true);
    }
    this.boundingRect.width = t.width, this.boundingRect.height = t.height - i;
  }
  calculateSpaceIfDrawnVertical(t) {
    let i = t.width;
    if (this.axisConfig.showAxisLine && i > this.axisConfig.axisLineWidth && (i -= this.axisConfig.axisLineWidth, this.showAxisLine = true), this.axisConfig.showLabel) {
      let e = this.getLabelDimension(), s = 0.2 * t.height;
      this.outerPadding = Math.min(e.height / 2, s);
      let r = e.width + this.axisConfig.labelPadding * 2;
      r <= i && (i -= r, this.showLabel = true);
    }
    if (this.axisConfig.showTick && i >= this.axisConfig.tickLength && (this.showTick = true, i -= this.axisConfig.tickLength), this.axisConfig.showTitle && this.title) {
      let e = this.textDimensionCalculator.getMaxDimension([this.title], this.axisConfig.titleFontSize), s = e.height + this.axisConfig.titlePadding * 2;
      this.titleTextHeight = e.height, s <= i && (i -= s, this.showTitle = true);
    }
    this.boundingRect.width = t.width - i, this.boundingRect.height = t.height;
  }
  calculateSpace(t) {
    return this.axisPosition === "left" || this.axisPosition === "right" ? this.calculateSpaceIfDrawnVertical(t) : this.calculateSpaceIfDrawnHorizontally(t), this.recalculateScale(), { width: this.boundingRect.width, height: this.boundingRect.height };
  }
  setBoundingBoxXY(t) {
    this.boundingRect.x = t.x, this.boundingRect.y = t.y;
  }
  getDrawableElementsForLeftAxis() {
    let t = [];
    if (this.showAxisLine) {
      let i = this.boundingRect.x + this.boundingRect.width - this.axisConfig.axisLineWidth / 2;
      t.push({ type: "path", groupTexts: ["left-axis", "axisl-line"], data: [{ path: `M ${i},${this.boundingRect.y} L ${i},${this.boundingRect.y + this.boundingRect.height} `, strokeFill: this.axisThemeConfig.axisLineColor, strokeWidth: this.axisConfig.axisLineWidth }] });
    }
    if (this.showLabel && t.push({ type: "text", groupTexts: ["left-axis", "label"], data: this.getTickValues().map((i) => ({ text: i.toString(), x: this.boundingRect.x + this.boundingRect.width - (this.showLabel ? this.axisConfig.labelPadding : 0) - (this.showTick ? this.axisConfig.tickLength : 0) - (this.showAxisLine ? this.axisConfig.axisLineWidth : 0), y: this.getScaleValue(i), fill: this.axisThemeConfig.labelColor, fontSize: this.axisConfig.labelFontSize, rotation: 0, verticalPos: "middle", horizontalPos: "right" })) }), this.showTick) {
      let i = this.boundingRect.x + this.boundingRect.width - (this.showAxisLine ? this.axisConfig.axisLineWidth : 0);
      t.push({ type: "path", groupTexts: ["left-axis", "ticks"], data: this.getTickValues().map((e) => ({ path: `M ${i},${this.getScaleValue(e)} L ${i - this.axisConfig.tickLength},${this.getScaleValue(e)}`, strokeFill: this.axisThemeConfig.tickColor, strokeWidth: this.axisConfig.tickWidth })) });
    }
    return this.showTitle && t.push({ type: "text", groupTexts: ["left-axis", "title"], data: [{ text: this.title, x: this.boundingRect.x + this.axisConfig.titlePadding, y: this.boundingRect.y + this.boundingRect.height / 2, fill: this.axisThemeConfig.titleColor, fontSize: this.axisConfig.titleFontSize, rotation: 270, verticalPos: "top", horizontalPos: "center" }] }), t;
  }
  getDrawableElementsForBottomAxis() {
    let t = [];
    if (this.showAxisLine) {
      let i = this.boundingRect.y + this.axisConfig.axisLineWidth / 2;
      t.push({ type: "path", groupTexts: ["bottom-axis", "axis-line"], data: [{ path: `M ${this.boundingRect.x},${i} L ${this.boundingRect.x + this.boundingRect.width},${i}`, strokeFill: this.axisThemeConfig.axisLineColor, strokeWidth: this.axisConfig.axisLineWidth }] });
    }
    if (this.showLabel && t.push({ type: "text", groupTexts: ["bottom-axis", "label"], data: this.getTickValues().map((i) => ({ text: i.toString(), x: this.getScaleValue(i), y: this.boundingRect.y + this.axisConfig.labelPadding + (this.showTick ? this.axisConfig.tickLength : 0) + (this.showAxisLine ? this.axisConfig.axisLineWidth : 0), fill: this.axisThemeConfig.labelColor, fontSize: this.axisConfig.labelFontSize, rotation: 0, verticalPos: "top", horizontalPos: "center" })) }), this.showTick) {
      let i = this.boundingRect.y + (this.showAxisLine ? this.axisConfig.axisLineWidth : 0);
      t.push({ type: "path", groupTexts: ["bottom-axis", "ticks"], data: this.getTickValues().map((e) => ({ path: `M ${this.getScaleValue(e)},${i} L ${this.getScaleValue(e)},${i + this.axisConfig.tickLength}`, strokeFill: this.axisThemeConfig.tickColor, strokeWidth: this.axisConfig.tickWidth })) });
    }
    return this.showTitle && t.push({ type: "text", groupTexts: ["bottom-axis", "title"], data: [{ text: this.title, x: this.range[0] + (this.range[1] - this.range[0]) / 2, y: this.boundingRect.y + this.boundingRect.height - this.axisConfig.titlePadding - this.titleTextHeight, fill: this.axisThemeConfig.titleColor, fontSize: this.axisConfig.titleFontSize, rotation: 0, verticalPos: "top", horizontalPos: "center" }] }), t;
  }
  getDrawableElementsForTopAxis() {
    let t = [];
    if (this.showAxisLine) {
      let i = this.boundingRect.y + this.boundingRect.height - this.axisConfig.axisLineWidth / 2;
      t.push({ type: "path", groupTexts: ["top-axis", "axis-line"], data: [{ path: `M ${this.boundingRect.x},${i} L ${this.boundingRect.x + this.boundingRect.width},${i}`, strokeFill: this.axisThemeConfig.axisLineColor, strokeWidth: this.axisConfig.axisLineWidth }] });
    }
    if (this.showLabel && t.push({ type: "text", groupTexts: ["top-axis", "label"], data: this.getTickValues().map((i) => ({ text: i.toString(), x: this.getScaleValue(i), y: this.boundingRect.y + (this.showTitle ? this.titleTextHeight + this.axisConfig.titlePadding * 2 : 0) + this.axisConfig.labelPadding, fill: this.axisThemeConfig.labelColor, fontSize: this.axisConfig.labelFontSize, rotation: 0, verticalPos: "top", horizontalPos: "center" })) }), this.showTick) {
      let i = this.boundingRect.y;
      t.push({ type: "path", groupTexts: ["top-axis", "ticks"], data: this.getTickValues().map((e) => ({ path: `M ${this.getScaleValue(e)},${i + this.boundingRect.height - (this.showAxisLine ? this.axisConfig.axisLineWidth : 0)} L ${this.getScaleValue(e)},${i + this.boundingRect.height - this.axisConfig.tickLength - (this.showAxisLine ? this.axisConfig.axisLineWidth : 0)}`, strokeFill: this.axisThemeConfig.tickColor, strokeWidth: this.axisConfig.tickWidth })) });
    }
    return this.showTitle && t.push({ type: "text", groupTexts: ["top-axis", "title"], data: [{ text: this.title, x: this.boundingRect.x + this.boundingRect.width / 2, y: this.boundingRect.y + this.axisConfig.titlePadding, fill: this.axisThemeConfig.titleColor, fontSize: this.axisConfig.titleFontSize, rotation: 0, verticalPos: "top", horizontalPos: "center" }] }), t;
  }
  getDrawableElements() {
    if (this.axisPosition === "left") return this.getDrawableElementsForLeftAxis();
    if (this.axisPosition === "right") throw Error("Drawing of right axis is not implemented");
    return this.axisPosition === "bottom" ? this.getDrawableElementsForBottomAxis() : this.axisPosition === "top" ? this.getDrawableElementsForTopAxis() : [];
  }
}, a(_b, "BaseAxis"), _b), di = (_c = class extends It {
  constructor(t, i, e, s, r) {
    super(t, s, r, i), this.categories = e, this.scale = Tt().domain(this.categories).range(this.getRange());
  }
  setRange(t) {
    super.setRange(t);
  }
  recalculateScale() {
    this.scale = Tt().domain(this.categories).range(this.getRange()).paddingInner(1).paddingOuter(0).align(0.5), Pt.trace("BandAxis axis final categories, range: ", this.categories, this.getRange());
  }
  getTickValues() {
    return this.categories;
  }
  getScaleValue(t) {
    return this.scale(t) ?? this.getRange()[0];
  }
}, a(_c, "BandAxis"), _c), pi = (_d = class extends It {
  constructor(t, i, e, s, r) {
    super(t, s, r, i), this.domain = e, this.scale = Rt().domain(this.domain).range(this.getRange());
  }
  getTickValues() {
    return this.scale.ticks();
  }
  recalculateScale() {
    let t = [...this.domain];
    this.axisPosition === "left" && t.reverse(), this.scale = Rt().domain(t).range(this.getRange());
  }
  getScaleValue(t) {
    return this.scale(t);
  }
}, a(_d, "LinearAxis"), _d);
function gt(t, i, e, s) {
  let r = new Et(s);
  return dt(t) ? new di(i, e, t.categories, t.title, r) : new pi(i, e, [t.min, t.max], t.title, r);
}
a(gt, "getAxis");
var fi = (_e = class {
  constructor(t, i, e, s) {
    this.textDimensionCalculator = t, this.chartConfig = i, this.chartData = e, this.chartThemeConfig = s, this.boundingRect = { x: 0, y: 0, width: 0, height: 0 }, this.showChartTitle = false;
  }
  setBoundingBoxXY(t) {
    this.boundingRect.x = t.x, this.boundingRect.y = t.y;
  }
  calculateSpace(t) {
    let i = this.textDimensionCalculator.getMaxDimension([this.chartData.title], this.chartConfig.titleFontSize), e = Math.max(i.width, t.width), s = i.height + 2 * this.chartConfig.titlePadding;
    return i.width <= e && i.height <= s && this.chartConfig.showTitle && this.chartData.title && (this.boundingRect.width = e, this.boundingRect.height = s, this.showChartTitle = true), { width: this.boundingRect.width, height: this.boundingRect.height };
  }
  getDrawableElements() {
    let t = [];
    return this.showChartTitle && t.push({ groupTexts: ["chart-title"], type: "text", data: [{ fontSize: this.chartConfig.titleFontSize, text: this.chartData.title, verticalPos: "middle", horizontalPos: "center", x: this.boundingRect.x + this.boundingRect.width / 2, y: this.boundingRect.y + this.boundingRect.height / 2, fill: this.chartThemeConfig.titleColor, rotation: 0 }] }), t;
  }
}, a(_e, "ChartTitle"), _e);
function Mt(t, i, e, s) {
  let r = new Et(s);
  return new fi(r, t, i, e);
}
a(Mt, "getChartTitleComponent");
var yi = (_f = class {
  constructor(t, i, e, s, r) {
    this.plotData = t, this.xAxis = i, this.yAxis = e, this.orientation = s, this.plotIndex = r;
  }
  getDrawableElement() {
    let t = this.plotData.data.map((e) => [this.xAxis.getScaleValue(e[0]), this.yAxis.getScaleValue(e[1])]), i;
    return this.orientation === "horizontal" ? i = Dt().y((e) => e[0]).x((e) => e[1])(t) : i = Dt().x((e) => e[0]).y((e) => e[1])(t), i ? [{ groupTexts: ["plot", `line-plot-${this.plotIndex}`], type: "path", data: [{ path: i, strokeFill: this.plotData.strokeFill, strokeWidth: this.plotData.strokeWidth }] }] : [];
  }
}, a(_f, "LinePlot"), _f), mi = (_g = class {
  constructor(t, i, e, s, r, f) {
    this.barData = t, this.boundingRect = i, this.xAxis = e, this.yAxis = s, this.orientation = r, this.plotIndex = f;
  }
  getDrawableElement() {
    let t = this.barData.data.map((s) => [this.xAxis.getScaleValue(s[0]), this.yAxis.getScaleValue(s[1])]), i = Math.min(this.xAxis.getAxisOuterPadding() * 2, this.xAxis.getTickDistance()) * (1 - 0.05), e = i / 2;
    return this.orientation === "horizontal" ? [{ groupTexts: ["plot", `bar-plot-${this.plotIndex}`], type: "rect", data: t.map((s) => ({ x: this.boundingRect.x, y: s[0] - e, height: i, width: s[1] - this.boundingRect.x, fill: this.barData.fill, strokeWidth: 0, strokeFill: this.barData.fill })) }] : [{ groupTexts: ["plot", `bar-plot-${this.plotIndex}`], type: "rect", data: t.map((s) => ({ x: s[0] - e, y: s[1], width: i, height: this.boundingRect.y + this.boundingRect.height - s[1], fill: this.barData.fill, strokeWidth: 0, strokeFill: this.barData.fill })) }];
  }
}, a(_g, "BarPlot"), _g), bi = (_h = class {
  constructor(t, i, e) {
    this.chartConfig = t, this.chartData = i, this.chartThemeConfig = e, this.boundingRect = { x: 0, y: 0, width: 0, height: 0 };
  }
  setAxes(t, i) {
    this.xAxis = t, this.yAxis = i;
  }
  setBoundingBoxXY(t) {
    this.boundingRect.x = t.x, this.boundingRect.y = t.y;
  }
  calculateSpace(t) {
    return this.boundingRect.width = t.width, this.boundingRect.height = t.height, { width: this.boundingRect.width, height: this.boundingRect.height };
  }
  getDrawableElements() {
    if (!(this.xAxis && this.yAxis)) throw Error("Axes must be passed to render Plots");
    let t = [];
    for (let [i, e] of this.chartData.plots.entries()) switch (e.type) {
      case "line":
        {
          let s = new yi(e, this.xAxis, this.yAxis, this.chartConfig.chartOrientation, i);
          t.push(...s.getDrawableElement());
        }
        break;
      case "bar":
        {
          let s = new mi(e, this.boundingRect, this.xAxis, this.yAxis, this.chartConfig.chartOrientation, i);
          t.push(...s.getDrawableElement());
        }
        break;
    }
    return t;
  }
}, a(_h, "BasePlot"), _h);
function $t(t, i, e) {
  return new bi(t, i, e);
}
a($t, "getPlotComponent");
var Ai = (_i2 = class {
  constructor(t, i, e, s) {
    this.chartConfig = t, this.chartData = i, this.componentStore = { title: Mt(t, i, e, s), plot: $t(t, i, e), xAxis: gt(i.xAxis, t.xAxis, { titleColor: e.xAxisTitleColor, labelColor: e.xAxisLabelColor, tickColor: e.xAxisTickColor, axisLineColor: e.xAxisLineColor }, s), yAxis: gt(i.yAxis, t.yAxis, { titleColor: e.yAxisTitleColor, labelColor: e.yAxisLabelColor, tickColor: e.yAxisTickColor, axisLineColor: e.yAxisLineColor }, s) };
  }
  calculateVerticalSpace() {
    let t = this.chartConfig.width, i = this.chartConfig.height, e = 0, s = 0, r = Math.floor(t * this.chartConfig.plotReservedSpacePercent / 100), f = Math.floor(i * this.chartConfig.plotReservedSpacePercent / 100), u = this.componentStore.plot.calculateSpace({ width: r, height: f });
    t -= u.width, i -= u.height, u = this.componentStore.title.calculateSpace({ width: this.chartConfig.width, height: i }), s = u.height, i -= u.height, this.componentStore.xAxis.setAxisPosition("bottom"), u = this.componentStore.xAxis.calculateSpace({ width: t, height: i }), i -= u.height, this.componentStore.yAxis.setAxisPosition("left"), u = this.componentStore.yAxis.calculateSpace({ width: t, height: i }), e = u.width, t -= u.width, t > 0 && (r += t, t = 0), i > 0 && (f += i, i = 0), this.componentStore.plot.calculateSpace({ width: r, height: f }), this.componentStore.plot.setBoundingBoxXY({ x: e, y: s }), this.componentStore.xAxis.setRange([e, e + r]), this.componentStore.xAxis.setBoundingBoxXY({ x: e, y: s + f }), this.componentStore.yAxis.setRange([s, s + f]), this.componentStore.yAxis.setBoundingBoxXY({ x: 0, y: s }), this.chartData.plots.some((A) => ct(A)) && this.componentStore.xAxis.recalculateOuterPaddingToDrawBar();
  }
  calculateHorizontalSpace() {
    let t = this.chartConfig.width, i = this.chartConfig.height, e = 0, s = 0, r = 0, f = Math.floor(t * this.chartConfig.plotReservedSpacePercent / 100), u = Math.floor(i * this.chartConfig.plotReservedSpacePercent / 100), A = this.componentStore.plot.calculateSpace({ width: f, height: u });
    t -= A.width, i -= A.height, A = this.componentStore.title.calculateSpace({ width: this.chartConfig.width, height: i }), e = A.height, i -= A.height, this.componentStore.xAxis.setAxisPosition("left"), A = this.componentStore.xAxis.calculateSpace({ width: t, height: i }), t -= A.width, s = A.width, this.componentStore.yAxis.setAxisPosition("top"), A = this.componentStore.yAxis.calculateSpace({ width: t, height: i }), i -= A.height, r = e + A.height, t > 0 && (f += t, t = 0), i > 0 && (u += i, i = 0), this.componentStore.plot.calculateSpace({ width: f, height: u }), this.componentStore.plot.setBoundingBoxXY({ x: s, y: r }), this.componentStore.yAxis.setRange([s, s + f]), this.componentStore.yAxis.setBoundingBoxXY({ x: s, y: e }), this.componentStore.xAxis.setRange([r, r + u]), this.componentStore.xAxis.setBoundingBoxXY({ x: 0, y: r }), this.chartData.plots.some((L) => ct(L)) && this.componentStore.xAxis.recalculateOuterPaddingToDrawBar();
  }
  calculateSpace() {
    this.chartConfig.chartOrientation === "horizontal" ? this.calculateHorizontalSpace() : this.calculateVerticalSpace();
  }
  getDrawableElement() {
    this.calculateSpace();
    let t = [];
    this.componentStore.plot.setAxes(this.componentStore.xAxis, this.componentStore.yAxis);
    for (let i of Object.values(this.componentStore)) t.push(...i.getDrawableElements());
    return t;
  }
}, a(_i2, "Orchestrator"), _i2), Si = (_j = class {
  static build(t, i, e, s) {
    return new Ai(t, i, e, s).getDrawableElement();
  }
}, a(_j, "XYChartBuilder"), _j), G = 0, Bt, Q = yt(), Z = ft(), y = mt(), ut = Z.plotColorPalette.split(",").map((t) => t.trim()), et = false, pt = false;
function ft() {
  let t = gi(), i = xt();
  return vt(t.xyChart, i.themeVariables.xyChart);
}
a(ft, "getChartDefaultThemeConfig");
function yt() {
  let t = xt();
  return vt(ci.xyChart, t.xyChart);
}
a(yt, "getChartDefaultConfig");
function mt() {
  return { yAxis: { type: "linear", title: "", min: 1 / 0, max: -1 / 0 }, xAxis: { type: "band", title: "", categories: [] }, title: "", plots: [] };
}
a(mt, "getChartDefaultData");
function st(t) {
  let i = xt();
  return li(t.trim(), i);
}
a(st, "textSanitizer");
function zt(t) {
  Bt = t;
}
a(zt, "setTmpSVGG");
function Wt(t) {
  t === "horizontal" ? Q.chartOrientation = "horizontal" : Q.chartOrientation = "vertical";
}
a(Wt, "setOrientation");
function Xt(t) {
  y.xAxis.title = st(t.text);
}
a(Xt, "setXAxisTitle");
function bt(t, i) {
  y.xAxis = { type: "linear", title: y.xAxis.title, min: t, max: i }, et = true;
}
a(bt, "setXAxisRangeData");
function Ot(t) {
  y.xAxis = { type: "band", title: y.xAxis.title, categories: t.map((i) => st(i.text)) }, et = true;
}
a(Ot, "setXAxisBand");
function Ft(t) {
  y.yAxis.title = st(t.text);
}
a(Ft, "setYAxisTitle");
function Vt(t, i) {
  y.yAxis = { type: "linear", title: y.yAxis.title, min: t, max: i }, pt = true;
}
a(Vt, "setYAxisRangeData");
function Nt(t) {
  let i = Math.min(...t), e = Math.max(...t), s = H(y.yAxis) ? y.yAxis.min : 1 / 0, r = H(y.yAxis) ? y.yAxis.max : -1 / 0;
  y.yAxis = { type: "linear", title: y.yAxis.title, min: Math.min(s, i), max: Math.max(r, e) };
}
a(Nt, "setYAxisRangeFromPlotData");
function At(t) {
  let i = [];
  if (t.length === 0) return i;
  if (!et) {
    let e = H(y.xAxis) ? y.xAxis.min : 1 / 0, s = H(y.xAxis) ? y.xAxis.max : -1 / 0;
    bt(Math.min(e, 1), Math.max(s, t.length));
  }
  if (pt || Nt(t), dt(y.xAxis) && (i = y.xAxis.categories.map((e, s) => [e, t[s]])), H(y.xAxis)) {
    let e = y.xAxis.min, s = y.xAxis.max, r = (s - e) / (t.length - 1), f = [];
    for (let u = e; u <= s; u += r) f.push(`${u}`);
    i = f.map((u, A) => [u, t[A]]);
  }
  return i;
}
a(At, "transformDataWithoutCategory");
function St(t) {
  return ut[t === 0 ? 0 : t % ut.length];
}
a(St, "getPlotColorFromPalette");
function Ut(t, i) {
  let e = At(i);
  y.plots.push({ type: "line", strokeFill: St(G), strokeWidth: 2, data: e }), G++;
}
a(Ut, "setLineData");
function Yt(t, i) {
  let e = At(i);
  y.plots.push({ type: "bar", fill: St(G), data: e }), G++;
}
a(Yt, "setBarData");
function jt() {
  if (y.plots.length === 0) throw Error("No Plot to render, please provide a plot with some data");
  return y.title = Lt(), Si.build(Q, y, Z, Bt);
}
a(jt, "getDrawableElem");
function Ht() {
  return Z;
}
a(Ht, "getChartThemeConfig");
function Gt() {
  return Q;
}
a(Gt, "getChartConfig");
function Qt() {
  return y;
}
a(Qt, "getXYChartData");
var wi = a(function() {
  ri(), G = 0, Q = yt(), y = mt(), Z = ft(), ut = Z.plotColorPalette.split(",").map((t) => t.trim()), et = false, pt = false;
}, "clear"), Ci = { getDrawableElem: jt, clear: wi, setAccTitle: ni, getAccTitle: ai, setDiagramTitle: si, getDiagramTitle: Lt, getAccDescription: ei, setAccDescription: ii, setOrientation: Wt, setXAxisTitle: Xt, setXAxisRangeData: bt, setXAxisBand: Ot, setYAxisTitle: Ft, setYAxisRangeData: Vt, setLineData: Ut, setBarData: Yt, setTmpSVGG: zt, getChartThemeConfig: Ht, getChartConfig: Gt, getXYChartData: Qt }, _i = a((t, i, e, s) => {
  let r = s.db, f = r.getChartThemeConfig(), u = r.getChartConfig(), A = r.getXYChartData().plots[0].data.map((p) => p[1]);
  function L(p) {
    return p === "top" ? "text-before-edge" : "middle";
  }
  a(L, "getDominantBaseLine");
  function B(p) {
    return p === "left" ? "start" : p === "right" ? "end" : "middle";
  }
  a(B, "getTextAnchor");
  function M(p) {
    return `translate(${p.x}, ${p.y}) rotate(${p.rotation || 0})`;
  }
  a(M, "getTextTransformation"), Pt.debug(`Rendering xychart chart
` + t);
  let T = hi(i), P = T.append("g").attr("class", "main"), z = P.append("rect").attr("width", u.width).attr("height", u.height).attr("class", "background");
  oi(T, u.height, u.width, true), T.attr("viewBox", `0 0 ${u.width} ${u.height}`), z.attr("fill", f.backgroundColor), r.setTmpSVGG(T.append("g").attr("class", "mermaid-tmp-group"));
  let W = r.getDrawableElem(), R = {};
  function $(p) {
    let S = P, o = "";
    for (let [v] of p.entries()) {
      let X = P;
      v > 0 && R[o] && (X = R[o]), o += p[v], S = R[o], S || (S = R[o] = X.append("g").attr("class", p[v]));
    }
    return S;
  }
  a($, "getGroup");
  for (let p of W) {
    if (p.data.length === 0) continue;
    let S = $(p.groupTexts);
    switch (p.type) {
      case "rect":
        if (S.selectAll("rect").data(p.data).enter().append("rect").attr("x", (o) => o.x).attr("y", (o) => o.y).attr("width", (o) => o.width).attr("height", (o) => o.height).attr("fill", (o) => o.fill).attr("stroke", (o) => o.strokeFill).attr("stroke-width", (o) => o.strokeWidth), u.showDataLabel) if (u.chartOrientation === "horizontal") {
          let o = function(g, d) {
            let { data: _, label: m } = g;
            return d * m.length * 0.7 <= _.width - 10;
          };
          a(o, "fitsHorizontally");
          let v = p.data.map((g, d) => ({ data: g, label: A[d].toString() })).filter((g) => g.data.width > 0 && g.data.height > 0), X = v.map((g) => {
            let { data: d } = g, _ = d.height * 0.7;
            for (; !o(g, _) && _ > 0; ) _ -= 1;
            return _;
          }), N = Math.floor(Math.min(...X));
          S.selectAll("text").data(v).enter().append("text").attr("x", (g) => g.data.x + g.data.width - 10).attr("y", (g) => g.data.y + g.data.height / 2).attr("text-anchor", "end").attr("dominant-baseline", "middle").attr("fill", "black").attr("font-size", `${N}px`).text((g) => g.label);
        } else {
          let o = function(g, d, _) {
            let { data: m, label: K } = g, U = d * K.length * 0.7, q = m.x + m.width / 2, Y = q - U / 2, E = q + U / 2, h = Y >= m.x && E <= m.x + m.width, l = m.y + _ + d <= m.y + m.height;
            return h && l;
          };
          a(o, "fitsInBar");
          let v = p.data.map((g, d) => ({ data: g, label: A[d].toString() })).filter((g) => g.data.width > 0 && g.data.height > 0), X = v.map((g) => {
            let { data: d, label: _ } = g, m = d.width / (_.length * 0.7);
            for (; !o(g, m, 10) && m > 0; ) m -= 1;
            return m;
          }), N = Math.floor(Math.min(...X));
          S.selectAll("text").data(v).enter().append("text").attr("x", (g) => g.data.x + g.data.width / 2).attr("y", (g) => g.data.y + 10).attr("text-anchor", "middle").attr("dominant-baseline", "hanging").attr("fill", "black").attr("font-size", `${N}px`).text((g) => g.label);
        }
        break;
      case "text":
        S.selectAll("text").data(p.data).enter().append("text").attr("x", 0).attr("y", 0).attr("fill", (o) => o.fill).attr("font-size", (o) => o.fontSize).attr("dominant-baseline", (o) => L(o.verticalPos)).attr("text-anchor", (o) => B(o.horizontalPos)).attr("transform", (o) => M(o)).text((o) => o.text);
        break;
      case "path":
        S.selectAll("path").data(p.data).enter().append("path").attr("d", (o) => o.path).attr("fill", (o) => o.fill ? o.fill : "none").attr("stroke", (o) => o.strokeFill).attr("stroke-width", (o) => o.strokeWidth);
        break;
    }
  }
}, "draw"), ki = { draw: _i }, Di = { parser: xi, db: Ci, renderer: ki };
export {
  Di as diagram
};
