export const DEFAULT_SCAN_EXCLUDES = [
  "node_modules/**",
  ".git/**",
  "dist/**",
  "build/**",
  "*.log",
];

const ARCHIVE_SUFFIXES = [
  ".tar.gz",
  ".tar.bz2",
  ".tar.xz",
  ".tgz",
  ".tbz2",
  ".zip",
  ".tar",
  ".7z",
  ".rar",
];

export function stripScanArchiveSuffix(filename: string) {
  const lower = filename.toLowerCase();
  const matched = ARCHIVE_SUFFIXES.find((suffix) => lower.endsWith(suffix));
  if (!matched) return filename;
  return filename.slice(0, filename.length - matched.length);
}

export function extractCreateScanTaskApiErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const detail = (error as any)?.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const msgs = detail
        .map((item: any) =>
          typeof item?.msg === "string" ? item.msg : String(item),
        )
        .filter(Boolean);
      if (msgs.length > 0) return msgs.join("; ");
    }
    return error.message || "未知错误";
  }
  const detail = (error as any)?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  return "未知错误";
}
