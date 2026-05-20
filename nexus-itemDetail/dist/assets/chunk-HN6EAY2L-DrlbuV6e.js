var _a;
import { k as _, e as g, Z as a, s as l, m as j, X as f, R as L } from "./chunk-H3VCZNTA-DXoxCplV.js";
import { m as d, a$ as p, b1 as O, b2 as C } from "./index-CRtis_Gf.js";
var N = "\0", u = "\0", w = "", y = (_a = class {
  constructor(t = {}) {
    this._isDirected = Object.prototype.hasOwnProperty.call(t, "directed") ? t.directed : true, this._isMultigraph = Object.prototype.hasOwnProperty.call(t, "multigraph") ? t.multigraph : false, this._isCompound = Object.prototype.hasOwnProperty.call(t, "compound") ? t.compound : false, this._label = void 0, this._defaultNodeLabelFn = p(void 0), this._defaultEdgeLabelFn = p(void 0), this._nodes = {}, this._isCompound && (this._parent = {}, this._children = {}, this._children[u] = {}), this._in = {}, this._preds = {}, this._out = {}, this._sucs = {}, this._edgeObjs = {}, this._edgeLabels = {};
  }
  isDirected() {
    return this._isDirected;
  }
  isMultigraph() {
    return this._isMultigraph;
  }
  isCompound() {
    return this._isCompound;
  }
  setGraph(t) {
    return this._label = t, this;
  }
  graph() {
    return this._label;
  }
  setDefaultNodeLabel(t) {
    return O(t) || (t = p(t)), this._defaultNodeLabelFn = t, this;
  }
  nodeCount() {
    return this._nodeCount;
  }
  nodes() {
    return _(this._nodes);
  }
  sources() {
    var t = this;
    return g(this.nodes(), function(e) {
      return C(t._in[e]);
    });
  }
  sinks() {
    var t = this;
    return g(this.nodes(), function(e) {
      return C(t._out[e]);
    });
  }
  setNodes(t, e) {
    var s = arguments, r = this;
    return a(t, function(n) {
      s.length > 1 ? r.setNode(n, e) : r.setNode(n);
    }), this;
  }
  setNode(t, e) {
    return Object.prototype.hasOwnProperty.call(this._nodes, t) ? (arguments.length > 1 && (this._nodes[t] = e), this) : (this._nodes[t] = arguments.length > 1 ? e : this._defaultNodeLabelFn(t), this._isCompound && (this._parent[t] = u, this._children[t] = {}, this._children[u][t] = true), this._in[t] = {}, this._preds[t] = {}, this._out[t] = {}, this._sucs[t] = {}, ++this._nodeCount, this);
  }
  node(t) {
    return this._nodes[t];
  }
  hasNode(t) {
    return Object.prototype.hasOwnProperty.call(this._nodes, t);
  }
  removeNode(t) {
    if (Object.prototype.hasOwnProperty.call(this._nodes, t)) {
      var e = d((s) => this.removeEdge(this._edgeObjs[s]), "removeEdge");
      delete this._nodes[t], this._isCompound && (this._removeFromParentsChildList(t), delete this._parent[t], a(this.children(t), (s) => {
        this.setParent(s);
      }), delete this._children[t]), a(_(this._in[t]), e), delete this._in[t], delete this._preds[t], a(_(this._out[t]), e), delete this._out[t], delete this._sucs[t], --this._nodeCount;
    }
    return this;
  }
  setParent(t, e) {
    if (!this._isCompound) throw new Error("Cannot set parent in a non-compound graph");
    if (l(e)) e = u;
    else {
      e += "";
      for (var s = e; !l(s); s = this.parent(s)) if (s === t) throw new Error("Setting " + e + " as parent of " + t + " would create a cycle");
      this.setNode(e);
    }
    return this.setNode(t), this._removeFromParentsChildList(t), this._parent[t] = e, this._children[e][t] = true, this;
  }
  _removeFromParentsChildList(t) {
    delete this._children[this._parent[t]][t];
  }
  parent(t) {
    if (this._isCompound) {
      var e = this._parent[t];
      if (e !== u) return e;
    }
  }
  children(t) {
    if (l(t) && (t = u), this._isCompound) {
      var e = this._children[t];
      if (e) return _(e);
    } else {
      if (t === u) return this.nodes();
      if (this.hasNode(t)) return [];
    }
  }
  predecessors(t) {
    var e = this._preds[t];
    if (e) return _(e);
  }
  successors(t) {
    var e = this._sucs[t];
    if (e) return _(e);
  }
  neighbors(t) {
    var e = this.predecessors(t);
    if (e) return j(e, this.successors(t));
  }
  isLeaf(t) {
    var e;
    return this.isDirected() ? e = this.successors(t) : e = this.neighbors(t), e.length === 0;
  }
  filterNodes(t) {
    var e = new this.constructor({ directed: this._isDirected, multigraph: this._isMultigraph, compound: this._isCompound });
    e.setGraph(this.graph());
    var s = this;
    a(this._nodes, function(i, h) {
      t(h) && e.setNode(h, i);
    }), a(this._edgeObjs, function(i) {
      e.hasNode(i.v) && e.hasNode(i.w) && e.setEdge(i, s.edge(i));
    });
    var r = {};
    function n(i) {
      var h = s.parent(i);
      return h === void 0 || e.hasNode(h) ? (r[i] = h, h) : h in r ? r[h] : n(h);
    }
    return d(n, "findParent"), this._isCompound && a(e.nodes(), function(i) {
      e.setParent(i, n(i));
    }), e;
  }
  setDefaultEdgeLabel(t) {
    return O(t) || (t = p(t)), this._defaultEdgeLabelFn = t, this;
  }
  edgeCount() {
    return this._edgeCount;
  }
  edges() {
    return f(this._edgeObjs);
  }
  setPath(t, e) {
    var s = this, r = arguments;
    return L(t, function(n, i) {
      return r.length > 1 ? s.setEdge(n, i, e) : s.setEdge(n, i), i;
    }), this;
  }
  setEdge() {
    var t, e, s, r, n = false, i = arguments[0];
    typeof i == "object" && i !== null && "v" in i ? (t = i.v, e = i.w, s = i.name, arguments.length === 2 && (r = arguments[1], n = true)) : (t = i, e = arguments[1], s = arguments[3], arguments.length > 2 && (r = arguments[2], n = true)), t = "" + t, e = "" + e, l(s) || (s = "" + s);
    var h = c(this._isDirected, t, e, s);
    if (Object.prototype.hasOwnProperty.call(this._edgeLabels, h)) return n && (this._edgeLabels[h] = r), this;
    if (!l(s) && !this._isMultigraph) throw new Error("Cannot set a named edge when isMultigraph = false");
    this.setNode(t), this.setNode(e), this._edgeLabels[h] = n ? r : this._defaultEdgeLabelFn(t, e, s);
    var o = E(this._isDirected, t, e, s);
    return t = o.v, e = o.w, Object.freeze(o), this._edgeObjs[h] = o, v(this._preds[e], t), v(this._sucs[t], e), this._in[e][h] = o, this._out[t][h] = o, this._edgeCount++, this;
  }
  edge(t, e, s) {
    var r = arguments.length === 1 ? m(this._isDirected, arguments[0]) : c(this._isDirected, t, e, s);
    return this._edgeLabels[r];
  }
  hasEdge(t, e, s) {
    var r = arguments.length === 1 ? m(this._isDirected, arguments[0]) : c(this._isDirected, t, e, s);
    return Object.prototype.hasOwnProperty.call(this._edgeLabels, r);
  }
  removeEdge(t, e, s) {
    var r = arguments.length === 1 ? m(this._isDirected, arguments[0]) : c(this._isDirected, t, e, s), n = this._edgeObjs[r];
    return n && (t = n.v, e = n.w, delete this._edgeLabels[r], delete this._edgeObjs[r], b(this._preds[e], t), b(this._sucs[t], e), delete this._in[e][r], delete this._out[t][r], this._edgeCount--), this;
  }
  inEdges(t, e) {
    var s = this._in[t];
    if (s) {
      var r = f(s);
      return e ? g(r, function(n) {
        return n.v === e;
      }) : r;
    }
  }
  outEdges(t, e) {
    var s = this._out[t];
    if (s) {
      var r = f(s);
      return e ? g(r, function(n) {
        return n.w === e;
      }) : r;
    }
  }
  nodeEdges(t, e) {
    var s = this.inEdges(t, e);
    if (s) return s.concat(this.outEdges(t, e));
  }
}, d(_a, "Graph"), _a);
y.prototype._nodeCount = 0;
y.prototype._edgeCount = 0;
function v(t, e) {
  t[e] ? t[e]++ : t[e] = 1;
}
d(v, "incrementOrInitEntry");
function b(t, e) {
  --t[e] || delete t[e];
}
d(b, "decrementOrRemoveEntry");
function c(t, e, s, r) {
  var n = "" + e, i = "" + s;
  if (!t && n > i) {
    var h = n;
    n = i, i = h;
  }
  return n + w + i + w + (l(r) ? N : r);
}
d(c, "edgeArgsToId");
function E(t, e, s, r) {
  var n = "" + e, i = "" + s;
  if (!t && n > i) {
    var h = n;
    n = i, i = h;
  }
  var o = { v: n, w: i };
  return r && (o.name = r), o;
}
d(E, "edgeArgsToObj");
function m(t, e) {
  return c(t, e.v, e.w, e.name);
}
d(m, "edgeObjToId");
export {
  y as m
};
