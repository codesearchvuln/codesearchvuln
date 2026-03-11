import { Cpu, Play, Square, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function RunBar({
  running,
  eventCount,
  onRun,
  onStop,
  onClear,
}: {
  running: boolean;
  eventCount: number;
  onRun: () => void;
  onStop: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {!running ? (
        <Button size="sm" onClick={onRun} className="gap-1.5">
          <Play className="w-3.5 h-3.5" /> 运行
        </Button>
      ) : (
        <Button
          size="sm"
          variant="destructive"
          onClick={onStop}
          className="gap-1.5"
        >
          <Square className="w-3.5 h-3.5" /> 停止
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={onClear} className="gap-1.5">
        <Trash2 className="w-3.5 h-3.5" /> 清空
      </Button>
      {running && (
        <Badge
          variant="outline"
          className="gap-1 text-cyan-400 border-cyan-800 animate-pulse"
        >
          <Cpu className="w-3 h-3" /> 运行中…
        </Badge>
      )}
      {eventCount > 0 && !running && (
        <Badge variant="outline" className="text-muted-foreground">
          {eventCount} 条日志
        </Badge>
      )}
    </div>
  );
}
