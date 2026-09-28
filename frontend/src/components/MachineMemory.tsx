"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { cn, formatDay, formatHours, getOutcomeBgColor, humanize } from "@/lib/utils";
import type { Fleet, MachineMemory as MachineMemoryType, MachineTimelineEntry } from "@/types/incident";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle,
  Clock,
  Database,
  Plus,
  Search,
  XCircle,
  Zap,
} from "lucide-react";
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  CARD,
  CARD_INTERACTIVE,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Section,
  StatTile,
} from "@/components/ui";

interface Props {
  machineId: string;
  onSelectMachine: (machineId: string) => void;
  onReportIncident: () => void;
  onBack: () => void;
}

/** "What happened before?" One machine's full maintenance history, from SQLite. */
export function MachineMemory({ machineId, onSelectMachine, onReportIncident, onBack }: Props) {
  const [memory, setMemory] = useState<MachineMemoryType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!machineId) return;
    setError(null);
    setMemory(null);
    api
      .getMachineMemory(machineId)
      .then(setMemory)
      .catch((e) => setError(e instanceof Error ? e.message : "The backend did not respond."));
  }, [machineId]);

  useEffect(() => load(), [load]);

  const breadcrumb = [{ label: "Machine Memory", onClick: machineId ? () => onSelectMachine("") : undefined }, ...(machineId ? [{ label: machineId }] : [])];

  if (!machineId) {
    return (
      <div className="space-y-6">
        <PageHeader question="What happened before?" title="Machine Memory" subtitle="Every work order on one machine: what was wrong, what was tried, and whether it worked." />
        <MachinePicker onSelect={onSelectMachine} />
      </div>
    );
  }

  const header = (
    <PageHeader
      question="What happened before?"
      title={machineId}
      breadcrumb={breadcrumb}
      subtitle={memory && (memory.model || memory.production_line) ? [memory.model, memory.production_line].filter(Boolean).join(" · ") : undefined}
      actions={
        <button type="button" onClick={onBack} className={BUTTON_SECONDARY}>
          Dashboard
        </button>
      }
    />
  );

  if (error) {
    return (
      <div className="space-y-6">
        {header}
        <ErrorState title={`Could not load the history of ${machineId}`} detail={error} onRetry={load} />
      </div>
    );
  }

  if (!memory) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingState label={`Reading ${machineId}'s maintenance history…`} />
      </div>
    );
  }

  if (memory.total_incidents === 0) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon={<Database className="w-6 h-6" />}
          title={`No work orders for ${machineId} yet`}
          action={
            <button type="button" onClick={onReportIncident} className={BUTTON_PRIMARY}>
              <Plus className="w-4 h-4" aria-hidden /> Report an incident
            </button>
          }
        >
          When an incident on this machine is reported and its outcome recorded, it appears here, and TRACE recalls it the next time
          the machine has a similar problem.
        </EmptyState>
      </div>
    );
  }

  const successRate = calculateSuccessRate(memory);

  return (
    <div className="space-y-6">
      {header}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Work orders" value={memory.total_incidents} sub={`${memory.recurring_defects?.length ?? 0} different problems`} icon={<Activity className="w-5 h-5" />} />
        <StatTile label="Repairs that worked" value={memory.outcome_distribution?.SUCCESS ?? 0} sub={`${successRate}% of verified attempts`} icon={<CheckCircle className="w-5 h-5" />} tone="good" />
        <StatTile label="Failed attempts" value={memory.outcome_distribution?.FAILED ?? 0} sub={`${memory.outcome_distribution?.PARTIAL ?? 0} partial`} icon={<XCircle className="w-5 h-5" />} tone="bad" />
        <StatTile label="Downtime logged" value={`${memory.total_downtime_hours ?? 0} h`} sub="Across this machine's work orders" icon={<Clock className="w-5 h-5" />} tone="warn" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Section icon={<CheckCircle className="w-5 h-5 text-green-400" />} title="What has worked" id="worked">
          <InterventionList interventions={memory.successful_interventions || {}} type="success" />
        </Section>
        <Section icon={<XCircle className="w-5 h-5 text-red-400" />} title="What hasn't worked" id="failed">
          <InterventionList interventions={memory.failed_interventions || {}} type="failed" />
        </Section>
        <Section icon={<AlertTriangle className="w-5 h-5 text-amber-400" />} title="Recurring problems" id="recurring">
          {memory.recurring_defects && memory.recurring_defects.length > 0 ? (
            <div className="space-y-3">
              {memory.recurring_defects.map(([defect, count]) => (
                <DefectBar key={defect} defect={defect} count={count} total={memory.total_incidents || 1} />
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No recurring problems.</p>
          )}
        </Section>
      </div>

      {(Object.keys(memory.successful_interventions || {}).length > 0 || Object.keys(memory.failed_interventions || {}).length > 0) && (
        <Section icon={<BarChart3 className="w-5 h-5" />} title="Interventions on this machine" id="interventions">
          <InterventionChart successful={memory.successful_interventions || {}} failed={memory.failed_interventions || {}} />
        </Section>
      )}

      <Section
        icon={<Calendar className="w-5 h-5" />}
        title="Maintenance timeline"
        id="timeline"
        aside={<span className="text-xs text-slate-400">Newest first · from the work-order record</span>}
      >
        <MemoryTimeline incidents={memory.timeline || []} />
      </Section>
    </div>
  );
}

/** Choose a machine: grouped by equipment type, filterable, from the fleet catalog. */
function MachinePicker({ onSelect }: { onSelect: (machineId: string) => void }) {
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    setError(null);
    api
      .getFleet()
      .then(setFleet)
      .catch((e) => setError(e instanceof Error ? e.message : "The backend did not respond."));
  }, []);
  useEffect(() => load(), [load]);

  const q = query.trim().toUpperCase();
  const groups = useMemo(
    () =>
      (fleet?.machine_types ?? [])
        .map((t) => ({ ...t, machines: t.machines.filter((m) => !q || m.machine_id.includes(q) || m.production_line.toUpperCase().includes(q)) }))
        .filter((t) => t.machines.length > 0),
    [fleet, q]
  );

  if (error) return <ErrorState title="Could not load the machine list" detail={error} onRetry={load} />;
  if (!fleet) return <LoadingState label="Loading machines…" />;

  return (
    <div className={cn(CARD, "p-6 space-y-5")}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (q) onSelect(groups[0]?.machines[0]?.machine_id ?? q);
        }}
        className="relative max-w-sm"
      >
        <label htmlFor="machine-search" className="sr-only">
          Find a machine
        </label>
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
        <input
          id="machine-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a machine, e.g. cnc-204"
          className="w-full pl-9 pr-3 py-2.5 glass-input text-sm"
        />
      </form>
      {groups.length === 0 && <p className="text-sm text-slate-400">No machine matches "{query}".</p>}
      {groups.map((type) => (
        <div key={type.machine_type}>
          <p className="text-xs uppercase tracking-wide font-semibold text-[#38bdf8] mb-2">{humanize(type.label)}</p>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {type.machines.map((m) => (
              <li key={m.machine_id}>
                <button
                  type="button"
                  onClick={() => onSelect(m.machine_id)}
                  className={cn("glass-pod w-full text-left px-3 py-2", CARD_INTERACTIVE)}
                >
                  <span className="block text-sm font-medium text-white">
                    {m.machine_id}
                    {m.machine_id === type.hero_machine_id && <span className="ml-1 text-xs text-[#38bdf8]">★ showcase</span>}
                  </span>
                  <span className="block text-xs text-slate-400 truncate">{m.production_line}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function MemoryTimeline({ incidents }: { incidents: MachineTimelineEntry[] }) {
  const [problem, setProblem] = useState<string | null>(null);
  if (incidents.length === 0) {
    return <p className="text-slate-400 text-sm">No incidents recorded.</p>;
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
              "text-xs px-2.5 py-1.5 rounded-full border transition-all",
              problem === key
                ? "bg-[#38bdf8] text-[#0a1628] border-[#38bdf8] font-medium"
                : "border-white/10 text-slate-300 hover:bg-white/5"
            )}
          >
            {key ? `${humanize(key)} (${counts[key]})` : `All (${incidents.length})`}
          </button>
        ))}
      </div>
    <div className="relative">
      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-700" aria-hidden />
      <ol className="space-y-3">
        {shown.map((incident, i) => (
          <li
            key={incident.incident_id}
            className="relative pl-8 animate-fade-in"
            style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
          >
            <div
              className={cn(
                "absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center",
                incident.action_outcome === "SUCCESS"
                  ? "bg-green-900/40"
                  : incident.action_outcome === "FAILED"
                  ? "bg-red-900/40"
                  : incident.action_outcome === "PARTIAL"
                  ? "bg-amber-900/40"
                  : "bg-slate-700/50"
              )}
            >
              {incident.action_outcome === "SUCCESS" ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : incident.action_outcome === "FAILED" ? (
                <XCircle className="w-4 h-4 text-red-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              )}
            </div>
            <div className="glass-pod p-3">
              <div className="flex items-center justify-between mb-1 gap-2">
                <p className="text-sm font-medium text-white">
                  {humanize(incident.defect_type)}
                  {i === 0 && !problem && (
                    <span className="ml-2 inline-flex items-center gap-1 text-xs text-[#38bdf8]">
                      <Zap className="w-3 h-3" aria-hidden />
                      Most recent
                    </span>
                  )}
                  {chain.get(incident.incident_id) === "follow-up" && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-300">Follow-up: previous attempt didn&apos;t work</span>
                  )}
                  {chain.get(incident.incident_id) === "recurred" && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-300">Came back after a fix</span>
                  )}
                </p>
                <span className={cn("text-xs px-2 py-0.5 rounded flex-shrink-0", getOutcomeBgColor(incident.action_outcome))}>
                  {incident.action_outcome ?? "OPEN"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {formatDay(incident.timestamp)} · {incident.incident_id}
                {incident.technician_id ? ` · ${incident.technician_id}` : ""}
                {incident.operating_hours ? ` · ${incident.operating_hours.toLocaleString()} h` : ""}
                {incident.downtime_minutes ? ` · downtime ${formatHours(incident.downtime_minutes)}` : ""}
              </p>
              {incident.action_taken ? (
                <p className="text-sm text-slate-300 mt-1">
                  {incident.intervention_category && <span className="font-medium text-white">{incident.intervention_category}: </span>}
                  {incident.action_taken}
                </p>
              ) : (
                <p className="text-sm text-slate-500 mt-1">No outcome recorded yet.</p>
              )}
              {incident.technician_notes && (
                <p className="text-xs text-slate-400 mt-1">&ldquo;{incident.technician_notes}&rdquo;</p>
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
        <span className="text-sm font-medium text-white">{humanize(defect)}</span>
        <span className="text-sm text-slate-400">{count} incidents</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-4">
        <div
          className="bg-amber-400 h-4 rounded-full flex items-center justify-end pr-2"
          style={{ width: `${Math.max(percentage, 10)}%` }}
        >
          {percentage >= 20 && (
            <span className="text-xs text-[#0a1628] font-medium">{percentage}%</span>
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
      <p className="text-slate-400 text-sm">
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
            "p-3 rounded-xl",
            type === "success" ? "bg-green-900/20 border border-green-500/20" : "bg-red-900/20 border border-red-500/20"
          )}
        >
          <p
            className={cn(
              "font-medium",
              type === "success" ? "text-green-300" : "text-red-300"
            )}
          >
            {action}
          </p>
          <p
            className={cn(
              "text-sm mt-1",
              type === "success" ? "text-green-400/80" : "text-red-400/80"
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
            <span className="text-white truncate pr-4">{item.action}</span>
            <span className="text-slate-400 flex-shrink-0">
              {item.success} success · {item.failed} failed
            </span>
          </div>
          <div className="flex h-6 bg-slate-700 rounded overflow-hidden">
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
      <div className="flex justify-center gap-6 pt-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded" />
          <span className="text-sm text-slate-300">Success</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded" />
          <span className="text-sm text-slate-300">Failed</span>
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
