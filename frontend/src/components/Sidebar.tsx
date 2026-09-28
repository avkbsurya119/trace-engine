"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { HealthStatus } from "@/types/incident";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileWarning,
  Brain,
  Database,
  Search,
  X,
} from "lucide-react";

type View = "dashboard" | "report" | "analysis" | "memory";

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  onViewMachineMemory?: (machineId: string) => void;
}

const navItems = [
  { id: "dashboard" as View, label: "Dashboard", icon: LayoutDashboard },
  { id: "report" as View, label: "Report Incident", icon: FileWarning },
];

export function Sidebar({ currentView, onNavigate, onViewMachineMemory }: SidebarProps) {
  const [showMachineSearch, setShowMachineSearch] = useState(false);
  const [machineId, setMachineId] = useState("");
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

  const handleMachineSearch = () => {
    const normalized = machineId.trim().toUpperCase();
    if (normalized && onViewMachineMemory) {
      onViewMachineMemory(normalized);
      setShowMachineSearch(false);
      setMachineId("");
    } else {
      onNavigate("memory");
    }
  };

  return (
    <aside className="w-64 bg-industrial-900 text-white flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-industrial-700">
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-industrial-400" />
          <div>
            <h1 className="text-xl font-bold">TRACE</h1>
            <p className="text-xs text-industrial-400">
              Adaptive Context Engine
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                    isActive
                      ? "bg-industrial-700 text-white"
                      : "text-industrial-300 hover:bg-industrial-800 hover:text-white"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}

          {/* Machine Memory with search */}
          <li>
            <button
              onClick={() => setShowMachineSearch(!showMachineSearch)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                currentView === "memory"
                  ? "bg-industrial-700 text-white"
                  : "text-industrial-300 hover:bg-industrial-800 hover:text-white"
              )}
            >
              <Database className="w-5 h-5" />
              <span>Machine Memory</span>
            </button>

            {showMachineSearch && (
              <div className="mt-2 px-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Machine ID..."
                    value={machineId}
                    onChange={(e) => setMachineId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleMachineSearch()}
                    className="flex-1 px-3 py-2 bg-industrial-800 border border-industrial-600 rounded-lg text-sm text-white placeholder-industrial-400 focus:outline-none focus:border-industrial-500"
                  />
                  <button
                    onClick={handleMachineSearch}
                    className="p-2 bg-industrial-700 rounded-lg hover:bg-industrial-600"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-industrial-500 mt-2 px-1">
                  Enter a machine ID to view its history
                </p>
              </div>
            )}
          </li>
        </ul>
      </nav>

      {/* Memory Status */}
      <div className="p-4 border-t border-industrial-700">
        <StatusLine
          label={healthError ? "Backend unreachable" : health?.checks.hindsight.ok ? `Hindsight memory: ${health.checks.hindsight.bank}` : health ? "Hindsight unavailable" : "Checking memory..."}
          state={healthError ? "down" : !health ? "pending" : health.checks.hindsight.ok ? "up" : "down"}
          title={health?.checks.hindsight.error}
        />
        {health && (
          <>
            <StatusLine
              label={`SQLite: ${health.checks.sqlite.incidents ?? "?"} incidents`}
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

      {/* Footer */}
      <div className="p-4 border-t border-industrial-700">
        <p className="text-xs text-industrial-500 text-center">
          Powered by Hindsight
        </p>
      </div>
    </aside>
  );
}

function StatusLine({ label, state, title }: { label: string; state: "up" | "down" | "pending"; title?: string }) {
  return (
    <div className="flex items-center gap-2 text-industrial-400 text-xs mt-1 first:mt-0" title={title}>
      <div
        className={cn(
          "w-2 h-2 rounded-full flex-shrink-0",
          state === "up" ? "bg-green-500" : state === "down" ? "bg-red-500" : "bg-amber-400",
          state === "up" && "animate-pulse"
        )}
      />
      <span className="truncate">{label}</span>
    </div>
  );
}
