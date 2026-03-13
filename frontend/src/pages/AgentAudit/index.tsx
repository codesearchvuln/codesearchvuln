import { Zap, Bot, Layers, ArrowRight, GitBranch, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import { useLogoVariant } from "@/shared/branding/useLogoVariant";

declare global {
  interface Window {
    VANTA?: {
      NET: (config: Record<string, unknown>) => { destroy: () => void };
    };
    THREE?: unknown;
  }
}

type HomeScanCard = {
  key: "static" | "agent" | "hybrid";
  title: string;
  intro: string;
  icon: typeof Zap;
  targetRoute: string;
};

const homeScanCards: HomeScanCard[] = [
  {
    key: "static",
    title: "静态扫描",
    intro: "规则驱动漏洞检测",
    icon: Zap,
    targetRoute: "/tasks/static?openCreate=1&source=home-card",
  },
  {
    key: "agent",
    title: "智能扫描",
    intro: "AI Agent 代码推理",
    icon: Bot,
    targetRoute: "/tasks/intelligent?openCreate=1&source=home-card",
  },
  {
    key: "hybrid",
    title: "混合扫描",
    intro: "静态分析 + AI 推理",
    icon: Layers,
    targetRoute: "/tasks/hybrid?openCreate=1&source=home-card",
  },
];

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

// ═══════════════════════════════════════════════════════════════════
//  Resizable + Draggable Modal
// ═══════════════════════════════════════════════════════════════════

const MIN_W = 400;
const MIN_H = 300;
const DEFAULT_W = 860;
const DEFAULT_H = 580;

interface ModalRect { x: number; y: number; w: number; h: number }

function GitNexusModal({ onClose }: { onClose: () => void }) {
  const [rect, setRect] = useState<ModalRect>(() => ({
    x: Math.max(0, (window.innerWidth  - DEFAULT_W) / 2),
    y: Math.max(0, (window.innerHeight - DEFAULT_H) / 2),
    w: DEFAULT_W,
    h: DEFAULT_H,
  }));
  const [minimized, setMinimized] = useState(false);

  // refs so mousemove handler always has fresh values without re-binding
  const dragRef   = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const resizeRef = useRef<{ edge: string; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } | null>(null);

  // global mouse tracking
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragRef.current) {
        const d = dragRef.current;
        setRect(r => ({
          ...r,
          x: Math.max(0, Math.min(window.innerWidth  - r.w, d.ox + e.clientX - d.sx)),
          y: Math.max(0, Math.min(window.innerHeight - 40,  d.oy + e.clientY - d.sy)),
        }));
      }
      if (resizeRef.current) {
        const r = resizeRef.current;
        const dx = e.clientX - r.sx;
        const dy = e.clientY - r.sy;
        setRect(prev => {
          let { x, y, w, h } = { x: r.ox, y: r.oy, w: r.ow, h: r.oh };
          if (r.edge.includes("e")) w = Math.max(MIN_W, r.ow + dx);
          if (r.edge.includes("s")) h = Math.max(MIN_H, r.oh + dy);
          if (r.edge.includes("w")) { const nw = Math.max(MIN_W, r.ow - dx); x = r.ox + r.ow - nw; w = nw; }
          if (r.edge.includes("n")) { const nh = Math.max(MIN_H, r.oh - dy); y = r.oy + r.oh - nh; h = nh; }
          return { x, y, w, h };
        });
      }
    };
    const onUp = () => { dragRef.current = null; resizeRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const startDrag = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: rect.x, oy: rect.y };
  }, [rect.x, rect.y]);

  const startResize = useCallback((e: React.MouseEvent, edge: string) => {
    e.preventDefault(); e.stopPropagation();
    resizeRef.current = { edge, sx: e.clientX, sy: e.clientY, ox: rect.x, oy: rect.y, ow: rect.w, oh: rect.h };
  }, [rect]);

  // 8 resize handles: n s e w ne nw se sw
  const handles: { edge: string; style: React.CSSProperties }[] = [
    { edge: "n",  style: { top: -4,    left: 12,   right: 12,  height: 8,  cursor: "n-resize"  } },
    { edge: "s",  style: { bottom: -4, left: 12,   right: 12,  height: 8,  cursor: "s-resize"  } },
    { edge: "e",  style: { right: -4,  top: 12,    bottom: 12, width: 8,   cursor: "e-resize"  } },
    { edge: "w",  style: { left: -4,   top: 12,    bottom: 12, width: 8,   cursor: "w-resize"  } },
    { edge: "ne", style: { top: -4,    right: -4,  width: 14,  height: 14, cursor: "ne-resize" } },
    { edge: "nw", style: { top: -4,    left: -4,   width: 14,  height: 14, cursor: "nw-resize" } },
    { edge: "se", style: { bottom: -4, right: -4,  width: 14,  height: 14, cursor: "se-resize" } },
    { edge: "sw", style: { bottom: -4, left: -4,   width: 14,  height: 14, cursor: "sw-resize" } },
  ];

  return (
    <div
      className="fixed z-50"
      style={{ left: rect.x, top: rect.y, width: rect.w, height: minimized ? "auto" : rect.h }}
    >
      {/* resize handles */}
      {!minimized && handles.map(h => (
        <div
          key={h.edge}
          className="absolute z-10"
          style={h.style}
          onMouseDown={e => startResize(e, h.edge)}
        />
      ))}

      {/* window */}
      <div
        className="flex flex-col rounded-xl overflow-hidden h-full"
        style={{
          height: minimized ? "auto" : "100%",
          background: "rgba(5, 8, 16, 0.94)",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 32px 96px rgba(0,0,0,0.75), 0 0 0 1px rgba(59,130,246,0.10), inset 0 1px 0 rgba(255,255,255,0.05)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* ── title bar ── */}
        <div
          className="flex items-center gap-2 px-3.5 py-2.5 flex-shrink-0 select-none"
          style={{
            background: "rgba(255,255,255,0.025)",
            borderBottom: minimized ? "none" : "1px solid rgba(255,255,255,0.055)",
            cursor: "grab",
          }}
          onMouseDown={startDrag}
        >
          {/* traffic lights */}
          <button
            onClick={onClose}
            className="w-3 h-3 rounded-full transition-opacity"
            style={{ background: "#ff5f56", flexShrink: 0 }}
            title="关闭"
          />
          <button
            onClick={() => setMinimized(v => !v)}
            className="w-3 h-3 rounded-full transition-opacity"
            style={{ background: "#febc2e", flexShrink: 0 }}
            title={minimized ? "展开" : "收起"}
          />
          {/* green dot — noop, just for aesthetics */}
          <div className="w-3 h-3 rounded-full" style={{ background: "#28c840", flexShrink: 0 }} />

          {/* title */}
          <div className="flex items-center gap-1.5 ml-2 flex-1 min-w-0">
            <GitBranch className="w-3 h-3 flex-shrink-0" style={{ color: "#4b5563" }} />
            <span className="text-[11px] font-mono truncate" style={{ color: "#6b7280" }}>
              GitNexus — File Dependency Graph
            </span>
          </div>

          {/* size hint */}
          {!minimized && (
            <span className="text-[9px] font-mono mr-2 flex-shrink-0" style={{ color: "#374151" }}>
              {Math.round(rect.w)} × {Math.round(rect.h)}
            </span>
          )}

          <button
            onClick={onClose}
            className="p-1 rounded transition-colors flex-shrink-0"
            style={{ color: "#374151" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#9ca3af")}
            onMouseLeave={e => (e.currentTarget.style.color = "#374151")}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ── iframe ── */}
        {!minimized && (
          <div className="flex-1 overflow-hidden">
            <iframe
              src="http://localhost:5174"
              className="w-full h-full border-0 block"
              title="GitNexus"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Main Page
// ═══════════════════════════════════════════════════════════════════

export function HomeScanCards() {
  const navigate = useNavigate();
  const { logoSrc, cycleLogoVariant } = useLogoVariant();

  const vantaRef    = useRef<HTMLDivElement>(null);
  const vantaEffect = useRef<{ destroy: () => void } | null>(null);
  const [showGraph, setShowGraph] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function initVanta() {
      try {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js");
        await loadScript("https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.net.min.js");
        if (cancelled || !vantaRef.current || !window.VANTA) return;
        vantaEffect.current = window.VANTA.NET({
          el: vantaRef.current,
          THREE: window.THREE,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200,
          minWidth: 200,
          scale: 1,
          scaleMobile: 1,
          color: 0x3b82f6,
          backgroundColor: 0x070b16,
          points: 14,
          maxDistance: 22,
          spacing: 18,
        });
      } catch (err) {
        console.warn("Vanta load failed:", err);
      }
    }
    initVanta();
    return () => {
      cancelled = true;
      vantaEffect.current?.destroy();
      vantaEffect.current = null;
    };
  }, []);

  return (
    <>
      {showGraph && <GitNexusModal onClose={() => setShowGraph(false)} />}

      <div
        ref={vantaRef}
        className="min-h-[100dvh] flex items-center justify-center relative overflow-hidden"
      >
        {/* 暗角 */}
        <div className="absolute inset-0 vignette pointer-events-none z-0" />

        <div className="relative z-10 w-full max-w-[1200px] mx-auto px-6 text-center">

          {/* Logo + 标题 */}
          <div className="mb-12 flex items-center justify-center gap-5">
            <button
              onClick={cycleLogoVariant}
              className="
                w-20 h-20 rounded-3xl
                border border-primary/40 bg-primary/10
                flex items-center justify-center
                shadow-[0_0_50px_rgba(59,130,246,0.5)]
                transition hover:scale-105 flex-shrink-0
              "
            >
              <img src={logoSrc} alt="VulHunter" className="w-16 h-16 object-contain" />
            </button>
            <h1 className="text-6xl font-bold tracking-wider font-mono flex-shrink-0">
              VulHunter
            </h1>
          </div>

          {/* 主按钮 */}
          <div className="mb-14">
            <button
              onClick={() => navigate("/tasks/hybrid?openCreate=1&source=home-primary")}
              className="
                group relative px-14 py-5 text-xl font-bold text-white rounded-2xl
                bg-gradient-to-r from-blue-500 to-indigo-600
                shadow-[0_0_35px_rgba(59,130,246,0.7)]
                transition hover:scale-105 hover:shadow-[0_0_60px_rgba(59,130,246,0.9)]
              "
            >
              <span className="flex items-center gap-3 justify-center">
                一键开始安全审计
                <ArrowRight className="w-6 h-6 transition group-hover:translate-x-1" />
              </span>
            </button>
          </div>

          {/* 信任信息 + 文件图入口 */}
          <div className="flex items-center justify-center gap-3 mb-14 flex-wrap">
            <span className="text-sm text-foreground/60">
              1000+ 漏洞规则 · AI Agent 推理
            </span>
            <span className="text-foreground/20 text-sm">|</span>
            <button
              onClick={() => setShowGraph(true)}
              className="
                flex items-center gap-1.5 text-sm
                text-foreground/35 hover:text-blue-400/80
                transition-colors duration-200
              "
            >
              <GitBranch className="w-3.5 h-3.5" />
              文件依赖图
            </button>
          </div>

          {/* 扫描模式卡片 */}
          <div className="mt-40 grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {homeScanCards.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.key}
                  onClick={() => navigate(card.targetRoute)}
                  className="
                    group relative backdrop-blur-sm
                    border border-white/10 bg-white/5
                    rounded-xl p-6 text-left transition
                    hover:border-primary/50 hover:bg-white/10 hover:-translate-y-1
                  "
                >
                  <ArrowRight className="absolute right-4 top-4 w-4 h-4 opacity-0 transition group-hover:opacity-100 group-hover:translate-x-1 text-primary" />
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-md bg-primary/10 text-primary">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-lg">{card.title}</h3>
                  </div>
                  <p className="text-sm text-foreground/70">{card.intro}</p>
                </button>
              );
            })}
          </div>

        </div>
      </div>
    </>
  );
}

export default HomeScanCards;