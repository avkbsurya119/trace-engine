"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, BarChart3, CheckCircle, Clock, Plus, Server, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { cn, formatDay, humanize } from "@/lib/utils";
import type { DashboardStats, Fleet } from "@/types/incident";
import {
  BUTTON_PRIMARY,
  CARD,
  CARD_INTERACTIVE,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Section,
  StatTile,
} from "@/components/ui";
import { AnimatedNumber } from "@/components/intelligence/charts";

interface DashboardProps {
  onReportIncident: () => void;
  onViewMachineMemory: (machineId: string) => void;
}

/** "What is happening?" The fleet's current state, from SQLite. */
export function Dashboard({ onReportIncident, onViewMachineMemory }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setStats(null);
    Promise.all([api.getDashboardStats(), api.getFleet()])
      .then(([s, f]) => {
        setStats(s);
        setFleet(f);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "The backend did not respond."));
  }, []);

  useEffect(() => load(), [load]);

  // Same basis as the outcome bars below: share of all recorded outcomes.
  const worked = stats && stats.incidents_with_outcome ? Math.round((stats.outcome_distribution.SUCCESS / stats.incidents_with_outcome) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        question="What is happening?"
        title="Dashboard"
        subtitle={
          stats?.history_start && stats.history_end ? (
            <>
              Maintenance work orders across the fleet, {formatDay(stats.history_start)} – {formatDay(stats.history_end)}.
              <span className="block text-xs text-slate-400 mt-0.5">
                Synthetic, operationally realistic history · memory bank {stats.memory_bank}
              </span>
            </>
          ) : (
            "Maintenance work orders across the fleet."
          )
        }
        actions={
          <button type="button" onClick={onReportIncident} className={BUTTON_PRIMARY}>
            <Plus className="w-4 h-4" aria-hidden /> Report incident
          </button>
        }
      />

      {error && <ErrorState title="Could not load the dashboard" detail={error} onRetry={load} />}
      {!stats && !error && <LoadingState label="Loading fleet status…" />}

      {stats && stats.total_incidents === 0 && (
        <EmptyState
          title="No work orders yet"
          action={
            <button type="button" onClick={onReportIncident} className={BUTTON_PRIMARY}>
              <Plus className="w-4 h-4" aria-hidden /> Report the first incident
            </button>
          }
        >
          Every incident you report and every outcome you record becomes memory TRACE can use for the next similar problem.
        </EmptyState>
      )}

      {stats && stats.total_incidents > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatTile
              label="Work orders"
              value={<AnimatedNumber value={stats.total_incidents} />}
              sub={`${stats.incidents_with_outcome.toLocaleString()} with a recorded outcome`}
              icon={<Activity className="w-5 h-5" />}
            />
            <StatTile
              label="Machines"
              value={<AnimatedNumber value={stats.unique_machines} />}
              sub={`${Object.keys(stats.machine_type_distribution ?? {}).length} equipment types`}
              icon={<Server className="w-5 h-5" />}
            />
            <StatTile
              label="Repairs that worked"
              value={`${worked}%`}
              sub={`${stats.outcome_distribution.SUCCESS.toLocaleString()} of ${stats.incidents_with_outcome.toLocaleString()} recorded outcomes`}
              icon={<CheckCircle className="w-5 h-5" />}
              tone="good"
            />
            <StatTile
              label="Downtime logged"
              value={<AnimatedNumber value={Math.round(stats.total_downtime_hours)} format={(n) => `${Math.round(n).toLocaleString()} h`} />}
              sub="Across all work orders"
              icon={<Clock className="w-5 h-5" />}
              tone="warn"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section icon={<BarChart3 className="w-5 h-5" />} title="Intervention outcomes" id="outcomes">
              <div className="space-y-4">
                <OutcomeRow label="Worked" count={stats.outcome_distribution.SUCCESS} total={stats.incidents_with_outcome} icon={<CheckCircle className="w-4 h-4" />} color="green" />
                <OutcomeRow label="Partially worked" count={stats.outcome_distribution.PARTIAL} total={stats.incidents_with_outcome} icon={<AlertTriangle className="w-4 h-4" />} color="amber" />
                <OutcomeRow label="Failed" count={stats.outcome_distribution.FAILED} total={stats.incidents_with_outcome} icon={<XCircle className="w-4 h-4" />} color="red" />
                <OutcomeRow label="Not verified" count={stats.outcome_distribution.UNKNOWN} total={stats.incidents_with_outcome} icon={<Activity className="w-4 h-4" />} color="gray" />
              </div>
            </Section>

            <Section icon={<AlertTriangle className="w-5 h-5" />} title="Most frequent problems" id="problems">
              <div className="space-y-3">
                {Object.entries(stats.defect_type_distribution)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 6)
                  .map(([defect, count], _, all) => (
                    <DefectRow key={defect} defect={defect} count={count} max={all[0][1]} total={stats.total_incidents} />
                  ))}
              </div>
            </Section>
          </div>

          <Section icon={<Server className="w-5 h-5" />} title="Fleet by equipment type" id="fleet" aside={<span className="text-xs text-slate-400">Open a type's showcase machine</span>}>
            {fleet ? (
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {fleet.machine_types.map((type) => {
                  const target = type.hero_machine_id ?? type.machines[0]?.machine_id;
                  const count = stats.machine_type_distribution?.[type.machine_type] ?? 0;
                  return (
                    <li key={type.machine_type}>
                      <button
                        type="button"
                        onClick={() => target && onViewMachineMemory(target)}
                        className={cn("glass-pod w-full p-4 text-left group", CARD_INTERACTIVE)}
                      >
                        <span className="flex items-center justify-between text-[#38bdf8]">
                          <Server className="w-5 h-5" aria-hidden />
                          <ArrowRight className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
                        </span>
                        <span className="block mt-2 font-medium text-white">{humanize(type.label)}</span>
                        <span className="block text-sm text-slate-400">
                          {count} work orders · {type.machines.length} machines
                        </span>
                        {target && <span className="block text-xs text-[#38bdf8] mt-1">Open {target}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <LoadingState label="Loading fleet…" className="py-6" />
            )}
          </Section>
        </>
      )}
    </div>
  );
}

const OUTCOME_COLORS = {
  green: { bar: "bg-green-500", icon: "text-green-400" },
  amber: { bar: "bg-amber-400", icon: "text-amber-400" },
  red: { bar: "bg-red-500", icon: "text-red-400" },
  gray: { bar: "bg-slate-500", icon: "text-slate-400" },
};

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
  color: keyof typeof OUTCOME_COLORS;
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1 text-sm">
        <span className="flex items-center gap-2 font-medium text-white">
          <span className={OUTCOME_COLORS[color].icon} aria-hidden>
            {icon}
          </span>
          {label}
        </span>
        <span className="text-slate-300 tabular-nums">
          {count.toLocaleString()} ({percentage}%)
        </span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2" aria-hidden>
        <div className={cn("h-2 rounded-full origin-left animate-grow-x", OUTCOME_COLORS[color].bar)} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function DefectRow({ defect, count, max, total }: { defect: string; count: number; max: number; total: number }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-44 text-white truncate" title={humanize(defect)}>
        {humanize(defect)}
      </span>
      <div className="flex-1 bg-slate-700 rounded-full h-2" aria-hidden>
        <div className="bg-amber-400 h-2 rounded-full origin-left animate-grow-x" style={{ width: `${(count / max) * 100}%` }} />
      </div>
      <span className="w-20 text-right font-medium text-white tabular-nums">
        {count} <span className="text-slate-400 font-normal">({Math.round((count / total) * 100)}%)</span>
      </span>
    </div>
  );
}
