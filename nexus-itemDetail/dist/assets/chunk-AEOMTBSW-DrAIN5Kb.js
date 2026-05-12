import { m as e } from "./index-CRtis_Gf.js";
function a(c, t) {
  var _a, _b, _c;
  c.accDescr && ((_a = t.setAccDescription) == null ? void 0 : _a.call(t, c.accDescr)), c.accTitle && ((_b = t.setAccTitle) == null ? void 0 : _b.call(t, c.accTitle)), c.title && ((_c = t.setDiagramTitle) == null ? void 0 : _c.call(t, c.title));
}
e(a, "populateCommonDb");
export {
  a as c
};
