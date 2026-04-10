import { Zap, Bot, Layers, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLogoVariant } from "@/shared/branding/useLogoVariant";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

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
  const [isNexusLoaded, setIsNexusLoaded] = useState(false);
  const iframeOrigin = `http://${window.location.hostname}:5174`;

  // 主题变化时通知 iframe
  useEffect(() => {
    if (!isNexusLoaded) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    const sendTheme = () => {
      iframe.contentWindow?.postMessage(
        { type: "THEME_CHANGE", theme: resolvedTheme },
        iframeOrigin
      );
    };

    // iframe 加载完成后立即同步当前主题
    iframe.addEventListener("load", sendTheme);
    // 主题变化时也发送
    sendTheme();

    return () => iframe.removeEventListener("load", sendTheme);
  }, [iframeOrigin, isNexusLoaded, resolvedTheme]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsNexusLoaded(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div className="min-h-[100dvh] relative overflow-hidden">
      <div className="absolute inset-0 z-10">
        {isNexusLoaded ? (
          <iframe
            ref={iframeRef}
            src={iframeOrigin}
            title="GitNexus"
            className="w-full h-full border-0 pointer-events-auto"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.22),_transparent_55%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.98))]">
            <button
              type="button"
              onClick={() => setIsNexusLoaded(true)}
              className="pointer-events-auto rounded-2xl border border-primary/50 bg-background/80 px-6 py-4 text-left shadow-[0_0_40px_rgba(59,130,246,0.2)] backdrop-blur-md transition hover:scale-[1.02] hover:border-primary hover:bg-background/90"
            >
              <div className="text-sm font-semibold text-primary">
                加载 GitNexus 预览
              </div>
              <div className="mt-2 max-w-md text-sm text-foreground/70">
                首页默认不自动挂载可视化 iframe，避免长时间待机时维持第二套前端运行时。
              </div>
            </button>
          </div>
        )}
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
