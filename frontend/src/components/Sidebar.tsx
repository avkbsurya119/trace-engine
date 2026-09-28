"use client";

import { useEffect, useState } from "react";
import { Brain, Database, FileWarning, LayoutDashboard, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { HealthStatus } from "@/types/incident";

export type View = "landing" | "dashboard" | "intelligence" | "report" | "analysis" | "memory" | "sliders";

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  onViewMachineMemory?: (machineId: string) => void;
}

/** Navigation in story order; each page answers one question. */
const NAV: { id: View; label: string; question: string; icon: typeof LayoutDashboard; active?: View[] }[] = [
  { id: "dashboard", label: "Dashboard", question: "What is happening?", icon: LayoutDashboard },
  { id: "report", label: "Report Incident", question: "What happened?", icon: FileWarning, active: ["report", "analysis"] },
  { id: "memory", label: "Machine Memory", question: "What happened before?", icon: Database },
  { id: "intelligence", label: "TRACE Intelligence", question: "What has TRACE learned?", icon: Sparkles },
];

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthError, setHealthError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = () =>
      api
        .healthCheck()
        .then((h) => !cancelled && (setHealth(h), setHealthError(false)))
        .catch(() => !cancelled && setHealthError(true));
    check();
    const timer = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const memoryState = healthError ? "down" : !health ? "pending" : health.checks.hindsight.ok ? "up" : "down";

  return (
    <aside className="w-64 flex-shrink-0 bg-[#0a1628]/95 backdrop-blur-xl text-white flex flex-col sticky top-0 h-screen border-r border-white/10">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-[#38bdf8]" aria-hidden />
          <div>
            <p className="text-xl font-bold neon-text-blue">TRACE</p>
            <p className="text-xs text-slate-400">Troubleshooting memory</p>
          </div>
        </div>
      </div>

      <nav aria-label="Main" className="flex-1 p-4">
        <ul className="space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = (item.active ?? [item.id]).includes(currentView);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                    isActive
                      ? "bg-[#38bdf8]/15 text-white border border-[#38bdf8]/30"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon className={cn("w-5 h-5 mt-0.5 flex-shrink-0", isActive && "text-[#38bdf8]")} aria-hidden />
                  <span>
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className={cn("block text-xs", isActive ? "text-slate-300" : "text-slate-500")}>{item.question}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-white/10 space-y-1" aria-label="System status">
        <StatusLine
          label={
            healthError
              ? "Backend unreachable"
              : health?.checks.hindsight.ok
              ? `Hindsight memory: ${health.checks.hindsight.bank}`
              : health
              ? "Hindsight unavailable"
              : "Checking memory…"
          }
          state={memoryState}
          title={health?.checks.hindsight.error}
        />
        {health && (
          <>
            <StatusLine
              label={`SQLite: ${health.checks.sqlite.incidents ?? "?"} work orders`}
              state={health.checks.sqlite.ok ? "up" : "down"}
              title={health.checks.sqlite.error}
            />
            <StatusLine
              label={health.checks.llm.ok ? `LLM wording: ${health.checks.llm.model}` : "LLM off: rule-based wording"}
              state={health.checks.llm.ok ? "up" : "pending"}
            />
          </>
        )}
      </div>
    </aside>
  );
}

function StatusLine({ label, state, title }: { label: string; state: "up" | "down" | "pending"; title?: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-400 text-xs" title={title}>
      <span
        className={cn(
          "w-2 h-2 rounded-full flex-shrink-0",
          state === "up" ? "bg-green-400" : state === "down" ? "bg-red-400" : "bg-amber-400",
          state === "up" && "animate-pulse"
        )}
        aria-hidden
      />
      <span className="truncate">
        <span className="sr-only">{state === "up" ? "OK: " : state === "down" ? "Problem: " : "Pending: "}</span>
        {label}
      </span>
    </div>
  );
}
