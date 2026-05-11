var _a;
import { c as Ye } from "./chunk-AEOMTBSW-DrAIN5Kb.js";
import { p as He } from "./treemap-KZPCXAKY-RU5UWGQG-Lo1E7Hlz.js";
import { m as w, a7 as ze, ap as Ve, p as Ie, j as Be, V as We, K as je, Z as $e, X as qe, Y as Je, $ as Ze, L as Ke, l as Qe, n as ti, x as ce, aB as ue, aH as de, s as ei, i as ii, J as ri, r as ni, aI as oi, aJ as ai, a6 as fe } from "./index-CRtis_Gf.js";
import { r as xe } from "./chunk-7RZVMHOQ-lJI4VAsb.js";
import "./chunk-H3VCZNTA-DXoxCplV.js";
var Ae = fe((A, H) => {
  w(function(L, F) {
    typeof A == "object" && typeof H == "object" ? H.exports = F() : typeof define == "function" && define.amd ? define([], F) : typeof A == "object" ? A.layoutBase = F() : L.layoutBase = F();
  }, "webpackUniversalModuleDefinition")(A, function() {
    return function(L) {
      var F = {};
      function T(c) {
        if (F[c]) return F[c].exports;
        var h = F[c] = { i: c, l: false, exports: {} };
        return L[c].call(h.exports, h, h.exports, T), h.l = true, h.exports;
      }
      return w(T, "__webpack_require__"), T.m = L, T.c = F, T.i = function(c) {
        return c;
      }, T.d = function(c, h, n) {
        T.o(c, h) || Object.defineProperty(c, h, { configurable: false, enumerable: true, get: n });
      }, T.n = function(c) {
        var h = c && c.__esModule ? w(function() {
          return c.default;
        }, "getDefault") : w(function() {
          return c;
        }, "getModuleExports");
        return T.d(h, "a", h), h;
      }, T.o = function(c, h) {
        return Object.prototype.hasOwnProperty.call(c, h);
      }, T.p = "", T(T.s = 28);
    }([function(L, F, T) {
      function c() {
      }
      w(c, "LayoutConstants"), c.QUALITY = 1, c.DEFAULT_CREATE_BENDS_AS_NEEDED = false, c.DEFAULT_INCREMENTAL = false, c.DEFAULT_ANIMATION_ON_LAYOUT = true, c.DEFAULT_ANIMATION_DURING_LAYOUT = false, c.DEFAULT_ANIMATION_PERIOD = 50, c.DEFAULT_UNIFORM_LEAF_NODE_SIZES = false, c.DEFAULT_GRAPH_MARGIN = 15, c.NODE_DIMENSIONS_INCLUDE_LABELS = false, c.SIMPLE_NODE_SIZE = 40, c.SIMPLE_NODE_HALF_SIZE = c.SIMPLE_NODE_SIZE / 2, c.EMPTY_COMPOUND_NODE_SIZE = 40, c.MIN_EDGE_LENGTH = 1, c.WORLD_BOUNDARY = 1e6, c.INITIAL_WORLD_BOUNDARY = c.WORLD_BOUNDARY / 1e3, c.WORLD_CENTER_X = 1200, c.WORLD_CENTER_Y = 900, L.exports = c;
    }, function(L, F, T) {
      var c = T(2), h = T(8), n = T(9);
      function i(a, r, f) {
        c.call(this, f), this.isOverlapingSourceAndTarget = false, this.vGraphObject = f, this.bendpoints = [], this.source = a, this.target = r;
      }
      w(i, "LEdge"), i.prototype = Object.create(c.prototype);
      for (var e in c) i[e] = c[e];
      i.prototype.getSource = function() {
        return this.source;
      }, i.prototype.getTarget = function() {
        return this.target;
      }, i.prototype.isInterGraph = function() {
        return this.isInterGraph;
      }, i.prototype.getLength = function() {
        return this.length;
      }, i.prototype.isOverlapingSourceAndTarget = function() {
        return this.isOverlapingSourceAndTarget;
      }, i.prototype.getBendpoints = function() {
        return this.bendpoints;
      }, i.prototype.getLca = function() {
        return this.lca;
      }, i.prototype.getSourceInLca = function() {
        return this.sourceInLca;
      }, i.prototype.getTargetInLca = function() {
        return this.targetInLca;
      }, i.prototype.getOtherEnd = function(a) {
        if (this.source === a) return this.target;
        if (this.target === a) return this.source;
        throw "Node is not incident with this edge";
      }, i.prototype.getOtherEndInGraph = function(a, r) {
        for (var f = this.getOtherEnd(a), o = r.getGraphManager().getRoot(); ; ) {
          if (f.getOwner() == r) return f;
          if (f.getOwner() == o) break;
          f = f.getOwner().getParent();
        }
        return null;
      }, i.prototype.updateLength = function() {
        var a = new Array(4);
        this.isOverlapingSourceAndTarget = h.getIntersection(this.target.getRect(), this.source.getRect(), a), this.isOverlapingSourceAndTarget || (this.lengthX = a[0] - a[2], this.lengthY = a[1] - a[3], Math.abs(this.lengthX) < 1 && (this.lengthX = n.sign(this.lengthX)), Math.abs(this.lengthY) < 1 && (this.lengthY = n.sign(this.lengthY)), this.length = Math.sqrt(this.lengthX * this.lengthX + this.lengthY * this.lengthY));
      }, i.prototype.updateLengthSimple = function() {
        this.lengthX = this.target.getCenterX() - this.source.getCenterX(), this.lengthY = this.target.getCenterY() - this.source.getCenterY(), Math.abs(this.lengthX) < 1 && (this.lengthX = n.sign(this.lengthX)), Math.abs(this.lengthY) < 1 && (this.lengthY = n.sign(this.lengthY)), this.length = Math.sqrt(this.lengthX * this.lengthX + this.lengthY * this.lengthY);
      }, L.exports = i;
    }, function(L, F, T) {
      function c(h) {
        this.vGraphObject = h;
      }
      w(c, "LGraphObject"), L.exports = c;
    }, function(L, F, T) {
      var c = T(2), h = T(10), n = T(13), i = T(0), e = T(16), a = T(5);
      function r(o, t, l, u) {
        l == null && u == null && (u = t), c.call(this, u), o.graphManager != null && (o = o.graphManager), this.estimatedSize = h.MIN_VALUE, this.inclusionTreeDepth = h.MAX_VALUE, this.vGraphObject = u, this.edges = [], this.graphManager = o, l != null && t != null ? this.rect = new n(t.x, t.y, l.width, l.height) : this.rect = new n();
      }
      w(r, "LNode"), r.prototype = Object.create(c.prototype);
      for (var f in c) r[f] = c[f];
      r.prototype.getEdges = function() {
        return this.edges;
      }, r.prototype.getChild = function() {
        return this.child;
      }, r.prototype.getOwner = function() {
        return this.owner;
      }, r.prototype.getWidth = function() {
        return this.rect.width;
      }, r.prototype.setWidth = function(o) {
        this.rect.width = o;
      }, r.prototype.getHeight = function() {
        return this.rect.height;
      }, r.prototype.setHeight = function(o) {
        this.rect.height = o;
      }, r.prototype.getCenterX = function() {
        return this.rect.x + this.rect.width / 2;
      }, r.prototype.getCenterY = function() {
        return this.rect.y + this.rect.height / 2;
      }, r.prototype.getCenter = function() {
        return new a(this.rect.x + this.rect.width / 2, this.rect.y + this.rect.height / 2);
      }, r.prototype.getLocation = function() {
        return new a(this.rect.x, this.rect.y);
      }, r.prototype.getRect = function() {
        return this.rect;
      }, r.prototype.getDiagonal = function() {
        return Math.sqrt(this.rect.width * this.rect.width + this.rect.height * this.rect.height);
      }, r.prototype.getHalfTheDiagonal = function() {
        return Math.sqrt(this.rect.height * this.rect.height + this.rect.width * this.rect.width) / 2;
      }, r.prototype.setRect = function(o, t) {
        this.rect.x = o.x, this.rect.y = o.y, this.rect.width = t.width, this.rect.height = t.height;
      }, r.prototype.setCenter = function(o, t) {
        this.rect.x = o - this.rect.width / 2, this.rect.y = t - this.rect.height / 2;
      }, r.prototype.setLocation = function(o, t) {
        this.rect.x = o, this.rect.y = t;
      }, r.prototype.moveBy = function(o, t) {
        this.rect.x += o, this.rect.y += t;
      }, r.prototype.getEdgeListToNode = function(o) {
        var t = [], l = this;
        return l.edges.forEach(function(u) {
          if (u.target == o) {
            if (u.source != l) throw "Incorrect edge source!";
            t.push(u);
          }
        }), t;
      }, r.prototype.getEdgesBetween = function(o) {
        var t = [], l = this;
        return l.edges.forEach(function(u) {
          if (!(u.source == l || u.target == l)) throw "Incorrect edge source and/or target";
          (u.target == o || u.source == o) && t.push(u);
        }), t;
      }, r.prototype.getNeighborsList = function() {
        var o = /* @__PURE__ */ new Set(), t = this;
        return t.edges.forEach(function(l) {
          if (l.source == t) o.add(l.target);
          else {
            if (l.target != t) throw "Incorrect incidency!";
            o.add(l.source);
          }
        }), o;
      }, r.prototype.withChildren = function() {
        var o = /* @__PURE__ */ new Set(), t, l;
        if (o.add(this), this.child != null) for (var u = this.child.getNodes(), d = 0; d < u.length; d++) t = u[d], l = t.withChildren(), l.forEach(function(N) {
          o.add(N);
        });
        return o;
      }, r.prototype.getNoOfChildren = function() {
        var o = 0, t;
        if (this.child == null) o = 1;
        else for (var l = this.child.getNodes(), u = 0; u < l.length; u++) t = l[u], o += t.getNoOfChildren();
        return o == 0 && (o = 1), o;
      }, r.prototype.getEstimatedSize = function() {
        if (this.estimatedSize == h.MIN_VALUE) throw "assert failed";
        return this.estimatedSize;
      }, r.prototype.calcEstimatedSize = function() {
        return this.child == null ? this.estimatedSize = (this.rect.width + this.rect.height) / 2 : (this.estimatedSize = this.child.calcEstimatedSize(), this.rect.width = this.estimatedSize, this.rect.height = this.estimatedSize, this.estimatedSize);
      }, r.prototype.scatter = function() {
        var o, t, l = -i.INITIAL_WORLD_BOUNDARY, u = i.INITIAL_WORLD_BOUNDARY;
        o = i.WORLD_CENTER_X + e.nextDouble() * (u - l) + l;
        var d = -i.INITIAL_WORLD_BOUNDARY, N = i.INITIAL_WORLD_BOUNDARY;
        t = i.WORLD_CENTER_Y + e.nextDouble() * (N - d) + d, this.rect.x = o, this.rect.y = t;
      }, r.prototype.updateBounds = function() {
        if (this.getChild() == null) throw "assert failed";
        if (this.getChild().getNodes().length != 0) {
          var o = this.getChild();
          if (o.updateBounds(true), this.rect.x = o.getLeft(), this.rect.y = o.getTop(), this.setWidth(o.getRight() - o.getLeft()), this.setHeight(o.getBottom() - o.getTop()), i.NODE_DIMENSIONS_INCLUDE_LABELS) {
            var t = o.getRight() - o.getLeft(), l = o.getBottom() - o.getTop();
            this.labelWidth && (this.labelPosHorizontal == "left" ? (this.rect.x -= this.labelWidth, this.setWidth(t + this.labelWidth)) : this.labelPosHorizontal == "center" && this.labelWidth > t ? (this.rect.x -= (this.labelWidth - t) / 2, this.setWidth(this.labelWidth)) : this.labelPosHorizontal == "right" && this.setWidth(t + this.labelWidth)), this.labelHeight && (this.labelPosVertical == "top" ? (this.rect.y -= this.labelHeight, this.setHeight(l + this.labelHeight)) : this.labelPosVertical == "center" && this.labelHeight > l ? (this.rect.y -= (this.labelHeight - l) / 2, this.setHeight(this.labelHeight)) : this.labelPosVertical == "bottom" && this.setHeight(l + this.labelHeight));
          }
        }
      }, r.prototype.getInclusionTreeDepth = function() {
        if (this.inclusionTreeDepth == h.MAX_VALUE) throw "assert failed";
        return this.inclusionTreeDepth;
      }, r.prototype.transform = function(o) {
        var t = this.rect.x;
        t > i.WORLD_BOUNDARY ? t = i.WORLD_BOUNDARY : t < -i.WORLD_BOUNDARY && (t = -i.WORLD_BOUNDARY);
        var l = this.rect.y;
        l > i.WORLD_BOUNDARY ? l = i.WORLD_BOUNDARY : l < -i.WORLD_BOUNDARY && (l = -i.WORLD_BOUNDARY);
        var u = new a(t, l), d = o.inverseTransformPoint(u);
        this.setLocation(d.x, d.y);
      }, r.prototype.getLeft = function() {
        return this.rect.x;
      }, r.prototype.getRight = function() {
        return this.rect.x + this.rect.width;
      }, r.prototype.getTop = function() {
        return this.rect.y;
      }, r.prototype.getBottom = function() {
        return this.rect.y + this.rect.height;
      }, r.prototype.getParent = function() {
        return this.owner == null ? null : this.owner.getParent();
      }, L.exports = r;
    }, function(L, F, T) {
      var c = T(0);
      function h() {
      }
      w(h, "FDLayoutConstants");
      for (var n in c) h[n] = c[n];
      h.MAX_ITERATIONS = 2500, h.DEFAULT_EDGE_LENGTH = 50, h.DEFAULT_SPRING_STRENGTH = 0.45, h.DEFAULT_REPULSION_STRENGTH = 4500, h.DEFAULT_GRAVITY_STRENGTH = 0.4, h.DEFAULT_COMPOUND_GRAVITY_STRENGTH = 1, h.DEFAULT_GRAVITY_RANGE_FACTOR = 3.8, h.DEFAULT_COMPOUND_GRAVITY_RANGE_FACTOR = 1.5, h.DEFAULT_USE_SMART_IDEAL_EDGE_LENGTH_CALCULATION = true, h.DEFAULT_USE_SMART_REPULSION_RANGE_CALCULATION = true, h.DEFAULT_COOLING_FACTOR_INCREMENTAL = 0.3, h.COOLING_ADAPTATION_FACTOR = 0.33, h.ADAPTATION_LOWER_NODE_LIMIT = 1e3, h.ADAPTATION_UPPER_NODE_LIMIT = 5e3, h.MAX_NODE_DISPLACEMENT_INCREMENTAL = 100, h.MAX_NODE_DISPLACEMENT = h.MAX_NODE_DISPLACEMENT_INCREMENTAL * 3, h.MIN_REPULSION_DIST = h.DEFAULT_EDGE_LENGTH / 10, h.CONVERGENCE_CHECK_PERIOD = 100, h.PER_LEVEL_IDEAL_EDGE_LENGTH_FACTOR = 0.1, h.MIN_EDGE_LENGTH = 1, h.GRID_CALCULATION_CHECK_PERIOD = 10, L.exports = h;
    }, function(L, F, T) {
      function c(h, n) {
        h == null && n == null ? (this.x = 0, this.y = 0) : (this.x = h, this.y = n);
      }
      w(c, "PointD"), c.prototype.getX = function() {
        return this.x;
      }, c.prototype.getY = function() {
        return this.y;
      }, c.prototype.setX = function(h) {
        this.x = h;
      }, c.prototype.setY = function(h) {
        this.y = h;
      }, c.prototype.getDifference = function(h) {
        return new DimensionD(this.x - h.x, this.y - h.y);
      }, c.prototype.getCopy = function() {
        return new c(this.x, this.y);
      }, c.prototype.translate = function(h) {
        return this.x += h.width, this.y += h.height, this;
      }, L.exports = c;
    }, function(L, F, T) {
      var c = T(2), h = T(10), n = T(0), i = T(7), e = T(3), a = T(1), r = T(13), f = T(12), o = T(11);
      function t(u, d, N) {
        c.call(this, N), this.estimatedSize = h.MIN_VALUE, this.margin = n.DEFAULT_GRAPH_MARGIN, this.edges = [], this.nodes = [], this.isConnected = false, this.parent = u, d != null && d instanceof i ? this.graphManager = d : d != null && d instanceof Layout && (this.graphManager = d.graphManager);
      }
      w(t, "LGraph"), t.prototype = Object.create(c.prototype);
      for (var l in c) t[l] = c[l];
      t.prototype.getNodes = function() {
        return this.nodes;
      }, t.prototype.getEdges = function() {
        return this.edges;
      }, t.prototype.getGraphManager = function() {
        return this.graphManager;
      }, t.prototype.getParent = function() {
        return this.parent;
      }, t.prototype.getLeft = function() {
        return this.left;
      }, t.prototype.getRight = function() {
        return this.right;
      }, t.prototype.getTop = function() {
        return this.top;
      }, t.prototype.getBottom = function() {
        return this.bottom;
      }, t.prototype.isConnected = function() {
        return this.isConnected;
      }, t.prototype.add = function(u, d, N) {
        if (d == null && N == null) {
          var g = u;
          if (this.graphManager == null) throw "Graph has no graph mgr!";
          if (this.getNodes().indexOf(g) > -1) throw "Node already in graph!";
          return g.owner = this, this.getNodes().push(g), g;
        } else {
          var E = u;
          if (!(this.getNodes().indexOf(d) > -1 && this.getNodes().indexOf(N) > -1)) throw "Source or target not in graph!";
          if (!(d.owner == N.owner && d.owner == this)) throw "Both owners must be this graph!";
          return d.owner != N.owner ? null : (E.source = d, E.target = N, E.isInterGraph = false, this.getEdges().push(E), d.edges.push(E), N != d && N.edges.push(E), E);
        }
      }, t.prototype.remove = function(u) {
        var d = u;
        if (u instanceof e) {
          if (d == null) throw "Node is null!";
          if (!(d.owner != null && d.owner == this)) throw "Owner graph is invalid!";
          if (this.graphManager == null) throw "Owner graph manager is invalid!";
          for (var N = d.edges.slice(), g, E = N.length, _ = 0; _ < E; _++) g = N[_], g.isInterGraph ? this.graphManager.remove(g) : g.source.owner.remove(g);
          var C = this.nodes.indexOf(d);
          if (C == -1) throw "Node not in owner node list!";
          this.nodes.splice(C, 1);
        } else if (u instanceof a) {
          var g = u;
          if (g == null) throw "Edge is null!";
          if (!(g.source != null && g.target != null)) throw "Source and/or target is null!";
          if (!(g.source.owner != null && g.target.owner != null && g.source.owner == this && g.target.owner == this)) throw "Source and/or target owner is invalid!";
          var k = g.source.edges.indexOf(g), Y = g.target.edges.indexOf(g);
          if (!(k > -1 && Y > -1)) throw "Source and/or target doesn't know this edge!";
          g.source.edges.splice(k, 1), g.target != g.source && g.target.edges.splice(Y, 1);
          var C = g.source.owner.getEdges().indexOf(g);
          if (C == -1) throw "Not in owner's edge list!";
          g.source.owner.getEdges().splice(C, 1);
        }
      }, t.prototype.updateLeftTop = function() {
        for (var u = h.MAX_VALUE, d = h.MAX_VALUE, N, g, E, _ = this.getNodes(), C = _.length, k = 0; k < C; k++) {
          var Y = _[k];
          N = Y.getTop(), g = Y.getLeft(), u > N && (u = N), d > g && (d = g);
        }
        return u == h.MAX_VALUE ? null : (_[0].getParent().paddingLeft != null ? E = _[0].getParent().paddingLeft : E = this.margin, this.left = d - E, this.top = u - E, new f(this.left, this.top));
      }, t.prototype.updateBounds = function(u) {
        for (var d = h.MAX_VALUE, N = -h.MAX_VALUE, g = h.MAX_VALUE, E = -h.MAX_VALUE, _, C, k, Y, V, B = this.nodes, q = B.length, O = 0; O < q; O++) {
          var st = B[O];
          u && st.child != null && st.updateBounds(), _ = st.getLeft(), C = st.getRight(), k = st.getTop(), Y = st.getBottom(), d > _ && (d = _), N < C && (N = C), g > k && (g = k), E < Y && (E = Y);
        }
        var s = new r(d, g, N - d, E - g);
        d == h.MAX_VALUE && (this.left = this.parent.getLeft(), this.right = this.parent.getRight(), this.top = this.parent.getTop(), this.bottom = this.parent.getBottom()), B[0].getParent().paddingLeft != null ? V = B[0].getParent().paddingLeft : V = this.margin, this.left = s.x - V, this.right = s.x + s.width + V, this.top = s.y - V, this.bottom = s.y + s.height + V;
      }, t.calculateBounds = function(u) {
        for (var d = h.MAX_VALUE, N = -h.MAX_VALUE, g = h.MAX_VALUE, E = -h.MAX_VALUE, _, C, k, Y, V = u.length, B = 0; B < V; B++) {
          var q = u[B];
          _ = q.getLeft(), C = q.getRight(), k = q.getTop(), Y = q.getBottom(), d > _ && (d = _), N < C && (N = C), g > k && (g = k), E < Y && (E = Y);
        }
        var O = new r(d, g, N - d, E - g);
        return O;
      }, t.prototype.getInclusionTreeDepth = function() {
        return this == this.graphManager.getRoot() ? 1 : this.parent.getInclusionTreeDepth();
      }, t.prototype.getEstimatedSize = function() {
        if (this.estimatedSize == h.MIN_VALUE) throw "assert failed";
        return this.estimatedSize;
      }, t.prototype.calcEstimatedSize = function() {
        for (var u = 0, d = this.nodes, N = d.length, g = 0; g < N; g++) {
          var E = d[g];
          u += E.calcEstimatedSize();
        }
        return u == 0 ? this.estimatedSize = n.EMPTY_COMPOUND_NODE_SIZE : this.estimatedSize = u / Math.sqrt(this.nodes.length), this.estimatedSize;
      }, t.prototype.updateConnected = function() {
        var u = this;
        if (this.nodes.length == 0) {
          this.isConnected = true;
          return;
        }
        var d = new o(), N = /* @__PURE__ */ new Set(), g = this.nodes[0], E, _, C = g.withChildren();
        for (C.forEach(function(O) {
          d.push(O), N.add(O);
        }); d.length !== 0; ) {
          g = d.shift(), E = g.getEdges();
          for (var k = E.length, Y = 0; Y < k; Y++) {
            var V = E[Y];
            if (_ = V.getOtherEndInGraph(g, this), _ != null && !N.has(_)) {
              var B = _.withChildren();
              B.forEach(function(O) {
                d.push(O), N.add(O);
              });
            }
          }
        }
        if (this.isConnected = false, N.size >= this.nodes.length) {
          var q = 0;
          N.forEach(function(O) {
            O.owner == u && q++;
          }), q == this.nodes.length && (this.isConnected = true);
        }
      }, L.exports = t;
    }, function(L, F, T) {
      var c, h = T(1);
      function n(i) {
        c = T(6), this.layout = i, this.graphs = [], this.edges = [];
      }
      w(n, "LGraphManager"), n.prototype.addRoot = function() {
        var i = this.layout.newGraph(), e = this.layout.newNode(null), a = this.add(i, e);
        return this.setRootGraph(a), this.rootGraph;
      }, n.prototype.add = function(i, e, a, r, f) {
        if (a == null && r == null && f == null) {
          if (i == null) throw "Graph is null!";
          if (e == null) throw "Parent node is null!";
          if (this.graphs.indexOf(i) > -1) throw "Graph already in this graph mgr!";
          if (this.graphs.push(i), i.parent != null) throw "Already has a parent!";
          if (e.child != null) throw "Already has a child!";
          return i.parent = e, e.child = i, i;
        } else {
          f = a, r = e, a = i;
          var o = r.getOwner(), t = f.getOwner();
          if (!(o != null && o.getGraphManager() == this)) throw "Source not in this graph mgr!";
          if (!(t != null && t.getGraphManager() == this)) throw "Target not in this graph mgr!";
          if (o == t) return a.isInterGraph = false, o.add(a, r, f);
          if (a.isInterGraph = true, a.source = r, a.target = f, this.edges.indexOf(a) > -1) throw "Edge already in inter-graph edge list!";
          if (this.edges.push(a), !(a.source != null && a.target != null)) throw "Edge source and/or target is null!";
          if (!(a.source.edges.indexOf(a) == -1 && a.target.edges.indexOf(a) == -1)) throw "Edge already in source and/or target incidency list!";
          return a.source.edges.push(a), a.target.edges.push(a), a;
        }
      }, n.prototype.remove = function(i) {
        if (i instanceof c) {
          var e = i;
          if (e.getGraphManager() != this) throw "Graph not in this graph mgr";
          if (!(e == this.rootGraph || e.parent != null && e.parent.graphManager == this)) throw "Invalid parent node!";
          var a = [];
          a = a.concat(e.getEdges());
          for (var r, f = a.length, o = 0; o < f; o++) r = a[o], e.remove(r);
          var t = [];
          t = t.concat(e.getNodes());
          var l;
          f = t.length;
          for (var o = 0; o < f; o++) l = t[o], e.remove(l);
          e == this.rootGraph && this.setRootGraph(null);
          var u = this.graphs.indexOf(e);
          this.graphs.splice(u, 1), e.parent = null;
        } else if (i instanceof h) {
          if (r = i, r == null) throw "Edge is null!";
          if (!r.isInterGraph) throw "Not an inter-graph edge!";
          if (!(r.source != null && r.target != null)) throw "Source and/or target is null!";
          if (!(r.source.edges.indexOf(r) != -1 && r.target.edges.indexOf(r) != -1)) throw "Source and/or target doesn't know this edge!";
          var u = r.source.edges.indexOf(r);
          if (r.source.edges.splice(u, 1), u = r.target.edges.indexOf(r), r.target.edges.splice(u, 1), !(r.source.owner != null && r.source.owner.getGraphManager() != null)) throw "Edge owner graph or owner graph manager is null!";
          if (r.source.owner.getGraphManager().edges.indexOf(r) == -1) throw "Not in owner graph manager's edge list!";
          var u = r.source.owner.getGraphManager().edges.indexOf(r);
          r.source.owner.getGraphManager().edges.splice(u, 1);
        }
      }, n.prototype.updateBounds = function() {
        this.rootGraph.updateBounds(true);
      }, n.prototype.getGraphs = function() {
        return this.graphs;
      }, n.prototype.getAllNodes = function() {
        if (this.allNodes == null) {
          for (var i = [], e = this.getGraphs(), a = e.length, r = 0; r < a; r++) i = i.concat(e[r].getNodes());
          this.allNodes = i;
        }
        return this.allNodes;
      }, n.prototype.resetAllNodes = function() {
        this.allNodes = null;
      }, n.prototype.resetAllEdges = function() {
        this.allEdges = null;
      }, n.prototype.resetAllNodesToApplyGravitation = function() {
        this.allNodesToApplyGravitation = null;
      }, n.prototype.getAllEdges = function() {
        if (this.allEdges == null) {
          for (var i = [], e = this.getGraphs(), a = e.length, r = 0; r < e.length; r++) i = i.concat(e[r].getEdges());
          i = i.concat(this.edges), this.allEdges = i;
        }
        return this.allEdges;
      }, n.prototype.getAllNodesToApplyGravitation = function() {
        return this.allNodesToApplyGravitation;
      }, n.prototype.setAllNodesToApplyGravitation = function(i) {
        if (this.allNodesToApplyGravitation != null) throw "assert failed";
        this.allNodesToApplyGravitation = i;
      }, n.prototype.getRoot = function() {
        return this.rootGraph;
      }, n.prototype.setRootGraph = function(i) {
        if (i.getGraphManager() != this) throw "Root not in this graph mgr!";
        this.rootGraph = i, i.parent == null && (i.parent = this.layout.newNode("Root node"));
      }, n.prototype.getLayout = function() {
        return this.layout;
      }, n.prototype.isOneAncestorOfOther = function(i, e) {
        if (!(i != null && e != null)) throw "assert failed";
        if (i == e) return true;
        var a = i.getOwner(), r;
        do {
          if (r = a.getParent(), r == null) break;
          if (r == e) return true;
          if (a = r.getOwner(), a == null) break;
        } while (true);
        a = e.getOwner();
        do {
          if (r = a.getParent(), r == null) break;
          if (r == i) return true;
          if (a = r.getOwner(), a == null) break;
        } while (true);
        return false;
      }, n.prototype.calcLowestCommonAncestors = function() {
        for (var i, e, a, r, f, o = this.getAllEdges(), t = o.length, l = 0; l < t; l++) {
          if (i = o[l], e = i.source, a = i.target, i.lca = null, i.sourceInLca = e, i.targetInLca = a, e == a) {
            i.lca = e.getOwner();
            continue;
          }
          for (r = e.getOwner(); i.lca == null; ) {
            for (i.targetInLca = a, f = a.getOwner(); i.lca == null; ) {
              if (f == r) {
                i.lca = f;
                break;
              }
              if (f == this.rootGraph) break;
              if (i.lca != null) throw "assert failed";
              i.targetInLca = f.getParent(), f = i.targetInLca.getOwner();
            }
            if (r == this.rootGraph) break;
            i.lca == null && (i.sourceInLca = r.getParent(), r = i.sourceInLca.getOwner());
          }
          if (i.lca == null) throw "assert failed";
        }
      }, n.prototype.calcLowestCommonAncestor = function(i, e) {
        if (i == e) return i.getOwner();
        var a = i.getOwner();
        do {
          if (a == null) break;
          var r = e.getOwner();
          do {
            if (r == null) break;
            if (r == a) return r;
            r = r.getParent().getOwner();
          } while (true);
          a = a.getParent().getOwner();
        } while (true);
        return a;
      }, n.prototype.calcInclusionTreeDepths = function(i, e) {
        i == null && e == null && (i = this.rootGraph, e = 1);
        for (var a, r = i.getNodes(), f = r.length, o = 0; o < f; o++) a = r[o], a.inclusionTreeDepth = e, a.child != null && this.calcInclusionTreeDepths(a.child, e + 1);
      }, n.prototype.includesInvalidEdge = function() {
        for (var i, e = [], a = this.edges.length, r = 0; r < a; r++) i = this.edges[r], this.isOneAncestorOfOther(i.source, i.target) && e.push(i);
        for (var r = 0; r < e.length; r++) this.remove(e[r]);
        return false;
      }, L.exports = n;
    }, function(L, F, T) {
      var c = T(12);
      function h() {
      }
      w(h, "IGeometry"), h.calcSeparationAmount = function(n, i, e, a) {
        if (!n.intersects(i)) throw "assert failed";
        var r = new Array(2);
        this.decideDirectionsForOverlappingNodes(n, i, r), e[0] = Math.min(n.getRight(), i.getRight()) - Math.max(n.x, i.x), e[1] = Math.min(n.getBottom(), i.getBottom()) - Math.max(n.y, i.y), n.getX() <= i.getX() && n.getRight() >= i.getRight() ? e[0] += Math.min(i.getX() - n.getX(), n.getRight() - i.getRight()) : i.getX() <= n.getX() && i.getRight() >= n.getRight() && (e[0] += Math.min(n.getX() - i.getX(), i.getRight() - n.getRight())), n.getY() <= i.getY() && n.getBottom() >= i.getBottom() ? e[1] += Math.min(i.getY() - n.getY(), n.getBottom() - i.getBottom()) : i.getY() <= n.getY() && i.getBottom() >= n.getBottom() && (e[1] += Math.min(n.getY() - i.getY(), i.getBottom() - n.getBottom()));
        var f = Math.abs((i.getCenterY() - n.getCenterY()) / (i.getCenterX() - n.getCenterX()));
        i.getCenterY() === n.getCenterY() && i.getCenterX() === n.getCenterX() && (f = 1);
        var o = f * e[0], t = e[1] / f;
        e[0] < t ? t = e[0] : o = e[1], e[0] = -1 * r[0] * (t / 2 + a), e[1] = -1 * r[1] * (o / 2 + a);
      }, h.decideDirectionsForOverlappingNodes = function(n, i, e) {
        n.getCenterX() < i.getCenterX() ? e[0] = -1 : e[0] = 1, n.getCenterY() < i.getCenterY() ? e[1] = -1 : e[1] = 1;
      }, h.getIntersection2 = function(n, i, e) {
        var a = n.getCenterX(), r = n.getCenterY(), f = i.getCenterX(), o = i.getCenterY();
        if (n.intersects(i)) return e[0] = a, e[1] = r, e[2] = f, e[3] = o, true;
        var t = n.getX(), l = n.getY(), u = n.getRight(), d = n.getX(), N = n.getBottom(), g = n.getRight(), E = n.getWidthHalf(), _ = n.getHeightHalf(), C = i.getX(), k = i.getY(), Y = i.getRight(), V = i.getX(), B = i.getBottom(), q = i.getRight(), O = i.getWidthHalf(), st = i.getHeightHalf(), s = false, y = false;
        if (a === f) {
          if (r > o) return e[0] = a, e[1] = l, e[2] = f, e[3] = B, false;
          if (r < o) return e[0] = a, e[1] = N, e[2] = f, e[3] = k, false;
        } else if (r === o) {
          if (a > f) return e[0] = t, e[1] = r, e[2] = Y, e[3] = o, false;
          if (a < f) return e[0] = u, e[1] = r, e[2] = C, e[3] = o, false;
        } else {
          var m = n.height / n.width, v = i.height / i.width, p = (o - r) / (f - a), M = void 0, x = void 0, b = void 0, U = void 0, X = void 0, W = void 0;
          if (-m === p ? a > f ? (e[0] = d, e[1] = N, s = true) : (e[0] = u, e[1] = l, s = true) : m === p && (a > f ? (e[0] = t, e[1] = l, s = true) : (e[0] = g, e[1] = N, s = true)), -v === p ? f > a ? (e[2] = V, e[3] = B, y = true) : (e[2] = Y, e[3] = k, y = true) : v === p && (f > a ? (e[2] = C, e[3] = k, y = true) : (e[2] = q, e[3] = B, y = true)), s && y) return false;
          if (a > f ? r > o ? (M = this.getCardinalDirection(m, p, 4), x = this.getCardinalDirection(v, p, 2)) : (M = this.getCardinalDirection(-m, p, 3), x = this.getCardinalDirection(-v, p, 1)) : r > o ? (M = this.getCardinalDirection(-m, p, 1), x = this.getCardinalDirection(-v, p, 3)) : (M = this.getCardinalDirection(m, p, 2), x = this.getCardinalDirection(v, p, 4)), !s) switch (M) {
            case 1:
              U = l, b = a + -_ / p, e[0] = b, e[1] = U;
              break;
            case 2:
              b = g, U = r + E * p, e[0] = b, e[1] = U;
              break;
            case 3:
              U = N, b = a + _ / p, e[0] = b, e[1] = U;
              break;
            case 4:
              b = d, U = r + -E * p, e[0] = b, e[1] = U;
              break;
          }
          if (!y) switch (x) {
            case 1:
              W = k, X = f + -st / p, e[2] = X, e[3] = W;
              break;
            case 2:
              X = q, W = o + O * p, e[2] = X, e[3] = W;
              break;
            case 3:
              W = B, X = f + st / p, e[2] = X, e[3] = W;
              break;
            case 4:
              X = V, W = o + -O * p, e[2] = X, e[3] = W;
              break;
          }
        }
        return false;
      }, h.getCardinalDirection = function(n, i, e) {
        return n > i ? e : 1 + e % 4;
      }, h.getIntersection = function(n, i, e, a) {
        if (a == null) return this.getIntersection2(n, i, e);
        var r = n.x, f = n.y, o = i.x, t = i.y, l = e.x, u = e.y, d = a.x, N = a.y, g = void 0, E = void 0, _ = void 0, C = void 0, k = void 0, Y = void 0, V = void 0, B = void 0, q = void 0;
        return _ = t - f, k = r - o, V = o * f - r * t, C = N - u, Y = l - d, B = d * u - l * N, q = _ * Y - C * k, q === 0 ? null : (g = (k * B - Y * V) / q, E = (C * V - _ * B) / q, new c(g, E));
      }, h.angleOfVector = function(n, i, e, a) {
        var r = void 0;
        return n !== e ? (r = Math.atan((a - i) / (e - n)), e < n ? r += Math.PI : a < i && (r += this.TWO_PI)) : a < i ? r = this.ONE_AND_HALF_PI : r = this.HALF_PI, r;
      }, h.doIntersect = function(n, i, e, a) {
        var r = n.x, f = n.y, o = i.x, t = i.y, l = e.x, u = e.y, d = a.x, N = a.y, g = (o - r) * (N - u) - (d - l) * (t - f);
        if (g === 0) return false;
        var E = ((N - u) * (d - r) + (l - d) * (N - f)) / g, _ = ((f - t) * (d - r) + (o - r) * (N - f)) / g;
        return 0 < E && E < 1 && 0 < _ && _ < 1;
      }, h.findCircleLineIntersections = function(n, i, e, a, r, f, o) {
        var t = (e - n) * (e - n) + (a - i) * (a - i), l = 2 * ((n - r) * (e - n) + (i - f) * (a - i)), u = (n - r) * (n - r) + (i - f) * (i - f) - o * o, d = l * l - 4 * t * u;
        if (d >= 0) {
          var N = (-l + Math.sqrt(l * l - 4 * t * u)) / (2 * t), g = (-l - Math.sqrt(l * l - 4 * t * u)) / (2 * t), E = null;
          return N >= 0 && N <= 1 ? [N] : g >= 0 && g <= 1 ? [g] : E;
        } else return null;
      }, h.HALF_PI = 0.5 * Math.PI, h.ONE_AND_HALF_PI = 1.5 * Math.PI, h.TWO_PI = 2 * Math.PI, h.THREE_PI = 3 * Math.PI, L.exports = h;
    }, function(L, F, T) {
      function c() {
      }
      w(c, "IMath"), c.sign = function(h) {
        return h > 0 ? 1 : h < 0 ? -1 : 0;
      }, c.floor = function(h) {
        return h < 0 ? Math.ceil(h) : Math.floor(h);
      }, c.ceil = function(h) {
        return h < 0 ? Math.floor(h) : Math.ceil(h);
      }, L.exports = c;
    }, function(L, F, T) {
      function c() {
      }
      w(c, "Integer"), c.MAX_VALUE = 2147483647, c.MIN_VALUE = -2147483648, L.exports = c;
    }, function(L, F, T) {
      var c = function() {
        function r(f, o) {
          for (var t = 0; t < o.length; t++) {
            var l = o[t];
            l.enumerable = l.enumerable || false, l.configurable = true, "value" in l && (l.writable = true), Object.defineProperty(f, l.key, l);
          }
        }
        return w(r, "defineProperties"), function(f, o, t) {
          return o && r(f.prototype, o), t && r(f, t), f;
        };
      }();
      function h(r, f) {
        if (!(r instanceof f)) throw new TypeError("Cannot call a class as a function");
      }
      w(h, "_classCallCheck");
      var n = w(function(r) {
        return { value: r, next: null, prev: null };
      }, "nodeFrom"), i = w(function(r, f, o, t) {
        return r !== null ? r.next = f : t.head = f, o !== null ? o.prev = f : t.tail = f, f.prev = r, f.next = o, t.length++, f;
      }, "add"), e = w(function(r, f) {
        var o = r.prev, t = r.next;
        return o !== null ? o.next = t : f.head = t, t !== null ? t.prev = o : f.tail = o, r.prev = r.next = null, f.length--, r;
      }, "_remove"), a = function() {
        function r(f) {
          var o = this;
          h(this, r), this.length = 0, this.head = null, this.tail = null, f == null ? void 0 : f.forEach(function(t) {
            return o.push(t);
          });
        }
        return w(r, "LinkedList"), c(r, [{ key: "size", value: w(function() {
          return this.length;
        }, "size") }, { key: "insertBefore", value: w(function(f, o) {
          return i(o.prev, n(f), o, this);
        }, "insertBefore") }, { key: "insertAfter", value: w(function(f, o) {
          return i(o, n(f), o.next, this);
        }, "insertAfter") }, { key: "insertNodeBefore", value: w(function(f, o) {
          return i(o.prev, f, o, this);
        }, "insertNodeBefore") }, { key: "insertNodeAfter", value: w(function(f, o) {
          return i(o, f, o.next, this);
        }, "insertNodeAfter") }, { key: "push", value: w(function(f) {
          return i(this.tail, n(f), null, this);
        }, "push") }, { key: "unshift", value: w(function(f) {
          return i(null, n(f), this.head, this);
        }, "unshift") }, { key: "remove", value: w(function(f) {
          return e(f, this);
        }, "remove") }, { key: "pop", value: w(function() {
          return e(this.tail, this).value;
        }, "pop") }, { key: "popNode", value: w(function() {
          return e(this.tail, this);
        }, "popNode") }, { key: "shift", value: w(function() {
          return e(this.head, this).value;
        }, "shift") }, { key: "shiftNode", value: w(function() {
          return e(this.head, this);
        }, "shiftNode") }, { key: "get_object_at", value: w(function(f) {
          if (f <= this.length()) {
            for (var o = 1, t = this.head; o < f; ) t = t.next, o++;
            return t.value;
          }
        }, "get_object_at") }, { key: "set_object_at", value: w(function(f, o) {
          if (f <= this.length()) {
            for (var t = 1, l = this.head; t < f; ) l = l.next, t++;
            l.value = o;
          }
        }, "set_object_at") }]), r;
      }();
      L.exports = a;
    }, function(L, F, T) {
      function c(h, n, i) {
        this.x = null, this.y = null, h == null && n == null && i == null ? (this.x = 0, this.y = 0) : typeof h == "number" && typeof n == "number" && i == null ? (this.x = h, this.y = n) : h.constructor.name == "Point" && n == null && i == null && (i = h, this.x = i.x, this.y = i.y);
      }
      w(c, "Point"), c.prototype.getX = function() {
        return this.x;
      }, c.prototype.getY = function() {
        return this.y;
      }, c.prototype.getLocation = function() {
        return new c(this.x, this.y);
      }, c.prototype.setLocation = function(h, n, i) {
        h.constructor.name == "Point" && n == null && i == null ? (i = h, this.setLocation(i.x, i.y)) : typeof h == "number" && typeof n == "number" && i == null && (parseInt(h) == h && parseInt(n) == n ? this.move(h, n) : (this.x = Math.floor(h + 0.5), this.y = Math.floor(n + 0.5)));
      }, c.prototype.move = function(h, n) {
        this.x = h, this.y = n;
      }, c.prototype.translate = function(h, n) {
        this.x += h, this.y += n;
      }, c.prototype.equals = function(h) {
        if (h.constructor.name == "Point") {
          var n = h;
          return this.x == n.x && this.y == n.y;
        }
        return this == h;
      }, c.prototype.toString = function() {
        return new c().constructor.name + "[x=" + this.x + ",y=" + this.y + "]";
      }, L.exports = c;
    }, function(L, F, T) {
      function c(h, n, i, e) {
        this.x = 0, this.y = 0, this.width = 0, this.height = 0, h != null && n != null && i != null && e != null && (this.x = h, this.y = n, this.width = i, this.height = e);
      }
      w(c, "RectangleD"), c.prototype.getX = function() {
        return this.x;
      }, c.prototype.setX = function(h) {
        this.x = h;
      }, c.prototype.getY = function() {
        return this.y;
      }, c.prototype.setY = function(h) {
        this.y = h;
      }, c.prototype.getWidth = function() {
        return this.width;
      }, c.prototype.setWidth = function(h) {
        this.width = h;
      }, c.prototype.getHeight = function() {
        return this.height;
      }, c.prototype.setHeight = function(h) {
        this.height = h;
      }, c.prototype.getRight = function() {
        return this.x + this.width;
      }, c.prototype.getBottom = function() {
        return this.y + this.height;
      }, c.prototype.intersects = function(h) {
        return !(this.getRight() < h.x || this.getBottom() < h.y || h.getRight() < this.x || h.getBottom() < this.y);
      }, c.prototype.getCenterX = function() {
        return this.x + this.width / 2;
      }, c.prototype.getMinX = function() {
        return this.getX();
      }, c.prototype.getMaxX = function() {
        return this.getX() + this.width;
      }, c.prototype.getCenterY = function() {
        return this.y + this.height / 2;
      }, c.prototype.getMinY = function() {
        return this.getY();
      }, c.prototype.getMaxY = function() {
        return this.getY() + this.height;
      }, c.prototype.getWidthHalf = function() {
        return this.width / 2;
      }, c.prototype.getHeightHalf = function() {
        return this.height / 2;
      }, L.exports = c;
    }, function(L, F, T) {
      var c = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(n) {
        return typeof n;
      } : function(n) {
        return n && typeof Symbol == "function" && n.constructor === Symbol && n !== Symbol.prototype ? "symbol" : typeof n;
      };
      function h() {
      }
      w(h, "UniqueIDGeneretor"), h.lastID = 0, h.createID = function(n) {
        return h.isPrimitive(n) ? n : (n.uniqueID != null || (n.uniqueID = h.getString(), h.lastID++), n.uniqueID);
      }, h.getString = function(n) {
        return n == null && (n = h.lastID), "Object#" + n;
      }, h.isPrimitive = function(n) {
        var i = typeof n > "u" ? "undefined" : c(n);
        return n == null || i != "object" && i != "function";
      }, L.exports = h;
    }, function(L, F, T) {
      function c(l) {
        if (Array.isArray(l)) {
          for (var u = 0, d = Array(l.length); u < l.length; u++) d[u] = l[u];
          return d;
        } else return Array.from(l);
      }
      w(c, "_toConsumableArray");
      var h = T(0), n = T(7), i = T(3), e = T(1), a = T(6), r = T(5), f = T(17), o = T(29);
      function t(l) {
        o.call(this), this.layoutQuality = h.QUALITY, this.createBendsAsNeeded = h.DEFAULT_CREATE_BENDS_AS_NEEDED, this.incremental = h.DEFAULT_INCREMENTAL, this.animationOnLayout = h.DEFAULT_ANIMATION_ON_LAYOUT, this.animationDuringLayout = h.DEFAULT_ANIMATION_DURING_LAYOUT, this.animationPeriod = h.DEFAULT_ANIMATION_PERIOD, this.uniformLeafNodeSizes = h.DEFAULT_UNIFORM_LEAF_NODE_SIZES, this.edgeToDummyNodes = /* @__PURE__ */ new Map(), this.graphManager = new n(this), this.isLayoutFinished = false, this.isSubLayout = false, this.isRemoteUse = false, l != null && (this.isRemoteUse = l);
      }
      w(t, "Layout"), t.RANDOM_SEED = 1, t.prototype = Object.create(o.prototype), t.prototype.getGraphManager = function() {
        return this.graphManager;
      }, t.prototype.getAllNodes = function() {
        return this.graphManager.getAllNodes();
      }, t.prototype.getAllEdges = function() {
        return this.graphManager.getAllEdges();
      }, t.prototype.getAllNodesToApplyGravitation = function() {
        return this.graphManager.getAllNodesToApplyGravitation();
      }, t.prototype.newGraphManager = function() {
        var l = new n(this);
        return this.graphManager = l, l;
      }, t.prototype.newGraph = function(l) {
        return new a(null, this.graphManager, l);
      }, t.prototype.newNode = function(l) {
        return new i(this.graphManager, l);
      }, t.prototype.newEdge = function(l) {
        return new e(null, null, l);
      }, t.prototype.checkLayoutSuccess = function() {
        return this.graphManager.getRoot() == null || this.graphManager.getRoot().getNodes().length == 0 || this.graphManager.includesInvalidEdge();
      }, t.prototype.runLayout = function() {
        this.isLayoutFinished = false, this.tilingPreLayout && this.tilingPreLayout(), this.initParameters();
        var l;
        return this.checkLayoutSuccess() ? l = false : l = this.layout(), h.ANIMATE === "during" ? false : (l && (this.isSubLayout || this.doPostLayout()), this.tilingPostLayout && this.tilingPostLayout(), this.isLayoutFinished = true, l);
      }, t.prototype.doPostLayout = function() {
        this.incremental || this.transform(), this.update();
      }, t.prototype.update2 = function() {
        if (this.createBendsAsNeeded && (this.createBendpointsFromDummyNodes(), this.graphManager.resetAllEdges()), !this.isRemoteUse) {
          for (var l, u = this.graphManager.getAllEdges(), d = 0; d < u.length; d++) l = u[d];
          for (var N, g = this.graphManager.getRoot().getNodes(), d = 0; d < g.length; d++) N = g[d];
          this.update(this.graphManager.getRoot());
        }
      }, t.prototype.update = function(l) {
        if (l == null) this.update2();
        else if (l instanceof i) {
          var u = l;
          if (u.getChild() != null) for (var d = u.getChild().getNodes(), N = 0; N < d.length; N++) update(d[N]);
          if (u.vGraphObject != null) {
            var g = u.vGraphObject;
            g.update(u);
          }
        } else if (l instanceof e) {
          var E = l;
          if (E.vGraphObject != null) {
            var _ = E.vGraphObject;
            _.update(E);
          }
        } else if (l instanceof a) {
          var C = l;
          if (C.vGraphObject != null) {
            var k = C.vGraphObject;
            k.update(C);
          }
        }
      }, t.prototype.initParameters = function() {
        this.isSubLayout || (this.layoutQuality = h.QUALITY, this.animationDuringLayout = h.DEFAULT_ANIMATION_DURING_LAYOUT, this.animationPeriod = h.DEFAULT_ANIMATION_PERIOD, this.animationOnLayout = h.DEFAULT_ANIMATION_ON_LAYOUT, this.incremental = h.DEFAULT_INCREMENTAL, this.createBendsAsNeeded = h.DEFAULT_CREATE_BENDS_AS_NEEDED, this.uniformLeafNodeSizes = h.DEFAULT_UNIFORM_LEAF_NODE_SIZES), this.animationDuringLayout && (this.animationOnLayout = false);
      }, t.prototype.transform = function(l) {
        if (l == null) this.transform(new r(0, 0));
        else {
          var u = new f(), d = this.graphManager.getRoot().updateLeftTop();
          if (d != null) {
            u.setWorldOrgX(l.x), u.setWorldOrgY(l.y), u.setDeviceOrgX(d.x), u.setDeviceOrgY(d.y);
            for (var N = this.getAllNodes(), g, E = 0; E < N.length; E++) g = N[E], g.transform(u);
          }
        }
      }, t.prototype.positionNodesRandomly = function(l) {
        if (l == null) this.positionNodesRandomly(this.getGraphManager().getRoot()), this.getGraphManager().getRoot().updateBounds(true);
        else for (var u, d, N = l.getNodes(), g = 0; g < N.length; g++) u = N[g], d = u.getChild(), d == null || d.getNodes().length == 0 ? u.scatter() : (this.positionNodesRandomly(d), u.updateBounds());
      }, t.prototype.getFlatForest = function() {
        for (var l = [], u = true, d = this.graphManager.getRoot().getNodes(), N = true, g = 0; g < d.length; g++) d[g].getChild() != null && (N = false);
        if (!N) return l;
        var E = /* @__PURE__ */ new Set(), _ = [], C = /* @__PURE__ */ new Map(), k = [];
        for (k = k.concat(d); k.length > 0 && u; ) {
          for (_.push(k[0]); _.length > 0 && u; ) {
            var Y = _[0];
            _.splice(0, 1), E.add(Y);
            for (var V = Y.getEdges(), g = 0; g < V.length; g++) {
              var B = V[g].getOtherEnd(Y);
              if (C.get(Y) != B) if (!E.has(B)) _.push(B), C.set(B, Y);
              else {
                u = false;
                break;
              }
            }
          }
          if (!u) l = [];
          else {
            var q = [].concat(c(E));
            l.push(q);
            for (var g = 0; g < q.length; g++) {
              var O = q[g], st = k.indexOf(O);
              st > -1 && k.splice(st, 1);
            }
            E = /* @__PURE__ */ new Set(), C = /* @__PURE__ */ new Map();
          }
        }
        return l;
      }, t.prototype.createDummyNodesForBendpoints = function(l) {
        for (var u = [], d = l.source, N = this.graphManager.calcLowestCommonAncestor(l.source, l.target), g = 0; g < l.bendpoints.length; g++) {
          var E = this.newNode(null);
          E.setRect(new Point(0, 0), new Dimension(1, 1)), N.add(E);
          var _ = this.newEdge(null);
          this.graphManager.add(_, d, E), u.add(E), d = E;
        }
        var _ = this.newEdge(null);
        return this.graphManager.add(_, d, l.target), this.edgeToDummyNodes.set(l, u), l.isInterGraph() ? this.graphManager.remove(l) : N.remove(l), u;
      }, t.prototype.createBendpointsFromDummyNodes = function() {
        var l = [];
        l = l.concat(this.graphManager.getAllEdges()), l = [].concat(c(this.edgeToDummyNodes.keys())).concat(l);
        for (var u = 0; u < l.length; u++) {
          var d = l[u];
          if (d.bendpoints.length > 0) {
            for (var N = this.edgeToDummyNodes.get(d), g = 0; g < N.length; g++) {
              var E = N[g], _ = new r(E.getCenterX(), E.getCenterY()), C = d.bendpoints.get(g);
              C.x = _.x, C.y = _.y, E.getOwner().remove(E);
            }
            this.graphManager.add(d, d.source, d.target);
          }
        }
      }, t.transform = function(l, u, d, N) {
        if (d != null && N != null) {
          var g = u;
          if (l <= 50) {
            var E = u / d;
            g -= (u - E) / 50 * (50 - l);
          } else {
            var _ = u * N;
            g += (_ - u) / 50 * (l - 50);
          }
          return g;
        } else {
          var C, k;
          return l <= 50 ? (C = 9 * u / 500, k = u / 10) : (C = 9 * u / 50, k = -8 * u), C * l + k;
        }
      }, t.findCenterOfTree = function(l) {
        var u = [];
        u = u.concat(l);
        var d = [], N = /* @__PURE__ */ new Map(), g = false, E = null;
        (u.length == 1 || u.length == 2) && (g = true, E = u[0]);
        for (var _ = 0; _ < u.length; _++) {
          var C = u[_], k = C.getNeighborsList().size;
          N.set(C, C.getNeighborsList().size), k == 1 && d.push(C);
        }
        var Y = [];
        for (Y = Y.concat(d); !g; ) {
          var V = [];
          V = V.concat(Y), Y = [];
          for (var _ = 0; _ < u.length; _++) {
            var C = u[_], B = u.indexOf(C);
            B >= 0 && u.splice(B, 1);
            var q = C.getNeighborsList();
            q.forEach(function(s) {
              if (d.indexOf(s) < 0) {
                var y = N.get(s), m = y - 1;
                m == 1 && Y.push(s), N.set(s, m);
              }
            });
          }
          d = d.concat(Y), (u.length == 1 || u.length == 2) && (g = true, E = u[0]);
        }
        return E;
      }, t.prototype.setGraphManager = function(l) {
        this.graphManager = l;
      }, L.exports = t;
    }, function(L, F, T) {
      function c() {
      }
      w(c, "RandomSeed"), c.seed = 1, c.x = 0, c.nextDouble = function() {
        return c.x = Math.sin(c.seed++) * 1e4, c.x - Math.floor(c.x);
      }, L.exports = c;
    }, function(L, F, T) {
      var c = T(5);
      function h(n, i) {
        this.lworldOrgX = 0, this.lworldOrgY = 0, this.ldeviceOrgX = 0, this.ldeviceOrgY = 0, this.lworldExtX = 1, this.lworldExtY = 1, this.ldeviceExtX = 1, this.ldeviceExtY = 1;
      }
      w(h, "Transform"), h.prototype.getWorldOrgX = function() {
        return this.lworldOrgX;
      }, h.prototype.setWorldOrgX = function(n) {
        this.lworldOrgX = n;
      }, h.prototype.getWorldOrgY = function() {
        return this.lworldOrgY;
      }, h.prototype.setWorldOrgY = function(n) {
        this.lworldOrgY = n;
      }, h.prototype.getWorldExtX = function() {
        return this.lworldExtX;
      }, h.prototype.setWorldExtX = function(n) {
        this.lworldExtX = n;
      }, h.prototype.getWorldExtY = function() {
        return this.lworldExtY;
      }, h.prototype.setWorldExtY = function(n) {
        this.lworldExtY = n;
      }, h.prototype.getDeviceOrgX = function() {
        return this.ldeviceOrgX;
      }, h.prototype.setDeviceOrgX = function(n) {
        this.ldeviceOrgX = n;
      }, h.prototype.getDeviceOrgY = function() {
        return this.ldeviceOrgY;
      }, h.prototype.setDeviceOrgY = function(n) {
        this.ldeviceOrgY = n;
      }, h.prototype.getDeviceExtX = function() {
        return this.ldeviceExtX;
      }, h.prototype.setDeviceExtX = function(n) {
        this.ldeviceExtX = n;
      }, h.prototype.getDeviceExtY = function() {
        return this.ldeviceExtY;
      }, h.prototype.setDeviceExtY = function(n) {
        this.ldeviceExtY = n;
      }, h.prototype.transformX = function(n) {
        var i = 0, e = this.lworldExtX;
        return e != 0 && (i = this.ldeviceOrgX + (n - this.lworldOrgX) * this.ldeviceExtX / e), i;
      }, h.prototype.transformY = function(n) {
        var i = 0, e = this.lworldExtY;
        return e != 0 && (i = this.ldeviceOrgY + (n - this.lworldOrgY) * this.ldeviceExtY / e), i;
      }, h.prototype.inverseTransformX = function(n) {
        var i = 0, e = this.ldeviceExtX;
        return e != 0 && (i = this.lworldOrgX + (n - this.ldeviceOrgX) * this.lworldExtX / e), i;
      }, h.prototype.inverseTransformY = function(n) {
        var i = 0, e = this.ldeviceExtY;
        return e != 0 && (i = this.lworldOrgY + (n - this.ldeviceOrgY) * this.lworldExtY / e), i;
      }, h.prototype.inverseTransformPoint = function(n) {
        var i = new c(this.inverseTransformX(n.x), this.inverseTransformY(n.y));
        return i;
      }, L.exports = h;
    }, function(L, F, T) {
      function c(o) {
        if (Array.isArray(o)) {
          for (var t = 0, l = Array(o.length); t < o.length; t++) l[t] = o[t];
          return l;
        } else return Array.from(o);
      }
      w(c, "_toConsumableArray");
      var h = T(15), n = T(4), i = T(0), e = T(8), a = T(9);
      function r() {
        h.call(this), this.useSmartIdealEdgeLengthCalculation = n.DEFAULT_USE_SMART_IDEAL_EDGE_LENGTH_CALCULATION, this.gravityConstant = n.DEFAULT_GRAVITY_STRENGTH, this.compoundGravityConstant = n.DEFAULT_COMPOUND_GRAVITY_STRENGTH, this.gravityRangeFactor = n.DEFAULT_GRAVITY_RANGE_FACTOR, this.compoundGravityRangeFactor = n.DEFAULT_COMPOUND_GRAVITY_RANGE_FACTOR, this.displacementThresholdPerNode = 3 * n.DEFAULT_EDGE_LENGTH / 100, this.coolingFactor = n.DEFAULT_COOLING_FACTOR_INCREMENTAL, this.initialCoolingFactor = n.DEFAULT_COOLING_FACTOR_INCREMENTAL, this.totalDisplacement = 0, this.oldTotalDisplacement = 0, this.maxIterations = n.MAX_ITERATIONS;
      }
      w(r, "FDLayout"), r.prototype = Object.create(h.prototype);
      for (var f in h) r[f] = h[f];
      r.prototype.initParameters = function() {
        h.prototype.initParameters.call(this, arguments), this.totalIterations = 0, this.notAnimatedIterations = 0, this.useFRGridVariant = n.DEFAULT_USE_SMART_REPULSION_RANGE_CALCULATION, this.grid = [];
      }, r.prototype.calcIdealEdgeLengths = function() {
        for (var o, t, l, u, d, N, g, E = this.getGraphManager().getAllEdges(), _ = 0; _ < E.length; _++) o = E[_], t = o.idealLength, o.isInterGraph && (u = o.getSource(), d = o.getTarget(), N = o.getSourceInLca().getEstimatedSize(), g = o.getTargetInLca().getEstimatedSize(), this.useSmartIdealEdgeLengthCalculation && (o.idealLength += N + g - 2 * i.SIMPLE_NODE_SIZE), l = o.getLca().getInclusionTreeDepth(), o.idealLength += t * n.PER_LEVEL_IDEAL_EDGE_LENGTH_FACTOR * (u.getInclusionTreeDepth() + d.getInclusionTreeDepth() - 2 * l));
      }, r.prototype.initSpringEmbedder = function() {
        var o = this.getAllNodes().length;
        this.incremental ? (o > n.ADAPTATION_LOWER_NODE_LIMIT && (this.coolingFactor = Math.max(this.coolingFactor * n.COOLING_ADAPTATION_FACTOR, this.coolingFactor - (o - n.ADAPTATION_LOWER_NODE_LIMIT) / (n.ADAPTATION_UPPER_NODE_LIMIT - n.ADAPTATION_LOWER_NODE_LIMIT) * this.coolingFactor * (1 - n.COOLING_ADAPTATION_FACTOR))), this.maxNodeDisplacement = n.MAX_NODE_DISPLACEMENT_INCREMENTAL) : (o > n.ADAPTATION_LOWER_NODE_LIMIT ? this.coolingFactor = Math.max(n.COOLING_ADAPTATION_FACTOR, 1 - (o - n.ADAPTATION_LOWER_NODE_LIMIT) / (n.ADAPTATION_UPPER_NODE_LIMIT - n.ADAPTATION_LOWER_NODE_LIMIT) * (1 - n.COOLING_ADAPTATION_FACTOR)) : this.coolingFactor = 1, this.initialCoolingFactor = this.coolingFactor, this.maxNodeDisplacement = n.MAX_NODE_DISPLACEMENT), this.maxIterations = Math.max(this.getAllNodes().length * 5, this.maxIterations), this.displacementThresholdPerNode = 3 * n.DEFAULT_EDGE_LENGTH / 100, this.totalDisplacementThreshold = this.displacementThresholdPerNode * this.getAllNodes().length, this.repulsionRange = this.calcRepulsionRange();
      }, r.prototype.calcSpringForces = function() {
        for (var o = this.getAllEdges(), t, l = 0; l < o.length; l++) t = o[l], this.calcSpringForce(t, t.idealLength);
      }, r.prototype.calcRepulsionForces = function() {
        var o = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : true, t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : false, l, u, d, N, g = this.getAllNodes(), E;
        if (this.useFRGridVariant) for (this.totalIterations % n.GRID_CALCULATION_CHECK_PERIOD == 1 && o && this.updateGrid(), E = /* @__PURE__ */ new Set(), l = 0; l < g.length; l++) d = g[l], this.calculateRepulsionForceOfANode(d, E, o, t), E.add(d);
        else for (l = 0; l < g.length; l++) for (d = g[l], u = l + 1; u < g.length; u++) N = g[u], d.getOwner() == N.getOwner() && this.calcRepulsionForce(d, N);
      }, r.prototype.calcGravitationalForces = function() {
        for (var o, t = this.getAllNodesToApplyGravitation(), l = 0; l < t.length; l++) o = t[l], this.calcGravitationalForce(o);
      }, r.prototype.moveNodes = function() {
        for (var o = this.getAllNodes(), t, l = 0; l < o.length; l++) t = o[l], t.move();
      }, r.prototype.calcSpringForce = function(o, t) {
        var l = o.getSource(), u = o.getTarget(), d, N, g, E;
        if (this.uniformLeafNodeSizes && l.getChild() == null && u.getChild() == null) o.updateLengthSimple();
        else if (o.updateLength(), o.isOverlapingSourceAndTarget) return;
        d = o.getLength(), d != 0 && (N = o.edgeElasticity * (d - t), g = N * (o.lengthX / d), E = N * (o.lengthY / d), l.springForceX += g, l.springForceY += E, u.springForceX -= g, u.springForceY -= E);
      }, r.prototype.calcRepulsionForce = function(o, t) {
        var l = o.getRect(), u = t.getRect(), d = new Array(2), N = new Array(4), g, E, _, C, k, Y, V;
        if (l.intersects(u)) {
          e.calcSeparationAmount(l, u, d, n.DEFAULT_EDGE_LENGTH / 2), Y = 2 * d[0], V = 2 * d[1];
          var B = o.noOfChildren * t.noOfChildren / (o.noOfChildren + t.noOfChildren);
          o.repulsionForceX -= B * Y, o.repulsionForceY -= B * V, t.repulsionForceX += B * Y, t.repulsionForceY += B * V;
        } else this.uniformLeafNodeSizes && o.getChild() == null && t.getChild() == null ? (g = u.getCenterX() - l.getCenterX(), E = u.getCenterY() - l.getCenterY()) : (e.getIntersection(l, u, N), g = N[2] - N[0], E = N[3] - N[1]), Math.abs(g) < n.MIN_REPULSION_DIST && (g = a.sign(g) * n.MIN_REPULSION_DIST), Math.abs(E) < n.MIN_REPULSION_DIST && (E = a.sign(E) * n.MIN_REPULSION_DIST), _ = g * g + E * E, C = Math.sqrt(_), k = (o.nodeRepulsion / 2 + t.nodeRepulsion / 2) * o.noOfChildren * t.noOfChildren / _, Y = k * g / C, V = k * E / C, o.repulsionForceX -= Y, o.repulsionForceY -= V, t.repulsionForceX += Y, t.repulsionForceY += V;
      }, r.prototype.calcGravitationalForce = function(o) {
        var t, l, u, d, N, g, E, _;
        t = o.getOwner(), l = (t.getRight() + t.getLeft()) / 2, u = (t.getTop() + t.getBottom()) / 2, d = o.getCenterX() - l, N = o.getCenterY() - u, g = Math.abs(d) + o.getWidth() / 2, E = Math.abs(N) + o.getHeight() / 2, o.getOwner() == this.graphManager.getRoot() ? (_ = t.getEstimatedSize() * this.gravityRangeFactor, (g > _ || E > _) && (o.gravitationForceX = -this.gravityConstant * d, o.gravitationForceY = -this.gravityConstant * N)) : (_ = t.getEstimatedSize() * this.compoundGravityRangeFactor, (g > _ || E > _) && (o.gravitationForceX = -this.gravityConstant * d * this.compoundGravityConstant, o.gravitationForceY = -this.gravityConstant * N * this.compoundGravityConstant));
      }, r.prototype.isConverged = function() {
        var o, t = false;
        return this.totalIterations > this.maxIterations / 3 && (t = Math.abs(this.totalDisplacement - this.oldTotalDisplacement) < 2), o = this.totalDisplacement < this.totalDisplacementThreshold, this.oldTotalDisplacement = this.totalDisplacement, o || t;
      }, r.prototype.animate = function() {
        this.animationDuringLayout && !this.isSubLayout && (this.notAnimatedIterations == this.animationPeriod ? (this.update(), this.notAnimatedIterations = 0) : this.notAnimatedIterations++);
      }, r.prototype.calcNoOfChildrenForAllNodes = function() {
        for (var o, t = this.graphManager.getAllNodes(), l = 0; l < t.length; l++) o = t[l], o.noOfChildren = o.getNoOfChildren();
      }, r.prototype.calcGrid = function(o) {
        var t = 0, l = 0;
        t = parseInt(Math.ceil((o.getRight() - o.getLeft()) / this.repulsionRange)), l = parseInt(Math.ceil((o.getBottom() - o.getTop()) / this.repulsionRange));
        for (var u = new Array(t), d = 0; d < t; d++) u[d] = new Array(l);
        for (var d = 0; d < t; d++) for (var N = 0; N < l; N++) u[d][N] = new Array();
        return u;
      }, r.prototype.addNodeToGrid = function(o, t, l) {
        var u = 0, d = 0, N = 0, g = 0;
        u = parseInt(Math.floor((o.getRect().x - t) / this.repulsionRange)), d = parseInt(Math.floor((o.getRect().width + o.getRect().x - t) / this.repulsionRange)), N = parseInt(Math.floor((o.getRect().y - l) / this.repulsionRange)), g = parseInt(Math.floor((o.getRect().height + o.getRect().y - l) / this.repulsionRange));
        for (var E = u; E <= d; E++) for (var _ = N; _ <= g; _++) this.grid[E][_].push(o), o.setGridCoordinates(u, d, N, g);
      }, r.prototype.updateGrid = function() {
        var o, t, l = this.getAllNodes();
        for (this.grid = this.calcGrid(this.graphManager.getRoot()), o = 0; o < l.length; o++) t = l[o], this.addNodeToGrid(t, this.graphManager.getRoot().getLeft(), this.graphManager.getRoot().getTop());
      }, r.prototype.calculateRepulsionForceOfANode = function(o, t, l, u) {
        if (this.totalIterations % n.GRID_CALCULATION_CHECK_PERIOD == 1 && l || u) {
          var d = /* @__PURE__ */ new Set();
          o.surrounding = new Array();
          for (var N, g = this.grid, E = o.startX - 1; E < o.finishX + 2; E++) for (var _ = o.startY - 1; _ < o.finishY + 2; _++) if (!(E < 0 || _ < 0 || E >= g.length || _ >= g[0].length)) {
            for (var C = 0; C < g[E][_].length; C++) if (N = g[E][_][C], !(o.getOwner() != N.getOwner() || o == N) && !t.has(N) && !d.has(N)) {
              var k = Math.abs(o.getCenterX() - N.getCenterX()) - (o.getWidth() / 2 + N.getWidth() / 2), Y = Math.abs(o.getCenterY() - N.getCenterY()) - (o.getHeight() / 2 + N.getHeight() / 2);
              k <= this.repulsionRange && Y <= this.repulsionRange && d.add(N);
            }
          }
          o.surrounding = [].concat(c(d));
        }
        for (E = 0; E < o.surrounding.length; E++) this.calcRepulsionForce(o, o.surrounding[E]);
      }, r.prototype.calcRepulsionRange = function() {
        return 0;
      }, L.exports = r;
    }, function(L, F, T) {
      var c = T(1), h = T(4);
      function n(e, a, r) {
        c.call(this, e, a, r), this.idealLength = h.DEFAULT_EDGE_LENGTH, this.edgeElasticity = h.DEFAULT_SPRING_STRENGTH;
      }
      w(n, "FDLayoutEdge"), n.prototype = Object.create(c.prototype);
      for (var i in c) n[i] = c[i];
      L.exports = n;
    }, function(L, F, T) {
      var c = T(3), h = T(4);
      function n(e, a, r, f) {
        c.call(this, e, a, r, f), this.nodeRepulsion = h.DEFAULT_REPULSION_STRENGTH, this.springForceX = 0, this.springForceY = 0, this.repulsionForceX = 0, this.repulsionForceY = 0, this.gravitationForceX = 0, this.gravitationForceY = 0, this.displacementX = 0, this.displacementY = 0, this.startX = 0, this.finishX = 0, this.startY = 0, this.finishY = 0, this.surrounding = [];
      }
      w(n, "FDLayoutNode"), n.prototype = Object.create(c.prototype);
      for (var i in c) n[i] = c[i];
      n.prototype.setGridCoordinates = function(e, a, r, f) {
        this.startX = e, this.finishX = a, this.startY = r, this.finishY = f;
      }, L.exports = n;
    }, function(L, F, T) {
      function c(h, n) {
        this.width = 0, this.height = 0, h !== null && n !== null && (this.height = n, this.width = h);
      }
      w(c, "DimensionD"), c.prototype.getWidth = function() {
        return this.width;
      }, c.prototype.setWidth = function(h) {
        this.width = h;
      }, c.prototype.getHeight = function() {
        return this.height;
      }, c.prototype.setHeight = function(h) {
        this.height = h;
      }, L.exports = c;
    }, function(L, F, T) {
      var c = T(14);
      function h() {
        this.map = {}, this.keys = [];
      }
      w(h, "HashMap"), h.prototype.put = function(n, i) {
        var e = c.createID(n);
        this.contains(e) || (this.map[e] = i, this.keys.push(n));
      }, h.prototype.contains = function(n) {
        return c.createID(n), this.map[n] != null;
      }, h.prototype.get = function(n) {
        var i = c.createID(n);
        return this.map[i];
      }, h.prototype.keySet = function() {
        return this.keys;
      }, L.exports = h;
    }, function(L, F, T) {
      var c = T(14);
      function h() {
        this.set = {};
      }
      w(h, "HashSet"), h.prototype.add = function(n) {
        var i = c.createID(n);
        this.contains(i) || (this.set[i] = n);
      }, h.prototype.remove = function(n) {
        delete this.set[c.createID(n)];
      }, h.prototype.clear = function() {
        this.set = {};
      }, h.prototype.contains = function(n) {
        return this.set[c.createID(n)] == n;
      }, h.prototype.isEmpty = function() {
        return this.size() === 0;
      }, h.prototype.size = function() {
        return Object.keys(this.set).length;
      }, h.prototype.addAllTo = function(n) {
        for (var i = Object.keys(this.set), e = i.length, a = 0; a < e; a++) n.push(this.set[i[a]]);
      }, h.prototype.size = function() {
        return Object.keys(this.set).length;
      }, h.prototype.addAll = function(n) {
        for (var i = n.length, e = 0; e < i; e++) {
          var a = n[e];
          this.add(a);
        }
      }, L.exports = h;
    }, function(L, F, T) {
      function c() {
      }
      w(c, "Matrix"), c.multMat = function(h, n) {
        for (var i = [], e = 0; e < h.length; e++) {
          i[e] = [];
          for (var a = 0; a < n[0].length; a++) {
            i[e][a] = 0;
            for (var r = 0; r < h[0].length; r++) i[e][a] += h[e][r] * n[r][a];
          }
        }
        return i;
      }, c.transpose = function(h) {
        for (var n = [], i = 0; i < h[0].length; i++) {
          n[i] = [];
          for (var e = 0; e < h.length; e++) n[i][e] = h[e][i];
        }
        return n;
      }, c.multCons = function(h, n) {
        for (var i = [], e = 0; e < h.length; e++) i[e] = h[e] * n;
        return i;
      }, c.minusOp = function(h, n) {
        for (var i = [], e = 0; e < h.length; e++) i[e] = h[e] - n[e];
        return i;
      }, c.dotProduct = function(h, n) {
        for (var i = 0, e = 0; e < h.length; e++) i += h[e] * n[e];
        return i;
      }, c.mag = function(h) {
        return Math.sqrt(this.dotProduct(h, h));
      }, c.normalize = function(h) {
        for (var n = [], i = this.mag(h), e = 0; e < h.length; e++) n[e] = h[e] / i;
        return n;
      }, c.multGamma = function(h) {
        for (var n = [], i = 0, e = 0; e < h.length; e++) i += h[e];
        i *= -1 / h.length;
        for (var a = 0; a < h.length; a++) n[a] = i + h[a];
        return n;
      }, c.multL = function(h, n, i) {
        for (var e = [], a = [], r = [], f = 0; f < n[0].length; f++) {
          for (var o = 0, t = 0; t < n.length; t++) o += -0.5 * n[t][f] * h[t];
          a[f] = o;
        }
        for (var l = 0; l < i.length; l++) {
          for (var u = 0, d = 0; d < i.length; d++) u += i[l][d] * a[d];
          r[l] = u;
        }
        for (var N = 0; N < n.length; N++) {
          for (var g = 0, E = 0; E < n[0].length; E++) g += n[N][E] * r[E];
          e[N] = g;
        }
        return e;
      }, L.exports = c;
    }, function(L, F, T) {
      var c = function() {
        function e(a, r) {
          for (var f = 0; f < r.length; f++) {
            var o = r[f];
            o.enumerable = o.enumerable || false, o.configurable = true, "value" in o && (o.writable = true), Object.defineProperty(a, o.key, o);
          }
        }
        return w(e, "defineProperties"), function(a, r, f) {
          return r && e(a.prototype, r), f && e(a, f), a;
        };
      }();
      function h(e, a) {
        if (!(e instanceof a)) throw new TypeError("Cannot call a class as a function");
      }
      w(h, "_classCallCheck");
      var n = T(11), i = function() {
        function e(a, r) {
          h(this, e), (r !== null || r !== void 0) && (this.compareFunction = this._defaultCompareFunction);
          var f = void 0;
          a instanceof n ? f = a.size() : f = a.length, this._quicksort(a, 0, f - 1);
        }
        return w(e, "Quicksort"), c(e, [{ key: "_quicksort", value: w(function(a, r, f) {
          if (r < f) {
            var o = this._partition(a, r, f);
            this._quicksort(a, r, o), this._quicksort(a, o + 1, f);
          }
        }, "_quicksort") }, { key: "_partition", value: w(function(a, r, f) {
          for (var o = this._get(a, r), t = r, l = f; ; ) {
            for (; this.compareFunction(o, this._get(a, l)); ) l--;
            for (; this.compareFunction(this._get(a, t), o); ) t++;
            if (t < l) this._swap(a, t, l), t++, l--;
            else return l;
          }
        }, "_partition") }, { key: "_get", value: w(function(a, r) {
          return a instanceof n ? a.get_object_at(r) : a[r];
        }, "_get") }, { key: "_set", value: w(function(a, r, f) {
          a instanceof n ? a.set_object_at(r, f) : a[r] = f;
        }, "_set") }, { key: "_swap", value: w(function(a, r, f) {
          var o = this._get(a, r);
          this._set(a, r, this._get(a, f)), this._set(a, f, o);
        }, "_swap") }, { key: "_defaultCompareFunction", value: w(function(a, r) {
          return r > a;
        }, "_defaultCompareFunction") }]), e;
      }();
      L.exports = i;
    }, function(L, F, T) {
      function c() {
      }
      w(c, "SVD"), c.svd = function(h) {
        this.U = null, this.V = null, this.s = null, this.m = 0, this.n = 0, this.m = h.length, this.n = h[0].length;
        var n = Math.min(this.m, this.n);
        this.s = function(Tt) {
          for (var At = []; Tt-- > 0; ) At.push(0);
          return At;
        }(Math.min(this.m + 1, this.n)), this.U = function(Tt) {
          var At = w(function Ft(St) {
            if (St.length == 0) return 0;
            for (var zt = [], jt = 0; jt < St[0]; jt++) zt.push(Ft(St.slice(1)));
            return zt;
          }, "allocate");
          return At(Tt);
        }([this.m, n]), this.V = function(Tt) {
          var At = w(function Ft(St) {
            if (St.length == 0) return 0;
            for (var zt = [], jt = 0; jt < St[0]; jt++) zt.push(Ft(St.slice(1)));
            return zt;
          }, "allocate");
          return At(Tt);
        }([this.n, this.n]);
        for (var i = function(Tt) {
          for (var At = []; Tt-- > 0; ) At.push(0);
          return At;
        }(this.n), e = function(Tt) {
          for (var At = []; Tt-- > 0; ) At.push(0);
          return At;
        }(this.m), a = true, r = true, f = Math.min(this.m - 1, this.n), o = Math.max(0, Math.min(this.n - 2, this.m)), t = 0; t < Math.max(f, o); t++) {
          if (t < f) {
            this.s[t] = 0;
            for (var l = t; l < this.m; l++) this.s[t] = c.hypot(this.s[t], h[l][t]);
            if (this.s[t] !== 0) {
              h[t][t] < 0 && (this.s[t] = -this.s[t]);
              for (var u = t; u < this.m; u++) h[u][t] /= this.s[t];
              h[t][t] += 1;
            }
            this.s[t] = -this.s[t];
          }
          for (var d = t + 1; d < this.n; d++) {
            if (/* @__PURE__ */ function(Tt, At) {
              return Tt && At;
            }(t < f, this.s[t] !== 0)) {
              for (var N = 0, g = t; g < this.m; g++) N += h[g][t] * h[g][d];
              N = -N / h[t][t];
              for (var E = t; E < this.m; E++) h[E][d] += N * h[E][t];
            }
            i[d] = h[t][d];
          }
          if (/* @__PURE__ */ function(Tt, At) {
            return Tt && At;
          }(a, t < f)) for (var _ = t; _ < this.m; _++) this.U[_][t] = h[_][t];
          if (t < o) {
            i[t] = 0;
            for (var C = t + 1; C < this.n; C++) i[t] = c.hypot(i[t], i[C]);
            if (i[t] !== 0) {
              i[t + 1] < 0 && (i[t] = -i[t]);
              for (var k = t + 1; k < this.n; k++) i[k] /= i[t];
              i[t + 1] += 1;
            }
            if (i[t] = -i[t], /* @__PURE__ */ function(Tt, At) {
              return Tt && At;
            }(t + 1 < this.m, i[t] !== 0)) {
              for (var Y = t + 1; Y < this.m; Y++) e[Y] = 0;
              for (var V = t + 1; V < this.n; V++) for (var B = t + 1; B < this.m; B++) e[B] += i[V] * h[B][V];
              for (var q = t + 1; q < this.n; q++) for (var O = -i[q] / i[t + 1], st = t + 1; st < this.m; st++) h[st][q] += O * e[st];
            }
            if (r) for (var s = t + 1; s < this.n; s++) this.V[s][t] = i[s];
          }
        }
        var y = Math.min(this.n, this.m + 1);
        if (f < this.n && (this.s[f] = h[f][f]), this.m < y && (this.s[y - 1] = 0), o + 1 < y && (i[o] = h[o][y - 1]), i[y - 1] = 0, a) {
          for (var m = f; m < n; m++) {
            for (var v = 0; v < this.m; v++) this.U[v][m] = 0;
            this.U[m][m] = 1;
          }
          for (var p = f - 1; p >= 0; p--) if (this.s[p] !== 0) {
            for (var M = p + 1; M < n; M++) {
              for (var x = 0, b = p; b < this.m; b++) x += this.U[b][p] * this.U[b][M];
              x = -x / this.U[p][p];
              for (var U = p; U < this.m; U++) this.U[U][M] += x * this.U[U][p];
            }
            for (var X = p; X < this.m; X++) this.U[X][p] = -this.U[X][p];
            this.U[p][p] = 1 + this.U[p][p];
            for (var W = 0; W < p - 1; W++) this.U[W][p] = 0;
          } else {
            for (var j = 0; j < this.m; j++) this.U[j][p] = 0;
            this.U[p][p] = 1;
          }
        }
        if (r) for (var z = this.n - 1; z >= 0; z--) {
          if (/* @__PURE__ */ function(Tt, At) {
            return Tt && At;
          }(z < o, i[z] !== 0)) for (var K = z + 1; K < n; K++) {
            for (var P = 0, R = z + 1; R < this.n; R++) P += this.V[R][z] * this.V[R][K];
            P = -P / this.V[z + 1][z];
            for (var S = z + 1; S < this.n; S++) this.V[S][K] += P * this.V[S][z];
          }
          for (var J = 0; J < this.n; J++) this.V[J][z] = 0;
          this.V[z][z] = 1;
        }
        for (var it = y - 1, ut = 0, Ct = Math.pow(2, -52), bt = Math.pow(2, -966); y > 0; ) {
          var G = void 0, rt = void 0;
          for (G = y - 2; G >= -1 && G !== -1; G--) if (Math.abs(i[G]) <= bt + Ct * (Math.abs(this.s[G]) + Math.abs(this.s[G + 1]))) {
            i[G] = 0;
            break;
          }
          if (G === y - 2) rt = 4;
          else {
            var ht = void 0;
            for (ht = y - 1; ht >= G && ht !== G; ht--) {
              var mt = (ht !== y ? Math.abs(i[ht]) : 0) + (ht !== G + 1 ? Math.abs(i[ht - 1]) : 0);
              if (Math.abs(this.s[ht]) <= bt + Ct * mt) {
                this.s[ht] = 0;
                break;
              }
            }
            ht === G ? rt = 3 : ht === y - 1 ? rt = 1 : (rt = 2, G = ht);
          }
          switch (G++, rt) {
            case 1:
              {
                var Lt = i[y - 2];
                i[y - 2] = 0;
                for (var vt = y - 2; vt >= G; vt--) {
                  var yt = c.hypot(this.s[vt], Lt), xt = this.s[vt] / yt, Ht = Lt / yt;
                  if (this.s[vt] = yt, vt !== G && (Lt = -Ht * i[vt - 1], i[vt - 1] = xt * i[vt - 1]), r) for (var Pt = 0; Pt < this.n; Pt++) yt = xt * this.V[Pt][vt] + Ht * this.V[Pt][y - 1], this.V[Pt][y - 1] = -Ht * this.V[Pt][vt] + xt * this.V[Pt][y - 1], this.V[Pt][vt] = yt;
                }
              }
              break;
            case 2:
              {
                var Gt = i[G - 1];
                i[G - 1] = 0;
                for (var Ot = G; Ot < y; Ot++) {
                  var Ut = c.hypot(this.s[Ot], Gt), Xt = this.s[Ot] / Ut, Wt = Gt / Ut;
                  if (this.s[Ot] = Ut, Gt = -Wt * i[Ot], i[Ot] = Xt * i[Ot], a) for (var lt = 0; lt < this.m; lt++) Ut = Xt * this.U[lt][Ot] + Wt * this.U[lt][G - 1], this.U[lt][G - 1] = -Wt * this.U[lt][Ot] + Xt * this.U[lt][G - 1], this.U[lt][Ot] = Ut;
                }
              }
              break;
            case 3:
              {
                var I = Math.max(Math.max(Math.max(Math.max(Math.abs(this.s[y - 1]), Math.abs(this.s[y - 2])), Math.abs(i[y - 2])), Math.abs(this.s[G])), Math.abs(i[G])), D = this.s[y - 1] / I, $ = this.s[y - 2] / I, Z = i[y - 2] / I, Q = this.s[G] / I, pt = i[G] / I, dt = (($ + D) * ($ - D) + Z * Z) / 2, tt = D * Z * (D * Z), ct = 0;
                /* @__PURE__ */ (function(Tt, At) {
                  return Tt || At;
                })(dt !== 0, tt !== 0) && (ct = Math.sqrt(dt * dt + tt), dt < 0 && (ct = -ct), ct = tt / (dt + ct));
                for (var Et = (Q + D) * (Q - D) + ct, wt = Q * pt, et = G; et < y - 1; et++) {
                  var It = c.hypot(Et, wt), nt = Et / It, at = wt / It;
                  if (et !== G && (i[et - 1] = It), Et = nt * this.s[et] + at * i[et], i[et] = nt * i[et] - at * this.s[et], wt = at * this.s[et + 1], this.s[et + 1] = nt * this.s[et + 1], r) for (var ot = 0; ot < this.n; ot++) It = nt * this.V[ot][et] + at * this.V[ot][et + 1], this.V[ot][et + 1] = -at * this.V[ot][et] + nt * this.V[ot][et + 1], this.V[ot][et] = It;
                  if (It = c.hypot(Et, wt), nt = Et / It, at = wt / It, this.s[et] = It, Et = nt * i[et] + at * this.s[et + 1], this.s[et + 1] = -at * i[et] + nt * this.s[et + 1], wt = at * i[et + 1], i[et + 1] = nt * i[et + 1], a && et < this.m - 1) for (var Nt = 0; Nt < this.m; Nt++) It = nt * this.U[Nt][et] + at * this.U[Nt][et + 1], this.U[Nt][et + 1] = -at * this.U[Nt][et] + nt * this.U[Nt][et + 1], this.U[Nt][et] = It;
                }
                i[y - 2] = Et, ut = ut + 1;
              }
              break;
            case 4:
              {
                if (this.s[G] <= 0 && (this.s[G] = this.s[G] < 0 ? -this.s[G] : 0, r)) for (var ft = 0; ft <= it; ft++) this.V[ft][G] = -this.V[ft][G];
                for (; G < it && !(this.s[G] >= this.s[G + 1]); ) {
                  var Mt = this.s[G];
                  if (this.s[G] = this.s[G + 1], this.s[G + 1] = Mt, r && G < this.n - 1) for (var Rt = 0; Rt < this.n; Rt++) Mt = this.V[Rt][G + 1], this.V[Rt][G + 1] = this.V[Rt][G], this.V[Rt][G] = Mt;
                  if (a && G < this.m - 1) for (var Dt = 0; Dt < this.m; Dt++) Mt = this.U[Dt][G + 1], this.U[Dt][G + 1] = this.U[Dt][G], this.U[Dt][G] = Mt;
                  G++;
                }
                ut = 0, y--;
              }
              break;
          }
        }
        var Bt = { U: this.U, V: this.V, S: this.s };
        return Bt;
      }, c.hypot = function(h, n) {
        var i = void 0;
        return Math.abs(h) > Math.abs(n) ? (i = n / h, i = Math.abs(h) * Math.sqrt(1 + i * i)) : n != 0 ? (i = h / n, i = Math.abs(n) * Math.sqrt(1 + i * i)) : i = 0, i;
      }, L.exports = c;
    }, function(L, F, T) {
      var c = function() {
        function i(e, a) {
          for (var r = 0; r < a.length; r++) {
            var f = a[r];
            f.enumerable = f.enumerable || false, f.configurable = true, "value" in f && (f.writable = true), Object.defineProperty(e, f.key, f);
          }
        }
        return w(i, "defineProperties"), function(e, a, r) {
          return a && i(e.prototype, a), r && i(e, r), e;
        };
      }();
      function h(i, e) {
        if (!(i instanceof e)) throw new TypeError("Cannot call a class as a function");
      }
      w(h, "_classCallCheck");
      var n = function() {
        function i(e, a) {
          var r = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 1, f = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : -1, o = arguments.length > 4 && arguments[4] !== void 0 ? arguments[4] : -1;
          h(this, i), this.sequence1 = e, this.sequence2 = a, this.match_score = r, this.mismatch_penalty = f, this.gap_penalty = o, this.iMax = e.length + 1, this.jMax = a.length + 1, this.grid = new Array(this.iMax);
          for (var t = 0; t < this.iMax; t++) {
            this.grid[t] = new Array(this.jMax);
            for (var l = 0; l < this.jMax; l++) this.grid[t][l] = 0;
          }
          this.tracebackGrid = new Array(this.iMax);
          for (var u = 0; u < this.iMax; u++) {
            this.tracebackGrid[u] = new Array(this.jMax);
            for (var d = 0; d < this.jMax; d++) this.tracebackGrid[u][d] = [null, null, null];
          }
          this.alignments = [], this.score = -1, this.computeGrids();
        }
        return w(i, "NeedlemanWunsch"), c(i, [{ key: "getScore", value: w(function() {
          return this.score;
        }, "getScore") }, { key: "getAlignments", value: w(function() {
          return this.alignments;
        }, "getAlignments") }, { key: "computeGrids", value: w(function() {
          for (var e = 1; e < this.jMax; e++) this.grid[0][e] = this.grid[0][e - 1] + this.gap_penalty, this.tracebackGrid[0][e] = [false, false, true];
          for (var a = 1; a < this.iMax; a++) this.grid[a][0] = this.grid[a - 1][0] + this.gap_penalty, this.tracebackGrid[a][0] = [false, true, false];
          for (var r = 1; r < this.iMax; r++) for (var f = 1; f < this.jMax; f++) {
            var o = void 0;
            this.sequence1[r - 1] === this.sequence2[f - 1] ? o = this.grid[r - 1][f - 1] + this.match_score : o = this.grid[r - 1][f - 1] + this.mismatch_penalty;
            var t = this.grid[r - 1][f] + this.gap_penalty, l = this.grid[r][f - 1] + this.gap_penalty, u = [o, t, l], d = this.arrayAllMaxIndexes(u);
            this.grid[r][f] = u[d[0]], this.tracebackGrid[r][f] = [d.includes(0), d.includes(1), d.includes(2)];
          }
          this.score = this.grid[this.iMax - 1][this.jMax - 1];
        }, "computeGrids") }, { key: "alignmentTraceback", value: w(function() {
          var e = [];
          for (e.push({ pos: [this.sequence1.length, this.sequence2.length], seq1: "", seq2: "" }); e[0]; ) {
            var a = e[0], r = this.tracebackGrid[a.pos[0]][a.pos[1]];
            r[0] && e.push({ pos: [a.pos[0] - 1, a.pos[1] - 1], seq1: this.sequence1[a.pos[0] - 1] + a.seq1, seq2: this.sequence2[a.pos[1] - 1] + a.seq2 }), r[1] && e.push({ pos: [a.pos[0] - 1, a.pos[1]], seq1: this.sequence1[a.pos[0] - 1] + a.seq1, seq2: "-" + a.seq2 }), r[2] && e.push({ pos: [a.pos[0], a.pos[1] - 1], seq1: "-" + a.seq1, seq2: this.sequence2[a.pos[1] - 1] + a.seq2 }), a.pos[0] === 0 && a.pos[1] === 0 && this.alignments.push({ sequence1: a.seq1, sequence2: a.seq2 }), e.shift();
          }
          return this.alignments;
        }, "alignmentTraceback") }, { key: "getAllIndexes", value: w(function(e, a) {
          for (var r = [], f = -1; (f = e.indexOf(a, f + 1)) !== -1; ) r.push(f);
          return r;
        }, "getAllIndexes") }, { key: "arrayAllMaxIndexes", value: w(function(e) {
          return this.getAllIndexes(e, Math.max.apply(null, e));
        }, "arrayAllMaxIndexes") }]), i;
      }();
      L.exports = n;
    }, function(L, F, T) {
      var c = w(function() {
      }, "layoutBase");
      c.FDLayout = T(18), c.FDLayoutConstants = T(4), c.FDLayoutEdge = T(19), c.FDLayoutNode = T(20), c.DimensionD = T(21), c.HashMap = T(22), c.HashSet = T(23), c.IGeometry = T(8), c.IMath = T(9), c.Integer = T(10), c.Point = T(12), c.PointD = T(5), c.RandomSeed = T(16), c.RectangleD = T(13), c.Transform = T(17), c.UniqueIDGeneretor = T(14), c.Quicksort = T(25), c.LinkedList = T(11), c.LGraphObject = T(2), c.LGraph = T(6), c.LEdge = T(1), c.LGraphManager = T(7), c.LNode = T(3), c.Layout = T(15), c.LayoutConstants = T(0), c.NeedlemanWunsch = T(27), c.Matrix = T(24), c.SVD = T(26), L.exports = c;
    }, function(L, F, T) {
      function c() {
        this.listeners = [];
      }
      w(c, "Emitter");
      var h = c.prototype;
      h.addListener = function(n, i) {
        this.listeners.push({ event: n, callback: i });
      }, h.removeListener = function(n, i) {
        for (var e = this.listeners.length; e >= 0; e--) {
          var a = this.listeners[e];
          a.event === n && a.callback === i && this.listeners.splice(e, 1);
        }
      }, h.emit = function(n, i) {
        for (var e = 0; e < this.listeners.length; e++) {
          var a = this.listeners[e];
          n === a.event && a.callback(i);
        }
      }, L.exports = c;
    }]);
  });
}), we = fe((A, H) => {
  w(function(L, F) {
    typeof A == "object" && typeof H == "object" ? H.exports = F(Ae()) : typeof define == "function" && define.amd ? define(["layout-base"], F) : typeof A == "object" ? A.coseBase = F(Ae()) : L.coseBase = F(L.layoutBase);
  }, "webpackUniversalModuleDefinition")(A, function(L) {
    return (() => {
      var F = { 45: (n, i, e) => {
        var a = {};
        a.layoutBase = e(551), a.CoSEConstants = e(806), a.CoSEEdge = e(767), a.CoSEGraph = e(880), a.CoSEGraphManager = e(578), a.CoSELayout = e(765), a.CoSENode = e(991), a.ConstraintHandler = e(902), n.exports = a;
      }, 806: (n, i, e) => {
        var a = e(551).FDLayoutConstants;
        function r() {
        }
        w(r, "CoSEConstants");
        for (var f in a) r[f] = a[f];
        r.DEFAULT_USE_MULTI_LEVEL_SCALING = false, r.DEFAULT_RADIAL_SEPARATION = a.DEFAULT_EDGE_LENGTH, r.DEFAULT_COMPONENT_SEPERATION = 60, r.TILE = true, r.TILING_PADDING_VERTICAL = 10, r.TILING_PADDING_HORIZONTAL = 10, r.TRANSFORM_ON_CONSTRAINT_HANDLING = true, r.ENFORCE_CONSTRAINTS = true, r.APPLY_LAYOUT = true, r.RELAX_MOVEMENT_ON_CONSTRAINTS = true, r.TREE_REDUCTION_ON_INCREMENTAL = true, r.PURE_INCREMENTAL = r.DEFAULT_INCREMENTAL, n.exports = r;
      }, 767: (n, i, e) => {
        var a = e(551).FDLayoutEdge;
        function r(o, t, l) {
          a.call(this, o, t, l);
        }
        w(r, "CoSEEdge"), r.prototype = Object.create(a.prototype);
        for (var f in a) r[f] = a[f];
        n.exports = r;
      }, 880: (n, i, e) => {
        var a = e(551).LGraph;
        function r(o, t, l) {
          a.call(this, o, t, l);
        }
        w(r, "CoSEGraph"), r.prototype = Object.create(a.prototype);
        for (var f in a) r[f] = a[f];
        n.exports = r;
      }, 578: (n, i, e) => {
        var a = e(551).LGraphManager;
        function r(o) {
          a.call(this, o);
        }
        w(r, "CoSEGraphManager"), r.prototype = Object.create(a.prototype);
        for (var f in a) r[f] = a[f];
        n.exports = r;
      }, 765: (n, i, e) => {
        var a = e(551).FDLayout, r = e(578), f = e(880), o = e(991), t = e(767), l = e(806), u = e(902), d = e(551).FDLayoutConstants, N = e(551).LayoutConstants, g = e(551).Point, E = e(551).PointD, _ = e(551).DimensionD, C = e(551).Layout, k = e(551).Integer, Y = e(551).IGeometry, V = e(551).LGraph, B = e(551).Transform, q = e(551).LinkedList;
        function O() {
          a.call(this), this.toBeTiled = {}, this.constraints = {};
        }
        w(O, "CoSELayout"), O.prototype = Object.create(a.prototype);
        for (var st in a) O[st] = a[st];
        O.prototype.newGraphManager = function() {
          var s = new r(this);
          return this.graphManager = s, s;
        }, O.prototype.newGraph = function(s) {
          return new f(null, this.graphManager, s);
        }, O.prototype.newNode = function(s) {
          return new o(this.graphManager, s);
        }, O.prototype.newEdge = function(s) {
          return new t(null, null, s);
        }, O.prototype.initParameters = function() {
          a.prototype.initParameters.call(this, arguments), this.isSubLayout || (l.DEFAULT_EDGE_LENGTH < 10 ? this.idealEdgeLength = 10 : this.idealEdgeLength = l.DEFAULT_EDGE_LENGTH, this.useSmartIdealEdgeLengthCalculation = l.DEFAULT_USE_SMART_IDEAL_EDGE_LENGTH_CALCULATION, this.gravityConstant = d.DEFAULT_GRAVITY_STRENGTH, this.compoundGravityConstant = d.DEFAULT_COMPOUND_GRAVITY_STRENGTH, this.gravityRangeFactor = d.DEFAULT_GRAVITY_RANGE_FACTOR, this.compoundGravityRangeFactor = d.DEFAULT_COMPOUND_GRAVITY_RANGE_FACTOR, this.prunedNodesAll = [], this.growTreeIterations = 0, this.afterGrowthIterations = 0, this.isTreeGrowing = false, this.isGrowthFinished = false);
        }, O.prototype.initSpringEmbedder = function() {
          a.prototype.initSpringEmbedder.call(this), this.coolingCycle = 0, this.maxCoolingCycle = this.maxIterations / d.CONVERGENCE_CHECK_PERIOD, this.finalTemperature = 0.04, this.coolingAdjuster = 1;
        }, O.prototype.layout = function() {
          var s = N.DEFAULT_CREATE_BENDS_AS_NEEDED;
          return s && (this.createBendpoints(), this.graphManager.resetAllEdges()), this.level = 0, this.classicLayout();
        }, O.prototype.classicLayout = function() {
          if (this.nodesWithGravity = this.calculateNodesToApplyGravitationTo(), this.graphManager.setAllNodesToApplyGravitation(this.nodesWithGravity), this.calcNoOfChildrenForAllNodes(), this.graphManager.calcLowestCommonAncestors(), this.graphManager.calcInclusionTreeDepths(), this.graphManager.getRoot().calcEstimatedSize(), this.calcIdealEdgeLengths(), this.incremental) {
            if (l.TREE_REDUCTION_ON_INCREMENTAL) {
              this.reduceTrees(), this.graphManager.resetAllNodesToApplyGravitation();
              var s = new Set(this.getAllNodes()), y = this.nodesWithGravity.filter(function(v) {
                return s.has(v);
              });
              this.graphManager.setAllNodesToApplyGravitation(y);
            }
          } else {
            var m = this.getFlatForest();
            if (m.length > 0) this.positionNodesRadially(m);
            else {
              this.reduceTrees(), this.graphManager.resetAllNodesToApplyGravitation();
              var s = new Set(this.getAllNodes()), y = this.nodesWithGravity.filter(function(M) {
                return s.has(M);
              });
              this.graphManager.setAllNodesToApplyGravitation(y), this.positionNodesRandomly();
            }
          }
          return Object.keys(this.constraints).length > 0 && (u.handleConstraints(this), this.initConstraintVariables()), this.initSpringEmbedder(), l.APPLY_LAYOUT && this.runSpringEmbedder(), true;
        }, O.prototype.tick = function() {
          if (this.totalIterations++, this.totalIterations === this.maxIterations && !this.isTreeGrowing && !this.isGrowthFinished) if (this.prunedNodesAll.length > 0) this.isTreeGrowing = true;
          else return true;
          if (this.totalIterations % d.CONVERGENCE_CHECK_PERIOD == 0 && !this.isTreeGrowing && !this.isGrowthFinished) {
            if (this.isConverged()) if (this.prunedNodesAll.length > 0) this.isTreeGrowing = true;
            else return true;
            this.coolingCycle++, this.layoutQuality == 0 ? this.coolingAdjuster = this.coolingCycle : this.layoutQuality == 1 && (this.coolingAdjuster = this.coolingCycle / 3), this.coolingFactor = Math.max(this.initialCoolingFactor - Math.pow(this.coolingCycle, Math.log(100 * (this.initialCoolingFactor - this.finalTemperature)) / Math.log(this.maxCoolingCycle)) / 100 * this.coolingAdjuster, this.finalTemperature), this.animationPeriod = Math.ceil(this.initialAnimationPeriod * Math.sqrt(this.coolingFactor));
          }
          if (this.isTreeGrowing) {
            if (this.growTreeIterations % 10 == 0) if (this.prunedNodesAll.length > 0) {
              this.graphManager.updateBounds(), this.updateGrid(), this.growTree(this.prunedNodesAll), this.graphManager.resetAllNodesToApplyGravitation();
              var s = new Set(this.getAllNodes()), y = this.nodesWithGravity.filter(function(p) {
                return s.has(p);
              });
              this.graphManager.setAllNodesToApplyGravitation(y), this.graphManager.updateBounds(), this.updateGrid(), l.PURE_INCREMENTAL ? this.coolingFactor = d.DEFAULT_COOLING_FACTOR_INCREMENTAL / 2 : this.coolingFactor = d.DEFAULT_COOLING_FACTOR_INCREMENTAL;
            } else this.isTreeGrowing = false, this.isGrowthFinished = true;
            this.growTreeIterations++;
          }
          if (this.isGrowthFinished) {
            if (this.isConverged()) return true;
            this.afterGrowthIterations % 10 == 0 && (this.graphManager.updateBounds(), this.updateGrid()), l.PURE_INCREMENTAL ? this.coolingFactor = d.DEFAULT_COOLING_FACTOR_INCREMENTAL / 2 * ((100 - this.afterGrowthIterations) / 100) : this.coolingFactor = d.DEFAULT_COOLING_FACTOR_INCREMENTAL * ((100 - this.afterGrowthIterations) / 100), this.afterGrowthIterations++;
          }
          var m = !this.isTreeGrowing && !this.isGrowthFinished, v = this.growTreeIterations % 10 == 1 && this.isTreeGrowing || this.afterGrowthIterations % 10 == 1 && this.isGrowthFinished;
          return this.totalDisplacement = 0, this.graphManager.updateBounds(), this.calcSpringForces(), this.calcRepulsionForces(m, v), this.calcGravitationalForces(), this.moveNodes(), this.animate(), false;
        }, O.prototype.getPositionsData = function() {
          for (var s = this.graphManager.getAllNodes(), y = {}, m = 0; m < s.length; m++) {
            var v = s[m].rect, p = s[m].id;
            y[p] = { id: p, x: v.getCenterX(), y: v.getCenterY(), w: v.width, h: v.height };
          }
          return y;
        }, O.prototype.runSpringEmbedder = function() {
          this.initialAnimationPeriod = 25, this.animationPeriod = this.initialAnimationPeriod;
          var s = false;
          if (d.ANIMATE === "during") this.emit("layoutstarted");
          else {
            for (; !s; ) s = this.tick();
            this.graphManager.updateBounds();
          }
        }, O.prototype.moveNodes = function() {
          for (var s = this.getAllNodes(), y, m = 0; m < s.length; m++) y = s[m], y.calculateDisplacement();
          Object.keys(this.constraints).length > 0 && this.updateDisplacements();
          for (var m = 0; m < s.length; m++) y = s[m], y.move();
        }, O.prototype.initConstraintVariables = function() {
          var s = this;
          this.idToNodeMap = /* @__PURE__ */ new Map(), this.fixedNodeSet = /* @__PURE__ */ new Set();
          for (var y = this.graphManager.getAllNodes(), m = 0; m < y.length; m++) {
            var v = y[m];
            this.idToNodeMap.set(v.id, v);
          }
          var p = w(function R(S) {
            for (var J = S.getChild().getNodes(), it, ut = 0, Ct = 0; Ct < J.length; Ct++) it = J[Ct], it.getChild() == null ? s.fixedNodeSet.has(it.id) && (ut += 100) : ut += R(it);
            return ut;
          }, "calculateCompoundWeight");
          if (this.constraints.fixedNodeConstraint) {
            this.constraints.fixedNodeConstraint.forEach(function(R) {
              s.fixedNodeSet.add(R.nodeId);
            });
            for (var y = this.graphManager.getAllNodes(), v, m = 0; m < y.length; m++) if (v = y[m], v.getChild() != null) {
              var M = p(v);
              M > 0 && (v.fixedNodeWeight = M);
            }
          }
          if (this.constraints.relativePlacementConstraint) {
            var x = /* @__PURE__ */ new Map(), b = /* @__PURE__ */ new Map();
            if (this.dummyToNodeForVerticalAlignment = /* @__PURE__ */ new Map(), this.dummyToNodeForHorizontalAlignment = /* @__PURE__ */ new Map(), this.fixedNodesOnHorizontal = /* @__PURE__ */ new Set(), this.fixedNodesOnVertical = /* @__PURE__ */ new Set(), this.fixedNodeSet.forEach(function(R) {
              s.fixedNodesOnHorizontal.add(R), s.fixedNodesOnVertical.add(R);
            }), this.constraints.alignmentConstraint) {
              if (this.constraints.alignmentConstraint.vertical) for (var U = this.constraints.alignmentConstraint.vertical, m = 0; m < U.length; m++) this.dummyToNodeForVerticalAlignment.set("dummy" + m, []), U[m].forEach(function(S) {
                x.set(S, "dummy" + m), s.dummyToNodeForVerticalAlignment.get("dummy" + m).push(S), s.fixedNodeSet.has(S) && s.fixedNodesOnHorizontal.add("dummy" + m);
              });
              if (this.constraints.alignmentConstraint.horizontal) for (var X = this.constraints.alignmentConstraint.horizontal, m = 0; m < X.length; m++) this.dummyToNodeForHorizontalAlignment.set("dummy" + m, []), X[m].forEach(function(S) {
                b.set(S, "dummy" + m), s.dummyToNodeForHorizontalAlignment.get("dummy" + m).push(S), s.fixedNodeSet.has(S) && s.fixedNodesOnVertical.add("dummy" + m);
              });
            }
            if (l.RELAX_MOVEMENT_ON_CONSTRAINTS) this.shuffle = function(R) {
              var S, J, it;
              for (it = R.length - 1; it >= 2 * R.length / 3; it--) S = Math.floor(Math.random() * (it + 1)), J = R[it], R[it] = R[S], R[S] = J;
              return R;
            }, this.nodesInRelativeHorizontal = [], this.nodesInRelativeVertical = [], this.nodeToRelativeConstraintMapHorizontal = /* @__PURE__ */ new Map(), this.nodeToRelativeConstraintMapVertical = /* @__PURE__ */ new Map(), this.nodeToTempPositionMapHorizontal = /* @__PURE__ */ new Map(), this.nodeToTempPositionMapVertical = /* @__PURE__ */ new Map(), this.constraints.relativePlacementConstraint.forEach(function(R) {
              if (R.left) {
                var S = x.has(R.left) ? x.get(R.left) : R.left, J = x.has(R.right) ? x.get(R.right) : R.right;
                s.nodesInRelativeHorizontal.includes(S) || (s.nodesInRelativeHorizontal.push(S), s.nodeToRelativeConstraintMapHorizontal.set(S, []), s.dummyToNodeForVerticalAlignment.has(S) ? s.nodeToTempPositionMapHorizontal.set(S, s.idToNodeMap.get(s.dummyToNodeForVerticalAlignment.get(S)[0]).getCenterX()) : s.nodeToTempPositionMapHorizontal.set(S, s.idToNodeMap.get(S).getCenterX())), s.nodesInRelativeHorizontal.includes(J) || (s.nodesInRelativeHorizontal.push(J), s.nodeToRelativeConstraintMapHorizontal.set(J, []), s.dummyToNodeForVerticalAlignment.has(J) ? s.nodeToTempPositionMapHorizontal.set(J, s.idToNodeMap.get(s.dummyToNodeForVerticalAlignment.get(J)[0]).getCenterX()) : s.nodeToTempPositionMapHorizontal.set(J, s.idToNodeMap.get(J).getCenterX())), s.nodeToRelativeConstraintMapHorizontal.get(S).push({ right: J, gap: R.gap }), s.nodeToRelativeConstraintMapHorizontal.get(J).push({ left: S, gap: R.gap });
              } else {
                var it = b.has(R.top) ? b.get(R.top) : R.top, ut = b.has(R.bottom) ? b.get(R.bottom) : R.bottom;
                s.nodesInRelativeVertical.includes(it) || (s.nodesInRelativeVertical.push(it), s.nodeToRelativeConstraintMapVertical.set(it, []), s.dummyToNodeForHorizontalAlignment.has(it) ? s.nodeToTempPositionMapVertical.set(it, s.idToNodeMap.get(s.dummyToNodeForHorizontalAlignment.get(it)[0]).getCenterY()) : s.nodeToTempPositionMapVertical.set(it, s.idToNodeMap.get(it).getCenterY())), s.nodesInRelativeVertical.includes(ut) || (s.nodesInRelativeVertical.push(ut), s.nodeToRelativeConstraintMapVertical.set(ut, []), s.dummyToNodeForHorizontalAlignment.has(ut) ? s.nodeToTempPositionMapVertical.set(ut, s.idToNodeMap.get(s.dummyToNodeForHorizontalAlignment.get(ut)[0]).getCenterY()) : s.nodeToTempPositionMapVertical.set(ut, s.idToNodeMap.get(ut).getCenterY())), s.nodeToRelativeConstraintMapVertical.get(it).push({ bottom: ut, gap: R.gap }), s.nodeToRelativeConstraintMapVertical.get(ut).push({ top: it, gap: R.gap });
              }
            });
            else {
              var W = /* @__PURE__ */ new Map(), j = /* @__PURE__ */ new Map();
              this.constraints.relativePlacementConstraint.forEach(function(R) {
                if (R.left) {
                  var S = x.has(R.left) ? x.get(R.left) : R.left, J = x.has(R.right) ? x.get(R.right) : R.right;
                  W.has(S) ? W.get(S).push(J) : W.set(S, [J]), W.has(J) ? W.get(J).push(S) : W.set(J, [S]);
                } else {
                  var it = b.has(R.top) ? b.get(R.top) : R.top, ut = b.has(R.bottom) ? b.get(R.bottom) : R.bottom;
                  j.has(it) ? j.get(it).push(ut) : j.set(it, [ut]), j.has(ut) ? j.get(ut).push(it) : j.set(ut, [it]);
                }
              });
              var z = w(function(R, S) {
                var J = [], it = [], ut = new q(), Ct = /* @__PURE__ */ new Set(), bt = 0;
                return R.forEach(function(G, rt) {
                  if (!Ct.has(rt)) {
                    J[bt] = [], it[bt] = false;
                    var ht = rt;
                    for (ut.push(ht), Ct.add(ht), J[bt].push(ht); ut.length != 0; ) {
                      ht = ut.shift(), S.has(ht) && (it[bt] = true);
                      var mt = R.get(ht);
                      mt.forEach(function(Lt) {
                        Ct.has(Lt) || (ut.push(Lt), Ct.add(Lt), J[bt].push(Lt));
                      });
                    }
                    bt++;
                  }
                }), { components: J, isFixed: it };
              }, "constructComponents"), K = z(W, s.fixedNodesOnHorizontal);
              this.componentsOnHorizontal = K.components, this.fixedComponentsOnHorizontal = K.isFixed;
              var P = z(j, s.fixedNodesOnVertical);
              this.componentsOnVertical = P.components, this.fixedComponentsOnVertical = P.isFixed;
            }
          }
        }, O.prototype.updateDisplacements = function() {
          var s = this;
          if (this.constraints.fixedNodeConstraint && this.constraints.fixedNodeConstraint.forEach(function(P) {
            var R = s.idToNodeMap.get(P.nodeId);
            R.displacementX = 0, R.displacementY = 0;
          }), this.constraints.alignmentConstraint) {
            if (this.constraints.alignmentConstraint.vertical) for (var y = this.constraints.alignmentConstraint.vertical, m = 0; m < y.length; m++) {
              for (var v = 0, p = 0; p < y[m].length; p++) {
                if (this.fixedNodeSet.has(y[m][p])) {
                  v = 0;
                  break;
                }
                v += this.idToNodeMap.get(y[m][p]).displacementX;
              }
              for (var M = v / y[m].length, p = 0; p < y[m].length; p++) this.idToNodeMap.get(y[m][p]).displacementX = M;
            }
            if (this.constraints.alignmentConstraint.horizontal) for (var x = this.constraints.alignmentConstraint.horizontal, m = 0; m < x.length; m++) {
              for (var b = 0, p = 0; p < x[m].length; p++) {
                if (this.fixedNodeSet.has(x[m][p])) {
                  b = 0;
                  break;
                }
                b += this.idToNodeMap.get(x[m][p]).displacementY;
              }
              for (var U = b / x[m].length, p = 0; p < x[m].length; p++) this.idToNodeMap.get(x[m][p]).displacementY = U;
            }
          }
          if (this.constraints.relativePlacementConstraint) if (l.RELAX_MOVEMENT_ON_CONSTRAINTS) this.totalIterations % 10 == 0 && (this.shuffle(this.nodesInRelativeHorizontal), this.shuffle(this.nodesInRelativeVertical)), this.nodesInRelativeHorizontal.forEach(function(P) {
            if (!s.fixedNodesOnHorizontal.has(P)) {
              var R = 0;
              s.dummyToNodeForVerticalAlignment.has(P) ? R = s.idToNodeMap.get(s.dummyToNodeForVerticalAlignment.get(P)[0]).displacementX : R = s.idToNodeMap.get(P).displacementX, s.nodeToRelativeConstraintMapHorizontal.get(P).forEach(function(S) {
                if (S.right) {
                  var J = s.nodeToTempPositionMapHorizontal.get(S.right) - s.nodeToTempPositionMapHorizontal.get(P) - R;
                  J < S.gap && (R -= S.gap - J);
                } else {
                  var J = s.nodeToTempPositionMapHorizontal.get(P) - s.nodeToTempPositionMapHorizontal.get(S.left) + R;
                  J < S.gap && (R += S.gap - J);
                }
              }), s.nodeToTempPositionMapHorizontal.set(P, s.nodeToTempPositionMapHorizontal.get(P) + R), s.dummyToNodeForVerticalAlignment.has(P) ? s.dummyToNodeForVerticalAlignment.get(P).forEach(function(S) {
                s.idToNodeMap.get(S).displacementX = R;
              }) : s.idToNodeMap.get(P).displacementX = R;
            }
          }), this.nodesInRelativeVertical.forEach(function(P) {
            if (!s.fixedNodesOnHorizontal.has(P)) {
              var R = 0;
              s.dummyToNodeForHorizontalAlignment.has(P) ? R = s.idToNodeMap.get(s.dummyToNodeForHorizontalAlignment.get(P)[0]).displacementY : R = s.idToNodeMap.get(P).displacementY, s.nodeToRelativeConstraintMapVertical.get(P).forEach(function(S) {
                if (S.bottom) {
                  var J = s.nodeToTempPositionMapVertical.get(S.bottom) - s.nodeToTempPositionMapVertical.get(P) - R;
                  J < S.gap && (R -= S.gap - J);
                } else {
                  var J = s.nodeToTempPositionMapVertical.get(P) - s.nodeToTempPositionMapVertical.get(S.top) + R;
                  J < S.gap && (R += S.gap - J);
                }
              }), s.nodeToTempPositionMapVertical.set(P, s.nodeToTempPositionMapVertical.get(P) + R), s.dummyToNodeForHorizontalAlignment.has(P) ? s.dummyToNodeForHorizontalAlignment.get(P).forEach(function(S) {
                s.idToNodeMap.get(S).displacementY = R;
              }) : s.idToNodeMap.get(P).displacementY = R;
            }
          });
          else {
            for (var m = 0; m < this.componentsOnHorizontal.length; m++) {
              var X = this.componentsOnHorizontal[m];
              if (this.fixedComponentsOnHorizontal[m]) for (var p = 0; p < X.length; p++) this.dummyToNodeForVerticalAlignment.has(X[p]) ? this.dummyToNodeForVerticalAlignment.get(X[p]).forEach(function(S) {
                s.idToNodeMap.get(S).displacementX = 0;
              }) : this.idToNodeMap.get(X[p]).displacementX = 0;
              else {
                for (var W = 0, j = 0, p = 0; p < X.length; p++) if (this.dummyToNodeForVerticalAlignment.has(X[p])) {
                  var z = this.dummyToNodeForVerticalAlignment.get(X[p]);
                  W += z.length * this.idToNodeMap.get(z[0]).displacementX, j += z.length;
                } else W += this.idToNodeMap.get(X[p]).displacementX, j++;
                for (var K = W / j, p = 0; p < X.length; p++) this.dummyToNodeForVerticalAlignment.has(X[p]) ? this.dummyToNodeForVerticalAlignment.get(X[p]).forEach(function(S) {
                  s.idToNodeMap.get(S).displacementX = K;
                }) : this.idToNodeMap.get(X[p]).displacementX = K;
              }
            }
            for (var m = 0; m < this.componentsOnVertical.length; m++) {
              var X = this.componentsOnVertical[m];
              if (this.fixedComponentsOnVertical[m]) for (var p = 0; p < X.length; p++) this.dummyToNodeForHorizontalAlignment.has(X[p]) ? this.dummyToNodeForHorizontalAlignment.get(X[p]).forEach(function(J) {
                s.idToNodeMap.get(J).displacementY = 0;
              }) : this.idToNodeMap.get(X[p]).displacementY = 0;
              else {
                for (var W = 0, j = 0, p = 0; p < X.length; p++) if (this.dummyToNodeForHorizontalAlignment.has(X[p])) {
                  var z = this.dummyToNodeForHorizontalAlignment.get(X[p]);
                  W += z.length * this.idToNodeMap.get(z[0]).displacementY, j += z.length;
                } else W += this.idToNodeMap.get(X[p]).displacementY, j++;
                for (var K = W / j, p = 0; p < X.length; p++) this.dummyToNodeForHorizontalAlignment.has(X[p]) ? this.dummyToNodeForHorizontalAlignment.get(X[p]).forEach(function(it) {
                  s.idToNodeMap.get(it).displacementY = K;
                }) : this.idToNodeMap.get(X[p]).displacementY = K;
              }
            }
          }
        }, O.prototype.calculateNodesToApplyGravitationTo = function() {
          var s = [], y, m = this.graphManager.getGraphs(), v = m.length, p;
          for (p = 0; p < v; p++) y = m[p], y.updateConnected(), y.isConnected || (s = s.concat(y.getNodes()));
          return s;
        }, O.prototype.createBendpoints = function() {
          var s = [];
          s = s.concat(this.graphManager.getAllEdges());
          var y = /* @__PURE__ */ new Set(), m;
          for (m = 0; m < s.length; m++) {
            var v = s[m];
            if (!y.has(v)) {
              var p = v.getSource(), M = v.getTarget();
              if (p == M) v.getBendpoints().push(new E()), v.getBendpoints().push(new E()), this.createDummyNodesForBendpoints(v), y.add(v);
              else {
                var x = [];
                if (x = x.concat(p.getEdgeListToNode(M)), x = x.concat(M.getEdgeListToNode(p)), !y.has(x[0])) {
                  if (x.length > 1) {
                    var b;
                    for (b = 0; b < x.length; b++) {
                      var U = x[b];
                      U.getBendpoints().push(new E()), this.createDummyNodesForBendpoints(U);
                    }
                  }
                  x.forEach(function(X) {
                    y.add(X);
                  });
                }
              }
            }
            if (y.size == s.length) break;
          }
        }, O.prototype.positionNodesRadially = function(s) {
          for (var y = new g(0, 0), m = Math.ceil(Math.sqrt(s.length)), v = 0, p = 0, M = 0, x = new E(0, 0), b = 0; b < s.length; b++) {
            b % m == 0 && (M = 0, p = v, b != 0 && (p += l.DEFAULT_COMPONENT_SEPERATION), v = 0);
            var U = s[b], X = C.findCenterOfTree(U);
            y.x = M, y.y = p, x = O.radialLayout(U, X, y), x.y > v && (v = Math.floor(x.y)), M = Math.floor(x.x + l.DEFAULT_COMPONENT_SEPERATION);
          }
          this.transform(new E(N.WORLD_CENTER_X - x.x / 2, N.WORLD_CENTER_Y - x.y / 2));
        }, O.radialLayout = function(s, y, m) {
          var v = Math.max(this.maxDiagonalInTree(s), l.DEFAULT_RADIAL_SEPARATION);
          O.branchRadialLayout(y, null, 0, 359, 0, v);
          var p = V.calculateBounds(s), M = new B();
          M.setDeviceOrgX(p.getMinX()), M.setDeviceOrgY(p.getMinY()), M.setWorldOrgX(m.x), M.setWorldOrgY(m.y);
          for (var x = 0; x < s.length; x++) {
            var b = s[x];
            b.transform(M);
          }
          var U = new E(p.getMaxX(), p.getMaxY());
          return M.inverseTransformPoint(U);
        }, O.branchRadialLayout = function(s, y, m, v, p, M) {
          var x = (v - m + 1) / 2;
          x < 0 && (x += 180);
          var b = (x + m) % 360, U = b * Y.TWO_PI / 360, X = p * Math.cos(U), W = p * Math.sin(U);
          s.setCenter(X, W);
          var j = [];
          j = j.concat(s.getEdges());
          var z = j.length;
          y != null && z--;
          for (var K = 0, P = j.length, R, S = s.getEdgesBetween(y); S.length > 1; ) {
            var J = S[0];
            S.splice(0, 1);
            var it = j.indexOf(J);
            it >= 0 && j.splice(it, 1), P--, z--;
          }
          y != null ? R = (j.indexOf(S[0]) + 1) % P : R = 0;
          for (var ut = Math.abs(v - m) / z, Ct = R; K != z; Ct = ++Ct % P) {
            var bt = j[Ct].getOtherEnd(s);
            if (bt != y) {
              var G = (m + K * ut) % 360, rt = (G + ut) % 360;
              O.branchRadialLayout(bt, s, G, rt, p + M, M), K++;
            }
          }
        }, O.maxDiagonalInTree = function(s) {
          for (var y = k.MIN_VALUE, m = 0; m < s.length; m++) {
            var v = s[m], p = v.getDiagonal();
            p > y && (y = p);
          }
          return y;
        }, O.prototype.calcRepulsionRange = function() {
          return 2 * (this.level + 1) * this.idealEdgeLength;
        }, O.prototype.groupZeroDegreeMembers = function() {
          var s = this, y = {};
          this.memberGroups = {}, this.idToDummyNode = {};
          for (var m = [], v = this.graphManager.getAllNodes(), p = 0; p < v.length; p++) {
            var M = v[p], x = M.getParent();
            this.getNodeDegreeWithChildren(M) === 0 && (x.id == null || !this.getToBeTiled(x)) && m.push(M);
          }
          for (var p = 0; p < m.length; p++) {
            var M = m[p], b = M.getParent().id;
            typeof y[b] > "u" && (y[b] = []), y[b] = y[b].concat(M);
          }
          Object.keys(y).forEach(function(U) {
            if (y[U].length > 1) {
              var X = "DummyCompound_" + U;
              s.memberGroups[X] = y[U];
              var W = y[U][0].getParent(), j = new o(s.graphManager);
              j.id = X, j.paddingLeft = W.paddingLeft || 0, j.paddingRight = W.paddingRight || 0, j.paddingBottom = W.paddingBottom || 0, j.paddingTop = W.paddingTop || 0, s.idToDummyNode[X] = j;
              var z = s.getGraphManager().add(s.newGraph(), j), K = W.getChild();
              K.add(j);
              for (var P = 0; P < y[U].length; P++) {
                var R = y[U][P];
                K.remove(R), z.add(R);
              }
            }
          });
        }, O.prototype.clearCompounds = function() {
          var s = {}, y = {};
          this.performDFSOnCompounds();
          for (var m = 0; m < this.compoundOrder.length; m++) y[this.compoundOrder[m].id] = this.compoundOrder[m], s[this.compoundOrder[m].id] = [].concat(this.compoundOrder[m].getChild().getNodes()), this.graphManager.remove(this.compoundOrder[m].getChild()), this.compoundOrder[m].child = null;
          this.graphManager.resetAllNodes(), this.tileCompoundMembers(s, y);
        }, O.prototype.clearZeroDegreeMembers = function() {
          var s = this, y = this.tiledZeroDegreePack = [];
          Object.keys(this.memberGroups).forEach(function(m) {
            var v = s.idToDummyNode[m];
            if (y[m] = s.tileNodes(s.memberGroups[m], v.paddingLeft + v.paddingRight), v.rect.width = y[m].width, v.rect.height = y[m].height, v.setCenter(y[m].centerX, y[m].centerY), v.labelMarginLeft = 0, v.labelMarginTop = 0, l.NODE_DIMENSIONS_INCLUDE_LABELS) {
              var p = v.rect.width, M = v.rect.height;
              v.labelWidth && (v.labelPosHorizontal == "left" ? (v.rect.x -= v.labelWidth, v.setWidth(p + v.labelWidth), v.labelMarginLeft = v.labelWidth) : v.labelPosHorizontal == "center" && v.labelWidth > p ? (v.rect.x -= (v.labelWidth - p) / 2, v.setWidth(v.labelWidth), v.labelMarginLeft = (v.labelWidth - p) / 2) : v.labelPosHorizontal == "right" && v.setWidth(p + v.labelWidth)), v.labelHeight && (v.labelPosVertical == "top" ? (v.rect.y -= v.labelHeight, v.setHeight(M + v.labelHeight), v.labelMarginTop = v.labelHeight) : v.labelPosVertical == "center" && v.labelHeight > M ? (v.rect.y -= (v.labelHeight - M) / 2, v.setHeight(v.labelHeight), v.labelMarginTop = (v.labelHeight - M) / 2) : v.labelPosVertical == "bottom" && v.setHeight(M + v.labelHeight));
            }
          });
        }, O.prototype.repopulateCompounds = function() {
          for (var s = this.compoundOrder.length - 1; s >= 0; s--) {
            var y = this.compoundOrder[s], m = y.id, v = y.paddingLeft, p = y.paddingTop, M = y.labelMarginLeft, x = y.labelMarginTop;
            this.adjustLocations(this.tiledMemberPack[m], y.rect.x, y.rect.y, v, p, M, x);
          }
        }, O.prototype.repopulateZeroDegreeMembers = function() {
          var s = this, y = this.tiledZeroDegreePack;
          Object.keys(y).forEach(function(m) {
            var v = s.idToDummyNode[m], p = v.paddingLeft, M = v.paddingTop, x = v.labelMarginLeft, b = v.labelMarginTop;
            s.adjustLocations(y[m], v.rect.x, v.rect.y, p, M, x, b);
          });
        }, O.prototype.getToBeTiled = function(s) {
          var y = s.id;
          if (this.toBeTiled[y] != null) return this.toBeTiled[y];
          var m = s.getChild();
          if (m == null) return this.toBeTiled[y] = false, false;
          for (var v = m.getNodes(), p = 0; p < v.length; p++) {
            var M = v[p];
            if (this.getNodeDegree(M) > 0) return this.toBeTiled[y] = false, false;
            if (M.getChild() == null) {
              this.toBeTiled[M.id] = false;
              continue;
            }
            if (!this.getToBeTiled(M)) return this.toBeTiled[y] = false, false;
          }
          return this.toBeTiled[y] = true, true;
        }, O.prototype.getNodeDegree = function(s) {
          for (var y = s.id, m = s.getEdges(), v = 0, p = 0; p < m.length; p++) {
            var M = m[p];
            M.getSource().id !== M.getTarget().id && (v = v + 1);
          }
          return v;
        }, O.prototype.getNodeDegreeWithChildren = function(s) {
          var y = this.getNodeDegree(s);
          if (s.getChild() == null) return y;
          for (var m = s.getChild().getNodes(), v = 0; v < m.length; v++) {
            var p = m[v];
            y += this.getNodeDegreeWithChildren(p);
          }
          return y;
        }, O.prototype.performDFSOnCompounds = function() {
          this.compoundOrder = [], this.fillCompexOrderByDFS(this.graphManager.getRoot().getNodes());
        }, O.prototype.fillCompexOrderByDFS = function(s) {
          for (var y = 0; y < s.length; y++) {
            var m = s[y];
            m.getChild() != null && this.fillCompexOrderByDFS(m.getChild().getNodes()), this.getToBeTiled(m) && this.compoundOrder.push(m);
          }
        }, O.prototype.adjustLocations = function(s, y, m, v, p, M, x) {
          y += v + M, m += p + x;
          for (var b = y, U = 0; U < s.rows.length; U++) {
            var X = s.rows[U];
            y = b;
            for (var W = 0, j = 0; j < X.length; j++) {
              var z = X[j];
              z.rect.x = y, z.rect.y = m, y += z.rect.width + s.horizontalPadding, z.rect.height > W && (W = z.rect.height);
            }
            m += W + s.verticalPadding;
          }
        }, O.prototype.tileCompoundMembers = function(s, y) {
          var m = this;
          this.tiledMemberPack = [], Object.keys(s).forEach(function(v) {
            var p = y[v];
            if (m.tiledMemberPack[v] = m.tileNodes(s[v], p.paddingLeft + p.paddingRight), p.rect.width = m.tiledMemberPack[v].width, p.rect.height = m.tiledMemberPack[v].height, p.setCenter(m.tiledMemberPack[v].centerX, m.tiledMemberPack[v].centerY), p.labelMarginLeft = 0, p.labelMarginTop = 0, l.NODE_DIMENSIONS_INCLUDE_LABELS) {
              var M = p.rect.width, x = p.rect.height;
              p.labelWidth && (p.labelPosHorizontal == "left" ? (p.rect.x -= p.labelWidth, p.setWidth(M + p.labelWidth), p.labelMarginLeft = p.labelWidth) : p.labelPosHorizontal == "center" && p.labelWidth > M ? (p.rect.x -= (p.labelWidth - M) / 2, p.setWidth(p.labelWidth), p.labelMarginLeft = (p.labelWidth - M) / 2) : p.labelPosHorizontal == "right" && p.setWidth(M + p.labelWidth)), p.labelHeight && (p.labelPosVertical == "top" ? (p.rect.y -= p.labelHeight, p.setHeight(x + p.labelHeight), p.labelMarginTop = p.labelHeight) : p.labelPosVertical == "center" && p.labelHeight > x ? (p.rect.y -= (p.labelHeight - x) / 2, p.setHeight(p.labelHeight), p.labelMarginTop = (p.labelHeight - x) / 2) : p.labelPosVertical == "bottom" && p.setHeight(x + p.labelHeight));
            }
          });
        }, O.prototype.tileNodes = function(s, y) {
          var m = this.tileNodesByFavoringDim(s, y, true), v = this.tileNodesByFavoringDim(s, y, false), p = this.getOrgRatio(m), M = this.getOrgRatio(v), x;
          return M < p ? x = v : x = m, x;
        }, O.prototype.getOrgRatio = function(s) {
          var y = s.width, m = s.height, v = y / m;
          return v < 1 && (v = 1 / v), v;
        }, O.prototype.calcIdealRowWidth = function(s, y) {
          var m = l.TILING_PADDING_VERTICAL, v = l.TILING_PADDING_HORIZONTAL, p = s.length, M = 0, x = 0, b = 0;
          s.forEach(function(P) {
            M += P.getWidth(), x += P.getHeight(), P.getWidth() > b && (b = P.getWidth());
          });
          var U = M / p, X = x / p, W = Math.pow(m - v, 2) + 4 * (U + v) * (X + m) * p, j = (v - m + Math.sqrt(W)) / (2 * (U + v)), z;
          y ? (z = Math.ceil(j), z == j && z++) : z = Math.floor(j);
          var K = z * (U + v) - v;
          return b > K && (K = b), K += v * 2, K;
        }, O.prototype.tileNodesByFavoringDim = function(s, y, m) {
          var v = l.TILING_PADDING_VERTICAL, p = l.TILING_PADDING_HORIZONTAL, M = l.TILING_COMPARE_BY, x = { rows: [], rowWidth: [], rowHeight: [], width: 0, height: y, verticalPadding: v, horizontalPadding: p, centerX: 0, centerY: 0 };
          M && (x.idealRowWidth = this.calcIdealRowWidth(s, m));
          var b = w(function(P) {
            return P.rect.width * P.rect.height;
          }, "getNodeArea"), U = w(function(P, R) {
            return b(R) - b(P);
          }, "areaCompareFcn");
          s.sort(function(P, R) {
            var S = U;
            return x.idealRowWidth ? (S = M, S(P.id, R.id)) : S(P, R);
          });
          for (var X = 0, W = 0, j = 0; j < s.length; j++) {
            var z = s[j];
            X += z.getCenterX(), W += z.getCenterY();
          }
          x.centerX = X / s.length, x.centerY = W / s.length;
          for (var j = 0; j < s.length; j++) {
            var z = s[j];
            if (x.rows.length == 0) this.insertNodeToRow(x, z, 0, y);
            else if (this.canAddHorizontal(x, z.rect.width, z.rect.height)) {
              var K = x.rows.length - 1;
              x.idealRowWidth || (K = this.getShortestRowIndex(x)), this.insertNodeToRow(x, z, K, y);
            } else this.insertNodeToRow(x, z, x.rows.length, y);
            this.shiftToLastRow(x);
          }
          return x;
        }, O.prototype.insertNodeToRow = function(s, y, m, v) {
          var p = v;
          if (m == s.rows.length) {
            var M = [];
            s.rows.push(M), s.rowWidth.push(p), s.rowHeight.push(0);
          }
          var x = s.rowWidth[m] + y.rect.width;
          s.rows[m].length > 0 && (x += s.horizontalPadding), s.rowWidth[m] = x, s.width < x && (s.width = x);
          var b = y.rect.height;
          m > 0 && (b += s.verticalPadding);
          var U = 0;
          b > s.rowHeight[m] && (U = s.rowHeight[m], s.rowHeight[m] = b, U = s.rowHeight[m] - U), s.height += U, s.rows[m].push(y);
        }, O.prototype.getShortestRowIndex = function(s) {
          for (var y = -1, m = Number.MAX_VALUE, v = 0; v < s.rows.length; v++) s.rowWidth[v] < m && (y = v, m = s.rowWidth[v]);
          return y;
        }, O.prototype.getLongestRowIndex = function(s) {
          for (var y = -1, m = Number.MIN_VALUE, v = 0; v < s.rows.length; v++) s.rowWidth[v] > m && (y = v, m = s.rowWidth[v]);
          return y;
        }, O.prototype.canAddHorizontal = function(s, y, m) {
          if (s.idealRowWidth) {
            var v = s.rows.length - 1, p = s.rowWidth[v];
            return p + y + s.horizontalPadding <= s.idealRowWidth;
          }
          var M = this.getShortestRowIndex(s);
          if (M < 0) return true;
          var x = s.rowWidth[M];
          if (x + s.horizontalPadding + y <= s.width) return true;
          var b = 0;
          s.rowHeight[M] < m && M > 0 && (b = m + s.verticalPadding - s.rowHeight[M]);
          var U;
          s.width - x >= y + s.horizontalPadding ? U = (s.height + b) / (x + y + s.horizontalPadding) : U = (s.height + b) / s.width, b = m + s.verticalPadding;
          var X;
          return s.width < y ? X = (s.height + b) / y : X = (s.height + b) / s.width, X < 1 && (X = 1 / X), U < 1 && (U = 1 / U), U < X;
        }, O.prototype.shiftToLastRow = function(s) {
          var y = this.getLongestRowIndex(s), m = s.rowWidth.length - 1, v = s.rows[y], p = v[v.length - 1], M = p.width + s.horizontalPadding;
          if (s.width - s.rowWidth[m] > M && y != m) {
            v.splice(-1, 1), s.rows[m].push(p), s.rowWidth[y] = s.rowWidth[y] - M, s.rowWidth[m] = s.rowWidth[m] + M, s.width = s.rowWidth[instance.getLongestRowIndex(s)];
            for (var x = Number.MIN_VALUE, b = 0; b < v.length; b++) v[b].height > x && (x = v[b].height);
            y > 0 && (x += s.verticalPadding);
            var U = s.rowHeight[y] + s.rowHeight[m];
            s.rowHeight[y] = x, s.rowHeight[m] < p.height + s.verticalPadding && (s.rowHeight[m] = p.height + s.verticalPadding);
            var X = s.rowHeight[y] + s.rowHeight[m];
            s.height += X - U, this.shiftToLastRow(s);
          }
        }, O.prototype.tilingPreLayout = function() {
          l.TILE && (this.groupZeroDegreeMembers(), this.clearCompounds(), this.clearZeroDegreeMembers());
        }, O.prototype.tilingPostLayout = function() {
          l.TILE && (this.repopulateZeroDegreeMembers(), this.repopulateCompounds());
        }, O.prototype.reduceTrees = function() {
          for (var s = [], y = true, m; y; ) {
            var v = this.graphManager.getAllNodes(), p = [];
            y = false;
            for (var M = 0; M < v.length; M++) if (m = v[M], m.getEdges().length == 1 && !m.getEdges()[0].isInterGraph && m.getChild() == null) {
              if (l.PURE_INCREMENTAL) {
                var x = m.getEdges()[0].getOtherEnd(m), b = new _(m.getCenterX() - x.getCenterX(), m.getCenterY() - x.getCenterY());
                p.push([m, m.getEdges()[0], m.getOwner(), b]);
              } else p.push([m, m.getEdges()[0], m.getOwner()]);
              y = true;
            }
            if (y == true) {
              for (var U = [], X = 0; X < p.length; X++) p[X][0].getEdges().length == 1 && (U.push(p[X]), p[X][0].getOwner().remove(p[X][0]));
              s.push(U), this.graphManager.resetAllNodes(), this.graphManager.resetAllEdges();
            }
          }
          this.prunedNodesAll = s;
        }, O.prototype.growTree = function(s) {
          for (var y = s.length, m = s[y - 1], v, p = 0; p < m.length; p++) v = m[p], this.findPlaceforPrunedNode(v), v[2].add(v[0]), v[2].add(v[1], v[1].source, v[1].target);
          s.splice(s.length - 1, 1), this.graphManager.resetAllNodes(), this.graphManager.resetAllEdges();
        }, O.prototype.findPlaceforPrunedNode = function(s) {
          var y, m, v = s[0];
          if (v == s[1].source ? m = s[1].target : m = s[1].source, l.PURE_INCREMENTAL) v.setCenter(m.getCenterX() + s[3].getWidth(), m.getCenterY() + s[3].getHeight());
          else {
            var p = m.startX, M = m.finishX, x = m.startY, b = m.finishY, U = 0, X = 0, W = 0, j = 0, z = [U, W, X, j];
            if (x > 0) for (var K = p; K <= M; K++) z[0] += this.grid[K][x - 1].length + this.grid[K][x].length - 1;
            if (M < this.grid.length - 1) for (var K = x; K <= b; K++) z[1] += this.grid[M + 1][K].length + this.grid[M][K].length - 1;
            if (b < this.grid[0].length - 1) for (var K = p; K <= M; K++) z[2] += this.grid[K][b + 1].length + this.grid[K][b].length - 1;
            if (p > 0) for (var K = x; K <= b; K++) z[3] += this.grid[p - 1][K].length + this.grid[p][K].length - 1;
            for (var P = k.MAX_VALUE, R, S, J = 0; J < z.length; J++) z[J] < P ? (P = z[J], R = 1, S = J) : z[J] == P && R++;
            if (R == 3 && P == 0) z[0] == 0 && z[1] == 0 && z[2] == 0 ? y = 1 : z[0] == 0 && z[1] == 0 && z[3] == 0 ? y = 0 : z[0] == 0 && z[2] == 0 && z[3] == 0 ? y = 3 : z[1] == 0 && z[2] == 0 && z[3] == 0 && (y = 2);
            else if (R == 2 && P == 0) {
              var it = Math.floor(Math.random() * 2);
              z[0] == 0 && z[1] == 0 ? it == 0 ? y = 0 : y = 1 : z[0] == 0 && z[2] == 0 ? it == 0 ? y = 0 : y = 2 : z[0] == 0 && z[3] == 0 ? it == 0 ? y = 0 : y = 3 : z[1] == 0 && z[2] == 0 ? it == 0 ? y = 1 : y = 2 : z[1] == 0 && z[3] == 0 ? it == 0 ? y = 1 : y = 3 : it == 0 ? y = 2 : y = 3;
            } else if (R == 4 && P == 0) {
              var it = Math.floor(Math.random() * 4);
              y = it;
            } else y = S;
            y == 0 ? v.setCenter(m.getCenterX(), m.getCenterY() - m.getHeight() / 2 - d.DEFAULT_EDGE_LENGTH - v.getHeight() / 2) : y == 1 ? v.setCenter(m.getCenterX() + m.getWidth() / 2 + d.DEFAULT_EDGE_LENGTH + v.getWidth() / 2, m.getCenterY()) : y == 2 ? v.setCenter(m.getCenterX(), m.getCenterY() + m.getHeight() / 2 + d.DEFAULT_EDGE_LENGTH + v.getHeight() / 2) : v.setCenter(m.getCenterX() - m.getWidth() / 2 - d.DEFAULT_EDGE_LENGTH - v.getWidth() / 2, m.getCenterY());
          }
        }, n.exports = O;
      }, 991: (n, i, e) => {
        var a = e(551).FDLayoutNode, r = e(551).IMath;
        function f(t, l, u, d) {
          a.call(this, t, l, u, d);
        }
        w(f, "CoSENode"), f.prototype = Object.create(a.prototype);
        for (var o in a) f[o] = a[o];
        f.prototype.calculateDisplacement = function() {
          var t = this.graphManager.getLayout();
          this.getChild() != null && this.fixedNodeWeight ? (this.displacementX += t.coolingFactor * (this.springForceX + this.repulsionForceX + this.gravitationForceX) / this.fixedNodeWeight, this.displacementY += t.coolingFactor * (this.springForceY + this.repulsionForceY + this.gravitationForceY) / this.fixedNodeWeight) : (this.displacementX += t.coolingFactor * (this.springForceX + this.repulsionForceX + this.gravitationForceX) / this.noOfChildren, this.displacementY += t.coolingFactor * (this.springForceY + this.repulsionForceY + this.gravitationForceY) / this.noOfChildren), Math.abs(this.displacementX) > t.coolingFactor * t.maxNodeDisplacement && (this.displacementX = t.coolingFactor * t.maxNodeDisplacement * r.sign(this.displacementX)), Math.abs(this.displacementY) > t.coolingFactor * t.maxNodeDisplacement && (this.displacementY = t.coolingFactor * t.maxNodeDisplacement * r.sign(this.displacementY)), this.child && this.child.getNodes().length > 0 && this.propogateDisplacementToChildren(this.displacementX, this.displacementY);
        }, f.prototype.propogateDisplacementToChildren = function(t, l) {
          for (var u = this.getChild().getNodes(), d, N = 0; N < u.length; N++) d = u[N], d.getChild() == null ? (d.displacementX += t, d.displacementY += l) : d.propogateDisplacementToChildren(t, l);
        }, f.prototype.move = function() {
          var t = this.graphManager.getLayout();
          (this.child == null || this.child.getNodes().length == 0) && (this.moveBy(this.displacementX, this.displacementY), t.totalDisplacement += Math.abs(this.displacementX) + Math.abs(this.displacementY)), this.springForceX = 0, this.springForceY = 0, this.repulsionForceX = 0, this.repulsionForceY = 0, this.gravitationForceX = 0, this.gravitationForceY = 0, this.displacementX = 0, this.displacementY = 0;
        }, f.prototype.setPred1 = function(t) {
          this.pred1 = t;
        }, f.prototype.getPred1 = function() {
          return pred1;
        }, f.prototype.getPred2 = function() {
          return pred2;
        }, f.prototype.setNext = function(t) {
          this.next = t;
        }, f.prototype.getNext = function() {
          return next;
        }, f.prototype.setProcessed = function(t) {
          this.processed = t;
        }, f.prototype.isProcessed = function() {
          return processed;
        }, n.exports = f;
      }, 902: (n, i, e) => {
        function a(u) {
          if (Array.isArray(u)) {
            for (var d = 0, N = Array(u.length); d < u.length; d++) N[d] = u[d];
            return N;
          } else return Array.from(u);
        }
        w(a, "_toConsumableArray");
        var r = e(806), f = e(551).LinkedList, o = e(551).Matrix, t = e(551).SVD;
        function l() {
        }
        w(l, "ConstraintHandler"), l.handleConstraints = function(u) {
          var d = {};
          d.fixedNodeConstraint = u.constraints.fixedNodeConstraint, d.alignmentConstraint = u.constraints.alignmentConstraint, d.relativePlacementConstraint = u.constraints.relativePlacementConstraint;
          for (var N = /* @__PURE__ */ new Map(), g = /* @__PURE__ */ new Map(), E = [], _ = [], C = u.getAllNodes(), k = 0, Y = 0; Y < C.length; Y++) {
            var V = C[Y];
            V.getChild() == null && (g.set(V.id, k++), E.push(V.getCenterX()), _.push(V.getCenterY()), N.set(V.id, V));
          }
          d.relativePlacementConstraint && d.relativePlacementConstraint.forEach(function(I) {
            !I.gap && I.gap != 0 && (I.left ? I.gap = r.DEFAULT_EDGE_LENGTH + N.get(I.left).getWidth() / 2 + N.get(I.right).getWidth() / 2 : I.gap = r.DEFAULT_EDGE_LENGTH + N.get(I.top).getHeight() / 2 + N.get(I.bottom).getHeight() / 2);
          });
          var B = w(function(I, D) {
            return { x: I.x - D.x, y: I.y - D.y };
          }, "calculatePositionDiff"), q = w(function(I) {
            var D = 0, $ = 0;
            return I.forEach(function(Z) {
              D += E[g.get(Z)], $ += _[g.get(Z)];
            }), { x: D / I.size, y: $ / I.size };
          }, "calculateAvgPosition"), O = w(function(I, D, $, Z, Q) {
            function pt(nt, at) {
              var ot = new Set(nt), Nt = true, ft = false, Mt = void 0;
              try {
                for (var Rt = at[Symbol.iterator](), Dt; !(Nt = (Dt = Rt.next()).done); Nt = true) {
                  var Bt = Dt.value;
                  ot.add(Bt);
                }
              } catch (Tt) {
                ft = true, Mt = Tt;
              } finally {
                try {
                  !Nt && Rt.return && Rt.return();
                } finally {
                  if (ft) throw Mt;
                }
              }
              return ot;
            }
            w(pt, "setUnion");
            var dt = /* @__PURE__ */ new Map();
            I.forEach(function(nt, at) {
              dt.set(at, 0);
            }), I.forEach(function(nt, at) {
              nt.forEach(function(ot) {
                dt.set(ot.id, dt.get(ot.id) + 1);
              });
            });
            var tt = /* @__PURE__ */ new Map(), ct = /* @__PURE__ */ new Map(), Et = new f();
            dt.forEach(function(nt, at) {
              nt == 0 ? (Et.push(at), $ || (D == "horizontal" ? tt.set(at, g.has(at) ? E[g.get(at)] : Z.get(at)) : tt.set(at, g.has(at) ? _[g.get(at)] : Z.get(at)))) : tt.set(at, Number.NEGATIVE_INFINITY), $ && ct.set(at, /* @__PURE__ */ new Set([at]));
            }), $ && Q.forEach(function(nt) {
              var at = [];
              if (nt.forEach(function(ft) {
                $.has(ft) && at.push(ft);
              }), at.length > 0) {
                var ot = 0;
                at.forEach(function(ft) {
                  D == "horizontal" ? (tt.set(ft, g.has(ft) ? E[g.get(ft)] : Z.get(ft)), ot += tt.get(ft)) : (tt.set(ft, g.has(ft) ? _[g.get(ft)] : Z.get(ft)), ot += tt.get(ft));
                }), ot = ot / at.length, nt.forEach(function(ft) {
                  $.has(ft) || tt.set(ft, ot);
                });
              } else {
                var Nt = 0;
                nt.forEach(function(ft) {
                  D == "horizontal" ? Nt += g.has(ft) ? E[g.get(ft)] : Z.get(ft) : Nt += g.has(ft) ? _[g.get(ft)] : Z.get(ft);
                }), Nt = Nt / nt.length, nt.forEach(function(ft) {
                  tt.set(ft, Nt);
                });
              }
            });
            for (var wt = w(function() {
              var nt = Et.shift(), at = I.get(nt);
              at.forEach(function(ot) {
                if (tt.get(ot.id) < tt.get(nt) + ot.gap) if ($ && $.has(ot.id)) {
                  var Nt = void 0;
                  if (D == "horizontal" ? Nt = g.has(ot.id) ? E[g.get(ot.id)] : Z.get(ot.id) : Nt = g.has(ot.id) ? _[g.get(ot.id)] : Z.get(ot.id), tt.set(ot.id, Nt), Nt < tt.get(nt) + ot.gap) {
                    var ft = tt.get(nt) + ot.gap - Nt;
                    ct.get(nt).forEach(function(Mt) {
                      tt.set(Mt, tt.get(Mt) - ft);
                    });
                  }
                } else tt.set(ot.id, tt.get(nt) + ot.gap);
                dt.set(ot.id, dt.get(ot.id) - 1), dt.get(ot.id) == 0 && Et.push(ot.id), $ && ct.set(ot.id, pt(ct.get(nt), ct.get(ot.id)));
              });
            }, "_loop"); Et.length != 0; ) wt();
            if ($) {
              var et = /* @__PURE__ */ new Set();
              I.forEach(function(nt, at) {
                nt.length == 0 && et.add(at);
              });
              var It = [];
              ct.forEach(function(nt, at) {
                if (et.has(at)) {
                  var ot = false, Nt = true, ft = false, Mt = void 0;
                  try {
                    for (var Rt = nt[Symbol.iterator](), Dt; !(Nt = (Dt = Rt.next()).done); Nt = true) {
                      var Bt = Dt.value;
                      $.has(Bt) && (ot = true);
                    }
                  } catch (Ft) {
                    ft = true, Mt = Ft;
                  } finally {
                    try {
                      !Nt && Rt.return && Rt.return();
                    } finally {
                      if (ft) throw Mt;
                    }
                  }
                  if (!ot) {
                    var Tt = false, At = void 0;
                    It.forEach(function(Ft, St) {
                      Ft.has([].concat(a(nt))[0]) && (Tt = true, At = St);
                    }), Tt ? nt.forEach(function(Ft) {
                      It[At].add(Ft);
                    }) : It.push(new Set(nt));
                  }
                }
              }), It.forEach(function(nt, at) {
                var ot = Number.POSITIVE_INFINITY, Nt = Number.POSITIVE_INFINITY, ft = Number.NEGATIVE_INFINITY, Mt = Number.NEGATIVE_INFINITY, Rt = true, Dt = false, Bt = void 0;
                try {
                  for (var Tt = nt[Symbol.iterator](), At; !(Rt = (At = Tt.next()).done); Rt = true) {
                    var Ft = At.value, St = void 0;
                    D == "horizontal" ? St = g.has(Ft) ? E[g.get(Ft)] : Z.get(Ft) : St = g.has(Ft) ? _[g.get(Ft)] : Z.get(Ft);
                    var zt = tt.get(Ft);
                    St < ot && (ot = St), St > ft && (ft = St), zt < Nt && (Nt = zt), zt > Mt && (Mt = zt);
                  }
                } catch (Jt) {
                  Dt = true, Bt = Jt;
                } finally {
                  try {
                    !Rt && Tt.return && Tt.return();
                  } finally {
                    if (Dt) throw Bt;
                  }
                }
                var jt = (ot + ft) / 2 - (Nt + Mt) / 2, ie = true, Zt = false, Kt = void 0;
                try {
                  for (var qt = nt[Symbol.iterator](), Qt; !(ie = (Qt = qt.next()).done); ie = true) {
                    var ne = Qt.value;
                    tt.set(ne, tt.get(ne) + jt);
                  }
                } catch (Jt) {
                  Zt = true, Kt = Jt;
                } finally {
                  try {
                    !ie && qt.return && qt.return();
                  } finally {
                    if (Zt) throw Kt;
                  }
                }
              });
            }
            return tt;
          }, "findAppropriatePositionForRelativePlacement"), st = w(function(I) {
            var D = 0, $ = 0, Z = 0, Q = 0;
            if (I.forEach(function(ct) {
              ct.left ? E[g.get(ct.left)] - E[g.get(ct.right)] >= 0 ? D++ : $++ : _[g.get(ct.top)] - _[g.get(ct.bottom)] >= 0 ? Z++ : Q++;
            }), D > $ && Z > Q) for (var pt = 0; pt < g.size; pt++) E[pt] = -1 * E[pt], _[pt] = -1 * _[pt];
            else if (D > $) for (var dt = 0; dt < g.size; dt++) E[dt] = -1 * E[dt];
            else if (Z > Q) for (var tt = 0; tt < g.size; tt++) _[tt] = -1 * _[tt];
          }, "applyReflectionForRelativePlacement"), s = w(function(I) {
            var D = [], $ = new f(), Z = /* @__PURE__ */ new Set(), Q = 0;
            return I.forEach(function(pt, dt) {
              if (!Z.has(dt)) {
                D[Q] = [];
                var tt = dt;
                for ($.push(tt), Z.add(tt), D[Q].push(tt); $.length != 0; ) {
                  tt = $.shift();
                  var ct = I.get(tt);
                  ct.forEach(function(Et) {
                    Z.has(Et.id) || ($.push(Et.id), Z.add(Et.id), D[Q].push(Et.id));
                  });
                }
                Q++;
              }
            }), D;
          }, "findComponents"), y = w(function(I) {
            var D = /* @__PURE__ */ new Map();
            return I.forEach(function($, Z) {
              D.set(Z, []);
            }), I.forEach(function($, Z) {
              $.forEach(function(Q) {
                D.get(Z).push(Q), D.get(Q.id).push({ id: Z, gap: Q.gap, direction: Q.direction });
              });
            }), D;
          }, "dagToUndirected"), m = w(function(I) {
            var D = /* @__PURE__ */ new Map();
            return I.forEach(function($, Z) {
              D.set(Z, []);
            }), I.forEach(function($, Z) {
              $.forEach(function(Q) {
                D.get(Q.id).push({ id: Z, gap: Q.gap, direction: Q.direction });
              });
            }), D;
          }, "dagToReversed"), v = [], p = [], M = false, x = false, b = /* @__PURE__ */ new Set(), U = /* @__PURE__ */ new Map(), X = /* @__PURE__ */ new Map(), W = [];
          if (d.fixedNodeConstraint && d.fixedNodeConstraint.forEach(function(I) {
            b.add(I.nodeId);
          }), d.relativePlacementConstraint && (d.relativePlacementConstraint.forEach(function(I) {
            I.left ? (U.has(I.left) ? U.get(I.left).push({ id: I.right, gap: I.gap, direction: "horizontal" }) : U.set(I.left, [{ id: I.right, gap: I.gap, direction: "horizontal" }]), U.has(I.right) || U.set(I.right, [])) : (U.has(I.top) ? U.get(I.top).push({ id: I.bottom, gap: I.gap, direction: "vertical" }) : U.set(I.top, [{ id: I.bottom, gap: I.gap, direction: "vertical" }]), U.has(I.bottom) || U.set(I.bottom, []));
          }), X = y(U), W = s(X)), r.TRANSFORM_ON_CONSTRAINT_HANDLING) {
            if (d.fixedNodeConstraint && d.fixedNodeConstraint.length > 1) d.fixedNodeConstraint.forEach(function(I, D) {
              v[D] = [I.position.x, I.position.y], p[D] = [E[g.get(I.nodeId)], _[g.get(I.nodeId)]];
            }), M = true;
            else if (d.alignmentConstraint) (function() {
              var I = 0;
              if (d.alignmentConstraint.vertical) {
                for (var D = d.alignmentConstraint.vertical, $ = w(function(tt) {
                  var ct = /* @__PURE__ */ new Set();
                  D[tt].forEach(function(et) {
                    ct.add(et);
                  });
                  var Et = new Set([].concat(a(ct)).filter(function(et) {
                    return b.has(et);
                  })), wt = void 0;
                  Et.size > 0 ? wt = E[g.get(Et.values().next().value)] : wt = q(ct).x, D[tt].forEach(function(et) {
                    v[I] = [wt, _[g.get(et)]], p[I] = [E[g.get(et)], _[g.get(et)]], I++;
                  });
                }, "_loop2"), Z = 0; Z < D.length; Z++) $(Z);
                M = true;
              }
              if (d.alignmentConstraint.horizontal) {
                for (var Q = d.alignmentConstraint.horizontal, pt = w(function(tt) {
                  var ct = /* @__PURE__ */ new Set();
                  Q[tt].forEach(function(et) {
                    ct.add(et);
                  });
                  var Et = new Set([].concat(a(ct)).filter(function(et) {
                    return b.has(et);
                  })), wt = void 0;
                  Et.size > 0 ? wt = E[g.get(Et.values().next().value)] : wt = q(ct).y, Q[tt].forEach(function(et) {
                    v[I] = [E[g.get(et)], wt], p[I] = [E[g.get(et)], _[g.get(et)]], I++;
                  });
                }, "_loop3"), dt = 0; dt < Q.length; dt++) pt(dt);
                M = true;
              }
              d.relativePlacementConstraint && (x = true);
            })();
            else if (d.relativePlacementConstraint) {
              for (var j = 0, z = 0, K = 0; K < W.length; K++) W[K].length > j && (j = W[K].length, z = K);
              if (j < X.size / 2) st(d.relativePlacementConstraint), M = false, x = false;
              else {
                var P = /* @__PURE__ */ new Map(), R = /* @__PURE__ */ new Map(), S = [];
                W[z].forEach(function(I) {
                  U.get(I).forEach(function(D) {
                    D.direction == "horizontal" ? (P.has(I) ? P.get(I).push(D) : P.set(I, [D]), P.has(D.id) || P.set(D.id, []), S.push({ left: I, right: D.id })) : (R.has(I) ? R.get(I).push(D) : R.set(I, [D]), R.has(D.id) || R.set(D.id, []), S.push({ top: I, bottom: D.id }));
                  });
                }), st(S), x = false;
                var J = O(P, "horizontal"), it = O(R, "vertical");
                W[z].forEach(function(I, D) {
                  p[D] = [E[g.get(I)], _[g.get(I)]], v[D] = [], J.has(I) ? v[D][0] = J.get(I) : v[D][0] = E[g.get(I)], it.has(I) ? v[D][1] = it.get(I) : v[D][1] = _[g.get(I)];
                }), M = true;
              }
            }
            if (M) {
              for (var ut = void 0, Ct = o.transpose(v), bt = o.transpose(p), G = 0; G < Ct.length; G++) Ct[G] = o.multGamma(Ct[G]), bt[G] = o.multGamma(bt[G]);
              var rt = o.multMat(Ct, o.transpose(bt)), ht = t.svd(rt);
              ut = o.multMat(ht.V, o.transpose(ht.U));
              for (var mt = 0; mt < g.size; mt++) {
                var Lt = [E[mt], _[mt]], vt = [ut[0][0], ut[1][0]], yt = [ut[0][1], ut[1][1]];
                E[mt] = o.dotProduct(Lt, vt), _[mt] = o.dotProduct(Lt, yt);
              }
              x && st(d.relativePlacementConstraint);
            }
          }
          if (r.ENFORCE_CONSTRAINTS) {
            if (d.fixedNodeConstraint && d.fixedNodeConstraint.length > 0) {
              var xt = { x: 0, y: 0 };
              d.fixedNodeConstraint.forEach(function(I, D) {
                var $ = { x: E[g.get(I.nodeId)], y: _[g.get(I.nodeId)] }, Z = I.position, Q = B(Z, $);
                xt.x += Q.x, xt.y += Q.y;
              }), xt.x /= d.fixedNodeConstraint.length, xt.y /= d.fixedNodeConstraint.length, E.forEach(function(I, D) {
                E[D] += xt.x;
              }), _.forEach(function(I, D) {
                _[D] += xt.y;
              }), d.fixedNodeConstraint.forEach(function(I) {
                E[g.get(I.nodeId)] = I.position.x, _[g.get(I.nodeId)] = I.position.y;
              });
            }
            if (d.alignmentConstraint) {
              if (d.alignmentConstraint.vertical) for (var Ht = d.alignmentConstraint.vertical, Pt = w(function(I) {
                var D = /* @__PURE__ */ new Set();
                Ht[I].forEach(function(Q) {
                  D.add(Q);
                });
                var $ = new Set([].concat(a(D)).filter(function(Q) {
                  return b.has(Q);
                })), Z = void 0;
                $.size > 0 ? Z = E[g.get($.values().next().value)] : Z = q(D).x, D.forEach(function(Q) {
                  b.has(Q) || (E[g.get(Q)] = Z);
                });
              }, "_loop4"), Gt = 0; Gt < Ht.length; Gt++) Pt(Gt);
              if (d.alignmentConstraint.horizontal) for (var Ot = d.alignmentConstraint.horizontal, Ut = w(function(I) {
                var D = /* @__PURE__ */ new Set();
                Ot[I].forEach(function(Q) {
                  D.add(Q);
                });
                var $ = new Set([].concat(a(D)).filter(function(Q) {
                  return b.has(Q);
                })), Z = void 0;
                $.size > 0 ? Z = _[g.get($.values().next().value)] : Z = q(D).y, D.forEach(function(Q) {
                  b.has(Q) || (_[g.get(Q)] = Z);
                });
              }, "_loop5"), Xt = 0; Xt < Ot.length; Xt++) Ut(Xt);
            }
            d.relativePlacementConstraint && function() {
              var I = /* @__PURE__ */ new Map(), D = /* @__PURE__ */ new Map(), $ = /* @__PURE__ */ new Map(), Z = /* @__PURE__ */ new Map(), Q = /* @__PURE__ */ new Map(), pt = /* @__PURE__ */ new Map(), dt = /* @__PURE__ */ new Set(), tt = /* @__PURE__ */ new Set();
              if (b.forEach(function(gt) {
                dt.add(gt), tt.add(gt);
              }), d.alignmentConstraint) {
                if (d.alignmentConstraint.vertical) for (var ct = d.alignmentConstraint.vertical, Et = w(function(gt) {
                  $.set("dummy" + gt, []), ct[gt].forEach(function(_t) {
                    I.set(_t, "dummy" + gt), $.get("dummy" + gt).push(_t), b.has(_t) && dt.add("dummy" + gt);
                  }), Q.set("dummy" + gt, E[g.get(ct[gt][0])]);
                }, "_loop6"), wt = 0; wt < ct.length; wt++) Et(wt);
                if (d.alignmentConstraint.horizontal) for (var et = d.alignmentConstraint.horizontal, It = w(function(gt) {
                  Z.set("dummy" + gt, []), et[gt].forEach(function(_t) {
                    D.set(_t, "dummy" + gt), Z.get("dummy" + gt).push(_t), b.has(_t) && tt.add("dummy" + gt);
                  }), pt.set("dummy" + gt, _[g.get(et[gt][0])]);
                }, "_loop7"), nt = 0; nt < et.length; nt++) It(nt);
              }
              var at = /* @__PURE__ */ new Map(), ot = /* @__PURE__ */ new Map(), Nt = w(function(gt) {
                U.get(gt).forEach(function(_t) {
                  var Yt = void 0, Vt = void 0;
                  _t.direction == "horizontal" ? (Yt = I.get(gt) ? I.get(gt) : gt, I.get(_t.id) ? Vt = { id: I.get(_t.id), gap: _t.gap, direction: _t.direction } : Vt = _t, at.has(Yt) ? at.get(Yt).push(Vt) : at.set(Yt, [Vt]), at.has(Vt.id) || at.set(Vt.id, [])) : (Yt = D.get(gt) ? D.get(gt) : gt, D.get(_t.id) ? Vt = { id: D.get(_t.id), gap: _t.gap, direction: _t.direction } : Vt = _t, ot.has(Yt) ? ot.get(Yt).push(Vt) : ot.set(Yt, [Vt]), ot.has(Vt.id) || ot.set(Vt.id, []));
                });
              }, "_loop8"), ft = true, Mt = false, Rt = void 0;
              try {
                for (var Dt = U.keys()[Symbol.iterator](), Bt; !(ft = (Bt = Dt.next()).done); ft = true) {
                  var Tt = Bt.value;
                  Nt(Tt);
                }
              } catch (gt) {
                Mt = true, Rt = gt;
              } finally {
                try {
                  !ft && Dt.return && Dt.return();
                } finally {
                  if (Mt) throw Rt;
                }
              }
              var At = y(at), Ft = y(ot), St = s(At), zt = s(Ft), jt = m(at), ie = m(ot), Zt = [], Kt = [];
              St.forEach(function(gt, _t) {
                Zt[_t] = [], gt.forEach(function(Yt) {
                  jt.get(Yt).length == 0 && Zt[_t].push(Yt);
                });
              }), zt.forEach(function(gt, _t) {
                Kt[_t] = [], gt.forEach(function(Yt) {
                  ie.get(Yt).length == 0 && Kt[_t].push(Yt);
                });
              });
              var qt = O(at, "horizontal", dt, Q, Zt), Qt = O(ot, "vertical", tt, pt, Kt), ne = w(function(gt) {
                $.get(gt) ? $.get(gt).forEach(function(_t) {
                  E[g.get(_t)] = qt.get(gt);
                }) : E[g.get(gt)] = qt.get(gt);
              }, "_loop9"), Jt = true, me = false, ve = void 0;
              try {
                for (var ae = qt.keys()[Symbol.iterator](), ye; !(Jt = (ye = ae.next()).done); Jt = true) {
                  var se = ye.value;
                  ne(se);
                }
              } catch (gt) {
                me = true, ve = gt;
              } finally {
                try {
                  !Jt && ae.return && ae.return();
                } finally {
                  if (me) throw ve;
                }
              }
              var Xe = w(function(gt) {
                Z.get(gt) ? Z.get(gt).forEach(function(_t) {
                  _[g.get(_t)] = Qt.get(gt);
                }) : _[g.get(gt)] = Qt.get(gt);
              }, "_loop10"), he = true, Ee = false, Ne = void 0;
              try {
                for (var le = Qt.keys()[Symbol.iterator](), Te; !(he = (Te = le.next()).done); he = true) {
                  var se = Te.value;
                  Xe(se);
                }
              } catch (gt) {
                Ee = true, Ne = gt;
              } finally {
                try {
                  !he && le.return && le.return();
                } finally {
                  if (Ee) throw Ne;
                }
              }
            }();
          }
          for (var Wt = 0; Wt < C.length; Wt++) {
            var lt = C[Wt];
            lt.getChild() == null && lt.setCenter(E[g.get(lt.id)], _[g.get(lt.id)]);
          }
        }, n.exports = l;
      }, 551: (n) => {
        n.exports = L;
      } }, T = {};
      function c(n) {
        var i = T[n];
        if (i !== void 0) return i.exports;
        var e = T[n] = { exports: {} };
        return F[n](e, e.exports, c), e.exports;
      }
      w(c, "__webpack_require__");
      var h = c(45);
      return h;
    })();
  });
}), si = fe((A, H) => {
  w(function(L, F) {
    typeof A == "object" && typeof H == "object" ? H.exports = F(we()) : typeof define == "function" && define.amd ? define(["cose-base"], F) : typeof A == "object" ? A.cytoscapeFcose = F(we()) : L.cytoscapeFcose = F(L.coseBase);
  }, "webpackUniversalModuleDefinition")(A, function(L) {
    return (() => {
      var F = { 658: (n) => {
        n.exports = Object.assign != null ? Object.assign.bind(Object) : function(i) {
          for (var e = arguments.length, a = Array(e > 1 ? e - 1 : 0), r = 1; r < e; r++) a[r - 1] = arguments[r];
          return a.forEach(function(f) {
            Object.keys(f).forEach(function(o) {
              return i[o] = f[o];
            });
          }), i;
        };
      }, 548: (n, i, e) => {
        var a = function() {
          function o(t, l) {
            var u = [], d = true, N = false, g = void 0;
            try {
              for (var E = t[Symbol.iterator](), _; !(d = (_ = E.next()).done) && (u.push(_.value), !(l && u.length === l)); d = true) ;
            } catch (C) {
              N = true, g = C;
            } finally {
              try {
                !d && E.return && E.return();
              } finally {
                if (N) throw g;
              }
            }
            return u;
          }
          return w(o, "sliceIterator"), function(t, l) {
            if (Array.isArray(t)) return t;
            if (Symbol.iterator in Object(t)) return o(t, l);
            throw new TypeError("Invalid attempt to destructure non-iterable instance");
          };
        }(), r = e(140).layoutBase.LinkedList, f = {};
        f.getTopMostNodes = function(o) {
          for (var t = {}, l = 0; l < o.length; l++) t[o[l].id()] = true;
          var u = o.filter(function(d, N) {
            typeof d == "number" && (d = N);
            for (var g = d.parent()[0]; g != null; ) {
              if (t[g.id()]) return false;
              g = g.parent()[0];
            }
            return true;
          });
          return u;
        }, f.connectComponents = function(o, t, l, u) {
          var d = new r(), N = /* @__PURE__ */ new Set(), g = [], E = void 0, _ = void 0, C = void 0, k = false, Y = 1, V = [], B = [], q = w(function() {
            var O = o.collection();
            B.push(O);
            var st = l[0], s = o.collection();
            s.merge(st).merge(st.descendants().intersection(t)), g.push(st), s.forEach(function(v) {
              d.push(v), N.add(v), O.merge(v);
            });
            for (var y = w(function() {
              st = d.shift();
              var v = o.collection();
              st.neighborhood().nodes().forEach(function(b) {
                t.intersection(st.edgesWith(b)).length > 0 && v.merge(b);
              });
              for (var p = 0; p < v.length; p++) {
                var M = v[p];
                if (E = l.intersection(M.union(M.ancestors())), E != null && !N.has(E[0])) {
                  var x = E.union(E.descendants());
                  x.forEach(function(b) {
                    d.push(b), N.add(b), O.merge(b), l.has(b) && g.push(b);
                  });
                }
              }
            }, "_loop2"); d.length != 0; ) y();
            if (O.forEach(function(v) {
              t.intersection(v.connectedEdges()).forEach(function(p) {
                O.has(p.source()) && O.has(p.target()) && O.merge(p);
              });
            }), g.length == l.length && (k = true), !k || k && Y > 1) {
              _ = g[0], C = _.connectedEdges().length, g.forEach(function(v) {
                v.connectedEdges().length < C && (C = v.connectedEdges().length, _ = v);
              }), V.push(_.id());
              var m = o.collection();
              m.merge(g[0]), g.forEach(function(v) {
                m.merge(v);
              }), g = [], l = l.difference(m), Y++;
            }
          }, "_loop");
          do
            q();
          while (!k);
          return u && V.length > 0 && u.set("dummy" + (u.size + 1), V), B;
        }, f.relocateComponent = function(o, t, l) {
          if (!l.fixedNodeConstraint) {
            var u = Number.POSITIVE_INFINITY, d = Number.NEGATIVE_INFINITY, N = Number.POSITIVE_INFINITY, g = Number.NEGATIVE_INFINITY;
            if (l.quality == "draft") {
              var E = true, _ = false, C = void 0;
              try {
                for (var k = t.nodeIndexes[Symbol.iterator](), Y; !(E = (Y = k.next()).done); E = true) {
                  var V = Y.value, B = a(V, 2), q = B[0], O = B[1], st = l.cy.getElementById(q);
                  if (st) {
                    var s = st.boundingBox(), y = t.xCoords[O] - s.w / 2, m = t.xCoords[O] + s.w / 2, v = t.yCoords[O] - s.h / 2, p = t.yCoords[O] + s.h / 2;
                    y < u && (u = y), m > d && (d = m), v < N && (N = v), p > g && (g = p);
                  }
                }
              } catch (X) {
                _ = true, C = X;
              } finally {
                try {
                  !E && k.return && k.return();
                } finally {
                  if (_) throw C;
                }
              }
              var M = o.x - (d + u) / 2, x = o.y - (g + N) / 2;
              t.xCoords = t.xCoords.map(function(X) {
                return X + M;
              }), t.yCoords = t.yCoords.map(function(X) {
                return X + x;
              });
            } else {
              Object.keys(t).forEach(function(X) {
                var W = t[X], j = W.getRect().x, z = W.getRect().x + W.getRect().width, K = W.getRect().y, P = W.getRect().y + W.getRect().height;
                j < u && (u = j), z > d && (d = z), K < N && (N = K), P > g && (g = P);
              });
              var b = o.x - (d + u) / 2, U = o.y - (g + N) / 2;
              Object.keys(t).forEach(function(X) {
                var W = t[X];
                W.setCenter(W.getCenterX() + b, W.getCenterY() + U);
              });
            }
          }
        }, f.calcBoundingBox = function(o, t, l, u) {
          for (var d = Number.MAX_SAFE_INTEGER, N = Number.MIN_SAFE_INTEGER, g = Number.MAX_SAFE_INTEGER, E = Number.MIN_SAFE_INTEGER, _ = void 0, C = void 0, k = void 0, Y = void 0, V = o.descendants().not(":parent"), B = V.length, q = 0; q < B; q++) {
            var O = V[q];
            _ = t[u.get(O.id())] - O.width() / 2, C = t[u.get(O.id())] + O.width() / 2, k = l[u.get(O.id())] - O.height() / 2, Y = l[u.get(O.id())] + O.height() / 2, d > _ && (d = _), N < C && (N = C), g > k && (g = k), E < Y && (E = Y);
          }
          var st = {};
          return st.topLeftX = d, st.topLeftY = g, st.width = N - d, st.height = E - g, st;
        }, f.calcParentsWithoutChildren = function(o, t) {
          var l = o.collection();
          return t.nodes(":parent").forEach(function(u) {
            var d = false;
            u.children().forEach(function(N) {
              N.css("display") != "none" && (d = true);
            }), d || l.merge(u);
          }), l;
        }, n.exports = f;
      }, 816: (n, i, e) => {
        var a = e(548), r = e(140).CoSELayout, f = e(140).CoSENode, o = e(140).layoutBase.PointD, t = e(140).layoutBase.DimensionD, l = e(140).layoutBase.LayoutConstants, u = e(140).layoutBase.FDLayoutConstants, d = e(140).CoSEConstants, N = w(function(g, E) {
          var _ = g.cy, C = g.eles, k = C.nodes(), Y = C.edges(), V = void 0, B = void 0, q = void 0, O = {};
          g.randomize && (V = E.nodeIndexes, B = E.xCoords, q = E.yCoords);
          var st = w(function(b) {
            return typeof b == "function";
          }, "isFn"), s = w(function(b, U) {
            return st(b) ? b(U) : b;
          }, "optFn"), y = a.calcParentsWithoutChildren(_, C), m = w(function b(U, X, W, j) {
            for (var z = X.length, K = 0; K < z; K++) {
              var P = X[K], R = null;
              P.intersection(y).length == 0 && (R = P.children());
              var S = void 0, J = P.layoutDimensions({ nodeDimensionsIncludeLabels: j.nodeDimensionsIncludeLabels });
              if (P.outerWidth() != null && P.outerHeight() != null) if (j.randomize) if (!P.isParent()) S = U.add(new f(W.graphManager, new o(B[V.get(P.id())] - J.w / 2, q[V.get(P.id())] - J.h / 2), new t(parseFloat(J.w), parseFloat(J.h))));
              else {
                var it = a.calcBoundingBox(P, B, q, V);
                P.intersection(y).length == 0 ? S = U.add(new f(W.graphManager, new o(it.topLeftX, it.topLeftY), new t(it.width, it.height))) : S = U.add(new f(W.graphManager, new o(it.topLeftX, it.topLeftY), new t(parseFloat(J.w), parseFloat(J.h))));
              }
              else S = U.add(new f(W.graphManager, new o(P.position("x") - J.w / 2, P.position("y") - J.h / 2), new t(parseFloat(J.w), parseFloat(J.h))));
              else S = U.add(new f(this.graphManager));
              if (S.id = P.data("id"), S.nodeRepulsion = s(j.nodeRepulsion, P), S.paddingLeft = parseInt(P.css("padding")), S.paddingTop = parseInt(P.css("padding")), S.paddingRight = parseInt(P.css("padding")), S.paddingBottom = parseInt(P.css("padding")), j.nodeDimensionsIncludeLabels && (S.labelWidth = P.boundingBox({ includeLabels: true, includeNodes: false, includeOverlays: false }).w, S.labelHeight = P.boundingBox({ includeLabels: true, includeNodes: false, includeOverlays: false }).h, S.labelPosVertical = P.css("text-valign"), S.labelPosHorizontal = P.css("text-halign")), O[P.data("id")] = S, isNaN(S.rect.x) && (S.rect.x = 0), isNaN(S.rect.y) && (S.rect.y = 0), R != null && R.length > 0) {
                var ut = void 0;
                ut = W.getGraphManager().add(W.newGraph(), S), b(ut, R, W, j);
              }
            }
          }, "processChildrenList"), v = w(function(b, U, X) {
            for (var W = 0, j = 0, z = 0; z < X.length; z++) {
              var K = X[z], P = O[K.data("source")], R = O[K.data("target")];
              if (P && R && P !== R && P.getEdgesBetween(R).length == 0) {
                var S = U.add(b.newEdge(), P, R);
                S.id = K.id(), S.idealLength = s(g.idealEdgeLength, K), S.edgeElasticity = s(g.edgeElasticity, K), W += S.idealLength, j++;
              }
            }
            g.idealEdgeLength != null && (j > 0 ? d.DEFAULT_EDGE_LENGTH = u.DEFAULT_EDGE_LENGTH = W / j : st(g.idealEdgeLength) ? d.DEFAULT_EDGE_LENGTH = u.DEFAULT_EDGE_LENGTH = 50 : d.DEFAULT_EDGE_LENGTH = u.DEFAULT_EDGE_LENGTH = g.idealEdgeLength, d.MIN_REPULSION_DIST = u.MIN_REPULSION_DIST = u.DEFAULT_EDGE_LENGTH / 10, d.DEFAULT_RADIAL_SEPARATION = u.DEFAULT_EDGE_LENGTH);
          }, "processEdges"), p = w(function(b, U) {
            U.fixedNodeConstraint && (b.constraints.fixedNodeConstraint = U.fixedNodeConstraint), U.alignmentConstraint && (b.constraints.alignmentConstraint = U.alignmentConstraint), U.relativePlacementConstraint && (b.constraints.relativePlacementConstraint = U.relativePlacementConstraint);
          }, "processConstraints");
          g.nestingFactor != null && (d.PER_LEVEL_IDEAL_EDGE_LENGTH_FACTOR = u.PER_LEVEL_IDEAL_EDGE_LENGTH_FACTOR = g.nestingFactor), g.gravity != null && (d.DEFAULT_GRAVITY_STRENGTH = u.DEFAULT_GRAVITY_STRENGTH = g.gravity), g.numIter != null && (d.MAX_ITERATIONS = u.MAX_ITERATIONS = g.numIter), g.gravityRange != null && (d.DEFAULT_GRAVITY_RANGE_FACTOR = u.DEFAULT_GRAVITY_RANGE_FACTOR = g.gravityRange), g.gravityCompound != null && (d.DEFAULT_COMPOUND_GRAVITY_STRENGTH = u.DEFAULT_COMPOUND_GRAVITY_STRENGTH = g.gravityCompound), g.gravityRangeCompound != null && (d.DEFAULT_COMPOUND_GRAVITY_RANGE_FACTOR = u.DEFAULT_COMPOUND_GRAVITY_RANGE_FACTOR = g.gravityRangeCompound), g.initialEnergyOnIncremental != null && (d.DEFAULT_COOLING_FACTOR_INCREMENTAL = u.DEFAULT_COOLING_FACTOR_INCREMENTAL = g.initialEnergyOnIncremental), g.tilingCompareBy != null && (d.TILING_COMPARE_BY = g.tilingCompareBy), g.quality == "proof" ? l.QUALITY = 2 : l.QUALITY = 0, d.NODE_DIMENSIONS_INCLUDE_LABELS = u.NODE_DIMENSIONS_INCLUDE_LABELS = l.NODE_DIMENSIONS_INCLUDE_LABELS = g.nodeDimensionsIncludeLabels, d.DEFAULT_INCREMENTAL = u.DEFAULT_INCREMENTAL = l.DEFAULT_INCREMENTAL = !g.randomize, d.ANIMATE = u.ANIMATE = l.ANIMATE = g.animate, d.TILE = g.tile, d.TILING_PADDING_VERTICAL = typeof g.tilingPaddingVertical == "function" ? g.tilingPaddingVertical.call() : g.tilingPaddingVertical, d.TILING_PADDING_HORIZONTAL = typeof g.tilingPaddingHorizontal == "function" ? g.tilingPaddingHorizontal.call() : g.tilingPaddingHorizontal, d.DEFAULT_INCREMENTAL = u.DEFAULT_INCREMENTAL = l.DEFAULT_INCREMENTAL = true, d.PURE_INCREMENTAL = !g.randomize, l.DEFAULT_UNIFORM_LEAF_NODE_SIZES = g.uniformNodeDimensions, g.step == "transformed" && (d.TRANSFORM_ON_CONSTRAINT_HANDLING = true, d.ENFORCE_CONSTRAINTS = false, d.APPLY_LAYOUT = false), g.step == "enforced" && (d.TRANSFORM_ON_CONSTRAINT_HANDLING = false, d.ENFORCE_CONSTRAINTS = true, d.APPLY_LAYOUT = false), g.step == "cose" && (d.TRANSFORM_ON_CONSTRAINT_HANDLING = false, d.ENFORCE_CONSTRAINTS = false, d.APPLY_LAYOUT = true), g.step == "all" && (g.randomize ? d.TRANSFORM_ON_CONSTRAINT_HANDLING = true : d.TRANSFORM_ON_CONSTRAINT_HANDLING = false, d.ENFORCE_CONSTRAINTS = true, d.APPLY_LAYOUT = true), g.fixedNodeConstraint || g.alignmentConstraint || g.relativePlacementConstraint ? d.TREE_REDUCTION_ON_INCREMENTAL = false : d.TREE_REDUCTION_ON_INCREMENTAL = true;
          var M = new r(), x = M.newGraphManager();
          return m(x.addRoot(), a.getTopMostNodes(k), M, g), v(M, x, Y), p(M, g), M.runLayout(), O;
        }, "coseLayout");
        n.exports = { coseLayout: N };
      }, 212: (n, i, e) => {
        var a = function() {
          function E(_, C) {
            for (var k = 0; k < C.length; k++) {
              var Y = C[k];
              Y.enumerable = Y.enumerable || false, Y.configurable = true, "value" in Y && (Y.writable = true), Object.defineProperty(_, Y.key, Y);
            }
          }
          return w(E, "defineProperties"), function(_, C, k) {
            return C && E(_.prototype, C), k && E(_, k), _;
          };
        }();
        function r(E, _) {
          if (!(E instanceof _)) throw new TypeError("Cannot call a class as a function");
        }
        w(r, "_classCallCheck");
        var f = e(658), o = e(548), t = e(657), l = t.spectralLayout, u = e(816), d = u.coseLayout, N = Object.freeze({ quality: "default", randomize: true, animate: true, animationDuration: 1e3, animationEasing: void 0, fit: true, padding: 30, nodeDimensionsIncludeLabels: false, uniformNodeDimensions: false, packComponents: true, step: "all", samplingType: true, sampleSize: 25, nodeSeparation: 75, piTol: 1e-7, nodeRepulsion: w(function(E) {
          return 4500;
        }, "nodeRepulsion"), idealEdgeLength: w(function(E) {
          return 50;
        }, "idealEdgeLength"), edgeElasticity: w(function(E) {
          return 0.45;
        }, "edgeElasticity"), nestingFactor: 0.1, gravity: 0.25, numIter: 2500, tile: true, tilingCompareBy: void 0, tilingPaddingVertical: 10, tilingPaddingHorizontal: 10, gravityRangeCompound: 1.5, gravityCompound: 1, gravityRange: 3.8, initialEnergyOnIncremental: 0.3, fixedNodeConstraint: void 0, alignmentConstraint: void 0, relativePlacementConstraint: void 0, ready: w(function() {
        }, "ready"), stop: w(function() {
        }, "stop") }), g = function() {
          function E(_) {
            r(this, E), this.options = f({}, N, _);
          }
          return w(E, "Layout"), a(E, [{ key: "run", value: w(function() {
            var _ = this, C = this.options, k = C.cy, Y = C.eles, V = [], B = [], q = void 0, O = [];
            C.fixedNodeConstraint && (!Array.isArray(C.fixedNodeConstraint) || C.fixedNodeConstraint.length == 0) && (C.fixedNodeConstraint = void 0), C.alignmentConstraint && (C.alignmentConstraint.vertical && (!Array.isArray(C.alignmentConstraint.vertical) || C.alignmentConstraint.vertical.length == 0) && (C.alignmentConstraint.vertical = void 0), C.alignmentConstraint.horizontal && (!Array.isArray(C.alignmentConstraint.horizontal) || C.alignmentConstraint.horizontal.length == 0) && (C.alignmentConstraint.horizontal = void 0)), C.relativePlacementConstraint && (!Array.isArray(C.relativePlacementConstraint) || C.relativePlacementConstraint.length == 0) && (C.relativePlacementConstraint = void 0);
            var st = C.fixedNodeConstraint || C.alignmentConstraint || C.relativePlacementConstraint;
            st && (C.tile = false, C.packComponents = false);
            var s = void 0, y = false;
            if (k.layoutUtilities && C.packComponents && (s = k.layoutUtilities("get"), s || (s = k.layoutUtilities()), y = true), Y.nodes().length > 0) if (y) {
              var m = o.getTopMostNodes(C.eles.nodes());
              if (q = o.connectComponents(k, C.eles, m), q.forEach(function(G) {
                var rt = G.boundingBox();
                O.push({ x: rt.x1 + rt.w / 2, y: rt.y1 + rt.h / 2 });
              }), C.randomize && q.forEach(function(G) {
                C.eles = G, V.push(l(C));
              }), C.quality == "default" || C.quality == "proof") {
                var v = k.collection();
                if (C.tile) {
                  var p = /* @__PURE__ */ new Map(), M = [], x = [], b = 0, U = { nodeIndexes: p, xCoords: M, yCoords: x }, X = [];
                  if (q.forEach(function(G, rt) {
                    G.edges().length == 0 && (G.nodes().forEach(function(ht, mt) {
                      v.merge(G.nodes()[mt]), ht.isParent() || (U.nodeIndexes.set(G.nodes()[mt].id(), b++), U.xCoords.push(G.nodes()[0].position().x), U.yCoords.push(G.nodes()[0].position().y));
                    }), X.push(rt));
                  }), v.length > 1) {
                    var W = v.boundingBox();
                    O.push({ x: W.x1 + W.w / 2, y: W.y1 + W.h / 2 }), q.push(v), V.push(U);
                    for (var j = X.length - 1; j >= 0; j--) q.splice(X[j], 1), V.splice(X[j], 1), O.splice(X[j], 1);
                  }
                }
                q.forEach(function(G, rt) {
                  C.eles = G, B.push(d(C, V[rt])), o.relocateComponent(O[rt], B[rt], C);
                });
              } else q.forEach(function(G, rt) {
                o.relocateComponent(O[rt], V[rt], C);
              });
              var z = /* @__PURE__ */ new Set();
              if (q.length > 1) {
                var K = [], P = Y.filter(function(G) {
                  return G.css("display") == "none";
                });
                q.forEach(function(G, rt) {
                  var ht = void 0;
                  if (C.quality == "draft" && (ht = V[rt].nodeIndexes), G.nodes().not(P).length > 0) {
                    var mt = {};
                    mt.edges = [], mt.nodes = [];
                    var Lt = void 0;
                    G.nodes().not(P).forEach(function(vt) {
                      if (C.quality == "draft") if (!vt.isParent()) Lt = ht.get(vt.id()), mt.nodes.push({ x: V[rt].xCoords[Lt] - vt.boundingbox().w / 2, y: V[rt].yCoords[Lt] - vt.boundingbox().h / 2, width: vt.boundingbox().w, height: vt.boundingbox().h });
                      else {
                        var yt = o.calcBoundingBox(vt, V[rt].xCoords, V[rt].yCoords, ht);
                        mt.nodes.push({ x: yt.topLeftX, y: yt.topLeftY, width: yt.width, height: yt.height });
                      }
                      else B[rt][vt.id()] && mt.nodes.push({ x: B[rt][vt.id()].getLeft(), y: B[rt][vt.id()].getTop(), width: B[rt][vt.id()].getWidth(), height: B[rt][vt.id()].getHeight() });
                    }), G.edges().forEach(function(vt) {
                      var yt = vt.source(), xt = vt.target();
                      if (yt.css("display") != "none" && xt.css("display") != "none") if (C.quality == "draft") {
                        var Ht = ht.get(yt.id()), Pt = ht.get(xt.id()), Gt = [], Ot = [];
                        if (yt.isParent()) {
                          var Ut = o.calcBoundingBox(yt, V[rt].xCoords, V[rt].yCoords, ht);
                          Gt.push(Ut.topLeftX + Ut.width / 2), Gt.push(Ut.topLeftY + Ut.height / 2);
                        } else Gt.push(V[rt].xCoords[Ht]), Gt.push(V[rt].yCoords[Ht]);
                        if (xt.isParent()) {
                          var Xt = o.calcBoundingBox(xt, V[rt].xCoords, V[rt].yCoords, ht);
                          Ot.push(Xt.topLeftX + Xt.width / 2), Ot.push(Xt.topLeftY + Xt.height / 2);
                        } else Ot.push(V[rt].xCoords[Pt]), Ot.push(V[rt].yCoords[Pt]);
                        mt.edges.push({ startX: Gt[0], startY: Gt[1], endX: Ot[0], endY: Ot[1] });
                      } else B[rt][yt.id()] && B[rt][xt.id()] && mt.edges.push({ startX: B[rt][yt.id()].getCenterX(), startY: B[rt][yt.id()].getCenterY(), endX: B[rt][xt.id()].getCenterX(), endY: B[rt][xt.id()].getCenterY() });
                    }), mt.nodes.length > 0 && (K.push(mt), z.add(rt));
                  }
                });
                var R = s.packComponents(K, C.randomize).shifts;
                if (C.quality == "draft") V.forEach(function(G, rt) {
                  var ht = G.xCoords.map(function(Lt) {
                    return Lt + R[rt].dx;
                  }), mt = G.yCoords.map(function(Lt) {
                    return Lt + R[rt].dy;
                  });
                  G.xCoords = ht, G.yCoords = mt;
                });
                else {
                  var S = 0;
                  z.forEach(function(G) {
                    Object.keys(B[G]).forEach(function(rt) {
                      var ht = B[G][rt];
                      ht.setCenter(ht.getCenterX() + R[S].dx, ht.getCenterY() + R[S].dy);
                    }), S++;
                  });
                }
              }
            } else {
              var J = C.eles.boundingBox();
              if (O.push({ x: J.x1 + J.w / 2, y: J.y1 + J.h / 2 }), C.randomize) {
                var it = l(C);
                V.push(it);
              }
              C.quality == "default" || C.quality == "proof" ? (B.push(d(C, V[0])), o.relocateComponent(O[0], B[0], C)) : o.relocateComponent(O[0], V[0], C);
            }
            var ut = w(function(G, rt) {
              if (C.quality == "default" || C.quality == "proof") {
                typeof G == "number" && (G = rt);
                var ht = void 0, mt = void 0, Lt = G.data("id");
                return B.forEach(function(yt) {
                  Lt in yt && (ht = { x: yt[Lt].getRect().getCenterX(), y: yt[Lt].getRect().getCenterY() }, mt = yt[Lt]);
                }), C.nodeDimensionsIncludeLabels && (mt.labelWidth && (mt.labelPosHorizontal == "left" ? ht.x += mt.labelWidth / 2 : mt.labelPosHorizontal == "right" && (ht.x -= mt.labelWidth / 2)), mt.labelHeight && (mt.labelPosVertical == "top" ? ht.y += mt.labelHeight / 2 : mt.labelPosVertical == "bottom" && (ht.y -= mt.labelHeight / 2))), ht == null && (ht = { x: G.position("x"), y: G.position("y") }), { x: ht.x, y: ht.y };
              } else {
                var vt = void 0;
                return V.forEach(function(yt) {
                  var xt = yt.nodeIndexes.get(G.id());
                  xt != null && (vt = { x: yt.xCoords[xt], y: yt.yCoords[xt] });
                }), vt == null && (vt = { x: G.position("x"), y: G.position("y") }), { x: vt.x, y: vt.y };
              }
            }, "getPositions");
            if (C.quality == "default" || C.quality == "proof" || C.randomize) {
              var Ct = o.calcParentsWithoutChildren(k, Y), bt = Y.filter(function(G) {
                return G.css("display") == "none";
              });
              C.eles = Y.not(bt), Y.nodes().not(":parent").not(bt).layoutPositions(_, C, ut), Ct.length > 0 && Ct.forEach(function(G) {
                G.position(ut(G));
              });
            } else console.log("If randomize option is set to false, then quality option must be 'default' or 'proof'.");
          }, "run") }]), E;
        }();
        n.exports = g;
      }, 657: (n, i, e) => {
        var a = e(548), r = e(140).layoutBase.Matrix, f = e(140).layoutBase.SVD, o = w(function(t) {
          var l = t.cy, u = t.eles, d = u.nodes(), N = u.nodes(":parent"), g = /* @__PURE__ */ new Map(), E = /* @__PURE__ */ new Map(), _ = /* @__PURE__ */ new Map(), C = [], k = [], Y = [], V = [], B = [], q = [], O = [], st = [], s = void 0, y = 1e8, m = 1e-9, v = t.piTol, p = t.samplingType, M = t.nodeSeparation, x = void 0, b = w(function() {
            for (var lt = 0, I = 0, D = false; I < x; ) {
              lt = Math.floor(Math.random() * s), D = false;
              for (var $ = 0; $ < I; $++) if (V[$] == lt) {
                D = true;
                break;
              }
              if (!D) V[I] = lt, I++;
              else continue;
            }
          }, "randomSampleCR"), U = w(function(lt, I, D) {
            for (var $ = [], Z = 0, Q = 0, pt = 0, dt = void 0, tt = [], ct = 0, Et = 1, wt = 0; wt < s; wt++) tt[wt] = y;
            for ($[Q] = lt, tt[lt] = 0; Q >= Z; ) {
              pt = $[Z++];
              for (var et = C[pt], It = 0; It < et.length; It++) dt = E.get(et[It]), tt[dt] == y && (tt[dt] = tt[pt] + 1, $[++Q] = dt);
              q[pt][I] = tt[pt] * M;
            }
            if (D) {
              for (var nt = 0; nt < s; nt++) q[nt][I] < B[nt] && (B[nt] = q[nt][I]);
              for (var at = 0; at < s; at++) B[at] > ct && (ct = B[at], Et = at);
            }
            return Et;
          }, "BFS"), X = w(function(lt) {
            var I = void 0;
            if (lt) {
              I = Math.floor(Math.random() * s);
              for (var D = 0; D < s; D++) B[D] = y;
              for (var $ = 0; $ < x; $++) V[$] = I, I = U(I, $, lt);
            } else {
              b();
              for (var Z = 0; Z < x; Z++) U(V[Z], Z, lt, false);
            }
            for (var Q = 0; Q < s; Q++) for (var pt = 0; pt < x; pt++) q[Q][pt] *= q[Q][pt];
            for (var dt = 0; dt < x; dt++) O[dt] = [];
            for (var tt = 0; tt < x; tt++) for (var ct = 0; ct < x; ct++) O[tt][ct] = q[V[ct]][tt];
          }, "allBFS"), W = w(function() {
            for (var lt = f.svd(O), I = lt.S, D = lt.U, $ = lt.V, Z = I[0] * I[0] * I[0], Q = [], pt = 0; pt < x; pt++) {
              Q[pt] = [];
              for (var dt = 0; dt < x; dt++) Q[pt][dt] = 0, pt == dt && (Q[pt][dt] = I[pt] / (I[pt] * I[pt] + Z / (I[pt] * I[pt])));
            }
            st = r.multMat(r.multMat($, Q), r.transpose(D));
          }, "sample"), j = w(function() {
            for (var lt = void 0, I = void 0, D = [], $ = [], Z = [], Q = [], pt = 0; pt < s; pt++) D[pt] = Math.random(), $[pt] = Math.random();
            D = r.normalize(D), $ = r.normalize($);
            for (var dt = 0, tt = m, ct = m, Et = void 0; ; ) {
              dt++;
              for (var wt = 0; wt < s; wt++) Z[wt] = D[wt];
              if (D = r.multGamma(r.multL(r.multGamma(Z), q, st)), lt = r.dotProduct(Z, D), D = r.normalize(D), tt = r.dotProduct(Z, D), Et = Math.abs(tt / ct), Et <= 1 + v && Et >= 1) break;
              ct = tt;
            }
            for (var et = 0; et < s; et++) Z[et] = D[et];
            for (dt = 0, ct = m; ; ) {
              dt++;
              for (var It = 0; It < s; It++) Q[It] = $[It];
              if (Q = r.minusOp(Q, r.multCons(Z, r.dotProduct(Z, Q))), $ = r.multGamma(r.multL(r.multGamma(Q), q, st)), I = r.dotProduct(Q, $), $ = r.normalize($), tt = r.dotProduct(Q, $), Et = Math.abs(tt / ct), Et <= 1 + v && Et >= 1) break;
              ct = tt;
            }
            for (var nt = 0; nt < s; nt++) Q[nt] = $[nt];
            k = r.multCons(Z, Math.sqrt(Math.abs(lt))), Y = r.multCons(Q, Math.sqrt(Math.abs(I)));
          }, "powerIteration");
          a.connectComponents(l, u, a.getTopMostNodes(d), g), N.forEach(function(lt) {
            a.connectComponents(l, u, a.getTopMostNodes(lt.descendants().intersection(u)), g);
          });
          for (var z = 0, K = 0; K < d.length; K++) d[K].isParent() || E.set(d[K].id(), z++);
          var P = true, R = false, S = void 0;
          try {
            for (var J = g.keys()[Symbol.iterator](), it; !(P = (it = J.next()).done); P = true) {
              var ut = it.value;
              E.set(ut, z++);
            }
          } catch (lt) {
            R = true, S = lt;
          } finally {
            try {
              !P && J.return && J.return();
            } finally {
              if (R) throw S;
            }
          }
          for (var Ct = 0; Ct < E.size; Ct++) C[Ct] = [];
          N.forEach(function(lt) {
            for (var I = lt.children().intersection(u); I.nodes(":childless").length == 0; ) I = I.nodes()[0].children().intersection(u);
            var D = 0, $ = I.nodes(":childless")[0].connectedEdges().length;
            I.nodes(":childless").forEach(function(Z, Q) {
              Z.connectedEdges().length < $ && ($ = Z.connectedEdges().length, D = Q);
            }), _.set(lt.id(), I.nodes(":childless")[D].id());
          }), d.forEach(function(lt) {
            var I = void 0;
            lt.isParent() ? I = E.get(_.get(lt.id())) : I = E.get(lt.id()), lt.neighborhood().nodes().forEach(function(D) {
              u.intersection(lt.edgesWith(D)).length > 0 && (D.isParent() ? C[I].push(_.get(D.id())) : C[I].push(D.id()));
            });
          });
          var bt = w(function(lt) {
            var I = E.get(lt), D = void 0;
            g.get(lt).forEach(function($) {
              l.getElementById($).isParent() ? D = _.get($) : D = $, C[I].push(D), C[E.get(D)].push(lt);
            });
          }, "_loop"), G = true, rt = false, ht = void 0;
          try {
            for (var mt = g.keys()[Symbol.iterator](), Lt; !(G = (Lt = mt.next()).done); G = true) {
              var vt = Lt.value;
              bt(vt);
            }
          } catch (lt) {
            rt = true, ht = lt;
          } finally {
            try {
              !G && mt.return && mt.return();
            } finally {
              if (rt) throw ht;
            }
          }
          s = E.size;
          var yt = void 0;
          if (s > 2) {
            x = s < t.sampleSize ? s : t.sampleSize;
            for (var xt = 0; xt < s; xt++) q[xt] = [];
            for (var Ht = 0; Ht < x; Ht++) st[Ht] = [];
            return t.quality == "draft" || t.step == "all" ? (X(p), W(), j(), yt = { nodeIndexes: E, xCoords: k, yCoords: Y }) : (E.forEach(function(lt, I) {
              k.push(l.getElementById(I).position("x")), Y.push(l.getElementById(I).position("y"));
            }), yt = { nodeIndexes: E, xCoords: k, yCoords: Y }), yt;
          } else {
            var Pt = E.keys(), Gt = l.getElementById(Pt.next().value), Ot = Gt.position(), Ut = Gt.outerWidth();
            if (k.push(Ot.x), Y.push(Ot.y), s == 2) {
              var Xt = l.getElementById(Pt.next().value), Wt = Xt.outerWidth();
              k.push(Ot.x + Ut / 2 + Wt / 2 + t.idealEdgeLength), Y.push(Ot.y);
            }
            return yt = { nodeIndexes: E, xCoords: k, yCoords: Y }, yt;
          }
        }, "spectralLayout");
        n.exports = { spectralLayout: o };
      }, 579: (n, i, e) => {
        var a = e(212), r = w(function(f) {
          f && f("layout", "fcose", a);
        }, "register");
        typeof cytoscape < "u" && r(cytoscape), n.exports = r;
      }, 140: (n) => {
        n.exports = L;
      } }, T = {};
      function c(n) {
        var i = T[n];
        if (i !== void 0) return i.exports;
        var e = T[n] = { exports: {} };
        return F[n](e, e.exports, c), e.exports;
      }
      w(c, "__webpack_require__");
      var h = c(579);
      return h;
    })();
  });
}), _e = { L: "left", R: "right", T: "top", B: "bottom" }, Ce = { L: w((A) => `${A},${A / 2} 0,${A} 0,0`, "L"), R: w((A) => `0,${A / 2} ${A},0 ${A},${A}`, "R"), T: w((A) => `0,0 ${A},0 ${A / 2},${A}`, "T"), B: w((A) => `${A / 2},0 ${A},${A} 0,${A}`, "B") }, oe = { L: w((A, H) => A - H + 2, "L"), R: w((A, H) => A - 2, "R"), T: w((A, H) => A - H + 2, "T"), B: w((A, H) => A - 2, "B") }, hi = w(function(A) {
  return kt(A) ? A === "L" ? "R" : "L" : A === "T" ? "B" : "T";
}, "getOppositeArchitectureDirection"), Le = w(function(A) {
  let H = A;
  return H === "L" || H === "R" || H === "T" || H === "B";
}, "isArchitectureDirection"), kt = w(function(A) {
  let H = A;
  return H === "L" || H === "R";
}, "isArchitectureDirectionX"), $t = w(function(A) {
  let H = A;
  return H === "T" || H === "B";
}, "isArchitectureDirectionY"), pe = w(function(A, H) {
  let L = kt(A) && $t(H), F = $t(A) && kt(H);
  return L || F;
}, "isArchitectureDirectionXY"), li = w(function(A) {
  let H = A[0], L = A[1], F = kt(H) && $t(L), T = $t(H) && kt(L);
  return F || T;
}, "isArchitecturePairXY"), di = w(function(A) {
  return A !== "LL" && A !== "RR" && A !== "TT" && A !== "BB";
}, "isValidArchitectureDirectionPair"), ge = w(function(A, H) {
  let L = `${A}${H}`;
  return di(L) ? L : void 0;
}, "getArchitectureDirectionPair"), gi = w(function([A, H], L) {
  let F = L[0], T = L[1];
  return kt(F) ? $t(T) ? [A + (F === "L" ? -1 : 1), H + (T === "T" ? 1 : -1)] : [A + (F === "L" ? -1 : 1), H] : kt(T) ? [A + (T === "L" ? 1 : -1), H + (F === "T" ? 1 : -1)] : [A, H + (F === "T" ? 1 : -1)];
}, "shiftPositionByArchitectureDirectionPair"), ci = w(function(A) {
  return A === "LT" || A === "TL" ? [1, 1] : A === "BL" || A === "LB" ? [1, -1] : A === "BR" || A === "RB" ? [-1, -1] : [-1, 1];
}, "getArchitectureDirectionXYFactors"), ui = w(function(A, H) {
  return pe(A, H) ? "bend" : kt(A) ? "horizontal" : "vertical";
}, "getArchitectureDirectionAlignment"), fi = w(function(A) {
  return A.type === "service";
}, "isArchitectureService"), pi = w(function(A) {
  return A.type === "junction";
}, "isArchitectureJunction"), Oe = w((A) => A.data(), "edgeData"), ee = w((A) => A.data(), "nodeData"), mi = Qe.architecture, be = (_a = class {
  constructor() {
    this.nodes = {}, this.groups = {}, this.edges = [], this.registeredIds = {}, this.elements = {}, this.setAccTitle = Be, this.getAccTitle = We, this.setDiagramTitle = je, this.getDiagramTitle = $e, this.getAccDescription = qe, this.setAccDescription = Je, this.clear();
  }
  clear() {
    this.nodes = {}, this.groups = {}, this.edges = [], this.registeredIds = {}, this.dataStructures = void 0, this.elements = {}, Ze();
  }
  addService({ id: A, icon: H, in: L, title: F, iconText: T }) {
    if (this.registeredIds[A] !== void 0) throw new Error(`The service id [${A}] is already in use by another ${this.registeredIds[A]}`);
    if (L !== void 0) {
      if (A === L) throw new Error(`The service [${A}] cannot be placed within itself`);
      if (this.registeredIds[L] === void 0) throw new Error(`The service [${A}]'s parent does not exist. Please make sure the parent is created before this service`);
      if (this.registeredIds[L] === "node") throw new Error(`The service [${A}]'s parent is not a group`);
    }
    this.registeredIds[A] = "node", this.nodes[A] = { id: A, type: "service", icon: H, iconText: T, title: F, edges: [], in: L };
  }
  getServices() {
    return Object.values(this.nodes).filter(fi);
  }
  addJunction({ id: A, in: H }) {
    if (this.registeredIds[A] !== void 0) throw new Error(`The junction id [${A}] is already in use by another ${this.registeredIds[A]}`);
    if (H !== void 0) {
      if (A === H) throw new Error(`The junction [${A}] cannot be placed within itself`);
      if (this.registeredIds[H] === void 0) throw new Error(`The junction [${A}]'s parent does not exist. Please make sure the parent is created before this junction`);
      if (this.registeredIds[H] === "node") throw new Error(`The junction [${A}]'s parent is not a group`);
    }
    this.registeredIds[A] = "node", this.nodes[A] = { id: A, type: "junction", edges: [], in: H };
  }
  getJunctions() {
    return Object.values(this.nodes).filter(pi);
  }
  getNodes() {
    return Object.values(this.nodes);
  }
  getNode(A) {
    return this.nodes[A] ?? null;
  }
  addGroup({ id: A, icon: H, in: L, title: F }) {
    var _a2, _b, _c;
    if (((_a2 = this.registeredIds) == null ? void 0 : _a2[A]) !== void 0) throw new Error(`The group id [${A}] is already in use by another ${this.registeredIds[A]}`);
    if (L !== void 0) {
      if (A === L) throw new Error(`The group [${A}] cannot be placed within itself`);
      if (((_b = this.registeredIds) == null ? void 0 : _b[L]) === void 0) throw new Error(`The group [${A}]'s parent does not exist. Please make sure the parent is created before this group`);
      if (((_c = this.registeredIds) == null ? void 0 : _c[L]) === "node") throw new Error(`The group [${A}]'s parent is not a group`);
    }
    this.registeredIds[A] = "group", this.groups[A] = { id: A, icon: H, title: F, in: L };
  }
  getGroups() {
    return Object.values(this.groups);
  }
  addEdge({ lhsId: A, rhsId: H, lhsDir: L, rhsDir: F, lhsInto: T, rhsInto: c, lhsGroup: h, rhsGroup: n, title: i }) {
    if (!Le(L)) throw new Error(`Invalid direction given for left hand side of edge ${A}--${H}. Expected (L,R,T,B) got ${String(L)}`);
    if (!Le(F)) throw new Error(`Invalid direction given for right hand side of edge ${A}--${H}. Expected (L,R,T,B) got ${String(F)}`);
    if (this.nodes[A] === void 0 && this.groups[A] === void 0) throw new Error(`The left-hand id [${A}] does not yet exist. Please create the service/group before declaring an edge to it.`);
    if (this.nodes[H] === void 0 && this.groups[H] === void 0) throw new Error(`The right-hand id [${H}] does not yet exist. Please create the service/group before declaring an edge to it.`);
    let e = this.nodes[A].in, a = this.nodes[H].in;
    if (h && e && a && e == a) throw new Error(`The left-hand id [${A}] is modified to traverse the group boundary, but the edge does not pass through two groups.`);
    if (n && e && a && e == a) throw new Error(`The right-hand id [${H}] is modified to traverse the group boundary, but the edge does not pass through two groups.`);
    let r = { lhsId: A, lhsDir: L, lhsInto: T, lhsGroup: h, rhsId: H, rhsDir: F, rhsInto: c, rhsGroup: n, title: i };
    this.edges.push(r), this.nodes[A] && this.nodes[H] && (this.nodes[A].edges.push(this.edges[this.edges.length - 1]), this.nodes[H].edges.push(this.edges[this.edges.length - 1]));
  }
  getEdges() {
    return this.edges;
  }
  getDataStructures() {
    if (this.dataStructures === void 0) {
      let A = {}, H = Object.entries(this.nodes).reduce((n, [i, e]) => (n[i] = e.edges.reduce((a, r) => {
        var _a2, _b;
        let f = (_a2 = this.getNode(r.lhsId)) == null ? void 0 : _a2.in, o = (_b = this.getNode(r.rhsId)) == null ? void 0 : _b.in;
        if (f && o && f !== o) {
          let t = ui(r.lhsDir, r.rhsDir);
          t !== "bend" && (A[f] ?? (A[f] = {}), A[f][o] = t, A[o] ?? (A[o] = {}), A[o][f] = t);
        }
        if (r.lhsId === i) {
          let t = ge(r.lhsDir, r.rhsDir);
          t && (a[t] = r.rhsId);
        } else {
          let t = ge(r.rhsDir, r.lhsDir);
          t && (a[t] = r.lhsId);
        }
        return a;
      }, {}), n), {}), L = Object.keys(H)[0], F = { [L]: 1 }, T = Object.keys(H).reduce((n, i) => i === L ? n : { ...n, [i]: 1 }, {}), c = w((n) => {
        let i = { [n]: [0, 0] }, e = [n];
        for (; e.length > 0; ) {
          let a = e.shift();
          if (a) {
            F[a] = 1, delete T[a];
            let r = H[a], [f, o] = i[a];
            Object.entries(r).forEach(([t, l]) => {
              F[l] || (i[l] = gi([f, o], t), e.push(l));
            });
          }
        }
        return i;
      }, "BFS"), h = [c(L)];
      for (; Object.keys(T).length > 0; ) h.push(c(Object.keys(T)[0]));
      this.dataStructures = { adjList: H, spatialMaps: h, groupAlignments: A };
    }
    return this.dataStructures;
  }
  setElementForId(A, H) {
    this.elements[A] = H;
  }
  getElementById(A) {
    return this.elements[A];
  }
  getConfig() {
    return Ke({ ...mi, ...ti().architecture });
  }
  getConfigField(A) {
    return this.getConfig()[A];
  }
}, w(_a, "ArchitectureDB"), _a), vi = w((A, H) => {
  Ye(A, H), A.groups.map((L) => H.addGroup(L)), A.services.map((L) => H.addService({ ...L, type: "service" })), A.junctions.map((L) => H.addJunction({ ...L, type: "junction" })), A.edges.map((L) => H.addEdge(L));
}, "populateDb"), Me = { parser: { yy: void 0 }, parse: w(async (A) => {
  var _a2;
  let H = await He("architecture", A);
  Ie.debug(H);
  let L = (_a2 = Me.parser) == null ? void 0 : _a2.yy;
  if (!(L instanceof be)) throw new Error("parser.parser?.yy was not a ArchitectureDB. This is due to a bug within Mermaid, please report this issue at https://github.com/mermaid-js/mermaid/issues.");
  vi(H, L);
}, "parse") }, yi = w((A) => `
  .edge {
    stroke-width: ${A.archEdgeWidth};
    stroke: ${A.archEdgeColor};
    fill: none;
  }

  .arrow {
    fill: ${A.archEdgeArrowColor};
  }

  .node-bkg {
    fill: none;
    stroke: ${A.archGroupBorderColor};
    stroke-width: ${A.archGroupBorderWidth};
    stroke-dasharray: 8;
  }
  .node-icon-text {
    display: flex; 
    align-items: center;
  }
  
  .node-icon-text > div {
    color: #fff;
    margin: 1px;
    height: fit-content;
    text-align: center;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
  }
`, "getStyles"), Ei = yi, Ni = ni(si()), te = w((A) => `<g><rect width="80" height="80" style="fill: #087ebf; stroke-width: 0px;"/>${A}</g>`, "wrapIcon"), re = { prefix: "mermaid-architecture", height: 80, width: 80, icons: { database: { body: te('<path id="b" data-name="4" d="m20,57.86c0,3.94,8.95,7.14,20,7.14s20-3.2,20-7.14" style="fill: none; stroke: #fff; stroke-miterlimit: 10; stroke-width: 2px;"/><path id="c" data-name="3" d="m20,45.95c0,3.94,8.95,7.14,20,7.14s20-3.2,20-7.14" style="fill: none; stroke: #fff; stroke-miterlimit: 10; stroke-width: 2px;"/><path id="d" data-name="2" d="m20,34.05c0,3.94,8.95,7.14,20,7.14s20-3.2,20-7.14" style="fill: none; stroke: #fff; stroke-miterlimit: 10; stroke-width: 2px;"/><ellipse id="e" data-name="1" cx="40" cy="22.14" rx="20" ry="7.14" style="fill: none; stroke: #fff; stroke-miterlimit: 10; stroke-width: 2px;"/><line x1="20" y1="57.86" x2="20" y2="22.14" style="fill: none; stroke: #fff; stroke-miterlimit: 10; stroke-width: 2px;"/><line x1="60" y1="57.86" x2="60" y2="22.14" style="fill: none; stroke: #fff; stroke-miterlimit: 10; stroke-width: 2px;"/>') }, server: { body: te('<rect x="17.5" y="17.5" width="45" height="45" rx="2" ry="2" style="fill: none; stroke: #fff; stroke-miterlimit: 10; stroke-width: 2px;"/><line x1="17.5" y1="32.5" x2="62.5" y2="32.5" style="fill: none; stroke: #fff; stroke-miterlimit: 10; stroke-width: 2px;"/><line x1="17.5" y1="47.5" x2="62.5" y2="47.5" style="fill: none; stroke: #fff; stroke-miterlimit: 10; stroke-width: 2px;"/><g><path d="m56.25,25c0,.27-.45.5-1,.5h-10.5c-.55,0-1-.23-1-.5s.45-.5,1-.5h10.5c.55,0,1,.23,1,.5Z" style="fill: #fff; stroke-width: 0px;"/><path d="m56.25,25c0,.27-.45.5-1,.5h-10.5c-.55,0-1-.23-1-.5s.45-.5,1-.5h10.5c.55,0,1,.23,1,.5Z" style="fill: none; stroke: #fff; stroke-miterlimit: 10;"/></g><g><path d="m56.25,40c0,.27-.45.5-1,.5h-10.5c-.55,0-1-.23-1-.5s.45-.5,1-.5h10.5c.55,0,1,.23,1,.5Z" style="fill: #fff; stroke-width: 0px;"/><path d="m56.25,40c0,.27-.45.5-1,.5h-10.5c-.55,0-1-.23-1-.5s.45-.5,1-.5h10.5c.55,0,1,.23,1,.5Z" style="fill: none; stroke: #fff; stroke-miterlimit: 10;"/></g><g><path d="m56.25,55c0,.27-.45.5-1,.5h-10.5c-.55,0-1-.23-1-.5s.45-.5,1-.5h10.5c.55,0,1,.23,1,.5Z" style="fill: #fff; stroke-width: 0px;"/><path d="m56.25,55c0,.27-.45.5-1,.5h-10.5c-.55,0-1-.23-1-.5s.45-.5,1-.5h10.5c.55,0,1,.23,1,.5Z" style="fill: none; stroke: #fff; stroke-miterlimit: 10;"/></g><g><circle cx="32.5" cy="25" r=".75" style="fill: #fff; stroke: #fff; stroke-miterlimit: 10;"/><circle cx="27.5" cy="25" r=".75" style="fill: #fff; stroke: #fff; stroke-miterlimit: 10;"/><circle cx="22.5" cy="25" r=".75" style="fill: #fff; stroke: #fff; stroke-miterlimit: 10;"/></g><g><circle cx="32.5" cy="40" r=".75" style="fill: #fff; stroke: #fff; stroke-miterlimit: 10;"/><circle cx="27.5" cy="40" r=".75" style="fill: #fff; stroke: #fff; stroke-miterlimit: 10;"/><circle cx="22.5" cy="40" r=".75" style="fill: #fff; stroke: #fff; stroke-miterlimit: 10;"/></g><g><circle cx="32.5" cy="55" r=".75" style="fill: #fff; stroke: #fff; stroke-miterlimit: 10;"/><circle cx="27.5" cy="55" r=".75" style="fill: #fff; stroke: #fff; stroke-miterlimit: 10;"/><circle cx="22.5" cy="55" r=".75" style="fill: #fff; stroke: #fff; stroke-miterlimit: 10;"/></g>') }, disk: { body: te('<rect x="20" y="15" width="40" height="50" rx="1" ry="1" style="fill: none; stroke: #fff; stroke-miterlimit: 10; stroke-width: 2px;"/><ellipse cx="24" cy="19.17" rx=".8" ry=".83" style="fill: none; stroke: #fff; stroke-miterlimit: 10; stroke-width: 2px;"/><ellipse cx="56" cy="19.17" rx=".8" ry=".83" style="fill: none; stroke: #fff; stroke-miterlimit: 10; stroke-width: 2px;"/><ellipse cx="24" cy="60.83" rx=".8" ry=".83" style="fill: none; stroke: #fff; stroke-miterlimit: 10; stroke-width: 2px;"/><ellipse cx="56" cy="60.83" rx=".8" ry=".83" style="fill: none; stroke: #fff; stroke-miterlimit: 10; stroke-width: 2px;"/><ellipse cx="40" cy="33.75" rx="14" ry="14.58" style="fill: none; stroke: #fff; stroke-miterlimit: 10; stroke-width: 2px;"/><ellipse cx="40" cy="33.75" rx="4" ry="4.17" style="fill: #fff; stroke: #fff; stroke-miterlimit: 10; stroke-width: 2px;"/><path d="m37.51,42.52l-4.83,13.22c-.26.71-1.1,1.02-1.76.64l-4.18-2.42c-.66-.38-.81-1.26-.33-1.84l9.01-10.8c.88-1.05,2.56-.08,2.09,1.2Z" style="fill: #fff; stroke-width: 0px;"/>') }, internet: { body: te('<circle cx="40" cy="40" r="22.5" style="fill: none; stroke: #fff; stroke-miterlimit: 10; stroke-width: 2px;"/><line x1="40" y1="17.5" x2="40" y2="62.5" style="fill: none; stroke: #fff; stroke-miterlimit: 10; stroke-width: 2px;"/><line x1="17.5" y1="40" x2="62.5" y2="40" style="fill: none; stroke: #fff; stroke-miterlimit: 10; stroke-width: 2px;"/><path d="m39.99,17.51c-15.28,11.1-15.28,33.88,0,44.98" style="fill: none; stroke: #fff; stroke-miterlimit: 10; stroke-width: 2px;"/><path d="m40.01,17.51c15.28,11.1,15.28,33.88,0,44.98" style="fill: none; stroke: #fff; stroke-miterlimit: 10; stroke-width: 2px;"/><line x1="19.75" y1="30.1" x2="60.25" y2="30.1" style="fill: none; stroke: #fff; stroke-miterlimit: 10; stroke-width: 2px;"/><line x1="19.75" y1="49.9" x2="60.25" y2="49.9" style="fill: none; stroke: #fff; stroke-miterlimit: 10; stroke-width: 2px;"/>') }, cloud: { body: te('<path d="m65,47.5c0,2.76-2.24,5-5,5H20c-2.76,0-5-2.24-5-5,0-1.87,1.03-3.51,2.56-4.36-.04-.21-.06-.42-.06-.64,0-2.6,2.48-4.74,5.65-4.97,1.65-4.51,6.34-7.76,11.85-7.76.86,0,1.69.08,2.5.23,2.09-1.57,4.69-2.5,7.5-2.5,6.1,0,11.19,4.38,12.28,10.17,2.14.56,3.72,2.51,3.72,4.83,0,.03,0,.07-.01.1,2.29.46,4.01,2.48,4.01,4.9Z" style="fill: none; stroke: #fff; stroke-miterlimit: 10; stroke-width: 2px;"/>') }, unknown: ai, blank: { body: te("") } } }, Ti = w(async function(A, H, L) {
  let F = L.getConfigField("padding"), T = L.getConfigField("iconSize"), c = T / 2, h = T / 6, n = h / 2;
  await Promise.all(H.edges().map(async (i) => {
    var _a2, _b;
    let { source: e, sourceDir: a, sourceArrow: r, sourceGroup: f, target: o, targetDir: t, targetArrow: l, targetGroup: u, label: d } = Oe(i), { x: N, y: g } = i[0].sourceEndpoint(), { x: E, y: _ } = i[0].midpoint(), { x: C, y: k } = i[0].targetEndpoint(), Y = F + 4;
    if (f && (kt(a) ? N += a === "L" ? -Y : Y : g += a === "T" ? -Y : Y + 18), u && (kt(t) ? C += t === "L" ? -Y : Y : k += t === "T" ? -Y : Y + 18), !f && ((_a2 = L.getNode(e)) == null ? void 0 : _a2.type) === "junction" && (kt(a) ? N += a === "L" ? c : -c : g += a === "T" ? c : -c), !u && ((_b = L.getNode(o)) == null ? void 0 : _b.type) === "junction" && (kt(t) ? C += t === "L" ? c : -c : k += t === "T" ? c : -c), i[0]._private.rscratch) {
      let V = A.insert("g");
      if (V.insert("path").attr("d", `M ${N},${g} L ${E},${_} L${C},${k} `).attr("class", "edge").attr("id", ri(e, o, { prefix: "L" })), r) {
        let B = kt(a) ? oe[a](N, h) : N - n, q = $t(a) ? oe[a](g, h) : g - n;
        V.insert("polygon").attr("points", Ce[a](h)).attr("transform", `translate(${B},${q})`).attr("class", "arrow");
      }
      if (l) {
        let B = kt(t) ? oe[t](C, h) : C - n, q = $t(t) ? oe[t](k, h) : k - n;
        V.insert("polygon").attr("points", Ce[t](h)).attr("transform", `translate(${B},${q})`).attr("class", "arrow");
      }
      if (d) {
        let B = pe(a, t) ? "XY" : kt(a) ? "X" : "Y", q = 0;
        B === "X" ? q = Math.abs(N - C) : B === "Y" ? q = Math.abs(g - k) / 1.5 : q = Math.abs(N - C) / 2;
        let O = V.append("g");
        if (await ue(O, d, { useHtmlLabels: false, width: q, classes: "architecture-service-label" }, ce()), O.attr("dy", "1em").attr("alignment-baseline", "middle").attr("dominant-baseline", "middle").attr("text-anchor", "middle"), B === "X") O.attr("transform", "translate(" + E + ", " + _ + ")");
        else if (B === "Y") O.attr("transform", "translate(" + E + ", " + _ + ") rotate(-90)");
        else if (B === "XY") {
          let st = ge(a, t);
          if (st && li(st)) {
            let s = O.node().getBoundingClientRect(), [y, m] = ci(st);
            O.attr("dominant-baseline", "auto").attr("transform", `rotate(${-1 * y * m * 45})`);
            let v = O.node().getBoundingClientRect();
            O.attr("transform", `
                translate(${E}, ${_ - s.height / 2})
                translate(${y * v.width / 2}, ${m * v.height / 2})
                rotate(${-1 * y * m * 45}, 0, ${s.height / 2})
              `);
          }
        }
      }
    }
  }));
}, "drawEdges"), Ai = w(async function(A, H, L) {
  let F = L.getConfigField("padding") * 0.75, T = L.getConfigField("fontSize"), c = L.getConfigField("iconSize") / 2;
  await Promise.all(H.nodes().map(async (h) => {
    let n = ee(h);
    if (n.type === "group") {
      let { h: i, w: e, x1: a, y1: r } = h.boundingBox(), f = A.append("rect");
      f.attr("id", `group-${n.id}`).attr("x", a + c).attr("y", r + c).attr("width", e).attr("height", i).attr("class", "node-bkg");
      let o = A.append("g"), t = a, l = r;
      if (n.icon) {
        let u = o.append("g");
        u.html(`<g>${await de(n.icon, { height: F, width: F, fallbackPrefix: re.prefix })}</g>`), u.attr("transform", "translate(" + (t + c + 1) + ", " + (l + c + 1) + ")"), t += F, l += T / 2 - 1 - 2;
      }
      if (n.label) {
        let u = o.append("g");
        await ue(u, n.label, { useHtmlLabels: false, width: e, classes: "architecture-service-label" }, ce()), u.attr("dy", "1em").attr("alignment-baseline", "middle").attr("dominant-baseline", "start").attr("text-anchor", "start"), u.attr("transform", "translate(" + (t + c + 4) + ", " + (l + c + 2) + ")");
      }
      L.setElementForId(n.id, f);
    }
  }));
}, "drawGroups"), wi = w(async function(A, H, L) {
  let F = ce();
  for (let T of L) {
    let c = H.append("g"), h = A.getConfigField("iconSize");
    if (T.title) {
      let a = c.append("g");
      await ue(a, T.title, { useHtmlLabels: false, width: h * 1.5, classes: "architecture-service-label" }, F), a.attr("dy", "1em").attr("alignment-baseline", "middle").attr("dominant-baseline", "middle").attr("text-anchor", "middle"), a.attr("transform", "translate(" + h / 2 + ", " + h + ")");
    }
    let n = c.append("g");
    if (T.icon) n.html(`<g>${await de(T.icon, { height: h, width: h, fallbackPrefix: re.prefix })}</g>`);
    else if (T.iconText) {
      n.html(`<g>${await de("blank", { height: h, width: h, fallbackPrefix: re.prefix })}</g>`);
      let a = n.append("g").append("foreignObject").attr("width", h).attr("height", h).append("div").attr("class", "node-icon-text").attr("style", `height: ${h}px;`).append("div").html(ei(T.iconText, F)), r = parseInt(window.getComputedStyle(a.node(), null).getPropertyValue("font-size").replace(/\D/g, "")) ?? 16;
      a.attr("style", `-webkit-line-clamp: ${Math.floor((h - 2) / r)};`);
    } else n.append("path").attr("class", "node-bkg").attr("id", "node-" + T.id).attr("d", `M0,${h} V5 Q0,0 5,0 H${h - 5} Q${h},0 ${h},5 V${h} Z`);
    c.attr("id", `service-${T.id}`).attr("class", "architecture-service");
    let { width: i, height: e } = c.node().getBBox();
    T.width = i, T.height = e, A.setElementForId(T.id, c);
  }
  return 0;
}, "drawServices"), _i = w(function(A, H, L) {
  L.forEach((F) => {
    let T = H.append("g"), c = A.getConfigField("iconSize");
    T.append("g").append("rect").attr("id", "node-" + F.id).attr("fill-opacity", "0").attr("width", c).attr("height", c), T.attr("class", "architecture-junction");
    let { width: h, height: n } = T._groups[0][0].getBBox();
    T.width = h, T.height = n, A.setElementForId(F.id, T);
  });
}, "drawJunctions");
oi([{ name: re.prefix, icons: re }]);
xe.use(Ni.default);
function Re(A, H, L) {
  A.forEach((F) => {
    H.add({ group: "nodes", data: { type: "service", id: F.id, icon: F.icon, label: F.title, parent: F.in, width: L.getConfigField("iconSize"), height: L.getConfigField("iconSize") }, classes: "node-service" });
  });
}
w(Re, "addServices");
function De(A, H, L) {
  A.forEach((F) => {
    H.add({ group: "nodes", data: { type: "junction", id: F.id, parent: F.in, width: L.getConfigField("iconSize"), height: L.getConfigField("iconSize") }, classes: "node-junction" });
  });
}
w(De, "addJunctions");
function Fe(A, H) {
  H.nodes().map((L) => {
    let F = ee(L);
    F.type !== "group" && (F.x = L.position().x, F.y = L.position().y, A.getElementById(F.id).attr("transform", "translate(" + (F.x || 0) + "," + (F.y || 0) + ")"));
  });
}
w(Fe, "positionNodes");
function Se(A, H) {
  A.forEach((L) => {
    H.add({ group: "nodes", data: { type: "group", id: L.id, icon: L.icon, label: L.title, parent: L.in }, classes: "node-group" });
  });
}
w(Se, "addGroups");
function Ge(A, H) {
  A.forEach((L) => {
    let { lhsId: F, rhsId: T, lhsInto: c, lhsGroup: h, rhsInto: n, lhsDir: i, rhsDir: e, rhsGroup: a, title: r } = L, f = pe(L.lhsDir, L.rhsDir) ? "segments" : "straight", o = { id: `${F}-${T}`, label: r, source: F, sourceDir: i, sourceArrow: c, sourceGroup: h, sourceEndpoint: i === "L" ? "0 50%" : i === "R" ? "100% 50%" : i === "T" ? "50% 0" : "50% 100%", target: T, targetDir: e, targetArrow: n, targetGroup: a, targetEndpoint: e === "L" ? "0 50%" : e === "R" ? "100% 50%" : e === "T" ? "50% 0" : "50% 100%" };
    H.add({ group: "edges", data: o, classes: f });
  });
}
w(Ge, "addEdges");
function Pe(A, H, L) {
  let F = w((n, i) => Object.entries(n).reduce((e, [a, r]) => {
    var _a2;
    let f = 0, o = Object.entries(r);
    if (o.length === 1) return e[a] = o[0][1], e;
    for (let t = 0; t < o.length - 1; t++) for (let l = t + 1; l < o.length; l++) {
      let [u, d] = o[t], [N, g] = o[l];
      if (((_a2 = L[u]) == null ? void 0 : _a2[N]) === i) e[a] ?? (e[a] = []), e[a] = [...e[a], ...d, ...g];
      else if (u === "default" || N === "default") e[a] ?? (e[a] = []), e[a] = [...e[a], ...d, ...g];
      else {
        let E = `${a}-${f++}`;
        e[E] = d;
        let _ = `${a}-${f++}`;
        e[_] = g;
      }
    }
    return e;
  }, {}), "flattenAlignments"), T = H.map((n) => {
    let i = {}, e = {};
    return Object.entries(n).forEach(([a, [r, f]]) => {
      var _a2, _b, _c;
      let o = ((_a2 = A.getNode(a)) == null ? void 0 : _a2.in) ?? "default";
      i[f] ?? (i[f] = {}), (_b = i[f])[o] ?? (_b[o] = []), i[f][o].push(a), e[r] ?? (e[r] = {}), (_c = e[r])[o] ?? (_c[o] = []), e[r][o].push(a);
    }), { horiz: Object.values(F(i, "horizontal")).filter((a) => a.length > 1), vert: Object.values(F(e, "vertical")).filter((a) => a.length > 1) };
  }), [c, h] = T.reduce(([n, i], { horiz: e, vert: a }) => [[...n, ...e], [...i, ...a]], [[], []]);
  return { horizontal: c, vertical: h };
}
w(Pe, "getAlignments");
function ke(A, H) {
  let L = [], F = w((c) => `${c[0]},${c[1]}`, "posToStr"), T = w((c) => c.split(",").map((h) => parseInt(h)), "strToPos");
  return A.forEach((c) => {
    let h = Object.fromEntries(Object.entries(c).map(([a, r]) => [F(r), a])), n = [F([0, 0])], i = {}, e = { L: [-1, 0], R: [1, 0], T: [0, 1], B: [0, -1] };
    for (; n.length > 0; ) {
      let a = n.shift();
      if (a) {
        i[a] = 1;
        let r = h[a];
        if (r) {
          let f = T(a);
          Object.entries(e).forEach(([o, t]) => {
            let l = F([f[0] + t[0], f[1] + t[1]]), u = h[l];
            u && !i[l] && (n.push(l), L.push({ [_e[o]]: u, [_e[hi(o)]]: r, gap: 1.5 * H.getConfigField("iconSize") }));
          });
        }
      }
    }
  }), L;
}
w(ke, "getRelativeConstraints");
function Ue(A, H, L, F, T, { spatialMaps: c, groupAlignments: h }) {
  return new Promise((n) => {
    let i = ii("body").append("div").attr("id", "cy").attr("style", "display:none"), e = xe({ container: document.getElementById("cy"), style: [{ selector: "edge", style: { "curve-style": "straight", label: "data(label)", "source-endpoint": "data(sourceEndpoint)", "target-endpoint": "data(targetEndpoint)" } }, { selector: "edge.segments", style: { "curve-style": "segments", "segment-weights": "0", "segment-distances": [0.5], "edge-distances": "endpoints", "source-endpoint": "data(sourceEndpoint)", "target-endpoint": "data(targetEndpoint)" } }, { selector: "node", style: { "compound-sizing-wrt-labels": "include" } }, { selector: "node[label]", style: { "text-valign": "bottom", "text-halign": "center", "font-size": `${T.getConfigField("fontSize")}px` } }, { selector: ".node-service", style: { label: "data(label)", width: "data(width)", height: "data(height)" } }, { selector: ".node-junction", style: { width: "data(width)", height: "data(height)" } }, { selector: ".node-group", style: { padding: `${T.getConfigField("padding")}px` } }], layout: { name: "grid", boundingBox: { x1: 0, x2: 100, y1: 0, y2: 100 } } });
    i.remove(), Se(L, e), Re(A, e, T), De(H, e, T), Ge(F, e);
    let a = Pe(T, c, h), r = ke(c, T), f = e.layout({ name: "fcose", quality: "proof", styleEnabled: false, animate: false, nodeDimensionsIncludeLabels: false, idealEdgeLength(o) {
      let [t, l] = o.connectedNodes(), { parent: u } = ee(t), { parent: d } = ee(l);
      return u === d ? 1.5 * T.getConfigField("iconSize") : 0.5 * T.getConfigField("iconSize");
    }, edgeElasticity(o) {
      let [t, l] = o.connectedNodes(), { parent: u } = ee(t), { parent: d } = ee(l);
      return u === d ? 0.45 : 1e-3;
    }, alignmentConstraint: a, relativePlacementConstraint: r });
    f.one("layoutstop", () => {
      var _a2;
      function o(t, l, u, d) {
        let N, g, { x: E, y: _ } = t, { x: C, y: k } = l;
        g = (d - _ + (E - u) * (_ - k) / (E - C)) / Math.sqrt(1 + Math.pow((_ - k) / (E - C), 2)), N = Math.sqrt(Math.pow(d - _, 2) + Math.pow(u - E, 2) - Math.pow(g, 2));
        let Y = Math.sqrt(Math.pow(C - E, 2) + Math.pow(k - _, 2));
        N = N / Y;
        let V = (C - E) * (d - _) - (k - _) * (u - E);
        switch (true) {
          case V >= 0:
            V = 1;
            break;
          case V < 0:
            V = -1;
            break;
        }
        let B = (C - E) * (u - E) + (k - _) * (d - _);
        switch (true) {
          case B >= 0:
            B = 1;
            break;
          case B < 0:
            B = -1;
            break;
        }
        return g = Math.abs(g) * V, N = N * B, { distances: g, weights: N };
      }
      w(o, "getSegmentWeights"), e.startBatch();
      for (let t of Object.values(e.edges())) if ((_a2 = t.data) == null ? void 0 : _a2.call(t)) {
        let { x: l, y: u } = t.source().position(), { x: d, y: N } = t.target().position();
        if (l !== d && u !== N) {
          let g = t.sourceEndpoint(), E = t.targetEndpoint(), { sourceDir: _ } = Oe(t), [C, k] = $t(_) ? [g.x, E.y] : [E.x, g.y], { weights: Y, distances: V } = o(g, E, C, k);
          t.style("segment-distances", V), t.style("segment-weights", Y);
        }
      }
      e.endBatch(), f.run();
    }), f.run(), e.ready((o) => {
      Ie.info("Ready", o), n(e);
    });
  });
}
w(Ue, "layoutArchitecture");
var Ci = w(async (A, H, L, F) => {
  let T = F.db, c = T.getServices(), h = T.getJunctions(), n = T.getGroups(), i = T.getEdges(), e = T.getDataStructures(), a = ze(H), r = a.append("g");
  r.attr("class", "architecture-edges");
  let f = a.append("g");
  f.attr("class", "architecture-services");
  let o = a.append("g");
  o.attr("class", "architecture-groups"), await wi(T, f, c), _i(T, f, h);
  let t = await Ue(c, h, n, i, T, e);
  await Ti(r, t, T), await Ai(o, t, T), Fe(T, t), Ve(void 0, a, T.getConfigField("padding"), T.getConfigField("useMaxWidth"));
}, "draw"), Li = { draw: Ci }, Ri = { parser: Me, get db() {
  return new be();
}, renderer: Li, styles: Ei };
export {
  Ri as diagram
};
