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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-industrial-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Header machineId={machineId} onBack={onBack} />
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      </div>
    );
  }

  if (!machineId || !memory || memory.message || memory.total_incidents === 0) {
    return (
      <div className="space-y-6">
        <Header machineId={machineId} onBack={onBack} />
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <Database className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">
            {memory?.message || "No incident history for this machine yet."}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Report an incident to start building this machine&apos;s memory.
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
      <div className="bg-gradient-to-r from-industrial-50 to-blue-50 border border-industrial-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <Database className="w-8 h-8 text-industrial-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-industrial-900">{machineId}</h3>
            {(memory.model || memory.production_line) && (
              <p className="text-sm text-industrial-600">
                {[memory.model, memory.production_line].filter(Boolean).join(" · ")}
              </p>
            )}
            <div className="flex flex-wrap gap-4 mt-2 text-sm">
              <span className="text-industrial-700">
                <strong>{memory.total_incidents}</strong> incidents
              </span>
              <span className="text-industrial-700">
                <strong>{memory.recurring_defects?.length || 0}</strong> defect types
              </span>
              <span className="text-industrial-700">
                <strong>{successRate}%</strong> of attempts worked
              </span>
              <span className="text-industrial-700">
                <strong>{memory.total_downtime_hours ?? 0} h</strong> downtime logged
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Activity className="w-6 h-6 text-industrial-600" />}
          label="Total Incidents"
          value={memory.total_incidents || 0}
          bgColor="bg-industrial-50"
        />
        <StatCard
          icon={<CheckCircle className="w-6 h-6 text-green-600" />}
          label="Repairs That Worked"
          value={memory.outcome_distribution?.SUCCESS ?? 0}
          bgColor="bg-green-50"
        />
        <StatCard
          icon={<XCircle className="w-6 h-6 text-red-600" />}
          label="Failed Attempts"
          value={memory.outcome_distribution?.FAILED ?? 0}
          bgColor="bg-red-50"
        />
        <StatCard
          icon={<TrendingUp className="w-6 h-6 text-blue-600" />}
          label="Attempts That Worked"
          value={`${successRate}%`}
          bgColor="bg-blue-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recurring Defects */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-semibold text-industrial-900">
              Recurring Defects
            </h3>
          </div>
          {memory.recurring_defects && memory.recurring_defects.length > 0 ? (
            <div className="space-y-3">
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
            <p className="text-gray-500 text-sm">No recurring defects.</p>
          )}
        </div>

        {/* What Worked */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <h3 className="text-lg font-semibold text-industrial-900">
              What Has Worked
            </h3>
          </div>
          <InterventionList
            interventions={memory.successful_interventions || {}}
            type="success"
          />
        </div>

        {/* What Didn't Work */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <XCircle className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-semibold text-industrial-900">
              What Hasn&apos;t Worked
            </h3>
          </div>
          <InterventionList
            interventions={memory.failed_interventions || {}}
            type="failed"
          />
        </div>
      </div>

      {/* Memory Timeline */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-industrial-600" />
          <h3 className="text-lg font-semibold text-industrial-900">Memory Timeline</h3>
          <span className="ml-auto text-xs text-gray-500">Newest first · from the work-order record</span>
        </div>
        <MemoryTimeline incidents={memory.timeline || []} />
      </div>

      {/* Intervention Chart */}
      {(Object.keys(memory.successful_interventions || {}).length > 0 ||
        Object.keys(memory.failed_interventions || {}).length > 0) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-industrial-600" />
            <h3 className="text-lg font-semibold text-industrial-900">
              Historical Interventions
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
        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div>
        <h2 className="text-2xl font-bold text-industrial-900">Machine Memory</h2>
        <p className="text-industrial-600">{machineId || "Select a machine"}</p>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  bgColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  bgColor: string;
}) {
  return (
    <div className={cn("rounded-lg p-4", bgColor)}>
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function MemoryTimeline({ incidents }: { incidents: MachineTimelineEntry[] }) {
  const [problem, setProblem] = useState<string | null>(null);
  if (incidents.length === 0) {
    return <p className="text-gray-500 text-sm">No incidents recorded.</p>;
  }

  // How each work order relates to the previous one for the same problem.
  const chain = new Map<string, "follow-up" | "recurred">();
  const lastByProblem = new Map<string, MachineTimelineEntry>();
  for (const entry of [...incidents].reverse()) {
    const previous = lastByProblem.get(entry.defect_type);
    if (previous) chain.set(entry.incident_id, previous.action_outcome === "SUCCESS" ? "recurred" : "follow-up");
    lastByProblem.set(entry.defect_type, entry);
  }
  const counts = incidents.reduce<Record<string, number>>((acc, i) => ((acc[i.defect_type] = (acc[i.defect_type] ?? 0) + 1), acc), {});
  const shown = problem ? incidents.filter((i) => i.defect_type === problem) : incidents;

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filter timeline by problem">
        {[null, ...Object.keys(counts)].map((key) => (
          <button
            key={key ?? "all"}
            type="button"
            aria-pressed={problem === key}
            onClick={() => setProblem(key)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-colors",
              problem === key ? "bg-industrial-600 text-white border-industrial-600" : "border-gray-200 text-gray-700 hover:bg-gray-50"
            )}
          >
            {key ? `${humanize(key)} (${counts[key]})` : `All (${incidents.length})`}
          </button>
        ))}
      </div>
    <div className="relative">
      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" aria-hidden />
      <ol className="space-y-3">
        {shown.map((incident, i) => (
          <li key={incident.incident_id} className="relative pl-8">
            <div
              className={cn(
                "absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center",
                incident.action_outcome === "SUCCESS"
                  ? "bg-green-100"
                  : incident.action_outcome === "FAILED"
                  ? "bg-red-100"
                  : incident.action_outcome === "PARTIAL"
                  ? "bg-amber-100"
                  : "bg-gray-100"
              )}
            >
              {incident.action_outcome === "SUCCESS" ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : incident.action_outcome === "FAILED" ? (
                <XCircle className="w-4 h-4 text-red-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              )}
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1 gap-2">
                <p className="text-sm font-medium text-gray-900">
                  {humanize(incident.defect_type)}
                  {i === 0 && !problem && (
                    <span className="ml-2 inline-flex items-center gap-1 text-xs text-industrial-600">
                      <Zap className="w-3 h-3" aria-hidden />
                      Most recent
                    </span>
                  )}
                  {chain.get(incident.incident_id) === "follow-up" && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">Follow-up: previous attempt didn&apos;t work</span>
                  )}
                  {chain.get(incident.incident_id) === "recurred" && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">Came back after a fix</span>
                  )}
                </p>
                <span className={cn("text-xs px-2 py-0.5 rounded flex-shrink-0", getOutcomeBgColor(incident.action_outcome))}>
                  {incident.action_outcome ?? "OPEN"}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {formatDay(incident.timestamp)} · {incident.incident_id}
                {incident.technician_id ? ` · ${incident.technician_id}` : ""}
                {incident.operating_hours ? ` · ${incident.operating_hours.toLocaleString()} h` : ""}
                {incident.downtime_minutes ? ` · downtime ${formatHours(incident.downtime_minutes)}` : ""}
              </p>
              {incident.action_taken ? (
                <p className="text-sm text-gray-700 mt-1">
                  {incident.intervention_category && <span className="font-medium">{incident.intervention_category}: </span>}
                  {incident.action_taken}
                </p>
              ) : (
                <p className="text-sm text-gray-500 mt-1">No outcome recorded yet.</p>
              )}
              {incident.technician_notes && (
                <p className="text-xs text-gray-500 mt-1">&ldquo;{incident.technician_notes}&rdquo;</p>
              )}
            </div>
          </li>
        ))}
      </ol>
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
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{humanize(defect)}</span>
        <span className="text-sm text-gray-500">{count} incidents</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-4">
        <div
          className="bg-amber-500 h-4 rounded-full flex items-center justify-end pr-2"
          style={{ width: `${Math.max(percentage, 10)}%` }}
        >
          {percentage >= 20 && (
            <span className="text-xs text-white font-medium">{percentage}%</span>
          )}
        </div>
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
      <p className="text-gray-500 text-sm">
        No {type === "success" ? "successful" : "failed"} interventions recorded.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {entries.map(([action, defects]) => (
        <div
          key={action}
          className={cn(
            "p-3 rounded-lg",
            type === "success" ? "bg-green-50" : "bg-red-50"
          )}
        >
          <p
            className={cn(
              "font-medium",
              type === "success" ? "text-green-800" : "text-red-800"
            )}
          >
            {action}
          </p>
          <p
            className={cn(
              "text-sm mt-1",
              type === "success" ? "text-green-600" : "text-red-600"
            )}
          >
            {type === "success" ? "Resolved" : "Failed for"}: {countList(defects)}
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
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-700 truncate pr-4">{item.action}</span>
            <span className="text-gray-500 flex-shrink-0">
              {item.success} success · {item.failed} failed
            </span>
          </div>
          <div className="flex h-6 bg-gray-100 rounded overflow-hidden">
            <div
              className="bg-green-500"
              style={{ width: `${(item.success / maxTotal) * 100}%` }}
            />
            <div
              className="bg-red-500"
              style={{ width: `${(item.failed / maxTotal) * 100}%` }}
            />
          </div>
        </div>
      ))}
      <div className="flex justify-center gap-6 pt-4 border-t">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded" />
          <span className="text-sm text-gray-600">Success</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded" />
          <span className="text-sm text-gray-600">Failed</span>
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
