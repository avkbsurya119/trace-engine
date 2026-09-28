"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { cn, formatDay, formatHours, getOutcomeBgColor, humanize } from "@/lib/utils";
import type { MachineMemory as MachineMemoryType, MachineTimelineEntry } from "@/types/incident";
import {
  ArrowLeft,
  Database,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  Activity,
  Loader2,
  BarChart3,
  Calendar,
  Zap,
} from "lucide-react";

interface Props {
  machineId: string;
  onBack: () => void;
}

export function MachineMemory({ machineId, onBack }: Props) {
  const [memory, setMemory] = useState<MachineMemoryType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMemory() {
      setLoading(true);
      setError(null);
      setMemory(null);
      if (!machineId) {
        setLoading(false);
        return;
      }
      try {
        const data = await api.getMachineMemory(machineId);
        setMemory(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchMemory();
  }, [machineId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#38bdf8]" />
        <p className="text-xs text-gray-400 uppercase tracking-widest font-mono">Recalling Machine Vector Store...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Header machineId={machineId} onBack={onBack} />
        <div className="glass-card border border-red-500/30 rounded-2xl p-6 text-red-300 text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!machineId || !memory || memory.message || memory.total_incidents === 0) {
    return (
      <div className="space-y-6">
        <Header machineId={machineId} onBack={onBack} />
        <div className="glass-card rounded-3xl border border-white/10 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center mx-auto mb-4 text-gray-400">
            <Database className="w-8 h-8" />
          </div>
          <p className="text-gray-200 text-lg font-semibold">
            {memory?.message || "No incident history for this machine yet."}
          </p>
          <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto leading-relaxed">
            Report an incident to start building this machine&apos;s memory bank and neural cross-references.
          </p>
        </div>
      </div>
    );
  }

  const successRate = calculateSuccessRate(memory);

  return (
    <div className="space-y-6">
      <Header machineId={machineId} onBack={onBack} />

      {/* Machine Health Summary */}
      <div className="glass-card rounded-3xl p-6 border border-white/10 relative overflow-hidden bg-gradient-to-r from-[#38bdf8]/10 via-[#3a6cff]/10 to-transparent">
        <div className="flex items-start gap-4">
          <div className="p-3.5 bg-white/[0.05] border border-white/15 rounded-2xl text-[#38bdf8] shadow-inner">
            <Database className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-black text-white tracking-wide font-mono">{machineId}</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/30">
                ACTIVE MEMORY BANK
              </span>
            </div>
            {(memory.model || memory.production_line) && (
              <p className="text-xs text-gray-400 mt-1">
                {[memory.model, memory.production_line].filter(Boolean).join(" · ")}
              </p>
            )}
            <div className="flex flex-wrap gap-4 mt-3 text-xs">
              <span className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-gray-300">
                <strong className="text-white font-mono">{memory.total_incidents}</strong> incidents
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-gray-300">
                <strong className="text-white font-mono">{memory.recurring_defects?.length || 0}</strong> defect types
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-[#38bdf8]/10 border border-[#38bdf8]/30 text-[#38bdf8]">
                <strong className="font-mono">{successRate}%</strong> first-time fix rate
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-gray-300">
                <strong className="text-white font-mono">{memory.total_downtime_hours ?? 0} h</strong> logged downtime
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Activity className="w-5 h-5 text-[#3a6cff]" />}
          label="Total Incidents"
          value={memory.total_incidents || 0}
          accent="text-white"
        />
        <StatCard
          icon={<CheckCircle className="w-5 h-5 text-[#38bdf8]" />}
          label="Repairs That Worked"
          value={memory.outcome_distribution?.SUCCESS ?? 0}
          accent="text-[#38bdf8]"
        />
        <StatCard
          icon={<XCircle className="w-5 h-5 text-red-400 text-rose-400" />}
          label="Failed Attempts"
          value={memory.outcome_distribution?.FAILED ?? 0}
          accent="text-rose-400"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-amber-400" />}
          label="Success Yield"
          value={`${successRate}%`}
          accent="text-amber-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recurring Defects */}
        <div className="glass-card rounded-2xl p-6 border border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white uppercase tracking-wider">
              Recurring Defects
            </h3>
          </div>
          {memory.recurring_defects && memory.recurring_defects.length > 0 ? (
            <div className="space-y-3.5">
              {memory.recurring_defects.map(([defect, count]) => (
                <DefectBar
                  key={defect}
                  defect={defect}
                  count={count}
                  total={memory.total_incidents || 1}
                />
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-xs">No recurring defects recorded for this asset.</p>
          )}
        </div>

        {/* What Worked */}
        <div className="glass-card rounded-2xl p-6 border border-[#38bdf8]/20 bg-[#38bdf8]/[0.02]">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-[#38bdf8]" />
            <h3 className="text-base font-bold text-white uppercase tracking-wider">
              Verified Solutions
            </h3>
          </div>
          <InterventionList
            interventions={memory.successful_interventions || {}}
            type="success"
          />
        </div>

        {/* What Didn't Work */}
        <div className="glass-card rounded-2xl p-6 border border-rose-500/20 bg-rose-500/[0.02] lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <XCircle className="w-5 h-5 text-rose-400" />
            <h3 className="text-base font-bold text-white uppercase tracking-wider">
              Ineffective Actions (Avoided by TRACE)
            </h3>
          </div>
          <InterventionList
            interventions={memory.failed_interventions || {}}
            type="failed"
          />
        </div>
      </div>

      {/* Memory Timeline */}
      <div className="glass-card rounded-2xl p-6 border border-white/10">
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="w-5 h-5 text-[#38bdf8]" />
          <h3 className="text-base font-bold text-white uppercase tracking-wider">Memory Timeline</h3>
          <span className="ml-auto text-xs text-gray-400 font-mono">Newest first · Verified Work Orders</span>
        </div>
        <MemoryTimeline incidents={memory.timeline || []} />
      </div>

      {/* Intervention Chart */}
      {(Object.keys(memory.successful_interventions || {}).length > 0 ||
        Object.keys(memory.failed_interventions || {}).length > 0) && (
        <div className="glass-card rounded-2xl p-6 border border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-[#3a6cff]" />
            <h3 className="text-base font-bold text-white uppercase tracking-wider">
              Historical Interventions Comparison
            </h3>
          </div>
          <InterventionChart
            successful={memory.successful_interventions || {}}
            failed={memory.failed_interventions || {}}
          />
        </div>
      )}
    </div>
  );
}

function Header({ machineId, onBack }: { machineId: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-4">
      <button
        onClick={onBack}
        className="p-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-gray-300 hover:text-white hover:bg-white/[0.08] hover:border-[#38bdf8]/40 transition-all"
        title="Back to Dashboard"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">Machine Memory Dossier</h2>
        <p className="text-xs text-[#38bdf8] font-mono mt-0.5">{machineId || "Select a machine"}</p>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-5 border border-white/10 hover:border-white/20 transition-all">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">{label}</p>
          <p className={cn("text-2xl font-bold font-mono mt-0.5", accent)}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function MemoryTimeline({ incidents }: { incidents: MachineTimelineEntry[] }) {
  if (incidents.length === 0) {
    return <p className="text-gray-400 text-xs">No incidents recorded.</p>;
  }

  return (
    <div className="relative">
      <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-white/10" />
      <div className="space-y-4">
        {incidents.map((incident, i) => (
          <div key={incident.incident_id} className="relative pl-9">
            <div
              className={cn(
                "absolute left-1 top-2.5 w-5 h-5 rounded-full flex items-center justify-center border",
                incident.action_outcome === "SUCCESS"
                  ? "bg-[#38bdf8]/20 border-[#38bdf8] text-[#38bdf8]"
                  : incident.action_outcome === "FAILED"
                  ? "bg-rose-500/20 border-rose-500 text-rose-400"
                  : incident.action_outcome === "PARTIAL"
                  ? "bg-amber-400/20 border-amber-400 text-amber-400"
                  : "bg-white/10 border-white/20 text-gray-400"
              )}
            >
              {incident.action_outcome === "SUCCESS" ? (
                <CheckCircle className="w-3.5 h-3.5" />
              ) : incident.action_outcome === "FAILED" ? (
                <XCircle className="w-3.5 h-3.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5" />
              )}
            </div>
            <div className="glass-card rounded-2xl p-4 border border-white/10 hover:border-white/20 transition-all">
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  {humanize(incident.defect_type)}
                  {i === 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/30">
                      <Zap className="w-3 h-3" />
                      LATEST
                    </span>
                  )}
                </p>
                <span className={cn("text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wider", getOutcomeBgColor(incident.action_outcome))}>
                  {incident.action_outcome ?? "OPEN"}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono">
                {formatDay(incident.timestamp)} · <span className="text-gray-300 font-semibold">{incident.incident_id}</span>
                {incident.technician_id ? ` · Tech: ${incident.technician_id}` : ""}
                {incident.operating_hours ? ` · ${incident.operating_hours.toLocaleString()} h` : ""}
                {incident.downtime_minutes ? ` · Downtime ${formatHours(incident.downtime_minutes)}` : ""}
              </p>
              {incident.action_taken ? (
                <p className="text-xs text-gray-200 mt-2 bg-white/[0.02] p-2 rounded-xl border border-white/5">
                  {incident.intervention_category && <span className="font-semibold text-[#38bdf8]">{incident.intervention_category}: </span>}
                  {incident.action_taken}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-2 italic">No outcome recorded yet.</p>
              )}
              {incident.technician_notes && (
                <p className="text-xs text-gray-400 mt-1.5 italic">&ldquo;{incident.technician_notes}&rdquo;</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DefectBar({
  defect,
  count,
  total,
}: {
  defect: string;
  count: number;
  total: number;
}) {
  const percentage = Math.round((count / total) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5 font-medium">
        <span className="text-gray-200">{humanize(defect)}</span>
        <span className="text-gray-400 font-mono">{count} incidents ({percentage}%)</span>
      </div>
      <div className="w-full bg-white/[0.06] rounded-full h-3 overflow-hidden border border-white/5">
        <div
          className="bg-amber-400 h-full rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(251,191,36,0.5)]"
          style={{ width: `${Math.max(percentage, 8)}%` }}
        />
      </div>
    </div>
  );
}

function InterventionList({
  interventions,
  type,
}: {
  interventions: { [action: string]: string[] };
  type: "success" | "failed";
}) {
  const entries = Object.entries(interventions);
  if (entries.length === 0) {
    return (
      <p className="text-gray-400 text-xs">
        No {type === "success" ? "successful" : "failed"} interventions recorded.
      </p>
    );
  }
  return (
    <div className="space-y-2.5">
      {entries.map(([action, defects]) => (
        <div
          key={action}
          className={cn(
            "p-3.5 rounded-xl border transition-all",
            type === "success"
              ? "bg-[#38bdf8]/[0.08] border-[#38bdf8]/30 text-gray-200"
              : "bg-rose-500/[0.08] border-rose-500/30 text-gray-200"
          )}
        >
          <p
            className={cn(
              "font-semibold text-sm",
              type === "success" ? "text-[#38bdf8]" : "text-rose-400"
            )}
          >
            {action}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {type === "success" ? "Resolved" : "Failed for"}: <span className="text-gray-200">{countList(defects)}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

function InterventionChart({
  successful,
  failed,
}: {
  successful: { [action: string]: string[] };
  failed: { [action: string]: string[] };
}) {
  const allActions = new Set([...Object.keys(successful), ...Object.keys(failed)]);
  const data = Array.from(allActions).map((action) => ({
    action,
    success: successful[action]?.length || 0,
    failed: failed[action]?.length || 0,
    total: (successful[action]?.length || 0) + (failed[action]?.length || 0),
  }));
  data.sort((a, b) => b.total - a.total);
  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="space-y-4">
      {data.slice(0, 5).map((item) => (
        <div key={item.action}>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-gray-200 font-medium truncate pr-4">{item.action}</span>
            <span className="text-gray-400 font-mono flex-shrink-0">
              <span className="text-[#38bdf8]">{item.success} success</span> · <span className="text-rose-400">{item.failed} failed</span>
            </span>
          </div>
          <div className="flex h-3 bg-white/[0.06] rounded-full overflow-hidden border border-white/5">
            <div
              className="bg-[#38bdf8] shadow-[0_0_10px_rgba(56,189,248,0.5)] transition-all duration-700"
              style={{ width: `${(item.success / maxTotal) * 100}%` }}
            />
            <div
              className="bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)] transition-all duration-700"
              style={{ width: `${(item.failed / maxTotal) * 100}%` }}
            />
          </div>
        </div>
      ))}
      <div className="flex justify-center gap-6 pt-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-[#38bdf8] rounded-full shadow-[0_0_6px_#38bdf8]" />
          <span className="text-xs text-gray-300 font-medium">Worked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-rose-500 rounded-full shadow-[0_0_6px_#f43f5e]" />
          <span className="text-xs text-gray-300 font-medium">Failed</span>
        </div>
      </div>
    </div>
  );
}

function calculateSuccessRate(memory: MachineMemoryType): number {
  const outcomes = memory.outcome_distribution ?? {};
  const attempts = (outcomes.SUCCESS ?? 0) + (outcomes.PARTIAL ?? 0) + (outcomes.FAILED ?? 0);
  return attempts > 0 ? Math.round(((outcomes.SUCCESS ?? 0) / attempts) * 100) : 0;
}

function countList(items: string[]): string {
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .map(([item, n]) => (n > 1 ? `${humanize(item)} ×${n}` : humanize(item)))
    .join(", ");
}
