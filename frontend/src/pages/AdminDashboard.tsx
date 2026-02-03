/**
 * Admin Dashboard Page
 * Cyberpunk Terminal Aesthetic
 */

import { DatabaseManager } from "@/components/database/DatabaseManager";
import { Database } from "lucide-react";

export default function AdminDashboard() {
  return (
    <div className="space-y-6 p-6 cyber-bg-elevated min-h-screen font-mono relative">
      {/* Grid background */}
      <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />
      <div className="relative z-10 space-y-4">
        <div className="cyber-card p-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          <span className="font-mono text-sm uppercase tracking-wider text-foreground">
            数据管理
          </span>
        </div>
        <DatabaseManager />
      </div>
    </div>
  );
}
