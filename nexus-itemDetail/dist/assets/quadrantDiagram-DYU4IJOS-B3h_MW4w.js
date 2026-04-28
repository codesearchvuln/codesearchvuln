var _a, _b;
import { Y as be, X as Se, Z as te, K as _e, V as ke, j as Fe, m as l, x as vt, p as yt, i as Ft, U as Pe, $ as Ce, l as L, u as Jt, s as ve, ac as Le } from "./index-CRtis_Gf.js";
var Pt = function() {
  var t = l(function(X, a, c, h) {
    for (c = c || {}, h = X.length; h--; c[X[h]] = a) ;
    return c;
  }, "o"), n = [1, 3], g = [1, 4], f = [1, 5], o = [1, 6], d = [1, 7], A = [1, 4, 5, 10, 12, 13, 14, 18, 25, 35, 37, 39, 41, 42, 48, 50, 51, 52, 53, 54, 55, 56, 57, 60, 61, 63, 64, 65, 66, 67], u = [1, 4, 5, 10, 12, 13, 14, 18, 25, 28, 35, 37, 39, 41, 42, 48, 50, 51, 52, 53, 54, 55, 56, 57, 60, 61, 63, 64, 65, 66, 67], r = [55, 56, 57], D = [2, 36], T = [1, 37], q = [1, 36], p = [1, 38], y = [1, 35], x = [1, 43], b = [1, 41], ot = [1, 14], ht = [1, 23], ct = [1, 18], ut = [1, 19], rt = [1, 20], lt = [1, 21], i = [1, 22], Lt = [1, 24], Et = [1, 25], Dt = [1, 26], It = [1, 27], wt = [1, 28], zt = [1, 29], R = [1, 32], Q = [1, 33], S = [1, 34], _ = [1, 39], k = [1, 40], F = [1, 42], P = [1, 44], U = [1, 62], M = [1, 61], C = [4, 5, 8, 10, 12, 13, 14, 18, 44, 47, 49, 55, 56, 57, 63, 64, 65, 66, 67], Nt = [1, 65], Wt = [1, 66], $t = [1, 67], Bt = [1, 68], Rt = [1, 69], Qt = [1, 70], Xt = [1, 71], Ht = [1, 72], Ut = [1, 73], Mt = [1, 74], Ot = [1, 75], Yt = [1, 76], z = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 18], K = [1, 90], V = [1, 91], Z = [1, 92], G = [1, 99], J = [1, 93], tt = [1, 96], et = [1, 94], it = [1, 95], at = [1, 97], nt = [1, 98], qt = [1, 102], jt = [10, 55, 56, 57], $ = [4, 5, 6, 8, 10, 11, 13, 17, 18, 19, 20, 55, 56, 57], mt = { trace: l(function() {
  }, "trace"), yy: {}, symbols_: { error: 2, idStringToken: 3, ALPHA: 4, NUM: 5, NODE_STRING: 6, DOWN: 7, MINUS: 8, DEFAULT: 9, COMMA: 10, COLON: 11, AMP: 12, BRKT: 13, MULT: 14, UNICODE_TEXT: 15, styleComponent: 16, UNIT: 17, SPACE: 18, STYLE: 19, PCT: 20, idString: 21, style: 22, stylesOpt: 23, classDefStatement: 24, CLASSDEF: 25, start: 26, eol: 27, QUADRANT: 28, document: 29, line: 30, statement: 31, axisDetails: 32, quadrantDetails: 33, points: 34, title: 35, title_value: 36, acc_title: 37, acc_title_value: 38, acc_descr: 39, acc_descr_value: 40, acc_descr_multiline_value: 41, section: 42, text: 43, point_start: 44, point_x: 45, point_y: 46, class_name: 47, "X-AXIS": 48, "AXIS-TEXT-DELIMITER": 49, "Y-AXIS": 50, QUADRANT_1: 51, QUADRANT_2: 52, QUADRANT_3: 53, QUADRANT_4: 54, NEWLINE: 55, SEMI: 56, EOF: 57, alphaNumToken: 58, textNoTagsToken: 59, STR: 60, MD_STR: 61, alphaNum: 62, PUNCTUATION: 63, PLUS: 64, EQUALS: 65, DOT: 66, UNDERSCORE: 67, $accept: 0, $end: 1 }, terminals_: { 2: "error", 4: "ALPHA", 5: "NUM", 6: "NODE_STRING", 7: "DOWN", 8: "MINUS", 9: "DEFAULT", 10: "COMMA", 11: "COLON", 12: "AMP", 13: "BRKT", 14: "MULT", 15: "UNICODE_TEXT", 17: "UNIT", 18: "SPACE", 19: "STYLE", 20: "PCT", 25: "CLASSDEF", 28: "QUADRANT", 35: "title", 36: "title_value", 37: "acc_title", 38: "acc_title_value", 39: "acc_descr", 40: "acc_descr_value", 41: "acc_descr_multiline_value", 42: "section", 44: "point_start", 45: "point_x", 46: "point_y", 47: "class_name", 48: "X-AXIS", 49: "AXIS-TEXT-DELIMITER", 50: "Y-AXIS", 51: "QUADRANT_1", 52: "QUADRANT_2", 53: "QUADRANT_3", 54: "QUADRANT_4", 55: "NEWLINE", 56: "SEMI", 57: "EOF", 60: "STR", 61: "MD_STR", 63: "PUNCTUATION", 64: "PLUS", 65: "EQUALS", 66: "DOT", 67: "UNDERSCORE" }, productions_: [0, [3, 1], [3, 1], [3, 1], [3, 1], [3, 1], [3, 1], [3, 1], [3, 1], [3, 1], [3, 1], [3, 1], [3, 1], [16, 1], [16, 1], [16, 1], [16, 1], [16, 1], [16, 1], [16, 1], [16, 1], [16, 1], [16, 1], [21, 1], [21, 2], [22, 1], [22, 2], [23, 1], [23, 3], [24, 5], [26, 2], [26, 2], [26, 2], [29, 0], [29, 2], [30, 2], [31, 0], [31, 1], [31, 2], [31, 1], [31, 1], [31, 1], [31, 2], [31, 2], [31, 2], [31, 1], [31, 1], [34, 4], [34, 5], [34, 5], [34, 6], [32, 4], [32, 3], [32, 2], [32, 4], [32, 3], [32, 2], [33, 2], [33, 2], [33, 2], [33, 2], [27, 1], [27, 1], [27, 1], [43, 1], [43, 2], [43, 1], [43, 1], [62, 1], [62, 2], [58, 1], [58, 1], [58, 1], [58, 1], [58, 1], [58, 1], [58, 1], [58, 1], [58, 1], [58, 1], [58, 1], [59, 1], [59, 1], [59, 1]], performAction: l(function(X, a, c, h, m, e, N) {
    var s = e.length - 1;
    switch (m) {
      case 23:
        this.$ = e[s];
        break;
      case 24:
        this.$ = e[s - 1] + "" + e[s];
        break;
      case 26:
        this.$ = e[s - 1] + e[s];
        break;
      case 27:
        this.$ = [e[s].trim()];
        break;
      case 28:
        e[s - 2].push(e[s].trim()), this.$ = e[s - 2];
        break;
      case 29:
        this.$ = e[s - 4], h.addClass(e[s - 2], e[s]);
        break;
      case 37:
        this.$ = [];
        break;
      case 42:
        this.$ = e[s].trim(), h.setDiagramTitle(this.$);
        break;
      case 43:
        this.$ = e[s].trim(), h.setAccTitle(this.$);
        break;
      case 44:
      case 45:
        this.$ = e[s].trim(), h.setAccDescription(this.$);
        break;
      case 46:
        h.addSection(e[s].substr(8)), this.$ = e[s].substr(8);
        break;
      case 47:
        h.addPoint(e[s - 3], "", e[s - 1], e[s], []);
        break;
      case 48:
        h.addPoint(e[s - 4], e[s - 3], e[s - 1], e[s], []);
        break;
      case 49:
        h.addPoint(e[s - 4], "", e[s - 2], e[s - 1], e[s]);
        break;
      case 50:
        h.addPoint(e[s - 5], e[s - 4], e[s - 2], e[s - 1], e[s]);
        break;
      case 51:
        h.setXAxisLeftText(e[s - 2]), h.setXAxisRightText(e[s]);
        break;
      case 52:
        e[s - 1].text += " \u27F6 ", h.setXAxisLeftText(e[s - 1]);
        break;
      case 53:
        h.setXAxisLeftText(e[s]);
        break;
      case 54:
        h.setYAxisBottomText(e[s - 2]), h.setYAxisTopText(e[s]);
        break;
      case 55:
        e[s - 1].text += " \u27F6 ", h.setYAxisBottomText(e[s - 1]);
        break;
      case 56:
        h.setYAxisBottomText(e[s]);
        break;
      case 57:
        h.setQuadrant1Text(e[s]);
        break;
      case 58:
        h.setQuadrant2Text(e[s]);
        break;
      case 59:
        h.setQuadrant3Text(e[s]);
        break;
      case 60:
        h.setQuadrant4Text(e[s]);
        break;
      case 64:
        this.$ = { text: e[s], type: "text" };
        break;
      case 65:
        this.$ = { text: e[s - 1].text + "" + e[s], type: e[s - 1].type };
        break;
      case 66:
        this.$ = { text: e[s], type: "text" };
        break;
      case 67:
        this.$ = { text: e[s], type: "markdown" };
        break;
      case 68:
        this.$ = e[s];
        break;
      case 69:
        this.$ = e[s - 1] + "" + e[s];
        break;
    }
  }, "anonymous"), table: [{ 18: n, 26: 1, 27: 2, 28: g, 55: f, 56: o, 57: d }, { 1: [3] }, { 18: n, 26: 8, 27: 2, 28: g, 55: f, 56: o, 57: d }, { 18: n, 26: 9, 27: 2, 28: g, 55: f, 56: o, 57: d }, t(A, [2, 33], { 29: 10 }), t(u, [2, 61]), t(u, [2, 62]), t(u, [2, 63]), { 1: [2, 30] }, { 1: [2, 31] }, t(r, D, { 30: 11, 31: 12, 24: 13, 32: 15, 33: 16, 34: 17, 43: 30, 58: 31, 1: [2, 32], 4: T, 5: q, 10: p, 12: y, 13: x, 14: b, 18: ot, 25: ht, 35: ct, 37: ut, 39: rt, 41: lt, 42: i, 48: Lt, 50: Et, 51: Dt, 52: It, 53: wt, 54: zt, 60: R, 61: Q, 63: S, 64: _, 65: k, 66: F, 67: P }), t(A, [2, 34]), { 27: 45, 55: f, 56: o, 57: d }, t(r, [2, 37]), t(r, D, { 24: 13, 32: 15, 33: 16, 34: 17, 43: 30, 58: 31, 31: 46, 4: T, 5: q, 10: p, 12: y, 13: x, 14: b, 18: ot, 25: ht, 35: ct, 37: ut, 39: rt, 41: lt, 42: i, 48: Lt, 50: Et, 51: Dt, 52: It, 53: wt, 54: zt, 60: R, 61: Q, 63: S, 64: _, 65: k, 66: F, 67: P }), t(r, [2, 39]), t(r, [2, 40]), t(r, [2, 41]), { 36: [1, 47] }, { 38: [1, 48] }, { 40: [1, 49] }, t(r, [2, 45]), t(r, [2, 46]), { 18: [1, 50] }, { 4: T, 5: q, 10: p, 12: y, 13: x, 14: b, 43: 51, 58: 31, 60: R, 61: Q, 63: S, 64: _, 65: k, 66: F, 67: P }, { 4: T, 5: q, 10: p, 12: y, 13: x, 14: b, 43: 52, 58: 31, 60: R, 61: Q, 63: S, 64: _, 65: k, 66: F, 67: P }, { 4: T, 5: q, 10: p, 12: y, 13: x, 14: b, 43: 53, 58: 31, 60: R, 61: Q, 63: S, 64: _, 65: k, 66: F, 67: P }, { 4: T, 5: q, 10: p, 12: y, 13: x, 14: b, 43: 54, 58: 31, 60: R, 61: Q, 63: S, 64: _, 65: k, 66: F, 67: P }, { 4: T, 5: q, 10: p, 12: y, 13: x, 14: b, 43: 55, 58: 31, 60: R, 61: Q, 63: S, 64: _, 65: k, 66: F, 67: P }, { 4: T, 5: q, 10: p, 12: y, 13: x, 14: b, 43: 56, 58: 31, 60: R, 61: Q, 63: S, 64: _, 65: k, 66: F, 67: P }, { 4: T, 5: q, 8: U, 10: p, 12: y, 13: x, 14: b, 18: M, 44: [1, 57], 47: [1, 58], 58: 60, 59: 59, 63: S, 64: _, 65: k, 66: F, 67: P }, t(C, [2, 64]), t(C, [2, 66]), t(C, [2, 67]), t(C, [2, 70]), t(C, [2, 71]), t(C, [2, 72]), t(C, [2, 73]), t(C, [2, 74]), t(C, [2, 75]), t(C, [2, 76]), t(C, [2, 77]), t(C, [2, 78]), t(C, [2, 79]), t(C, [2, 80]), t(A, [2, 35]), t(r, [2, 38]), t(r, [2, 42]), t(r, [2, 43]), t(r, [2, 44]), { 3: 64, 4: Nt, 5: Wt, 6: $t, 7: Bt, 8: Rt, 9: Qt, 10: Xt, 11: Ht, 12: Ut, 13: Mt, 14: Ot, 15: Yt, 21: 63 }, t(r, [2, 53], { 59: 59, 58: 60, 4: T, 5: q, 8: U, 10: p, 12: y, 13: x, 14: b, 18: M, 49: [1, 77], 63: S, 64: _, 65: k, 66: F, 67: P }), t(r, [2, 56], { 59: 59, 58: 60, 4: T, 5: q, 8: U, 10: p, 12: y, 13: x, 14: b, 18: M, 49: [1, 78], 63: S, 64: _, 65: k, 66: F, 67: P }), t(r, [2, 57], { 59: 59, 58: 60, 4: T, 5: q, 8: U, 10: p, 12: y, 13: x, 14: b, 18: M, 63: S, 64: _, 65: k, 66: F, 67: P }), t(r, [2, 58], { 59: 59, 58: 60, 4: T, 5: q, 8: U, 10: p, 12: y, 13: x, 14: b, 18: M, 63: S, 64: _, 65: k, 66: F, 67: P }), t(r, [2, 59], { 59: 59, 58: 60, 4: T, 5: q, 8: U, 10: p, 12: y, 13: x, 14: b, 18: M, 63: S, 64: _, 65: k, 66: F, 67: P }), t(r, [2, 60], { 59: 59, 58: 60, 4: T, 5: q, 8: U, 10: p, 12: y, 13: x, 14: b, 18: M, 63: S, 64: _, 65: k, 66: F, 67: P }), { 45: [1, 79] }, { 44: [1, 80] }, t(C, [2, 65]), t(C, [2, 81]), t(C, [2, 82]), t(C, [2, 83]), { 3: 82, 4: Nt, 5: Wt, 6: $t, 7: Bt, 8: Rt, 9: Qt, 10: Xt, 11: Ht, 12: Ut, 13: Mt, 14: Ot, 15: Yt, 18: [1, 81] }, t(z, [2, 23]), t(z, [2, 1]), t(z, [2, 2]), t(z, [2, 3]), t(z, [2, 4]), t(z, [2, 5]), t(z, [2, 6]), t(z, [2, 7]), t(z, [2, 8]), t(z, [2, 9]), t(z, [2, 10]), t(z, [2, 11]), t(z, [2, 12]), t(r, [2, 52], { 58: 31, 43: 83, 4: T, 5: q, 10: p, 12: y, 13: x, 14: b, 60: R, 61: Q, 63: S, 64: _, 65: k, 66: F, 67: P }), t(r, [2, 55], { 58: 31, 43: 84, 4: T, 5: q, 10: p, 12: y, 13: x, 14: b, 60: R, 61: Q, 63: S, 64: _, 65: k, 66: F, 67: P }), { 46: [1, 85] }, { 45: [1, 86] }, { 4: K, 5: V, 6: Z, 8: G, 11: J, 13: tt, 16: 89, 17: et, 18: it, 19: at, 20: nt, 22: 88, 23: 87 }, t(z, [2, 24]), t(r, [2, 51], { 59: 59, 58: 60, 4: T, 5: q, 8: U, 10: p, 12: y, 13: x, 14: b, 18: M, 63: S, 64: _, 65: k, 66: F, 67: P }), t(r, [2, 54], { 59: 59, 58: 60, 4: T, 5: q, 8: U, 10: p, 12: y, 13: x, 14: b, 18: M, 63: S, 64: _, 65: k, 66: F, 67: P }), t(r, [2, 47], { 22: 88, 16: 89, 23: 100, 4: K, 5: V, 6: Z, 8: G, 11: J, 13: tt, 17: et, 18: it, 19: at, 20: nt }), { 46: [1, 101] }, t(r, [2, 29], { 10: qt }), t(jt, [2, 27], { 16: 103, 4: K, 5: V, 6: Z, 8: G, 11: J, 13: tt, 17: et, 18: it, 19: at, 20: nt }), t($, [2, 25]), t($, [2, 13]), t($, [2, 14]), t($, [2, 15]), t($, [2, 16]), t($, [2, 17]), t($, [2, 18]), t($, [2, 19]), t($, [2, 20]), t($, [2, 21]), t($, [2, 22]), t(r, [2, 49], { 10: qt }), t(r, [2, 48], { 22: 88, 16: 89, 23: 104, 4: K, 5: V, 6: Z, 8: G, 11: J, 13: tt, 17: et, 18: it, 19: at, 20: nt }), { 4: K, 5: V, 6: Z, 8: G, 11: J, 13: tt, 16: 89, 17: et, 18: it, 19: at, 20: nt, 22: 105 }, t($, [2, 26]), t(r, [2, 50], { 10: qt }), t(jt, [2, 28], { 16: 103, 4: K, 5: V, 6: Z, 8: G, 11: J, 13: tt, 17: et, 18: it, 19: at, 20: nt })], defaultActions: { 8: [2, 30], 9: [2, 31] }, parseError: l(function(X, a) {
    if (a.recoverable) this.trace(X);
    else {
      var c = new Error(X);
      throw c.hash = a, c;
    }
  }, "parseError"), parse: l(function(X) {
    var a = this, c = [0], h = [], m = [null], e = [], N = this.table, s = "", xt = 0, Kt = 0, ye = 0, Te = 2, Vt = 1, qe = e.slice.call(arguments, 1), v = Object.create(this.lexer), Y = { yy: {} };
    for (var At in this.yy) Object.prototype.hasOwnProperty.call(this.yy, At) && (Y.yy[At] = this.yy[At]);
    v.setInput(X, Y.yy), Y.yy.lexer = v, Y.yy.parser = this, typeof v.yylloc > "u" && (v.yylloc = {});
    var bt = v.yylloc;
    e.push(bt);
    var me = v.options && v.options.ranges;
    typeof Y.yy.parseError == "function" ? this.parseError = Y.yy.parseError : this.parseError = Object.getPrototypeOf(this).parseError;
    function Ae(W) {
      c.length = c.length - 2 * W, m.length = m.length - W, e.length = e.length - W;
    }
    l(Ae, "popStack");
    function Zt() {
      var W;
      return W = h.pop() || v.lex() || Vt, typeof W != "number" && (W instanceof Array && (h = W, W = h.pop()), W = a.symbols_[W] || W), W;
    }
    l(Zt, "lex");
    for (var I, St, j, B, $e, _t, st = {}, ft, O, Gt, gt; ; ) {
      if (j = c[c.length - 1], this.defaultActions[j] ? B = this.defaultActions[j] : ((I === null || typeof I > "u") && (I = Zt()), B = N[j] && N[j][I]), typeof B > "u" || !B.length || !B[0]) {
        var kt = "";
        gt = [];
        for (ft in N[j]) this.terminals_[ft] && ft > Te && gt.push("'" + this.terminals_[ft] + "'");
        v.showPosition ? kt = "Parse error on line " + (xt + 1) + `:
` + v.showPosition() + `
Expecting ` + gt.join(", ") + ", got '" + (this.terminals_[I] || I) + "'" : kt = "Parse error on line " + (xt + 1) + ": Unexpected " + (I == Vt ? "end of input" : "'" + (this.terminals_[I] || I) + "'"), this.parseError(kt, { text: v.match, token: this.terminals_[I] || I, line: v.yylineno, loc: bt, expected: gt });
      }
      if (B[0] instanceof Array && B.length > 1) throw new Error("Parse Error: multiple actions possible at state: " + j + ", token: " + I);
      switch (B[0]) {
        case 1:
          c.push(I), m.push(v.yytext), e.push(v.yylloc), c.push(B[1]), I = null, St ? (I = St, St = null) : (Kt = v.yyleng, s = v.yytext, xt = v.yylineno, bt = v.yylloc, ye > 0);
          break;
        case 2:
          if (O = this.productions_[B[1]][1], st.$ = m[m.length - O], st._$ = { first_line: e[e.length - (O || 1)].first_line, last_line: e[e.length - 1].last_line, first_column: e[e.length - (O || 1)].first_column, last_column: e[e.length - 1].last_column }, me && (st._$.range = [e[e.length - (O || 1)].range[0], e[e.length - 1].range[1]]), _t = this.performAction.apply(st, [s, Kt, xt, Y.yy, B[1], m, e].concat(qe)), typeof _t < "u") return _t;
          O && (c = c.slice(0, -1 * O * 2), m = m.slice(0, -1 * O), e = e.slice(0, -1 * O)), c.push(this.productions_[B[1]][0]), m.push(st.$), e.push(st._$), Gt = N[c[c.length - 2]][c[c.length - 1]], c.push(Gt);
          break;
        case 3:
          return true;
      }
    }
    return true;
  }, "parse") }, pe = function() {
    var X = { EOF: 1, parseError: l(function(a, c) {
      if (this.yy.parser) this.yy.parser.parseError(a, c);
      else throw new Error(a);
    }, "parseError"), setInput: l(function(a, c) {
      return this.yy = c || this.yy || {}, this._input = a, this._more = this._backtrack = this.done = false, this.yylineno = this.yyleng = 0, this.yytext = this.matched = this.match = "", this.conditionStack = ["INITIAL"], this.yylloc = { first_line: 1, first_column: 0, last_line: 1, last_column: 0 }, this.options.ranges && (this.yylloc.range = [0, 0]), this.offset = 0, this;
    }, "setInput"), input: l(function() {
      var a = this._input[0];
      this.yytext += a, this.yyleng++, this.offset++, this.match += a, this.matched += a;
      var c = a.match(/(?:\r\n?|\n).*/g);
      return c ? (this.yylineno++, this.yylloc.last_line++) : this.yylloc.last_column++, this.options.ranges && this.yylloc.range[1]++, this._input = this._input.slice(1), a;
    }, "input"), unput: l(function(a) {
      var c = a.length, h = a.split(/(?:\r\n?|\n)/g);
      this._input = a + this._input, this.yytext = this.yytext.substr(0, this.yytext.length - c), this.offset -= c;
      var m = this.match.split(/(?:\r\n?|\n)/g);
      this.match = this.match.substr(0, this.match.length - 1), this.matched = this.matched.substr(0, this.matched.length - 1), h.length - 1 && (this.yylineno -= h.length - 1);
      var e = this.yylloc.range;
      return this.yylloc = { first_line: this.yylloc.first_line, last_line: this.yylineno + 1, first_column: this.yylloc.first_column, last_column: h ? (h.length === m.length ? this.yylloc.first_column : 0) + m[m.length - h.length].length - h[0].length : this.yylloc.first_column - c }, this.options.ranges && (this.yylloc.range = [e[0], e[0] + this.yyleng - c]), this.yyleng = this.yytext.length, this;
    }, "unput"), more: l(function() {
      return this._more = true, this;
    }, "more"), reject: l(function() {
      if (this.options.backtrack_lexer) this._backtrack = true;
      else return this.parseError("Lexical error on line " + (this.yylineno + 1) + `. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
` + this.showPosition(), { text: "", token: null, line: this.yylineno });
      return this;
    }, "reject"), less: l(function(a) {
      this.unput(this.match.slice(a));
    }, "less"), pastInput: l(function() {
      var a = this.matched.substr(0, this.matched.length - this.match.length);
      return (a.length > 20 ? "..." : "") + a.substr(-20).replace(/\n/g, "");
    }, "pastInput"), upcomingInput: l(function() {
      var a = this.match;
      return a.length < 20 && (a += this._input.substr(0, 20 - a.length)), (a.substr(0, 20) + (a.length > 20 ? "..." : "")).replace(/\n/g, "");
    }, "upcomingInput"), showPosition: l(function() {
      var a = this.pastInput(), c = new Array(a.length + 1).join("-");
      return a + this.upcomingInput() + `
` + c + "^";
    }, "showPosition"), test_match: l(function(a, c) {
      var h, m, e;
      if (this.options.backtrack_lexer && (e = { yylineno: this.yylineno, yylloc: { first_line: this.yylloc.first_line, last_line: this.last_line, first_column: this.yylloc.first_column, last_column: this.yylloc.last_column }, yytext: this.yytext, match: this.match, matches: this.matches, matched: this.matched, yyleng: this.yyleng, offset: this.offset, _more: this._more, _input: this._input, yy: this.yy, conditionStack: this.conditionStack.slice(0), done: this.done }, this.options.ranges && (e.yylloc.range = this.yylloc.range.slice(0))), m = a[0].match(/(?:\r\n?|\n).*/g), m && (this.yylineno += m.length), this.yylloc = { first_line: this.yylloc.last_line, last_line: this.yylineno + 1, first_column: this.yylloc.last_column, last_column: m ? m[m.length - 1].length - m[m.length - 1].match(/\r?\n?/)[0].length : this.yylloc.last_column + a[0].length }, this.yytext += a[0], this.match += a[0], this.matches = a, this.yyleng = this.yytext.length, this.options.ranges && (this.yylloc.range = [this.offset, this.offset += this.yyleng]), this._more = false, this._backtrack = false, this._input = this._input.slice(a[0].length), this.matched += a[0], h = this.performAction.call(this, this.yy, this, c, this.conditionStack[this.conditionStack.length - 1]), this.done && this._input && (this.done = false), h) return h;
      if (this._backtrack) {
        for (var N in e) this[N] = e[N];
        return false;
      }
      return false;
    }, "test_match"), next: l(function() {
      if (this.done) return this.EOF;
      this._input || (this.done = true);
      var a, c, h, m;
      this._more || (this.yytext = "", this.match = "");
      for (var e = this._currentRules(), N = 0; N < e.length; N++) if (h = this._input.match(this.rules[e[N]]), h && (!c || h[0].length > c[0].length)) {
        if (c = h, m = N, this.options.backtrack_lexer) {
          if (a = this.test_match(h, e[N]), a !== false) return a;
          if (this._backtrack) {
            c = false;
            continue;
          } else return false;
        } else if (!this.options.flex) break;
      }
      return c ? (a = this.test_match(c, e[m]), a !== false ? a : false) : this._input === "" ? this.EOF : this.parseError("Lexical error on line " + (this.yylineno + 1) + `. Unrecognized text.
` + this.showPosition(), { text: "", token: null, line: this.yylineno });
    }, "next"), lex: l(function() {
      var a = this.next();
      return a || this.lex();
    }, "lex"), begin: l(function(a) {
      this.conditionStack.push(a);
    }, "begin"), popState: l(function() {
      var a = this.conditionStack.length - 1;
      return a > 0 ? this.conditionStack.pop() : this.conditionStack[0];
    }, "popState"), _currentRules: l(function() {
      return this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1] ? this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules : this.conditions.INITIAL.rules;
    }, "_currentRules"), topState: l(function(a) {
      return a = this.conditionStack.length - 1 - Math.abs(a || 0), a >= 0 ? this.conditionStack[a] : "INITIAL";
    }, "topState"), pushState: l(function(a) {
      this.begin(a);
    }, "pushState"), stateStackSize: l(function() {
      return this.conditionStack.length;
    }, "stateStackSize"), options: { "case-insensitive": true }, performAction: l(function(a, c, h, m) {
      switch (h) {
        case 0:
          break;
        case 1:
          break;
        case 2:
          return 55;
        case 3:
          break;
        case 4:
          return this.begin("title"), 35;
        case 5:
          return this.popState(), "title_value";
        case 6:
          return this.begin("acc_title"), 37;
        case 7:
          return this.popState(), "acc_title_value";
        case 8:
          return this.begin("acc_descr"), 39;
        case 9:
          return this.popState(), "acc_descr_value";
        case 10:
          this.begin("acc_descr_multiline");
          break;
        case 11:
          this.popState();
          break;
        case 12:
          return "acc_descr_multiline_value";
        case 13:
          return 48;
        case 14:
          return 50;
        case 15:
          return 49;
        case 16:
          return 51;
        case 17:
          return 52;
        case 18:
          return 53;
        case 19:
          return 54;
        case 20:
          return 25;
        case 21:
          this.begin("md_string");
          break;
        case 22:
          return "MD_STR";
        case 23:
          this.popState();
          break;
        case 24:
          this.begin("string");
          break;
        case 25:
          this.popState();
          break;
        case 26:
          return "STR";
        case 27:
          this.begin("class_name");
          break;
        case 28:
          return this.popState(), 47;
        case 29:
          return this.begin("point_start"), 44;
        case 30:
          return this.begin("point_x"), 45;
        case 31:
          this.popState();
          break;
        case 32:
          this.popState(), this.begin("point_y");
          break;
        case 33:
          return this.popState(), 46;
        case 34:
          return 28;
        case 35:
          return 4;
        case 36:
          return 11;
        case 37:
          return 64;
        case 38:
          return 10;
        case 39:
          return 65;
        case 40:
          return 65;
        case 41:
          return 14;
        case 42:
          return 13;
        case 43:
          return 67;
        case 44:
          return 66;
        case 45:
          return 12;
        case 46:
          return 8;
        case 47:
          return 5;
        case 48:
          return 18;
        case 49:
          return 56;
        case 50:
          return 63;
        case 51:
          return 57;
      }
    }, "anonymous"), rules: [/^(?:%%(?!\{)[^\n]*)/i, /^(?:[^\}]%%[^\n]*)/i, /^(?:[\n\r]+)/i, /^(?:%%[^\n]*)/i, /^(?:title\b)/i, /^(?:(?!\n||)*[^\n]*)/i, /^(?:accTitle\s*:\s*)/i, /^(?:(?!\n||)*[^\n]*)/i, /^(?:accDescr\s*:\s*)/i, /^(?:(?!\n||)*[^\n]*)/i, /^(?:accDescr\s*\{\s*)/i, /^(?:[\}])/i, /^(?:[^\}]*)/i, /^(?: *x-axis *)/i, /^(?: *y-axis *)/i, /^(?: *--+> *)/i, /^(?: *quadrant-1 *)/i, /^(?: *quadrant-2 *)/i, /^(?: *quadrant-3 *)/i, /^(?: *quadrant-4 *)/i, /^(?:classDef\b)/i, /^(?:["][`])/i, /^(?:[^`"]+)/i, /^(?:[`]["])/i, /^(?:["])/i, /^(?:["])/i, /^(?:[^"]*)/i, /^(?::::)/i, /^(?:^\w+)/i, /^(?:\s*:\s*\[\s*)/i, /^(?:(1)|(0(.\d+)?))/i, /^(?:\s*\] *)/i, /^(?:\s*,\s*)/i, /^(?:(1)|(0(.\d+)?))/i, /^(?: *quadrantChart *)/i, /^(?:[A-Za-z]+)/i, /^(?::)/i, /^(?:\+)/i, /^(?:,)/i, /^(?:=)/i, /^(?:=)/i, /^(?:\*)/i, /^(?:#)/i, /^(?:[\_])/i, /^(?:\.)/i, /^(?:&)/i, /^(?:-)/i, /^(?:[0-9]+)/i, /^(?:\s)/i, /^(?:;)/i, /^(?:[!"#$%&'*+,-.`?\\_/])/i, /^(?:$)/i], conditions: { class_name: { rules: [28], inclusive: false }, point_y: { rules: [33], inclusive: false }, point_x: { rules: [32], inclusive: false }, point_start: { rules: [30, 31], inclusive: false }, acc_descr_multiline: { rules: [11, 12], inclusive: false }, acc_descr: { rules: [9], inclusive: false }, acc_title: { rules: [7], inclusive: false }, title: { rules: [5], inclusive: false }, md_string: { rules: [22, 23], inclusive: false }, string: { rules: [25, 26], inclusive: false }, INITIAL: { rules: [0, 1, 2, 3, 4, 6, 8, 10, 13, 14, 15, 16, 17, 18, 19, 20, 21, 24, 27, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51], inclusive: true } } };
    return X;
  }();
  mt.lexer = pe;
  function dt() {
    this.yy = {};
  }
  return l(dt, "Parser"), dt.prototype = mt, mt.Parser = dt, new dt();
}();
Pt.parser = Pt;
var Ee = Pt, w = Le(), De = (_a = class {
  constructor() {
    this.classes = /* @__PURE__ */ new Map(), this.config = this.getDefaultConfig(), this.themeConfig = this.getDefaultThemeConfig(), this.data = this.getDefaultData();
  }
  getDefaultData() {
    return { titleText: "", quadrant1Text: "", quadrant2Text: "", quadrant3Text: "", quadrant4Text: "", xAxisLeftText: "", xAxisRightText: "", yAxisBottomText: "", yAxisTopText: "", points: [] };
  }
  getDefaultConfig() {
    var _a2, _b2, _c, _d, _e2, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r;
    return { showXAxis: true, showYAxis: true, showTitle: true, chartHeight: ((_a2 = L.quadrantChart) == null ? void 0 : _a2.chartWidth) || 500, chartWidth: ((_b2 = L.quadrantChart) == null ? void 0 : _b2.chartHeight) || 500, titlePadding: ((_c = L.quadrantChart) == null ? void 0 : _c.titlePadding) || 10, titleFontSize: ((_d = L.quadrantChart) == null ? void 0 : _d.titleFontSize) || 20, quadrantPadding: ((_e2 = L.quadrantChart) == null ? void 0 : _e2.quadrantPadding) || 5, xAxisLabelPadding: ((_f = L.quadrantChart) == null ? void 0 : _f.xAxisLabelPadding) || 5, yAxisLabelPadding: ((_g = L.quadrantChart) == null ? void 0 : _g.yAxisLabelPadding) || 5, xAxisLabelFontSize: ((_h = L.quadrantChart) == null ? void 0 : _h.xAxisLabelFontSize) || 16, yAxisLabelFontSize: ((_i = L.quadrantChart) == null ? void 0 : _i.yAxisLabelFontSize) || 16, quadrantLabelFontSize: ((_j = L.quadrantChart) == null ? void 0 : _j.quadrantLabelFontSize) || 16, quadrantTextTopPadding: ((_k = L.quadrantChart) == null ? void 0 : _k.quadrantTextTopPadding) || 5, pointTextPadding: ((_l = L.quadrantChart) == null ? void 0 : _l.pointTextPadding) || 5, pointLabelFontSize: ((_m = L.quadrantChart) == null ? void 0 : _m.pointLabelFontSize) || 12, pointRadius: ((_n = L.quadrantChart) == null ? void 0 : _n.pointRadius) || 5, xAxisPosition: ((_o = L.quadrantChart) == null ? void 0 : _o.xAxisPosition) || "top", yAxisPosition: ((_p = L.quadrantChart) == null ? void 0 : _p.yAxisPosition) || "left", quadrantInternalBorderStrokeWidth: ((_q = L.quadrantChart) == null ? void 0 : _q.quadrantInternalBorderStrokeWidth) || 1, quadrantExternalBorderStrokeWidth: ((_r = L.quadrantChart) == null ? void 0 : _r.quadrantExternalBorderStrokeWidth) || 2 };
  }
  getDefaultThemeConfig() {
    return { quadrant1Fill: w.quadrant1Fill, quadrant2Fill: w.quadrant2Fill, quadrant3Fill: w.quadrant3Fill, quadrant4Fill: w.quadrant4Fill, quadrant1TextFill: w.quadrant1TextFill, quadrant2TextFill: w.quadrant2TextFill, quadrant3TextFill: w.quadrant3TextFill, quadrant4TextFill: w.quadrant4TextFill, quadrantPointFill: w.quadrantPointFill, quadrantPointTextFill: w.quadrantPointTextFill, quadrantXAxisTextFill: w.quadrantXAxisTextFill, quadrantYAxisTextFill: w.quadrantYAxisTextFill, quadrantTitleFill: w.quadrantTitleFill, quadrantInternalBorderStrokeFill: w.quadrantInternalBorderStrokeFill, quadrantExternalBorderStrokeFill: w.quadrantExternalBorderStrokeFill };
  }
  clear() {
    this.config = this.getDefaultConfig(), this.themeConfig = this.getDefaultThemeConfig(), this.data = this.getDefaultData(), this.classes = /* @__PURE__ */ new Map(), yt.info("clear called");
  }
  setData(t) {
    this.data = { ...this.data, ...t };
  }
  addPoints(t) {
    this.data.points = [...t, ...this.data.points];
  }
  addClass(t, n) {
    this.classes.set(t, n);
  }
  setConfig(t) {
    yt.trace("setConfig called with: ", t), this.config = { ...this.config, ...t };
  }
  setThemeConfig(t) {
    yt.trace("setThemeConfig called with: ", t), this.themeConfig = { ...this.themeConfig, ...t };
  }
  calculateSpace(t, n, g, f) {
    let o = this.config.xAxisLabelPadding * 2 + this.config.xAxisLabelFontSize, d = { top: t === "top" && n ? o : 0, bottom: t === "bottom" && n ? o : 0 }, A = this.config.yAxisLabelPadding * 2 + this.config.yAxisLabelFontSize, u = { left: this.config.yAxisPosition === "left" && g ? A : 0, right: this.config.yAxisPosition === "right" && g ? A : 0 }, r = this.config.titleFontSize + this.config.titlePadding * 2, D = { top: f ? r : 0 }, T = this.config.quadrantPadding + u.left, q = this.config.quadrantPadding + d.top + D.top, p = this.config.chartWidth - this.config.quadrantPadding * 2 - u.left - u.right, y = this.config.chartHeight - this.config.quadrantPadding * 2 - d.top - d.bottom - D.top, x = p / 2, b = y / 2;
    return { xAxisSpace: d, yAxisSpace: u, titleSpace: D, quadrantSpace: { quadrantLeft: T, quadrantTop: q, quadrantWidth: p, quadrantHalfWidth: x, quadrantHeight: y, quadrantHalfHeight: b } };
  }
  getAxisLabels(t, n, g, f) {
    let { quadrantSpace: o, titleSpace: d } = f, { quadrantHalfHeight: A, quadrantHeight: u, quadrantLeft: r, quadrantHalfWidth: D, quadrantTop: T, quadrantWidth: q } = o, p = !!this.data.xAxisRightText, y = !!this.data.yAxisTopText, x = [];
    return this.data.xAxisLeftText && n && x.push({ text: this.data.xAxisLeftText, fill: this.themeConfig.quadrantXAxisTextFill, x: r + (p ? D / 2 : 0), y: t === "top" ? this.config.xAxisLabelPadding + d.top : this.config.xAxisLabelPadding + T + u + this.config.quadrantPadding, fontSize: this.config.xAxisLabelFontSize, verticalPos: p ? "center" : "left", horizontalPos: "top", rotation: 0 }), this.data.xAxisRightText && n && x.push({ text: this.data.xAxisRightText, fill: this.themeConfig.quadrantXAxisTextFill, x: r + D + (p ? D / 2 : 0), y: t === "top" ? this.config.xAxisLabelPadding + d.top : this.config.xAxisLabelPadding + T + u + this.config.quadrantPadding, fontSize: this.config.xAxisLabelFontSize, verticalPos: p ? "center" : "left", horizontalPos: "top", rotation: 0 }), this.data.yAxisBottomText && g && x.push({ text: this.data.yAxisBottomText, fill: this.themeConfig.quadrantYAxisTextFill, x: this.config.yAxisPosition === "left" ? this.config.yAxisLabelPadding : this.config.yAxisLabelPadding + r + q + this.config.quadrantPadding, y: T + u - (y ? A / 2 : 0), fontSize: this.config.yAxisLabelFontSize, verticalPos: y ? "center" : "left", horizontalPos: "top", rotation: -90 }), this.data.yAxisTopText && g && x.push({ text: this.data.yAxisTopText, fill: this.themeConfig.quadrantYAxisTextFill, x: this.config.yAxisPosition === "left" ? this.config.yAxisLabelPadding : this.config.yAxisLabelPadding + r + q + this.config.quadrantPadding, y: T + A - (y ? A / 2 : 0), fontSize: this.config.yAxisLabelFontSize, verticalPos: y ? "center" : "left", horizontalPos: "top", rotation: -90 }), x;
  }
  getQuadrants(t) {
    let { quadrantSpace: n } = t, { quadrantHalfHeight: g, quadrantLeft: f, quadrantHalfWidth: o, quadrantTop: d } = n, A = [{ text: { text: this.data.quadrant1Text, fill: this.themeConfig.quadrant1TextFill, x: 0, y: 0, fontSize: this.config.quadrantLabelFontSize, verticalPos: "center", horizontalPos: "middle", rotation: 0 }, x: f + o, y: d, width: o, height: g, fill: this.themeConfig.quadrant1Fill }, { text: { text: this.data.quadrant2Text, fill: this.themeConfig.quadrant2TextFill, x: 0, y: 0, fontSize: this.config.quadrantLabelFontSize, verticalPos: "center", horizontalPos: "middle", rotation: 0 }, x: f, y: d, width: o, height: g, fill: this.themeConfig.quadrant2Fill }, { text: { text: this.data.quadrant3Text, fill: this.themeConfig.quadrant3TextFill, x: 0, y: 0, fontSize: this.config.quadrantLabelFontSize, verticalPos: "center", horizontalPos: "middle", rotation: 0 }, x: f, y: d + g, width: o, height: g, fill: this.themeConfig.quadrant3Fill }, { text: { text: this.data.quadrant4Text, fill: this.themeConfig.quadrant4TextFill, x: 0, y: 0, fontSize: this.config.quadrantLabelFontSize, verticalPos: "center", horizontalPos: "middle", rotation: 0 }, x: f + o, y: d + g, width: o, height: g, fill: this.themeConfig.quadrant4Fill }];
    for (let u of A) u.text.x = u.x + u.width / 2, this.data.points.length === 0 ? (u.text.y = u.y + u.height / 2, u.text.horizontalPos = "middle") : (u.text.y = u.y + this.config.quadrantTextTopPadding, u.text.horizontalPos = "top");
    return A;
  }
  getQuadrantPoints(t) {
    let { quadrantSpace: n } = t, { quadrantHeight: g, quadrantLeft: f, quadrantTop: o, quadrantWidth: d } = n, A = Jt().domain([0, 1]).range([f, d + f]), u = Jt().domain([0, 1]).range([g + o, o]);
    return this.data.points.map((r) => {
      let D = this.classes.get(r.className);
      return D && (r = { ...D, ...r }), { x: A(r.x), y: u(r.y), fill: r.color ?? this.themeConfig.quadrantPointFill, radius: r.radius ?? this.config.pointRadius, text: { text: r.text, fill: this.themeConfig.quadrantPointTextFill, x: A(r.x), y: u(r.y) + this.config.pointTextPadding, verticalPos: "center", horizontalPos: "top", fontSize: this.config.pointLabelFontSize, rotation: 0 }, strokeColor: r.strokeColor ?? this.themeConfig.quadrantPointFill, strokeWidth: r.strokeWidth ?? "0px" };
    });
  }
  getBorders(t) {
    let n = this.config.quadrantExternalBorderStrokeWidth / 2, { quadrantSpace: g } = t, { quadrantHalfHeight: f, quadrantHeight: o, quadrantLeft: d, quadrantHalfWidth: A, quadrantTop: u, quadrantWidth: r } = g;
    return [{ strokeFill: this.themeConfig.quadrantExternalBorderStrokeFill, strokeWidth: this.config.quadrantExternalBorderStrokeWidth, x1: d - n, y1: u, x2: d + r + n, y2: u }, { strokeFill: this.themeConfig.quadrantExternalBorderStrokeFill, strokeWidth: this.config.quadrantExternalBorderStrokeWidth, x1: d + r, y1: u + n, x2: d + r, y2: u + o - n }, { strokeFill: this.themeConfig.quadrantExternalBorderStrokeFill, strokeWidth: this.config.quadrantExternalBorderStrokeWidth, x1: d - n, y1: u + o, x2: d + r + n, y2: u + o }, { strokeFill: this.themeConfig.quadrantExternalBorderStrokeFill, strokeWidth: this.config.quadrantExternalBorderStrokeWidth, x1: d, y1: u + n, x2: d, y2: u + o - n }, { strokeFill: this.themeConfig.quadrantInternalBorderStrokeFill, strokeWidth: this.config.quadrantInternalBorderStrokeWidth, x1: d + A, y1: u + n, x2: d + A, y2: u + o - n }, { strokeFill: this.themeConfig.quadrantInternalBorderStrokeFill, strokeWidth: this.config.quadrantInternalBorderStrokeWidth, x1: d + n, y1: u + f, x2: d + r - n, y2: u + f }];
  }
  getTitle(t) {
    if (t) return { text: this.data.titleText, fill: this.themeConfig.quadrantTitleFill, fontSize: this.config.titleFontSize, horizontalPos: "top", verticalPos: "center", rotation: 0, y: this.config.titlePadding, x: this.config.chartWidth / 2 };
  }
  build() {
    let t = this.config.showXAxis && !!(this.data.xAxisLeftText || this.data.xAxisRightText), n = this.config.showYAxis && !!(this.data.yAxisTopText || this.data.yAxisBottomText), g = this.config.showTitle && !!this.data.titleText, f = this.data.points.length > 0 ? "bottom" : this.config.xAxisPosition, o = this.calculateSpace(f, t, n, g);
    return { points: this.getQuadrantPoints(o), quadrants: this.getQuadrants(o), axisLabels: this.getAxisLabels(f, t, n, o), borderLines: this.getBorders(o), title: this.getTitle(g) };
  }
}, l(_a, "QuadrantBuilder"), _a), pt = (_b = class extends Error {
  constructor(t, n, g) {
    super(`value for ${t} ${n} is invalid, please use a valid ${g}`), this.name = "InvalidStyleError";
  }
}, l(_b, "InvalidStyleError"), _b);
function Ct(t) {
  return !/^#?([\dA-Fa-f]{6}|[\dA-Fa-f]{3})$/.test(t);
}
l(Ct, "validateHexCode");
function ee(t) {
  return !/^\d+$/.test(t);
}
l(ee, "validateNumber");
function ie(t) {
  return !/^\d+px$/.test(t);
}
l(ie, "validateSizeInPixels");
var Ie = vt();
function H(t) {
  return ve(t.trim(), Ie);
}
l(H, "textSanitizer");
var E = new De();
function ae(t) {
  E.setData({ quadrant1Text: H(t.text) });
}
l(ae, "setQuadrant1Text");
function ne(t) {
  E.setData({ quadrant2Text: H(t.text) });
}
l(ne, "setQuadrant2Text");
function se(t) {
  E.setData({ quadrant3Text: H(t.text) });
}
l(se, "setQuadrant3Text");
function re(t) {
  E.setData({ quadrant4Text: H(t.text) });
}
l(re, "setQuadrant4Text");
function le(t) {
  E.setData({ xAxisLeftText: H(t.text) });
}
l(le, "setXAxisLeftText");
function oe(t) {
  E.setData({ xAxisRightText: H(t.text) });
}
l(oe, "setXAxisRightText");
function he(t) {
  E.setData({ yAxisTopText: H(t.text) });
}
l(he, "setYAxisTopText");
function ce(t) {
  E.setData({ yAxisBottomText: H(t.text) });
}
l(ce, "setYAxisBottomText");
function Tt(t) {
  let n = {};
  for (let g of t) {
    let [f, o] = g.trim().split(/\s*:\s*/);
    if (f === "radius") {
      if (ee(o)) throw new pt(f, o, "number");
      n.radius = parseInt(o);
    } else if (f === "color") {
      if (Ct(o)) throw new pt(f, o, "hex code");
      n.color = o;
    } else if (f === "stroke-color") {
      if (Ct(o)) throw new pt(f, o, "hex code");
      n.strokeColor = o;
    } else if (f === "stroke-width") {
      if (ie(o)) throw new pt(f, o, "number of pixels (eg. 10px)");
      n.strokeWidth = o;
    } else throw new Error(`style named ${f} is not supported.`);
  }
  return n;
}
l(Tt, "parseStyles");
function ue(t, n, g, f, o) {
  let d = Tt(o);
  E.addPoints([{ x: g, y: f, text: H(t.text), className: n, ...d }]);
}
l(ue, "addPoint");
function de(t, n) {
  E.addClass(t, Tt(n));
}
l(de, "addClass");
function xe(t) {
  E.setConfig({ chartWidth: t });
}
l(xe, "setWidth");
function fe(t) {
  E.setConfig({ chartHeight: t });
}
l(fe, "setHeight");
function ge() {
  let t = vt(), { themeVariables: n, quadrantChart: g } = t;
  return g && E.setConfig(g), E.setThemeConfig({ quadrant1Fill: n.quadrant1Fill, quadrant2Fill: n.quadrant2Fill, quadrant3Fill: n.quadrant3Fill, quadrant4Fill: n.quadrant4Fill, quadrant1TextFill: n.quadrant1TextFill, quadrant2TextFill: n.quadrant2TextFill, quadrant3TextFill: n.quadrant3TextFill, quadrant4TextFill: n.quadrant4TextFill, quadrantPointFill: n.quadrantPointFill, quadrantPointTextFill: n.quadrantPointTextFill, quadrantXAxisTextFill: n.quadrantXAxisTextFill, quadrantYAxisTextFill: n.quadrantYAxisTextFill, quadrantExternalBorderStrokeFill: n.quadrantExternalBorderStrokeFill, quadrantInternalBorderStrokeFill: n.quadrantInternalBorderStrokeFill, quadrantTitleFill: n.quadrantTitleFill }), E.setData({ titleText: te() }), E.build();
}
l(ge, "getQuadrantData");
var we = l(function() {
  E.clear(), Ce();
}, "clear"), ze = { setWidth: xe, setHeight: fe, setQuadrant1Text: ae, setQuadrant2Text: ne, setQuadrant3Text: se, setQuadrant4Text: re, setXAxisLeftText: le, setXAxisRightText: oe, setYAxisTopText: he, setYAxisBottomText: ce, parseStyles: Tt, addPoint: ue, addClass: de, getQuadrantData: ge, clear: we, setAccTitle: Fe, getAccTitle: ke, setDiagramTitle: _e, getDiagramTitle: te, getAccDescription: Se, setAccDescription: be }, Ne = l((t, n, g, f) => {
  var _a2, _b2, _c;
  function o(i) {
    return i === "top" ? "hanging" : "middle";
  }
  l(o, "getDominantBaseLine");
  function d(i) {
    return i === "left" ? "start" : "middle";
  }
  l(d, "getTextAnchor");
  function A(i) {
    return `translate(${i.x}, ${i.y}) rotate(${i.rotation || 0})`;
  }
  l(A, "getTransformation");
  let u = vt();
  yt.debug(`Rendering quadrant chart
` + t);
  let r = u.securityLevel, D;
  r === "sandbox" && (D = Ft("#i" + n));
  let T = (r === "sandbox" ? Ft(D.nodes()[0].contentDocument.body) : Ft("body")).select(`[id="${n}"]`), q = T.append("g").attr("class", "main"), p = ((_a2 = u.quadrantChart) == null ? void 0 : _a2.chartWidth) ?? 500, y = ((_b2 = u.quadrantChart) == null ? void 0 : _b2.chartHeight) ?? 500;
  Pe(T, y, p, ((_c = u.quadrantChart) == null ? void 0 : _c.useMaxWidth) ?? true), T.attr("viewBox", "0 0 " + p + " " + y), f.db.setHeight(y), f.db.setWidth(p);
  let x = f.db.getQuadrantData(), b = q.append("g").attr("class", "quadrants"), ot = q.append("g").attr("class", "border"), ht = q.append("g").attr("class", "data-points"), ct = q.append("g").attr("class", "labels"), ut = q.append("g").attr("class", "title");
  x.title && ut.append("text").attr("x", 0).attr("y", 0).attr("fill", x.title.fill).attr("font-size", x.title.fontSize).attr("dominant-baseline", o(x.title.horizontalPos)).attr("text-anchor", d(x.title.verticalPos)).attr("transform", A(x.title)).text(x.title.text), x.borderLines && ot.selectAll("line").data(x.borderLines).enter().append("line").attr("x1", (i) => i.x1).attr("y1", (i) => i.y1).attr("x2", (i) => i.x2).attr("y2", (i) => i.y2).style("stroke", (i) => i.strokeFill).style("stroke-width", (i) => i.strokeWidth);
  let rt = b.selectAll("g.quadrant").data(x.quadrants).enter().append("g").attr("class", "quadrant");
  rt.append("rect").attr("x", (i) => i.x).attr("y", (i) => i.y).attr("width", (i) => i.width).attr("height", (i) => i.height).attr("fill", (i) => i.fill), rt.append("text").attr("x", 0).attr("y", 0).attr("fill", (i) => i.text.fill).attr("font-size", (i) => i.text.fontSize).attr("dominant-baseline", (i) => o(i.text.horizontalPos)).attr("text-anchor", (i) => d(i.text.verticalPos)).attr("transform", (i) => A(i.text)).text((i) => i.text.text), ct.selectAll("g.label").data(x.axisLabels).enter().append("g").attr("class", "label").append("text").attr("x", 0).attr("y", 0).text((i) => i.text).attr("fill", (i) => i.fill).attr("font-size", (i) => i.fontSize).attr("dominant-baseline", (i) => o(i.horizontalPos)).attr("text-anchor", (i) => d(i.verticalPos)).attr("transform", (i) => A(i));
  let lt = ht.selectAll("g.data-point").data(x.points).enter().append("g").attr("class", "data-point");
  lt.append("circle").attr("cx", (i) => i.x).attr("cy", (i) => i.y).attr("r", (i) => i.radius).attr("fill", (i) => i.fill).attr("stroke", (i) => i.strokeColor).attr("stroke-width", (i) => i.strokeWidth), lt.append("text").attr("x", 0).attr("y", 0).text((i) => i.text.text).attr("fill", (i) => i.text.fill).attr("font-size", (i) => i.text.fontSize).attr("dominant-baseline", (i) => o(i.text.horizontalPos)).attr("text-anchor", (i) => d(i.text.verticalPos)).attr("transform", (i) => A(i.text));
}, "draw"), We = { draw: Ne }, Re = { parser: Ee, db: ze, renderer: We, styles: l(() => "", "styles") };
export {
  Re as diagram
};
