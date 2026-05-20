const DEFAULT_OBFUSCATION_SEED = 1337;

function resolveObfuscationSeed() {
  const rawValue = String(process.env.VITE_BUILD_OBFUSCATION_SEED || "").trim();
  if (!rawValue) {
    return DEFAULT_OBFUSCATION_SEED;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (Number.isSafeInteger(parsed)) {
    return parsed;
  }

  return DEFAULT_OBFUSCATION_SEED;
}

export function createProductionObfuscatorOptions() {
  return {
    seed: resolveObfuscationSeed(),
    // 标识符混淆（低成本高收益）
    identifierNamesGenerator: "hexadecimal" as const,
    renameGlobals: false, // 不重命名全局：避免破坏 React 运行时

    // 最终 chunk 阶段不再需要把 sourcemap 传给后续编译步骤。
    sourceMap: false,

    // ⚠️ stringArray 必须关闭：
    // javascript-obfuscator 处理动态 import 路径时会把字面量提取进字符串数组，
    // 导致 Rollup 无法静态分析并漏掉对应 chunk。
    // stringArray:true 会将 import("@/pages/AgentAudit") 的路径字符串
    // 编码进字符串数组，导致 Rollup 无法静态分析该动态 import，
    // 从而不生成对应 chunk，浏览器运行时报
    // "Failed to resolve module specifier '@/pages/AgentAudit'"
    stringArray: false,

    splitStrings: false, // 关闭：避免破坏 EventSource URL 构造

    // 关闭高风险选项
    controlFlowFlattening: false, // 关闭：构建时间翻倍，SSE 处理器有风险
    selfDefending: false, // 关闭：与 React 不兼容
    debugProtection: false, // 关闭：会破坏 SSE DevTools 调试

    // 适度保护
    disableConsoleOutput: true,
    deadCodeInjection: false, // 关闭：显著增加包体积
    unicodeEscapeSequence: false, // 关闭：大幅增加体积

    // 构建配置
    target: "browser" as const,
  };
}
