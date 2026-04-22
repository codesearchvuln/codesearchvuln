var _a;
import { m as y } from "./chunk-HN6EAY2L-DrlbuV6e.js";
import { Z as f, T as V, N as tt, b as x, D as Y, d as $, l as re, J as m, a as N, s as b, y as C, f as Ee, c as xe, Q as L, O as ie, t as ot, K as ae, e as R, X as O, R as q, g as rt, n as T, h as it, i as at, j as ut } from "./chunk-H3VCZNTA-DXoxCplV.js";
import { m as d, a_ as W, a$ as dt, b0 as st } from "./index-CRtis_Gf.js";
function E(e, n, t, o) {
  var r;
  do
    r = re(o);
  while (e.hasNode(r));
  return t.dummy = n, e.setNode(r, t), r;
}
d(E, "addDummyNode");
function Ne(e) {
  var n = new y().setGraph(e.graph());
  return f(e.nodes(), function(t) {
    n.setNode(t, e.node(t));
  }), f(e.edges(), function(t) {
    var o = n.edge(t.v, t.w) || { weight: 0, minlen: 1 }, r = e.edge(t);
    n.setEdge(t.v, t.w, { weight: o.weight + r.weight, minlen: Math.max(o.minlen, r.minlen) });
  }), n;
}
d(Ne, "simplify");
function ue(e) {
  var n = new y({ multigraph: e.isMultigraph() }).setGraph(e.graph());
  return f(e.nodes(), function(t) {
    e.children(t).length || n.setNode(t, e.node(t));
  }), f(e.edges(), function(t) {
    n.setEdge(t, e.edge(t));
  }), n;
}
d(ue, "asNonCompoundGraph");
function X(e, n) {
  var t = e.x, o = e.y, r = n.x - t, i = n.y - o, a = e.width / 2, u = e.height / 2;
  if (!r && !i) throw new Error("Not possible to find intersection inside of the rectangle");
  var s, c;
  return Math.abs(i) * a > Math.abs(r) * u ? (i < 0 && (u = -u), s = u * r / i, c = u) : (r < 0 && (a = -a), s = a, c = a * i / r), { x: t + s, y: o + c };
}
d(X, "intersectRect");
function j(e) {
  var n = m(N(de(e) + 1), function() {
    return [];
  });
  return f(e.nodes(), function(t) {
    var o = e.node(t), r = o.rank;
    b(r) || (n[r][o.order] = t);
  }), n;
}
d(j, "buildLayerMatrix");
function Oe(e) {
  var n = C(m(e.nodes(), function(t) {
    return e.node(t).rank;
  }));
  f(e.nodes(), function(t) {
    var o = e.node(t);
    Ee(o, "rank") && (o.rank -= n);
  });
}
d(Oe, "normalizeRanks");
function Ie(e) {
  var n = C(m(e.nodes(), function(i) {
    return e.node(i).rank;
  })), t = [];
  f(e.nodes(), function(i) {
    var a = e.node(i).rank - n;
    t[a] || (t[a] = []), t[a].push(i);
  });
  var o = 0, r = e.graph().nodeRankFactor;
  f(t, function(i, a) {
    b(i) && a % r !== 0 ? --o : o && f(i, function(u) {
      e.node(u).rank += o;
    });
  });
}
d(Ie, "removeEmptyRanks");
function H(e, n, t, o) {
  var r = { width: 0, height: 0 };
  return arguments.length >= 4 && (r.rank = t, r.order = o), E(e, "border", r, n);
}
d(H, "addBorderNode");
function de(e) {
  return x(m(e.nodes(), function(n) {
    var t = e.node(n).rank;
    if (!b(t)) return t;
  }));
}
d(de, "maxRank");
function Pe(e, n) {
  var t = { lhs: [], rhs: [] };
  return f(e, function(o) {
    n(o) ? t.lhs.push(o) : t.rhs.push(o);
  }), t;
}
d(Pe, "partition");
function Ce(e, n) {
  var t = xe();
  try {
    return n();
  } finally {
    console.log(e + " time: " + (xe() - t) + "ms");
  }
}
d(Ce, "time");
function _e(e, n) {
  return n();
}
d(_e, "notime");
function Le(e) {
  function n(t) {
    var o = e.children(t), r = e.node(t);
    if (o.length && f(o, n), Object.prototype.hasOwnProperty.call(r, "minRank")) {
      r.borderLeft = [], r.borderRight = [];
      for (var i = r.minRank, a = r.maxRank + 1; i < a; ++i) K(e, "borderLeft", "_bl", t, r, i), K(e, "borderRight", "_br", t, r, i);
    }
  }
  d(n, "dfs"), f(e.children(), n);
}
d(Le, "addBorderSegments");
function K(e, n, t, o, r, i) {
  var a = { width: 0, height: 0, rank: i, borderType: n }, u = r[n][i - 1], s = E(e, "border", a, t);
  r[n][i] = s, e.setParent(s, o), u && e.setEdge(u, s, { weight: 1 });
}
d(K, "addBorderNode");
function Re(e) {
  var n = e.graph().rankdir.toLowerCase();
  (n === "lr" || n === "rl") && se(e);
}
d(Re, "adjust");
function Te(e) {
  var n = e.graph().rankdir.toLowerCase();
  (n === "bt" || n === "rl") && je(e), (n === "lr" || n === "rl") && (Se(e), se(e));
}
d(Te, "undo");
function se(e) {
  f(e.nodes(), function(n) {
    Z(e.node(n));
  }), f(e.edges(), function(n) {
    Z(e.edge(n));
  });
}
d(se, "swapWidthHeight");
function Z(e) {
  var n = e.width;
  e.width = e.height, e.height = n;
}
d(Z, "swapWidthHeightOne");
function je(e) {
  f(e.nodes(), function(n) {
    S(e.node(n));
  }), f(e.edges(), function(n) {
    var t = e.edge(n);
    f(t.points, S), Object.prototype.hasOwnProperty.call(t, "y") && S(t);
  });
}
d(je, "reverseY");
function S(e) {
  e.y = -e.y;
}
d(S, "reverseYOne");
function Se(e) {
  f(e.nodes(), function(n) {
    M(e.node(n));
  }), f(e.edges(), function(n) {
    var t = e.edge(n);
    f(t.points, M), Object.prototype.hasOwnProperty.call(t, "x") && M(t);
  });
}
d(Se, "swapXY");
function M(e) {
  var n = e.x;
  e.x = e.y, e.y = n;
}
d(M, "swapXYOne");
var ct = (_a = class {
  constructor() {
    var e = {};
    e._next = e._prev = e, this._sentinel = e;
  }
  dequeue() {
    var e = this._sentinel, n = e._prev;
    if (n !== e) return Q(n), n;
  }
  enqueue(e) {
    var n = this._sentinel;
    e._prev && e._next && Q(e), e._next = n._next, n._next._prev = e, n._next = e, e._prev = n;
  }
  toString() {
    for (var e = [], n = this._sentinel, t = n._prev; t !== n; ) e.push(JSON.stringify(t, Me)), t = t._prev;
    return "[" + e.join(", ") + "]";
  }
}, d(_a, "List"), _a);
function Q(e) {
  e._prev._next = e._next, e._next._prev = e._prev, delete e._next, delete e._prev;
}
d(Q, "unlink");
function Me(e, n) {
  if (e !== "_next" && e !== "_prev") return n;
}
d(Me, "filterOutLinks");
var ft = dt(1);
function Ge(e, n) {
  if (e.nodeCount() <= 1) return [];
  var t = Fe(e, n || ft), o = Be(t.graph, t.buckets, t.zeroIdx);
  return L(m(o, function(r) {
    return e.outEdges(r.v, r.w);
  }));
}
d(Ge, "greedyFAS");
function Be(e, n, t) {
  for (var o = [], r = n[n.length - 1], i = n[0], a; e.nodeCount(); ) {
    for (; a = i.dequeue(); ) G(e, n, t, a);
    for (; a = r.dequeue(); ) G(e, n, t, a);
    if (e.nodeCount()) {
      for (var u = n.length - 2; u > 0; --u) if (a = n[u].dequeue(), a) {
        o = o.concat(G(e, n, t, a, true));
        break;
      }
    }
  }
  return o;
}
d(Be, "doGreedyFAS");
function G(e, n, t, o, r) {
  var i = r ? [] : void 0;
  return f(e.inEdges(o.v), function(a) {
    var u = e.edge(a), s = e.node(a.v);
    r && i.push({ v: a.v, w: a.w }), s.out -= u, D(n, t, s);
  }), f(e.outEdges(o.v), function(a) {
    var u = e.edge(a), s = a.w, c = e.node(s);
    c.in -= u, D(n, t, c);
  }), e.removeNode(o.v), i;
}
d(G, "removeNode");
function Fe(e, n) {
  var t = new y(), o = 0, r = 0;
  f(e.nodes(), function(u) {
    t.setNode(u, { v: u, in: 0, out: 0 });
  }), f(e.edges(), function(u) {
    var s = t.edge(u.v, u.w) || 0, c = n(u), h = s + c;
    t.setEdge(u.v, u.w, h), r = Math.max(r, t.node(u.v).out += c), o = Math.max(o, t.node(u.w).in += c);
  });
  var i = N(r + o + 3).map(function() {
    return new ct();
  }), a = o + 1;
  return f(t.nodes(), function(u) {
    D(i, a, t.node(u));
  }), { graph: t, buckets: i, zeroIdx: a };
}
d(Fe, "buildState");
function D(e, n, t) {
  t.out ? t.in ? e[t.out - t.in + n].enqueue(t) : e[e.length - 1].enqueue(t) : e[0].enqueue(t);
}
d(D, "assignBucket");
function Ve(e) {
  var n = e.graph().acyclicer === "greedy" ? Ge(e, t(e)) : Ye(e);
  f(n, function(o) {
    var r = e.edge(o);
    e.removeEdge(o), r.forwardName = o.name, r.reversed = true, e.setEdge(o.w, o.v, r, re("rev"));
  });
  function t(o) {
    return function(r) {
      return o.edge(r).weight;
    };
  }
  d(t, "weightFn");
}
d(Ve, "run");
function Ye(e) {
  var n = [], t = {}, o = {};
  function r(i) {
    Object.prototype.hasOwnProperty.call(o, i) || (o[i] = true, t[i] = true, f(e.outEdges(i), function(a) {
      Object.prototype.hasOwnProperty.call(t, a.w) ? n.push(a) : r(a.w);
    }), delete t[i]);
  }
  return d(r, "dfs"), f(e.nodes(), r), n;
}
d(Ye, "dfsFAS");
function De(e) {
  f(e.edges(), function(n) {
    var t = e.edge(n);
    if (t.reversed) {
      e.removeEdge(n);
      var o = t.forwardName;
      delete t.reversed, delete t.forwardName, e.setEdge(n.w, n.v, t, o);
    }
  });
}
d(De, "undo");
function $e(e) {
  e.graph().dummyChains = [], f(e.edges(), function(n) {
    qe(e, n);
  });
}
d($e, "run");
function qe(e, n) {
  var t = n.v, o = e.node(t).rank, r = n.w, i = e.node(r).rank, a = n.name, u = e.edge(n), s = u.labelRank;
  if (i !== o + 1) {
    e.removeEdge(n);
    var c = void 0, h, g;
    for (g = 0, ++o; o < i; ++g, ++o) u.points = [], c = { width: 0, height: 0, edgeLabel: u, edgeObj: n, rank: o }, h = E(e, "edge", c, "_d"), o === s && (c.width = u.width, c.height = u.height, c.dummy = "edge-label", c.labelpos = u.labelpos), e.setEdge(t, h, { weight: u.weight }, a), g === 0 && e.graph().dummyChains.push(h), t = h;
    e.setEdge(t, r, { weight: u.weight }, a);
  }
}
d(qe, "normalizeEdge");
function ze(e) {
  f(e.graph().dummyChains, function(n) {
    var t = e.node(n), o = t.edgeLabel, r;
    for (e.setEdge(t.edgeObj, o); t.dummy; ) r = e.successors(n)[0], e.removeNode(n), o.points.push({ x: t.x, y: t.y }), t.dummy === "edge-label" && (o.x = t.x, o.y = t.y, o.width = t.width, o.height = t.height), n = r, t = e.node(n);
  });
}
d(ze, "undo");
function z(e) {
  var n = {};
  function t(o) {
    var r = e.node(o);
    if (Object.prototype.hasOwnProperty.call(n, o)) return r.rank;
    n[o] = true;
    var i = C(m(e.outEdges(o), function(a) {
      return t(a.w) - e.edge(a).minlen;
    }));
    return (i === Number.POSITIVE_INFINITY || i === void 0 || i === null) && (i = 0), r.rank = i;
  }
  d(t, "dfs"), f(e.sources(), t);
}
d(z, "longestPath");
function I(e, n) {
  return e.node(n.w).rank - e.node(n.v).rank - e.edge(n).minlen;
}
d(I, "slack");
function ce(e) {
  var n = new y({ directed: false }), t = e.nodes()[0], o = e.nodeCount();
  n.setNode(t, {});
  for (var r, i; Ae(n, e) < o; ) r = Je(n, e), i = n.hasNode(r.v) ? I(e, r) : -I(e, r), We(n, e, i);
  return n;
}
d(ce, "feasibleTree");
function Ae(e, n) {
  function t(o) {
    f(n.nodeEdges(o), function(r) {
      var i = r.v, a = o === i ? r.w : i;
      !e.hasNode(a) && !I(n, r) && (e.setNode(a, {}), e.setEdge(o, a, {}), t(a));
    });
  }
  return d(t, "dfs"), f(e.nodes(), t), e.nodeCount();
}
d(Ae, "tightTree");
function Je(e, n) {
  return ie(n.edges(), function(t) {
    if (e.hasNode(t.v) !== e.hasNode(t.w)) return I(n, t);
  });
}
d(Je, "findMinSlackEdge");
function We(e, n, t) {
  f(e.nodes(), function(o) {
    n.node(o).rank += t;
  });
}
d(We, "shiftRanks");
Xe.CycleException = _;
function Xe(e) {
  var n = {}, t = {}, o = [];
  function r(i) {
    if (Object.prototype.hasOwnProperty.call(t, i)) throw new _();
    Object.prototype.hasOwnProperty.call(n, i) || (t[i] = true, n[i] = true, f(e.predecessors(i), r), delete t[i], o.push(i));
  }
  if (d(r, "visit"), f(e.sinks(), r), ot(n) !== e.nodeCount()) throw new _();
  return o;
}
d(Xe, "topsort");
function _() {
}
d(_, "CycleException");
_.prototype = new Error();
function fe(e, n, t) {
  st(n) || (n = [n]);
  var o = (e.isDirected() ? e.successors : e.neighbors).bind(e), r = [], i = {};
  return f(n, function(a) {
    if (!e.hasNode(a)) throw new Error("Graph does not have node: " + a);
    he(e, a, t === "post", i, o, r);
  }), r;
}
d(fe, "dfs");
function he(e, n, t, o, r, i) {
  Object.prototype.hasOwnProperty.call(o, n) || (o[n] = true, t || i.push(n), f(r(n), function(a) {
    he(e, a, t, o, r, i);
  }), t && i.push(n));
}
d(he, "doDfs");
function He(e, n) {
  return fe(e, n, "post");
}
d(He, "postorder");
function Ke(e, n) {
  return fe(e, n, "pre");
}
d(Ke, "preorder");
k.initLowLimValues = J;
k.initCutValues = A;
k.calcCutValue = ge;
k.leaveEdge = pe;
k.enterEdge = ve;
k.exchangeEdges = me;
function k(e) {
  e = Ne(e), z(e);
  var n = ce(e);
  J(n), A(n, e);
  for (var t, o; t = pe(n); ) o = ve(n, e, t), me(n, e, t, o);
}
d(k, "networkSimplex");
function A(e, n) {
  var t = He(e, e.nodes());
  t = t.slice(0, t.length - 1), f(t, function(o) {
    Ze(e, n, o);
  });
}
d(A, "initCutValues");
function Ze(e, n, t) {
  var o = e.node(t), r = o.parent;
  e.edge(t, r).cutvalue = ge(e, n, t);
}
d(Ze, "assignCutValue");
function ge(e, n, t) {
  var o = e.node(t), r = o.parent, i = true, a = n.edge(t, r), u = 0;
  return a || (i = false, a = n.edge(r, t)), u = a.weight, f(n.nodeEdges(t), function(s) {
    var c = s.v === t, h = c ? s.w : s.v;
    if (h !== r) {
      var g = c === i, l = n.edge(s).weight;
      if (u += g ? l : -l, Ue(e, t, h)) {
        var p = e.edge(t, h).cutvalue;
        u += g ? -p : p;
      }
    }
  }), u;
}
d(ge, "calcCutValue");
function J(e, n) {
  arguments.length < 2 && (n = e.nodes()[0]), le(e, {}, 1, n);
}
d(J, "initLowLimValues");
function le(e, n, t, o, r) {
  var i = t, a = e.node(o);
  return n[o] = true, f(e.neighbors(o), function(u) {
    Object.prototype.hasOwnProperty.call(n, u) || (t = le(e, n, t, u, o));
  }), a.low = i, a.lim = t++, r ? a.parent = r : delete a.parent, t;
}
d(le, "dfsAssignLowLim");
function pe(e) {
  return ae(e.edges(), function(n) {
    return e.edge(n).cutvalue < 0;
  });
}
d(pe, "leaveEdge");
function ve(e, n, t) {
  var o = t.v, r = t.w;
  n.hasEdge(o, r) || (o = t.w, r = t.v);
  var i = e.node(o), a = e.node(r), u = i, s = false;
  i.lim > a.lim && (u = a, s = true);
  var c = R(n.edges(), function(h) {
    return s === U(e, e.node(h.v), u) && s !== U(e, e.node(h.w), u);
  });
  return ie(c, function(h) {
    return I(n, h);
  });
}
d(ve, "enterEdge");
function me(e, n, t, o) {
  var r = t.v, i = t.w;
  e.removeEdge(r, i), e.setEdge(o.v, o.w, {}), J(e), A(e, n), Qe(e, n);
}
d(me, "exchangeEdges");
function Qe(e, n) {
  var t = ae(e.nodes(), function(r) {
    return !n.node(r).parent;
  }), o = Ke(e, t);
  o = o.slice(1), f(o, function(r) {
    var i = e.node(r).parent, a = n.edge(r, i), u = false;
    a || (a = n.edge(i, r), u = true), n.node(r).rank = n.node(i).rank + (u ? a.minlen : -a.minlen);
  });
}
d(Qe, "updateRanks");
function Ue(e, n, t) {
  return e.hasEdge(n, t);
}
d(Ue, "isTreeEdge");
function U(e, n, t) {
  return t.low <= n.lim && n.lim <= t.lim;
}
d(U, "isDescendant");
function en(e) {
  switch (e.graph().ranker) {
    case "network-simplex":
      ee(e);
      break;
    case "tight-tree":
      nn(e);
      break;
    case "longest-path":
      ht(e);
      break;
    default:
      ee(e);
  }
}
d(en, "rank");
var ht = z;
function nn(e) {
  z(e), ce(e);
}
d(nn, "tightTreeRanker");
function ee(e) {
  k(e);
}
d(ee, "networkSimplexRanker");
function tn(e) {
  var n = E(e, "root", {}, "_root"), t = on(e), o = x(O(t)) - 1, r = 2 * o + 1;
  e.graph().nestingRoot = n, f(e.edges(), function(a) {
    e.edge(a).minlen *= r;
  });
  var i = rn(e) + 1;
  f(e.children(), function(a) {
    we(e, n, r, i, o, t, a);
  }), e.graph().nodeRankFactor = r;
}
d(tn, "run");
function we(e, n, t, o, r, i, a) {
  var u = e.children(a);
  if (!u.length) {
    a !== n && e.setEdge(n, a, { weight: 0, minlen: t });
    return;
  }
  var s = H(e, "_bt"), c = H(e, "_bb"), h = e.node(a);
  e.setParent(s, a), h.borderTop = s, e.setParent(c, a), h.borderBottom = c, f(u, function(g) {
    we(e, n, t, o, r, i, g);
    var l = e.node(g), p = l.borderTop ? l.borderTop : g, v = l.borderBottom ? l.borderBottom : g, w = l.borderTop ? o : 2 * o, P = p !== v ? 1 : r - i[a] + 1;
    e.setEdge(s, p, { weight: w, minlen: P, nestingEdge: true }), e.setEdge(v, c, { weight: w, minlen: P, nestingEdge: true });
  }), e.parent(a) || e.setEdge(n, s, { weight: 0, minlen: r + i[a] });
}
d(we, "dfs");
function on(e) {
  var n = {};
  function t(o, r) {
    var i = e.children(o);
    i && i.length && f(i, function(a) {
      t(a, r + 1);
    }), n[o] = r;
  }
  return d(t, "dfs"), f(e.children(), function(o) {
    t(o, 1);
  }), n;
}
d(on, "treeDepths");
function rn(e) {
  return q(e.edges(), function(n, t) {
    return n + e.edge(t).weight;
  }, 0);
}
d(rn, "sumWeights");
function an(e) {
  var n = e.graph();
  e.removeNode(n.nestingRoot), delete n.nestingRoot, f(e.edges(), function(t) {
    var o = e.edge(t);
    o.nestingEdge && e.removeEdge(t);
  });
}
d(an, "cleanup");
function un(e, n, t) {
  var o = {}, r;
  f(t, function(i) {
    for (var a = e.parent(i), u, s; a; ) {
      if (u = e.parent(a), u ? (s = o[u], o[u] = a) : (s = r, r = a), s && s !== a) {
        n.setEdge(s, a);
        return;
      }
      a = u;
    }
  });
}
d(un, "addSubgraphConstraints");
function dn(e, n, t) {
  var o = sn(e), r = new y({ compound: true }).setGraph({ root: o }).setDefaultNodeLabel(function(i) {
    return e.node(i);
  });
  return f(e.nodes(), function(i) {
    var a = e.node(i), u = e.parent(i);
    (a.rank === n || a.minRank <= n && n <= a.maxRank) && (r.setNode(i), r.setParent(i, u || o), f(e[t](i), function(s) {
      var c = s.v === i ? s.w : s.v, h = r.edge(c, i), g = b(h) ? 0 : h.weight;
      r.setEdge(c, i, { weight: e.edge(s).weight + g });
    }), Object.prototype.hasOwnProperty.call(a, "minRank") && r.setNode(i, { borderLeft: a.borderLeft[n], borderRight: a.borderRight[n] }));
  }), r;
}
d(dn, "buildLayerGraph");
function sn(e) {
  for (var n; e.hasNode(n = re("_root")); ) ;
  return n;
}
d(sn, "createRootNode");
function cn(e, n) {
  for (var t = 0, o = 1; o < n.length; ++o) t += fn(e, n[o - 1], n[o]);
  return t;
}
d(cn, "crossCount");
function fn(e, n, t) {
  for (var o = rt(t, m(t, function(c, h) {
    return h;
  })), r = L(m(n, function(c) {
    return T(m(e.outEdges(c), function(h) {
      return { pos: o[h.w], weight: e.edge(h).weight };
    }), "pos");
  })), i = 1; i < t.length; ) i <<= 1;
  var a = 2 * i - 1;
  i -= 1;
  var u = m(new Array(a), function() {
    return 0;
  }), s = 0;
  return f(r.forEach(function(c) {
    var h = c.pos + i;
    u[h] += c.weight;
    for (var g = 0; h > 0; ) h % 2 && (g += u[h + 1]), h = h - 1 >> 1, u[h] += c.weight;
    s += c.weight * g;
  })), s;
}
d(fn, "twoLayerCrossCount");
function hn(e) {
  var n = {}, t = R(e.nodes(), function(u) {
    return !e.children(u).length;
  }), o = x(m(t, function(u) {
    return e.node(u).rank;
  })), r = m(N(o + 1), function() {
    return [];
  });
  function i(u) {
    if (!Ee(n, u)) {
      n[u] = true;
      var s = e.node(u);
      r[s.rank].push(u), f(e.successors(u), i);
    }
  }
  d(i, "dfs");
  var a = T(t, function(u) {
    return e.node(u).rank;
  });
  return f(a, i), r;
}
d(hn, "initOrder");
function gn(e, n) {
  return m(n, function(t) {
    var o = e.inEdges(t);
    if (o.length) {
      var r = q(o, function(i, a) {
        var u = e.edge(a), s = e.node(a.v);
        return { sum: i.sum + u.weight * s.order, weight: i.weight + u.weight };
      }, { sum: 0, weight: 0 });
      return { v: t, barycenter: r.sum / r.weight, weight: r.weight };
    } else return { v: t };
  });
}
d(gn, "barycenter");
function ln(e, n) {
  var t = {};
  f(e, function(r, i) {
    var a = t[r.v] = { indegree: 0, in: [], out: [], vs: [r.v], i };
    b(r.barycenter) || (a.barycenter = r.barycenter, a.weight = r.weight);
  }), f(n.edges(), function(r) {
    var i = t[r.v], a = t[r.w];
    !b(i) && !b(a) && (a.indegree++, i.out.push(t[r.w]));
  });
  var o = R(t, function(r) {
    return !r.indegree;
  });
  return pn(o);
}
d(ln, "resolveConflicts");
function pn(e) {
  var n = [];
  function t(i) {
    return function(a) {
      a.merged || (b(a.barycenter) || b(i.barycenter) || a.barycenter >= i.barycenter) && vn(i, a);
    };
  }
  d(t, "handleIn");
  function o(i) {
    return function(a) {
      a.in.push(i), --a.indegree === 0 && e.push(a);
    };
  }
  for (d(o, "handleOut"); e.length; ) {
    var r = e.pop();
    n.push(r), f(r.in.reverse(), t(r)), f(r.out, o(r));
  }
  return m(R(n, function(i) {
    return !i.merged;
  }), function(i) {
    return V(i, ["vs", "i", "barycenter", "weight"]);
  });
}
d(pn, "doResolveConflicts");
function vn(e, n) {
  var t = 0, o = 0;
  e.weight && (t += e.barycenter * e.weight, o += e.weight), n.weight && (t += n.barycenter * n.weight, o += n.weight), e.vs = n.vs.concat(e.vs), e.barycenter = t / o, e.weight = o, e.i = Math.min(n.i, e.i), n.merged = true;
}
d(vn, "mergeEntries");
function mn(e, n) {
  var t = Pe(e, function(h) {
    return Object.prototype.hasOwnProperty.call(h, "barycenter");
  }), o = t.lhs, r = T(t.rhs, function(h) {
    return -h.i;
  }), i = [], a = 0, u = 0, s = 0;
  o.sort(wn(!!n)), s = ne(i, r, s), f(o, function(h) {
    s += h.vs.length, i.push(h.vs), a += h.barycenter * h.weight, u += h.weight, s = ne(i, r, s);
  });
  var c = { vs: L(i) };
  return u && (c.barycenter = a / u, c.weight = u), c;
}
d(mn, "sort");
function ne(e, n, t) {
  for (var o; n.length && (o = Y(n)).i <= t; ) n.pop(), e.push(o.vs), t++;
  return t;
}
d(ne, "consumeUnsortable");
function wn(e) {
  return function(n, t) {
    return n.barycenter < t.barycenter ? -1 : n.barycenter > t.barycenter ? 1 : e ? t.i - n.i : n.i - t.i;
  };
}
d(wn, "compareWithBias");
function be(e, n, t, o) {
  var r = e.children(n), i = e.node(n), a = i ? i.borderLeft : void 0, u = i ? i.borderRight : void 0, s = {};
  a && (r = R(r, function(v) {
    return v !== a && v !== u;
  }));
  var c = gn(e, r);
  f(c, function(v) {
    if (e.children(v.v).length) {
      var w = be(e, v.v, t, o);
      s[v.v] = w, Object.prototype.hasOwnProperty.call(w, "barycenter") && yn(v, w);
    }
  });
  var h = ln(c, t);
  bn(h, s);
  var g = mn(h, o);
  if (a && (g.vs = L([a, g.vs, u]), e.predecessors(a).length)) {
    var l = e.node(e.predecessors(a)[0]), p = e.node(e.predecessors(u)[0]);
    Object.prototype.hasOwnProperty.call(g, "barycenter") || (g.barycenter = 0, g.weight = 0), g.barycenter = (g.barycenter * g.weight + l.order + p.order) / (g.weight + 2), g.weight += 2;
  }
  return g;
}
d(be, "sortSubgraph");
function bn(e, n) {
  f(e, function(t) {
    t.vs = L(t.vs.map(function(o) {
      return n[o] ? n[o].vs : o;
    }));
  });
}
d(bn, "expandSubgraphs");
function yn(e, n) {
  b(e.barycenter) ? (e.barycenter = n.barycenter, e.weight = n.weight) : (e.barycenter = (e.barycenter * e.weight + n.barycenter * n.weight) / (e.weight + n.weight), e.weight += n.weight);
}
d(yn, "mergeBarycenters");
function kn(e) {
  var n = de(e), t = te(e, N(1, n + 1), "inEdges"), o = te(e, N(n - 1, -1, -1), "outEdges"), r = hn(e);
  oe(e, r);
  for (var i = Number.POSITIVE_INFINITY, a, u = 0, s = 0; s < 4; ++u, ++s) {
    xn(u % 2 ? t : o, u % 4 >= 2), r = j(e);
    var c = cn(e, r);
    c < i && (s = 0, a = it(r), i = c);
  }
  oe(e, a);
}
d(kn, "order");
function te(e, n, t) {
  return m(n, function(o) {
    return dn(e, o, t);
  });
}
d(te, "buildLayerGraphs");
function xn(e, n) {
  var t = new y();
  f(e, function(o) {
    var r = o.graph().root, i = be(o, r, t, n);
    f(i.vs, function(a, u) {
      o.node(a).order = u;
    }), un(o, t, i.vs);
  });
}
d(xn, "sweepLayerGraphs");
function oe(e, n) {
  f(n, function(t) {
    f(t, function(o, r) {
      e.node(o).order = r;
    });
  });
}
d(oe, "assignOrder");
function En(e) {
  var n = On(e);
  f(e.graph().dummyChains, function(t) {
    for (var o = e.node(t), r = o.edgeObj, i = Nn(e, n, r.v, r.w), a = i.path, u = i.lca, s = 0, c = a[s], h = true; t !== r.w; ) {
      if (o = e.node(t), h) {
        for (; (c = a[s]) !== u && e.node(c).maxRank < o.rank; ) s++;
        c === u && (h = false);
      }
      if (!h) {
        for (; s < a.length - 1 && e.node(c = a[s + 1]).minRank <= o.rank; ) s++;
        c = a[s];
      }
      e.setParent(t, c), t = e.successors(t)[0];
    }
  });
}
d(En, "parentDummyChains");
function Nn(e, n, t, o) {
  var r = [], i = [], a = Math.min(n[t].low, n[o].low), u = Math.max(n[t].lim, n[o].lim), s, c;
  s = t;
  do
    s = e.parent(s), r.push(s);
  while (s && (n[s].low > a || u > n[s].lim));
  for (c = s, s = o; (s = e.parent(s)) !== c; ) i.push(s);
  return { path: r.concat(i.reverse()), lca: c };
}
d(Nn, "findPath");
function On(e) {
  var n = {}, t = 0;
  function o(r) {
    var i = t;
    f(e.children(r), o), n[r] = { low: i, lim: t++ };
  }
  return d(o, "dfs"), f(e.children(), o), n;
}
d(On, "postorder");
function In(e, n) {
  var t = {};
  function o(r, i) {
    var a = 0, u = 0, s = r.length, c = Y(i);
    return f(i, function(h, g) {
      var l = Cn(e, h), p = l ? e.node(l).order : s;
      (l || h === c) && (f(i.slice(u, g + 1), function(v) {
        f(e.predecessors(v), function(w) {
          var P = e.node(w), ke = P.order;
          (ke < a || p < ke) && !(P.dummy && e.node(v).dummy) && ye(t, w, v);
        });
      }), u = g + 1, a = p);
    }), i;
  }
  return d(o, "visitLayer"), q(n, o), t;
}
d(In, "findType1Conflicts");
function Pn(e, n) {
  var t = {};
  function o(i, a, u, s, c) {
    var h;
    f(N(a, u), function(g) {
      h = i[g], e.node(h).dummy && f(e.predecessors(h), function(l) {
        var p = e.node(l);
        p.dummy && (p.order < s || p.order > c) && ye(t, l, h);
      });
    });
  }
  d(o, "scan");
  function r(i, a) {
    var u = -1, s, c = 0;
    return f(a, function(h, g) {
      if (e.node(h).dummy === "border") {
        var l = e.predecessors(h);
        l.length && (s = e.node(l[0]).order, o(a, c, g, u, s), c = g, u = s);
      }
      o(a, c, a.length, s, i.length);
    }), a;
  }
  return d(r, "visitLayer"), q(n, r), t;
}
d(Pn, "findType2Conflicts");
function Cn(e, n) {
  if (e.node(n).dummy) return ae(e.predecessors(n), function(t) {
    return e.node(t).dummy;
  });
}
d(Cn, "findOtherInnerSegmentNode");
function ye(e, n, t) {
  if (n > t) {
    var o = n;
    n = t, t = o;
  }
  Object.prototype.hasOwnProperty.call(e, n) || Object.defineProperty(e, n, { enumerable: true, configurable: true, value: {}, writable: true });
  var r = e[n];
  Object.defineProperty(r, t, { enumerable: true, configurable: true, value: true, writable: true });
}
d(ye, "addConflict");
function _n(e, n, t) {
  if (n > t) {
    var o = n;
    n = t, t = o;
  }
  return !!e[n] && Object.prototype.hasOwnProperty.call(e[n], t);
}
d(_n, "hasConflict");
function Ln(e, n, t, o) {
  var r = {}, i = {}, a = {};
  return f(n, function(u) {
    f(u, function(s, c) {
      r[s] = s, i[s] = s, a[s] = c;
    });
  }), f(n, function(u) {
    var s = -1;
    f(u, function(c) {
      var h = o(c);
      if (h.length) {
        h = T(h, function(w) {
          return a[w];
        });
        for (var g = (h.length - 1) / 2, l = Math.floor(g), p = Math.ceil(g); l <= p; ++l) {
          var v = h[l];
          i[c] === c && s < a[v] && !_n(t, c, v) && (i[v] = c, i[c] = r[c] = r[v], s = a[v]);
        }
      }
    });
  }), { root: r, align: i };
}
d(Ln, "verticalAlignment");
function Rn(e, n, t, o, r) {
  var i = {}, a = Tn(e, n, t, r), u = r ? "borderLeft" : "borderRight";
  function s(g, l) {
    for (var p = a.nodes(), v = p.pop(), w = {}; v; ) w[v] ? g(v) : (w[v] = true, p.push(v), p = p.concat(l(v))), v = p.pop();
  }
  d(s, "iterate");
  function c(g) {
    i[g] = a.inEdges(g).reduce(function(l, p) {
      return Math.max(l, i[p.v] + a.edge(p));
    }, 0);
  }
  d(c, "pass1");
  function h(g) {
    var l = a.outEdges(g).reduce(function(v, w) {
      return Math.min(v, i[w.w] - a.edge(w));
    }, Number.POSITIVE_INFINITY), p = e.node(g);
    l !== Number.POSITIVE_INFINITY && p.borderType !== u && (i[g] = Math.max(i[g], l));
  }
  return d(h, "pass2"), s(c, a.predecessors.bind(a)), s(h, a.successors.bind(a)), f(o, function(g) {
    i[g] = i[t[g]];
  }), i;
}
d(Rn, "horizontalCompaction");
function Tn(e, n, t, o) {
  var r = new y(), i = e.graph(), a = Bn(i.nodesep, i.edgesep, o);
  return f(n, function(u) {
    var s;
    f(u, function(c) {
      var h = t[c];
      if (r.setNode(h), s) {
        var g = t[s], l = r.edge(g, h);
        r.setEdge(g, h, Math.max(a(e, c, s), l || 0));
      }
      s = c;
    });
  }), r;
}
d(Tn, "buildBlockGraph");
function jn(e, n) {
  return ie(O(n), function(t) {
    var o = Number.NEGATIVE_INFINITY, r = Number.POSITIVE_INFINITY;
    return at(t, function(i, a) {
      var u = Fn(e, a) / 2;
      o = Math.max(i + u, o), r = Math.min(i - u, r);
    }), o - r;
  });
}
d(jn, "findSmallestWidthAlignment");
function Sn(e, n) {
  var t = O(n), o = C(t), r = x(t);
  f(["u", "d"], function(i) {
    f(["l", "r"], function(a) {
      var u = i + a, s = e[u], c;
      if (s !== n) {
        var h = O(s);
        c = a === "l" ? o - C(h) : r - x(h), c && (e[u] = $(s, function(g) {
          return g + c;
        }));
      }
    });
  });
}
d(Sn, "alignCoordinates");
function Mn(e, n) {
  return $(e.ul, function(t, o) {
    if (n) return e[n.toLowerCase()][o];
    var r = T(m(e, o));
    return (r[1] + r[2]) / 2;
  });
}
d(Mn, "balance");
function Gn(e) {
  var n = j(e), t = W(In(e, n), Pn(e, n)), o = {}, r;
  f(["u", "d"], function(a) {
    r = a === "u" ? n : O(n).reverse(), f(["l", "r"], function(u) {
      u === "r" && (r = m(r, function(g) {
        return O(g).reverse();
      }));
      var s = (a === "u" ? e.predecessors : e.successors).bind(e), c = Ln(e, r, t, s), h = Rn(e, r, c.root, c.align, u === "r");
      u === "r" && (h = $(h, function(g) {
        return -g;
      })), o[a + u] = h;
    });
  });
  var i = jn(e, o);
  return Sn(o, i), Mn(o, e.graph().align);
}
d(Gn, "positionX");
function Bn(e, n, t) {
  return function(o, r, i) {
    var a = o.node(r), u = o.node(i), s = 0, c;
    if (s += a.width / 2, Object.prototype.hasOwnProperty.call(a, "labelpos")) switch (a.labelpos.toLowerCase()) {
      case "l":
        c = -a.width / 2;
        break;
      case "r":
        c = a.width / 2;
        break;
    }
    if (c && (s += t ? c : -c), c = 0, s += (a.dummy ? n : e) / 2, s += (u.dummy ? n : e) / 2, s += u.width / 2, Object.prototype.hasOwnProperty.call(u, "labelpos")) switch (u.labelpos.toLowerCase()) {
      case "l":
        c = u.width / 2;
        break;
      case "r":
        c = -u.width / 2;
        break;
    }
    return c && (s += t ? c : -c), c = 0, s;
  };
}
d(Bn, "sep");
function Fn(e, n) {
  return e.node(n).width;
}
d(Fn, "width");
function Vn(e) {
  e = ue(e), Yn(e), ut(Gn(e), function(n, t) {
    e.node(t).x = n;
  });
}
d(Vn, "position");
function Yn(e) {
  var n = j(e), t = e.graph().ranksep, o = 0;
  f(n, function(r) {
    var i = x(m(r, function(a) {
      return e.node(a).height;
    }));
    f(r, function(a) {
      e.node(a).y = o + i / 2;
    }), o += i + t;
  });
}
d(Yn, "positionY");
function gt(e, n) {
  var t = n && n.debugTiming ? Ce : _e;
  t("layout", () => {
    var o = t("  buildLayoutGraph", () => qn(e));
    t("  runLayout", () => Dn(o, t)), t("  updateInputGraph", () => $n(e, o));
  });
}
d(gt, "layout");
function Dn(e, n) {
  n("    makeSpaceForEdgeLabels", () => zn(e)), n("    removeSelfEdges", () => Un(e)), n("    acyclic", () => Ve(e)), n("    nestingGraph.run", () => tn(e)), n("    rank", () => en(ue(e))), n("    injectEdgeLabelProxies", () => An(e)), n("    removeEmptyRanks", () => Ie(e)), n("    nestingGraph.cleanup", () => an(e)), n("    normalizeRanks", () => Oe(e)), n("    assignRankMinMax", () => Jn(e)), n("    removeEdgeLabelProxies", () => Wn(e)), n("    normalize.run", () => $e(e)), n("    parentDummyChains", () => En(e)), n("    addBorderSegments", () => Le(e)), n("    order", () => kn(e)), n("    insertSelfEdges", () => et(e)), n("    adjustCoordinateSystem", () => Re(e)), n("    position", () => Vn(e)), n("    positionSelfEdges", () => nt(e)), n("    removeBorderNodes", () => Qn(e)), n("    normalize.undo", () => ze(e)), n("    fixupEdgeLabelCoords", () => Kn(e)), n("    undoCoordinateSystem", () => Te(e)), n("    translateGraph", () => Xn(e)), n("    assignNodeIntersects", () => Hn(e)), n("    reversePoints", () => Zn(e)), n("    acyclic.undo", () => De(e));
}
d(Dn, "runLayout");
function $n(e, n) {
  f(e.nodes(), function(t) {
    var o = e.node(t), r = n.node(t);
    o && (o.x = r.x, o.y = r.y, n.children(t).length && (o.width = r.width, o.height = r.height));
  }), f(e.edges(), function(t) {
    var o = e.edge(t), r = n.edge(t);
    o.points = r.points, Object.prototype.hasOwnProperty.call(r, "x") && (o.x = r.x, o.y = r.y);
  }), e.graph().width = n.graph().width, e.graph().height = n.graph().height;
}
d($n, "updateInputGraph");
var lt = ["nodesep", "edgesep", "ranksep", "marginx", "marginy"], pt = { ranksep: 50, edgesep: 20, nodesep: 50, rankdir: "tb" }, vt = ["acyclicer", "ranker", "rankdir", "align"], mt = ["width", "height"], wt = { width: 0, height: 0 }, bt = ["minlen", "weight", "width", "height", "labeloffset"], yt = { minlen: 1, weight: 1, width: 0, height: 0, labeloffset: 10, labelpos: "r" }, kt = ["labelpos"];
function qn(e) {
  var n = new y({ multigraph: true, compound: true }), t = F(e.graph());
  return n.setGraph(W({}, pt, B(t, lt), V(t, vt))), f(e.nodes(), function(o) {
    var r = F(e.node(o));
    n.setNode(o, tt(B(r, mt), wt)), n.setParent(o, e.parent(o));
  }), f(e.edges(), function(o) {
    var r = F(e.edge(o));
    n.setEdge(o, W({}, yt, B(r, bt), V(r, kt)));
  }), n;
}
d(qn, "buildLayoutGraph");
function zn(e) {
  var n = e.graph();
  n.ranksep /= 2, f(e.edges(), function(t) {
    var o = e.edge(t);
    o.minlen *= 2, o.labelpos.toLowerCase() !== "c" && (n.rankdir === "TB" || n.rankdir === "BT" ? o.width += o.labeloffset : o.height += o.labeloffset);
  });
}
d(zn, "makeSpaceForEdgeLabels");
function An(e) {
  f(e.edges(), function(n) {
    var t = e.edge(n);
    if (t.width && t.height) {
      var o = e.node(n.v), r = e.node(n.w), i = { rank: (r.rank - o.rank) / 2 + o.rank, e: n };
      E(e, "edge-proxy", i, "_ep");
    }
  });
}
d(An, "injectEdgeLabelProxies");
function Jn(e) {
  var n = 0;
  f(e.nodes(), function(t) {
    var o = e.node(t);
    o.borderTop && (o.minRank = e.node(o.borderTop).rank, o.maxRank = e.node(o.borderBottom).rank, n = x(n, o.maxRank));
  }), e.graph().maxRank = n;
}
d(Jn, "assignRankMinMax");
function Wn(e) {
  f(e.nodes(), function(n) {
    var t = e.node(n);
    t.dummy === "edge-proxy" && (e.edge(t.e).labelRank = t.rank, e.removeNode(n));
  });
}
d(Wn, "removeEdgeLabelProxies");
function Xn(e) {
  var n = Number.POSITIVE_INFINITY, t = 0, o = Number.POSITIVE_INFINITY, r = 0, i = e.graph(), a = i.marginx || 0, u = i.marginy || 0;
  function s(c) {
    var h = c.x, g = c.y, l = c.width, p = c.height;
    n = Math.min(n, h - l / 2), t = Math.max(t, h + l / 2), o = Math.min(o, g - p / 2), r = Math.max(r, g + p / 2);
  }
  d(s, "getExtremes"), f(e.nodes(), function(c) {
    s(e.node(c));
  }), f(e.edges(), function(c) {
    var h = e.edge(c);
    Object.prototype.hasOwnProperty.call(h, "x") && s(h);
  }), n -= a, o -= u, f(e.nodes(), function(c) {
    var h = e.node(c);
    h.x -= n, h.y -= o;
  }), f(e.edges(), function(c) {
    var h = e.edge(c);
    f(h.points, function(g) {
      g.x -= n, g.y -= o;
    }), Object.prototype.hasOwnProperty.call(h, "x") && (h.x -= n), Object.prototype.hasOwnProperty.call(h, "y") && (h.y -= o);
  }), i.width = t - n + a, i.height = r - o + u;
}
d(Xn, "translateGraph");
function Hn(e) {
  f(e.edges(), function(n) {
    var t = e.edge(n), o = e.node(n.v), r = e.node(n.w), i, a;
    t.points ? (i = t.points[0], a = t.points[t.points.length - 1]) : (t.points = [], i = r, a = o), t.points.unshift(X(o, i)), t.points.push(X(r, a));
  });
}
d(Hn, "assignNodeIntersects");
function Kn(e) {
  f(e.edges(), function(n) {
    var t = e.edge(n);
    if (Object.prototype.hasOwnProperty.call(t, "x")) switch ((t.labelpos === "l" || t.labelpos === "r") && (t.width -= t.labeloffset), t.labelpos) {
      case "l":
        t.x -= t.width / 2 + t.labeloffset;
        break;
      case "r":
        t.x += t.width / 2 + t.labeloffset;
        break;
    }
  });
}
d(Kn, "fixupEdgeLabelCoords");
function Zn(e) {
  f(e.edges(), function(n) {
    var t = e.edge(n);
    t.reversed && t.points.reverse();
  });
}
d(Zn, "reversePointsForReversedEdges");
function Qn(e) {
  f(e.nodes(), function(n) {
    if (e.children(n).length) {
      var t = e.node(n), o = e.node(t.borderTop), r = e.node(t.borderBottom), i = e.node(Y(t.borderLeft)), a = e.node(Y(t.borderRight));
      t.width = Math.abs(a.x - i.x), t.height = Math.abs(r.y - o.y), t.x = i.x + t.width / 2, t.y = o.y + t.height / 2;
    }
  }), f(e.nodes(), function(n) {
    e.node(n).dummy === "border" && e.removeNode(n);
  });
}
d(Qn, "removeBorderNodes");
function Un(e) {
  f(e.edges(), function(n) {
    if (n.v === n.w) {
      var t = e.node(n.v);
      t.selfEdges || (t.selfEdges = []), t.selfEdges.push({ e: n, label: e.edge(n) }), e.removeEdge(n);
    }
  });
}
d(Un, "removeSelfEdges");
function et(e) {
  var n = j(e);
  f(n, function(t) {
    var o = 0;
    f(t, function(r, i) {
      var a = e.node(r);
      a.order = i + o, f(a.selfEdges, function(u) {
        E(e, "selfedge", { width: u.label.width, height: u.label.height, rank: a.rank, order: i + ++o, e: u.e, label: u.label }, "_se");
      }), delete a.selfEdges;
    });
  });
}
d(et, "insertSelfEdges");
function nt(e) {
  f(e.nodes(), function(n) {
    var t = e.node(n);
    if (t.dummy === "selfedge") {
      var o = e.node(t.e.v), r = o.x + o.width / 2, i = o.y, a = t.x - r, u = o.height / 2;
      e.setEdge(t.e, t.label), e.removeNode(n), t.label.points = [{ x: r + 2 * a / 3, y: i - u }, { x: r + 5 * a / 6, y: i - u }, { x: r + a, y: i }, { x: r + 5 * a / 6, y: i + u }, { x: r + 2 * a / 3, y: i + u }], t.label.x = t.x, t.label.y = t.y;
    }
  });
}
d(nt, "positionSelfEdges");
function B(e, n) {
  return $(V(e, n), Number);
}
d(B, "selectNumberAttrs");
function F(e) {
  var n = {};
  return f(e, function(t, o) {
    n[o.toLowerCase()] = t;
  }), n;
}
d(F, "canonicalize");
export {
  gt as f
};
