import { Zap, Bot, Layers, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLogoVariant } from "@/shared/branding/useLogoVariant";
import { useTheme } from "next-themes";
import { useEffect, useReducer, useRef } from "react";
import {
  NEXUS_EMBED_LOAD_TIMEOUT_MS,
  reduceNexusEmbedLoadState,
} from "@/shared/nexusEmbedLoadState";

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

export function HomeScanCards() {
  const navigate = useNavigate();
  const { logoSrc, cycleLogoVariant } = useLogoVariant();
  const { resolvedTheme } = useTheme();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [nexusIframeState, dispatchNexusIframeState] = useReducer(
    reduceNexusEmbedLoadState,
    "loading",
  );
  const iframeOrigin = window.location.origin;
  const iframePath = "/nexus/";
  const isNexusReady = nexusIframeState === "ready";

  useEffect(() => {
    if (nexusIframeState !== "loading") return;

    const timeoutId = window.setTimeout(() => {
      dispatchNexusIframeState("load-timeout");
    }, NEXUS_EMBED_LOAD_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [nexusIframeState]);

  // GitNexus 不再通过独立容器暴露端口，改为由主前端承载本地 dist 页面。
  useEffect(() => {
    if (nexusIframeState === "failed") return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    const sendTheme = () => {
      iframe.contentWindow?.postMessage(
        { type: "THEME_CHANGE", theme: resolvedTheme },
        iframeOrigin
      );
    };

    iframe.addEventListener("load", sendTheme);
    sendTheme();

    return () => iframe.removeEventListener("load", sendTheme);
  }, [iframeOrigin, nexusIframeState, resolvedTheme]);

  return (
    <div className="min-h-[100dvh] relative overflow-hidden">
      <div className="absolute inset-0 z-10">
        {nexusIframeState !== "failed" ? (
          <iframe
            ref={iframeRef}
            src={iframePath}
            title="GitNexus"
            className="w-full h-full border-0 pointer-events-auto"
            onLoad={() => dispatchNexusIframeState("iframe-loaded")}
            onError={() => dispatchNexusIframeState("iframe-error")}
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_58%),linear-gradient(180deg,rgba(15,23,42,0.86),rgba(2,6,23,0.98))]" />
        )}
        {!isNexusReady ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_55%),linear-gradient(180deg,rgba(15,23,42,0.58),rgba(2,6,23,0.78))] backdrop-blur-sm">
            <div className="rounded-2xl border border-primary/30 bg-background/70 px-5 py-3 text-sm font-medium text-primary/90 shadow-[0_0_24px_rgba(59,130,246,0.18)]">
              {nexusIframeState === "failed"
                ? "GitNexus 背景加载失败，已停止继续加载。"
                : "GitNexus 正在加载…"}
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative z-20 w-full max-w-[1200px] mx-auto px-6 text-center pointer-events-none min-h-[100dvh] flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="mb-12 flex items-center justify-center gap-5">
            <button
              onClick={cycleLogoVariant}
              className="
                pointer-events-auto
                w-20 h-20 rounded-3xl
                border border-primary/40 bg-primary/10
                flex items-center justify-center
                shadow-[0_0_50px_rgba(59,130,246,0.5)]
                transition hover:scale-105
              "
            >
              <img
                src={logoSrc}
                alt="VulHunter"
                className="w-16 h-16 object-contain"
              />
            </button>

            <h1 className="text-6xl font-bold tracking-wider font-mono">
              VulHunter
            </h1>
          </div>

          <div className="mb-14">
            <button
              onClick={() =>
                navigate("/tasks/hybrid?openCreate=1&source=home-primary")
              }
              className="
                pointer-events-auto
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
        </div>

        <div className="pb-20 grid md:grid-cols-3 gap-6 max-w-4xl mx-auto w-full">
          {homeScanCards.map((card) => {
            const Icon = card.icon;

            return (
              <button
                key={card.key}
                onClick={() => navigate(card.targetRoute)}
                className="
                  pointer-events-auto
                  group relative backdrop-blur-sm
                  border bg-card/60 border-border hover:bg-card
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
  );
}

export default HomeScanCards;
