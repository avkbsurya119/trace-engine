"use client";

import { useEffect, useState } from "react";
import { Brain, Database, FileWarning, LayoutDashboard, Presentation, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { HealthStatus } from "@/types/incident";

export type View = "landing" | "dashboard" | "intelligence" | "report" | "analysis" | "memory" | "sliders";

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  onViewMachineMemory?: (machineId: string) => void;
  judgeMode: boolean;
  onToggleJudgeMode: (on: boolean) => void;
}

/** Navigation in story order; each page answers one question. */
const NAV: { id: View; label: string; question: string; icon: typeof LayoutDashboard; active?: View[] }[] = [
  { id: "dashboard", label: "Dashboard", question: "What is happening?", icon: LayoutDashboard },
  { id: "report", label: "Report Incident", question: "What happened?", icon: FileWarning, active: ["report", "analysis"] },
  { id: "memory", label: "Machine Memory", question: "What happened before?", icon: Database },
  { id: "intelligence", label: "TRACE Intelligence", question: "What has TRACE learned?", icon: Sparkles },
];

export function Sidebar({ currentView, onNavigate, judgeMode, onToggleJudgeMode }: SidebarProps) {
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
    <aside className="w-64 flex-shrink-0 bg-industrial-900 text-white flex flex-col sticky top-0 h-screen">
      <div className="p-6 border-b border-industrial-700">
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-industrial-400" aria-hidden />
          <div>
            <p className="text-xl font-bold">TRACE</p>
            <p className="text-xs text-industrial-400">Troubleshooting memory</p>
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
                    "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                    isActive ? "bg-industrial-700 text-white" : "text-industrial-300 hover:bg-industrial-800 hover:text-white"
                  )}
                >
                  <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" aria-hidden />
                  <span>
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className={cn("block text-xs", isActive ? "text-industrial-200" : "text-industrial-500")}>{item.question}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-industrial-700 space-y-3">
        <button
          type="button"
          onClick={() => onToggleJudgeMode(!judgeMode)}
          aria-pressed={judgeMode}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            judgeMode ? "bg-white text-industrial-900 hover:bg-industrial-50" : "bg-industrial-800 text-industrial-200 hover:bg-industrial-700 hover:text-white"
          )}
        >
          <Presentation className="w-4 h-4" aria-hidden />
          {judgeMode ? "Exit judge mode" : "Judge mode"}
        </button>

        <div className="space-y-1" aria-label="System status">
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
          {health && !judgeMode && (
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
      </div>
    </aside>
  );
}

function StatusLine({ label, state, title }: { label: string; state: "up" | "down" | "pending"; title?: string }) {
  return (
    <div className="flex items-center gap-2 text-industrial-400 text-xs" title={title}>
      <span
        className={cn(
          "w-2 h-2 rounded-full flex-shrink-0",
          state === "up" ? "bg-green-500" : state === "down" ? "bg-red-500" : "bg-amber-400",
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
