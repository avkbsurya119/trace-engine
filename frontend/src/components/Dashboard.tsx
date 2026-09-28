"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn, formatDay, humanize } from "@/lib/utils";
import type { DashboardStats, Fleet } from "@/types/incident";
import {
  Brain,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Clock,
  Target,
  Zap,
  Loader2,
  BarChart3,
  Server,
  ArrowRight,
  TrendingUp,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { SliderDashboard } from "./SliderDashboard";

interface Props {
  onReportIncident: () => void;
  onViewMachineMemory: (machineId: string) => void;
  onShowBeforeAfter?: () => void;
  onOpenSliders?: () => void;
}

export function Dashboard({
  onReportIncident,
  onViewMachineMemory,
  onShowBeforeAfter,
  onOpenSliders,
}: Props) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      api.getFleet().then(setFleet).catch(() => null);
      try {
        const data = await api.getDashboardStats();
        setStats(data);
      } catch (err) {
        setError("Unable to load dashboard data. Is the backend running?");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-[#38bdf8]" />
        <p className="text-xs text-[#8290ab] font-mono uppercase tracking-widest">Loading Telemetry & Memory Matrices...</p>
      </div>
    );
  }

  // Calculate memory effectiveness metrics
  const successRate =
    stats && stats.incidents_with_outcome > 0
      ? Math.round(
          (stats.outcome_distribution.SUCCESS / stats.incidents_with_outcome) *
            100
        )
      : 0;

  const memoryDepth =
    stats && stats.total_incidents > 0
      ? Math.round((stats.incidents_with_outcome / stats.total_incidents) * 100)
      : 0;

  const failureReduction =
    stats && stats.incidents_with_outcome > 0
      ? Math.round(
          ((stats.outcome_distribution.SUCCESS +
            stats.outcome_distribution.PARTIAL) /
            stats.incidents_with_outcome) *
            100
        )
      : 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#1e2a4a]">
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#1e2a4a]/80 border border-[#3b82f6]/35 text-[#38bdf8] text-xs font-semibold uppercase tracking-wider mb-2 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] animate-pulse shadow-[0_0_8px_#38bdf8]" />
            Plant Floor Intelligence
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            TRACE Fleet Console
          </h2>
          <p className="text-sm text-[#8290ab] mt-1">
            Organizational memory &amp; root-cause diagnosis across 39 industrial assets
          </p>
          {stats?.history_start && stats?.history_end && (
            <p className="text-xs text-[#50607d] mt-1.5 font-mono">
              Operationally verified work-orders · {formatDay(stats.history_start)} – {formatDay(stats.history_end)} · Bank: <span className="text-[#38bdf8] font-mono">{stats.memory_bank}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => {
              const el = document.getElementById("slider-dashboard");
              if (el) {
                el.scrollIntoView({ behavior: "smooth" });
              } else if (onOpenSliders) {
                onOpenSliders();
              }
            }}
            className="btn-neon-outline flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all"
          >
            <SlidersHorizontal className="w-4 h-4 text-[#38bdf8]" />
            Interactive Sliders
          </button>
          {onShowBeforeAfter && (
            <button
              onClick={onShowBeforeAfter}
              className="btn-neon-outline flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all"
            >
              <Brain className="w-4 h-4 text-[#60a5fa]" />
              Memory Impact
            </button>
          )}
          <button
            onClick={onReportIncident}
            className="btn-neon-primary flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all shadow-[0_4px_22px_rgba(59,130,246,0.4)]"
          >
            <Plus className="w-4 h-4" />
            Report Incident
          </button>
        </div>
      </div>

      {error ? (
        <div className="glass-card rounded-2xl p-5 border border-rose-500/30 text-rose-300 bg-rose-950/20">
          {error}
        </div>
      ) : stats ? (
        <>
          {/* Memory Health Banner */}
          <MemoryHealthBanner
            totalIncidents={stats.total_incidents}
            withOutcome={stats.incidents_with_outcome}
            successRate={successRate}
            uniqueMachines={stats.unique_machines}
          />

          {/* Key Metrics matching the reference cards style */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <MetricCard
              icon={<Activity className="w-5 h-5 text-[#38bdf8]" />}
              label="Total Incidents"
              value={stats.total_incidents}
              sublabel="In vector hindsight memory"
              color="blue"
            />
            <MetricCard
              icon={<Clock className="w-5 h-5 text-[#60a5fa]" />}
              label="Downtime Tracked"
              value={`${Math.round(stats.total_downtime_hours).toLocaleString()} h`}
              sublabel={`${memoryDepth}% with verified outcomes`}
              color="cyan"
            />
            <MetricCard
              icon={<Target className="w-5 h-5 text-[#818cf8]" />}
              label="First-Time Fixes"
              value={`${successRate}%`}
              sublabel="SUCCESS share of interventions"
              color="indigo"
            />
            <MetricCard
              icon={<TrendingUp className="w-5 h-5 text-[#a78bfa]" />}
              label="Resolution Velocity"
              value={`${failureReduction}%`}
              sublabel="Effective resolution rate"
              color="violet"
            />
          </div>

          {/* Interactive Slider Dashboard Centerpiece */}
          <section id="slider-dashboard" className="pt-2">
            <SliderDashboard
              onViewMachineMemory={onViewMachineMemory}
              onReportIncident={onReportIncident}
            />
          </section>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Outcome Distribution */}
            <div className="glass-card p-6 rounded-3xl">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-2xl bg-[#1d4ed8]/20 text-[#38bdf8] border border-[#3b82f6]/30">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Intervention Outcomes
                    </h3>
                    <p className="text-xs text-[#8290ab]">First-pass resolution reliability</p>
                  </div>
                </div>
                <span className="text-xs text-[#8290ab] font-mono px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/10">{stats.incidents_with_outcome} Verified</span>
              </div>
              {stats.incidents_with_outcome > 0 ? (
                <div className="space-y-4">
                  <OutcomeRow
                    label="Success (Fixed First Attempt)"
                    count={stats.outcome_distribution.SUCCESS}
                    total={stats.incidents_with_outcome}
                    icon={<CheckCircle className="w-4 h-4 text-[#38bdf8]" />}
                    color="blue"
                  />
                  <OutcomeRow
                    label="Partial (Temporary Mitigation)"
                    count={stats.outcome_distribution.PARTIAL}
                    total={stats.incidents_with_outcome}
                    icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
                    color="amber"
                  />
                  <OutcomeRow
                    label="Failed (Wrong Component First)"
                    count={stats.outcome_distribution.FAILED}
                    total={stats.incidents_with_outcome}
                    icon={<XCircle className="w-4 h-4 text-rose-400" />}
                    color="red"
                  />
                  <OutcomeRow
                    label="Under Active Monitoring"
                    count={stats.outcome_distribution.UNKNOWN}
                    total={stats.incidents_with_outcome}
                    icon={<Activity className="w-4 h-4 text-slate-400" />}
                    color="gray"
                  />
                </div>
              ) : (
                <EmptyState message="No outcomes recorded yet" />
              )}
            </div>

            {/* Defect Types */}
            <div className="glass-card p-6 rounded-3xl">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-2xl bg-[#6366f1]/20 text-[#818cf8] border border-[#6366f1]/30">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Most Frequent Failure Modes
                    </h3>
                    <p className="text-xs text-[#8290ab]">Top recurring machine telemetry anomalies</p>
                  </div>
                </div>
                <span className="text-xs text-[#8290ab] font-mono px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/10">Fleet Top 5</span>
              </div>
              {Object.keys(stats.defect_type_distribution).length > 0 ? (
                <div className="space-y-3.5">
                  {Object.entries(stats.defect_type_distribution)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([defect, count]) => (
                      <DefectRow
                        key={defect}
                        defect={defect}
                        count={count}
                        total={stats.total_incidents}
                      />
                    ))}
                </div>
              ) : (
                <EmptyState message="No defects recorded yet" />
              )}
            </div>
          </div>

          {/* Machine Fleet Overview */}
          <div className="glass-card p-6 rounded-3xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-2xl bg-[#1d4ed8]/20 text-[#60a5fa] border border-[#3b82f6]/30">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Monitored Equipment Families
                  </h3>
                  <p className="text-xs text-[#8290ab]">Click any family to inspect hero machine memory</p>
                </div>
              </div>
              <span className="text-xs font-mono text-[#38bdf8] px-3 py-1 rounded-full bg-[#3b82f6]/15 border border-[#3b82f6]/30 font-semibold">
                {stats.unique_machines} Assets Online
              </span>
            </div>
            <MachineTypeBreakdown
              distribution={stats.machine_type_distribution ?? {}}
              fleet={fleet}
              onViewMachine={onViewMachineMemory}
            />
          </div>

          {/* Memory Value Proposition */}
          <MemoryValueCard
            incidents={stats.total_incidents}
            successRate={successRate}
            onReportIncident={onReportIncident}
          />
        </>
      ) : null}
    </div>
  );
}

function MemoryHealthBanner({
  totalIncidents,
  withOutcome,
  successRate,
  uniqueMachines,
}: {
  totalIncidents: number;
  withOutcome: number;
  successRate: number;
  uniqueMachines: number;
}) {
  const memoryStage =
    totalIncidents === 0
      ? "empty"
      : totalIncidents < 5
      ? "learning"
      : totalIncidents < 20
      ? "growing"
      : "mature";

  const stages = {
    empty: {
      title: "Memory System Initializing",
      subtitle: "Submit first field telemetry report to establish organizational vector baseline",
      glow: "bg-slate-500/10",
      accent: "text-slate-400",
      border: "border-white/10",
      icon: <Brain className="w-6 h-6 text-slate-400" />,
    },
    learning: {
      title: "TRACE Hindsight Memory Active",
      subtitle: `Forming associative patterns across ${totalIncidents} incident work orders`,
      glow: "bg-[#1d4ed8]/15",
      accent: "text-[#60a5fa]",
      border: "border-[#3b82f6]/30",
      icon: <Brain className="w-6 h-6 text-[#60a5fa]" />,
    },
    growing: {
      title: "Fleet Hindsight Memory Expanding",
      subtitle: `${totalIncidents} incidents catalogued across ${uniqueMachines} industrial machines`,
      glow: "bg-[#38bdf8]/15",
      accent: "text-[#38bdf8]",
      border: "border-[#38bdf8]/30",
      icon: <TrendingUp className="w-6 h-6 text-[#38bdf8]" />,
    },
    mature: {
      title: "High-Confidence Memory Established",
      subtitle: `${totalIncidents} verified work orders retained · ${successRate}% first-time fix rate`,
      glow: "bg-[#2563eb]/20",
      accent: "text-[#38bdf8]",
      border: "border-[#3b82f6]/40",
      icon: <Zap className="w-6 h-6 text-[#38bdf8]" />,
    },
  };

  const stage = stages[memoryStage];

  return (
    <div
      className={cn(
        "glass-card p-6 md:p-8 rounded-3xl relative overflow-hidden border shadow-[0_20px_50px_rgba(0,0,0,0.65)]",
        stage.border
      )}
    >
      {/* Ambient glow backdrop */}
      <div className={cn("absolute -top-20 -right-20 w-80 h-80 rounded-full blur-3xl pointer-events-none", stage.glow)} />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="p-3.5 rounded-2xl bg-white/[0.05] border border-white/10 text-white shadow-inner">
            {stage.icon}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-xl font-extrabold text-white tracking-tight">{stage.title}</h3>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#3b82f6]/20 text-[#38bdf8] border border-[#3b82f6]/30">
                Online
              </span>
            </div>
            <p className="text-sm text-[#8290ab] mt-1">{stage.subtitle}</p>
          </div>
        </div>

        {memoryStage !== "empty" && (
          <div className="flex flex-wrap gap-2.5">
            <MemoryChip
              label="Incidents"
              value={totalIncidents}
              icon={<Activity className="w-3.5 h-3.5 text-[#38bdf8]" />}
            />
            <MemoryChip
              label="Verified Outcomes"
              value={withOutcome}
              icon={<CheckCircle className="w-3.5 h-3.5 text-[#60a5fa]" />}
            />
            <MemoryChip
              label="Machines"
              value={uniqueMachines}
              icon={<Server className="w-3.5 h-3.5 text-[#818cf8]" />}
            />
            <MemoryChip
              label="Fix Accuracy"
              value={`${successRate}%`}
              icon={<Target className="w-3.5 h-3.5 text-cyan-400" />}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function MemoryChip({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-[#f8fafc] backdrop-blur-md">
      {icon}
      <span className="font-bold text-white font-mono">{value}</span>
      <span className="text-[#8290ab]">{label}</span>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sublabel,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sublabel: string;
  color: "blue" | "cyan" | "indigo" | "violet";
}) {
  const colors = {
    blue: "bg-[#1d4ed8]/20 text-[#38bdf8] border-[#3b82f6]/35 shadow-[0_0_15px_rgba(59,130,246,0.3)]",
    cyan: "bg-[#0284c7]/20 text-[#38bdf8] border-[#0ea5e9]/35 shadow-[0_0_15px_rgba(14,165,233,0.3)]",
    indigo: "bg-[#4338ca]/20 text-[#818cf8] border-[#6366f1]/35 shadow-[0_0_15px_rgba(99,102,241,0.3)]",
    violet: "bg-[#6d28d9]/20 text-[#a78bfa] border-[#8b5cf6]/35 shadow-[0_0_15px_rgba(139,92,246,0.3)]",
  };

  return (
    <div className="glass-card glass-card-hover p-6 rounded-3xl relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8290ab]">{label}</p>
          <p className="text-3xl font-extrabold text-white mt-1.5 tracking-tight font-mono">{value}</p>
          <p className="text-xs text-[#50607d] mt-1.5">{sublabel}</p>
        </div>
        <div className={cn("p-2.5 rounded-2xl border", colors[color])}>{icon}</div>
      </div>
    </div>
  );
}

function OutcomeRow({
  label,
  count,
  total,
  icon,
  color,
}: {
  label: string;
  count: number;
  total: number;
  icon: React.ReactNode;
  color: "blue" | "amber" | "red" | "gray";
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  const barStyles = {
    blue: "bg-gradient-to-r from-[#2563eb] to-[#38bdf8] shadow-[0_0_12px_rgba(56,189,248,0.45)]",
    amber: "bg-gradient-to-r from-amber-400 to-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]",
    red: "bg-gradient-to-r from-rose-500 to-rose-600 shadow-[0_0_12px_rgba(244,63,94,0.4)]",
    gray: "bg-slate-500",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span className="text-sm font-medium text-white">{label}</span>
        </div>
        <span className="text-xs font-mono text-[#8290ab]">
          {count} ({percentage}%)
        </span>
      </div>
      <div className="w-full bg-white/[0.06] rounded-full h-2.5 overflow-hidden border border-white/5">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barStyles[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function DefectRow({
  defect,
  count,
  total,
}: {
  defect: string;
  count: number;
  total: number;
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  const formattedDefect = defect
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return (
    <div className="flex items-center gap-3">
      <span className="w-36 text-sm text-[#f8fafc] truncate font-medium" title={formattedDefect}>
        {formattedDefect}
      </span>
      <div className="flex-1 bg-white/[0.06] rounded-full h-2.5 overflow-hidden border border-white/5">
        <div
          className="bg-gradient-to-r from-[#6366f1] to-[#a855f7] h-full rounded-full shadow-[0_0_8px_rgba(168,85,247,0.4)]"
          style={{ width: `${Math.max(percentage, 6)}%` }}
        />
      </div>
      <span className="text-xs font-mono text-[#8290ab] w-16 text-right">
        {count} ({percentage}%)
      </span>
    </div>
  );
}

function MachineTypeBreakdown({
  distribution,
  fleet,
  onViewMachine,
}: {
  distribution: { [machineType: string]: number };
  fleet: Fleet | null;
  onViewMachine: (machineId: string) => void;
}) {
  const types = fleet?.machine_types ?? [];
  if (types.length === 0) {
    return <EmptyState message="Loading fleet assets..." />;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
      {types.map((type) => {
        const incidentCount = distribution[type.machine_type] ?? 0;
        const target = type.hero_machine_id ?? type.machines[0]?.machine_id;
        return (
          <button
            key={type.machine_type}
            onClick={() => target && onViewMachine(target)}
            className="glass-card glass-card-hover rounded-2xl p-4 text-left transition-all group"
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="p-2 rounded-xl bg-[#1d4ed8]/20 text-[#60a5fa] border border-[#3b82f6]/30">
                <Server className="w-4 h-4" />
              </span>
              <ArrowRight className="w-4 h-4 text-[#8290ab] group-hover:text-[#38bdf8] group-hover:translate-x-1 transition-all" />
            </div>
            <p className="font-bold text-white text-sm group-hover:text-[#38bdf8] transition-colors">{humanize(type.label)}</p>
            <p className="text-xs text-[#8290ab] mt-1">
              {incidentCount} work orders · {type.machines.length} assets
            </p>
            {target && (
              <span className="inline-block mt-2 text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#3b82f6]/15 text-[#38bdf8] border border-[#3b82f6]/30">
                Hero: {target}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function MemoryValueCard({
  incidents,
  successRate,
  onReportIncident,
}: {
  incidents: number;
  successRate: number;
  onReportIncident: () => void;
}) {
  return (
    <div className="glass-card p-6 md:p-8 rounded-3xl relative overflow-hidden border border-[#3b82f6]/35 shadow-[0_0_40px_rgba(59,130,246,0.15)]">
      <div className="absolute -top-24 -right-24 w-80 h-80 bg-[#1d4ed8]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-2 rounded-xl bg-[#3b82f6]/20 text-[#38bdf8] border border-[#3b82f6]/40 shadow-[0_0_12px_rgba(59,130,246,0.3)]">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-extrabold text-white">Closed-Loop Vector Memory</h3>
          </div>
          <p className="text-sm text-[#8290ab] max-w-2xl leading-relaxed">
            Every verified repair is permanently retained into Hindsight vector memory. Next time an operator encounters identical vibration or pressure telemetry on any monitored line, the engine predicts the verified resolution instantly.
          </p>
        </div>
        <button
          onClick={onReportIncident}
          className="btn-neon-primary px-6 py-3 text-sm font-bold whitespace-nowrap self-start md:self-auto flex items-center gap-2 shadow-[0_0_22px_rgba(59,130,246,0.45)]"
        >
          <Plus className="w-4 h-4" />
          Report Machine Incident
        </button>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-[#50607d]">
      <Activity className="w-8 h-8 mb-2 text-[#8290ab]" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
