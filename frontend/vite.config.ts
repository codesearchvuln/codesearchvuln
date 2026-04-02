import { defineConfig, type ConfigEnv } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import javascriptObfuscator from "vite-plugin-javascript-obfuscator";
import path from "path";

// https://vite.dev/config/
export default defineConfig(({ mode }: ConfigEnv) => {
  const isProduction = mode === "production";

  // 仅在生产构建时加载混淆插件，避免开发模式性能损耗
  const obfuscatorPlugin = isProduction
    ? (() => {
        return javascriptObfuscator({
          options: {
            // 标识符混淆（低成本高收益）
            identifierNamesGenerator: "hexadecimal",
            renameGlobals: false,        // 不重命名全局：避免破坏 React 运行时

            // ⚠️ stringArray 必须关闭：
            // vite-plugin-javascript-obfuscator v2.x 的 include/exclude 参数被忽略，
            // 插件实际在所有源文件（含 routes.tsx）的 transform 阶段运行。
            // stringArray:true 会将 import("@/pages/AgentAudit") 的路径字符串
            // 编码进字符串数组，导致 Rollup 无法静态分析该动态 import，
            // 从而不生成对应 chunk，浏览器运行时报
            // "Failed to resolve module specifier '@/pages/AgentAudit'"
            stringArray: false,

            splitStrings: false,          // 关闭：避免破坏 EventSource URL 构造

            // 关闭高风险选项
            controlFlowFlattening: false, // 关闭：构建时间翻倍，SSE 处理器有风险
            selfDefending: false,         // 关闭：与 React 不兼容
            debugProtection: false,       // 关闭：会破坏 SSE DevTools 调试

            // 适度保护
            disableConsoleOutput: true,
            deadCodeInjection: false,     // 关闭：显著增加包体积
            unicodeEscapeSequence: false, // 关闭：大幅增加体积

            // 构建配置
            sourceMap: false,
            target: "browser",
          },
        });
      })()
    : null;

  return {
  envDir: path.resolve(__dirname, "../docker/env/frontend"),
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
    ...(obfuscatorPlugin ? [obfuscatorPlugin] : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // 抑制来自 node_modules 的 Rollup 警告（lodash 等预编译包的 sourcemap 链断裂问题）
        if (warning.id?.includes('node_modules')) return;
        warn(warning);
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-progress'
          ],
          charts: ['recharts'],
          ai: ['@google/generative-ai'],
          utils: ['clsx', 'tailwind-merge', 'date-fns', 'sonner']
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
    minify: 'esbuild',
  },
  // cacheDir 支持 Docker BuildKit 缓存挂载，本地开发回退到默认位置
  cacheDir: process.env.VITE_CACHE_DIR ?? 'node_modules/.vite',
  // esbuild 转换选项：生产构建时去除 console/debugger
  esbuild: isProduction ? {
    drop: ['console', 'debugger'],
  } : {},
  server: {
    port: 5173,
    host: true,
    open: process.env.VITE_OPEN_BROWSER === "1",
    hmr: process.env.VITE_HMR_CLIENT_PORT
      ? { clientPort: parseInt(process.env.VITE_HMR_CLIENT_PORT, 10) }
      : true,
    cors: {
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: [
        "Authorization",
        "Content-Type",
        "X-DashScope-SSE",
        "X-Requested-With",
      ],
    },
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET || "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false,
      },
      "/dashscope-proxy": {
        target: "https://dashscope.aliyuncs.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/dashscope-proxy/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("origin", "https://dashscope.aliyuncs.com");
          });
        },
      },
    },
  },
  preview: {
    port: 5173,
    host: true,
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@google/generative-ai',
      'recharts',
      'sonner'
    ],
  },
  };
});
