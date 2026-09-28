"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { HealthStatus } from "@/types/incident";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileWarning,
  Database,
  Search,
  SlidersHorizontal,
  Globe,
} from "lucide-react";

type View = "landing" | "dashboard" | "report" | "analysis" | "memory" | "sliders";

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  onViewMachineMemory?: (machineId: string) => void;
}

const navItems = [
  { id: "landing" as View, label: "Landing Page", icon: Globe },
  { id: "dashboard" as View, label: "Dashboard", icon: LayoutDashboard },
  { id: "sliders" as View, label: "Interactive Sliders", icon: SlidersHorizontal },
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
    <aside className="w-64 md:w-72 bg-[#090f2b]/55 backdrop-blur-3xl border-r border-white/10 text-[#f8fafc] flex flex-col flex-shrink-0 z-20 min-h-screen shadow-[10px_0_40px_rgba(0,0,0,0.35)]">
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <button 
          onClick={() => onNavigate("dashboard")}
          className="flex items-center gap-3.5 group cursor-pointer text-left w-full"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#2563eb] to-[#38bdf8] border border-white/30 flex items-center justify-center text-white shadow-[0_0_24px_rgba(56,189,248,0.45)] group-hover:scale-105 transition-transform">
            <span className="text-base font-bold">▲</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold tracking-tight text-white group-hover:text-[#38bdf8] transition-colors">TRACE</h1>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/35 shadow-[0_0_10px_rgba(56,189,248,0.2)]">v2.4</span>
            </div>
            <p className="text-xs text-[#94a3b8] font-normal">
              Adaptive Context Engine
            </p>
          </div>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1.5">
        <ul className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm transition-all duration-200",
                    isActive
                      ? "bg-gradient-to-r from-[#2563eb]/25 to-[#38bdf8]/15 text-white border border-[#38bdf8]/40 shadow-[0_4px_20px_rgba(56,189,248,0.22),inset_0_1px_1px_rgba(255,255,255,0.25)] font-semibold backdrop-blur-md"
                      : "text-[#94a3b8] hover:text-white hover:bg-white/[0.06] border border-transparent font-medium"
                  )}
                >
                  <Icon className={cn("w-4 h-4 transition-colors", isActive ? "text-[#38bdf8]" : "text-[#94a3b8]")} />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}

          {/* Machine Memory with search */}
          <li className="pt-2">
            <button
              onClick={() => setShowMachineSearch(!showMachineSearch)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm transition-all duration-200",
                currentView === "memory"
                  ? "bg-gradient-to-r from-[#2563eb]/25 to-[#38bdf8]/15 text-white border border-[#38bdf8]/40 shadow-[0_4px_20px_rgba(56,189,248,0.22),inset_0_1px_1px_rgba(255,255,255,0.25)] font-semibold backdrop-blur-md"
                  : "text-[#94a3b8] hover:text-white hover:bg-white/[0.06] border border-transparent font-medium"
              )}
            >
              <div className="flex items-center gap-3.5">
                <Database className={cn("w-4 h-4 transition-colors", currentView === "memory" ? "text-[#38bdf8]" : "text-[#94a3b8]")} />
                <span>Machine Memory</span>
              </div>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-white/[0.08] text-[#94a3b8]">
                Recall
              </span>
            </button>

            {showMachineSearch && (
              <div className="mt-2.5 p-3 rounded-2xl bg-black/35 border border-white/10 backdrop-blur-md space-y-2 shadow-xl">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. CNC-204"
                    value={machineId}
                    onChange={(e) => setMachineId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleMachineSearch()}
                    className="flex-1 px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-white placeholder-[#64748b] focus:outline-none focus:border-[#38bdf8]"
                  />
                  <button
                    onClick={handleMachineSearch}
                    className="p-2 bg-[#38bdf8]/20 hover:bg-[#38bdf8]/30 text-[#38bdf8] rounded-xl border border-[#38bdf8]/35 transition-colors"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-[#64748b]">Quick:</span>
                  {["CNC-204", "HP-303", "CV-507"].map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        if (onViewMachineMemory) onViewMachineMemory(m);
                        setShowMachineSearch(false);
                      }}
                      className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.06] hover:bg-[#38bdf8]/20 text-[#94a3b8] hover:text-[#38bdf8] border border-white/10"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </li>
        </ul>
      </nav>

      {/* Memory Status Glass Pod */}
      <div className="p-4 mx-3 mb-3 rounded-2xl bg-black/30 border border-white/10 backdrop-blur-xl space-y-2 shadow-[inset_0_2px_6px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between pb-1 border-b border-white/[0.08]">
          <span className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider">Subsystems</span>
          <span className="w-2 h-2 rounded-full bg-[#38bdf8] shadow-[0_0_10px_#38bdf8]" />
        </div>
        <StatusLine
          label={healthError ? "Backend unreachable" : health?.checks.hindsight.ok ? `Hindsight: ${health.checks.hindsight.bank}` : health ? "Hindsight unavailable" : "Checking memory..."}
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
              label={health.checks.llm.ok ? `LLM: ${health.checks.llm.model}` : "LLM: Rule-based fallback"}
              state={health.checks.llm.ok ? "up" : "pending"}
            />
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/10 flex items-center justify-between text-xs text-[#64748b]">
        <span>Industrial AI Engine</span>
        <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" className="text-[#94a3b8] hover:text-[#38bdf8] transition-colors">
          API &rarr;
        </a>
      </div>
    </aside>
  );
}

function StatusLine({ label, state, title }: { label: string; state: "up" | "down" | "pending"; title?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-[#94a3b8]" title={title}>
      <div
        className={cn(
          "w-1.5 h-1.5 rounded-full flex-shrink-0",
          state === "up" ? "bg-[#38bdf8] shadow-[0_0_6px_#38bdf8]" : state === "down" ? "bg-rose-500 shadow-[0_0_6px_#ef4444]" : "bg-amber-400 shadow-[0_0_6px_#f59e0b]",
          state === "up" && "animate-pulse"
        )}
      />
      <span className="truncate">{label}</span>
    </div>
  );
}
