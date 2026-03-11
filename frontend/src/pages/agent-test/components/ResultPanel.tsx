import { ScrollArea } from "@/components/ui/scroll-area";

export default function ResultPanel({ result }: { result: unknown }) {
  if (!result) return null;
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-muted-foreground mb-1">
        最终输出 (JSON)
      </p>
      <ScrollArea className="h-[280px] rounded border border-green-800/40 bg-black/60">
        <pre className="p-3 text-xs text-green-300 whitespace-pre-wrap break-all font-mono">
          {JSON.stringify(result, null, 2)}
        </pre>
      </ScrollArea>
    </div>
  );
}
