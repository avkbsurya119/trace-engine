"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { cn, formatDay, humanize } from "@/lib/utils";
import type { DashboardStats, DemoPreset, Fleet } from "@/types/incident";
import { MemoryGrowthChart } from "@/components/MemoryGrowthChart";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  Server,
  Brain,
  TrendingUp,
  Activity,
  Zap,
  Target,
  ArrowRight,
  BarChart3,
  Loader2,
  Clock,
} from "lucide-react";

interface DashboardProps {
  onReportIncident: () => void;
  onViewMachineMemory: (machineId: string) => void;
  onShowBeforeAfter?: () => void;
  onStartDemo?: (preset: DemoPreset) => void;
}

export function Dashboard({
  onReportIncident,
  onViewMachineMemory,
  onShowBeforeAfter,
  onStartDemo,
}: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fleet, setFleet] = useState<Fleet | null>(null);

  useEffect(() => {
    api.getFleet().then(setFleet).catch(() => setFleet(null));
  }, []);

  useEffect(() => {
    async function fetchStats() {
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-12 h-12 animate-spin text-industrial-600" />
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-industrial-900">
            TRACE Dashboard
          </h2>
          <p className="text-industrial-600">
            Organizational memory for manufacturing troubleshooting
          </p>
          {stats?.history_start && stats?.history_end && (
            <p className="text-xs text-gray-500 mt-1">
              Synthetic, operationally realistic work-order history · {formatDay(stats.history_start)} –{" "}
              {formatDay(stats.history_end)} · Hindsight bank {stats.memory_bank}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onShowBeforeAfter && (
            <button
              onClick={onShowBeforeAfter}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-industrial-300 text-industrial-700 rounded-lg hover:bg-industrial-50 transition-colors shadow-sm"
            >
              <Brain className="w-5 h-5" />
              See Memory Impact
            </button>
          )}
          <button
            onClick={onReportIncident}
            className="flex items-center gap-2 px-4 py-2 bg-industrial-600 text-white rounded-lg hover:bg-industrial-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Report Incident
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
          {error}
        </div>
      ) : stats ? (
        <>
          {/* Demo guide */}
          {fleet && fleet.demo_presets.length >= 2 && onStartDemo && (
            <DemoGuide fleet={fleet} onStartDemo={onStartDemo} onShowBeforeAfter={onShowBeforeAfter} onViewMachine={onViewMachineMemory} />
          )}

          {/* Memory Health Banner */}
          <MemoryHealthBanner
            totalIncidents={stats.total_incidents}
            withOutcome={stats.incidents_with_outcome}
            successRate={successRate}
            uniqueMachines={stats.unique_machines}
          />

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={<Activity className="w-6 h-6" />}
              label="Total Incidents"
              value={stats.total_incidents}
              sublabel="In organizational memory"
              color="industrial"
            />
            <MetricCard
              icon={<Clock className="w-6 h-6" />}
              label="Downtime Logged"
              value={`${Math.round(stats.total_downtime_hours).toLocaleString()} h`}
              sublabel={`${memoryDepth}% of incidents have an outcome`}
              color="blue"
            />
            <MetricCard
              icon={<Target className="w-6 h-6" />}
              label="Repairs That Worked"
              value={`${successRate}%`}
              sublabel="SUCCESS share of recorded outcomes"
              color="green"
            />
            <MetricCard
              icon={<TrendingUp className="w-6 h-6" />}
              label="Resolution Rate"
              value={`${failureReduction}%`}
              sublabel="Success + Partial"
              color="emerald"
            />
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Outcome Distribution */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-industrial-600" />
                <h3 className="text-lg font-semibold text-industrial-900">
                  Intervention Outcomes
                </h3>
              </div>
              {stats.incidents_with_outcome > 0 ? (
                <div className="space-y-4">
                  <OutcomeRow
                    label="Success"
                    count={stats.outcome_distribution.SUCCESS}
                    total={stats.incidents_with_outcome}
                    icon={<CheckCircle className="w-4 h-4" />}
                    color="green"
                  />
                  <OutcomeRow
                    label="Partial"
                    count={stats.outcome_distribution.PARTIAL}
                    total={stats.incidents_with_outcome}
                    icon={<AlertTriangle className="w-4 h-4" />}
                    color="amber"
                  />
                  <OutcomeRow
                    label="Failed"
                    count={stats.outcome_distribution.FAILED}
                    total={stats.incidents_with_outcome}
                    icon={<XCircle className="w-4 h-4" />}
                    color="red"
                  />
                  <OutcomeRow
                    label="Not verified"
                    count={stats.outcome_distribution.UNKNOWN}
                    total={stats.incidents_with_outcome}
                    icon={<Activity className="w-4 h-4" />}
                    color="gray"
                  />
                </div>
              ) : (
                <EmptyState message="No outcomes recorded yet" />
              )}
            </div>

            {/* Defect Types */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-semibold text-industrial-900">
                  Most Frequent Problems
                </h3>
              </div>
              {Object.keys(stats.defect_type_distribution).length > 0 ? (
                <div className="space-y-3">
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

          {/* Knowledge growth */}
          {stats.memory_growth && stats.memory_growth.length > 1 && (
            <section aria-labelledby="growth-heading" className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <h3 id="growth-heading" className="text-lg font-semibold text-industrial-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-industrial-600" aria-hidden />
                  Knowledge growth
                </h3>
                <p className="text-sm text-gray-500">
                  Recorded outcomes TRACE can learn from, by month · every new outcome is recalled for future incidents
                </p>
              </div>
              <MemoryGrowthChart points={stats.memory_growth} />
            </section>
          )}

          {/* Machine Fleet Overview */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-semibold text-industrial-900">
                  Machine Fleet Overview
                </h3>
              </div>
              <span className="text-sm text-industrial-600">
                {stats.unique_machines} machines with history · click a type to open its hero machine
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
      title: "Memory is Empty",
      subtitle: "Report your first incident to start building organizational knowledge",
      gradient: "from-gray-50 to-gray-100",
      border: "border-gray-300",
      icon: <Brain className="w-8 h-8 text-gray-400" />,
    },
    learning: {
      title: "TRACE is Learning",
      subtitle: `Building patterns from ${totalIncidents} incident${totalIncidents !== 1 ? "s" : ""}`,
      gradient: "from-blue-50 to-indigo-50",
      border: "border-blue-200",
      icon: <Brain className="w-8 h-8 text-blue-500" />,
    },
    growing: {
      title: "Memory Growing",
      subtitle: `${totalIncidents} incidents across ${uniqueMachines} machines`,
      gradient: "from-green-50 to-emerald-50",
      border: "border-green-200",
      icon: <TrendingUp className="w-8 h-8 text-green-500" />,
    },
    mature: {
      title: "Rich Memory Available",
      subtitle: `${totalIncidents} incidents with ${successRate}% success rate`,
      gradient: "from-emerald-50 to-green-50",
      border: "border-emerald-200",
      icon: <Zap className="w-8 h-8 text-emerald-500" />,
    },
  };

  const stage = stages[memoryStage];

  return (
    <div
      className={cn(
        "bg-gradient-to-r rounded-xl p-6 border",
        stage.gradient,
        stage.border
      )}
    >
      <div className="flex items-start gap-4">
        <div className="p-3 bg-white rounded-lg shadow-sm">{stage.icon}</div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900">{stage.title}</h3>
          <p className="text-gray-600 mt-1">{stage.subtitle}</p>
          {memoryStage !== "empty" && (
            <div className="flex flex-wrap gap-4 mt-3">
              <MemoryChip
                label="Incidents"
                value={totalIncidents}
                icon={<Activity className="w-3 h-3" />}
              />
              <MemoryChip
                label="With Outcomes"
                value={withOutcome}
                icon={<CheckCircle className="w-3 h-3" />}
              />
              <MemoryChip
                label="Machines"
                value={uniqueMachines}
                icon={<Server className="w-3 h-3" />}
              />
              <MemoryChip
                label="Success Rate"
                value={`${successRate}%`}
                icon={<Target className="w-3 h-3" />}
              />
            </div>
          )}
        </div>
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
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/80 rounded-full text-sm">
      {icon}
      <span className="font-medium text-gray-900">{value}</span>
      <span className="text-gray-500">{label}</span>
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
  color: "industrial" | "blue" | "green" | "emerald";
}) {
  const colors = {
    industrial: "bg-industrial-50 text-industrial-600",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          <p className="text-xs text-gray-500 mt-1">{sublabel}</p>
        </div>
        <div className={cn("p-2 rounded-lg", colors[color])}>{icon}</div>
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
  color: "green" | "amber" | "red" | "gray";
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  const colors = {
    green: {
      bg: "bg-green-500",
      text: "text-green-700",
      light: "text-green-500",
    },
    amber: {
      bg: "bg-amber-500",
      text: "text-amber-700",
      light: "text-amber-500",
    },
    red: {
      bg: "bg-red-500",
      text: "text-red-700",
      light: "text-red-500",
    },
    gray: {
      bg: "bg-gray-400",
      text: "text-gray-700",
      light: "text-gray-400",
    },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={colors[color].light}>{icon}</span>
          <span className="text-sm font-medium text-gray-700">{label}</span>
        </div>
        <span className="text-sm text-gray-600">
          {count} ({percentage}%)
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={cn("h-2 rounded-full", colors[color].bg)}
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

  // Format defect name
  const formattedDefect = defect
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return (
    <div className="flex items-center gap-3">
      <span className="w-32 text-sm text-gray-700 truncate" title={formattedDefect}>
        {formattedDefect}
      </span>
      <div className="flex-1 bg-gray-200 rounded-full h-3">
        <div
          className="bg-amber-500 h-3 rounded-full"
          style={{ width: `${Math.max(percentage, 5)}%` }}
        />
      </div>
      <span className="text-sm font-medium text-gray-700 w-16 text-right">
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
    return <EmptyState message="Loading fleet..." />;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {types.map((type) => {
        const incidentCount = distribution[type.machine_type] ?? 0;
        const target = type.hero_machine_id ?? type.machines[0]?.machine_id;
        return (
          <button
            key={type.machine_type}
            onClick={() => target && onViewMachine(target)}
            className="bg-gray-50 hover:bg-gray-100 rounded-lg p-4 text-left transition-colors group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-500">
                <Server className="w-5 h-5" />
              </span>
              <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="font-medium text-gray-900">{humanize(type.label)}</p>
            <p className="text-sm text-gray-500">
              {incidentCount} incident{incidentCount !== 1 ? "s" : ""} · {type.machines.length} machines
            </p>
            {target && <p className="text-xs text-industrial-600 mt-1">Open {target}</p>}
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
  if (incidents >= 10) {
    // Memory is valuable
    return (
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-3">
          <Zap className="w-6 h-6" />
          <h3 className="text-xl font-bold">Memory is Working</h3>
        </div>
        <p className="text-green-100 mb-4">
          TRACE has built significant organizational knowledge. New incidents will
          benefit from {incidents} historical cases with a {successRate}% success
          rate.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onReportIncident}
            className="px-4 py-2 bg-white text-green-700 rounded-lg font-medium hover:bg-green-50 transition-colors"
          >
            Report New Incident
          </button>
        </div>
      </div>
    );
  }

  // Memory is building
  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
      <div className="flex items-center gap-3 mb-3">
        <Brain className="w-6 h-6" />
        <h3 className="text-xl font-bold">Build Your Memory</h3>
      </div>
      <p className="text-blue-100 mb-4">
        Every resolved incident makes TRACE smarter. Record outcomes to help future
        engineers benefit from your experience.
      </p>
      <div className="flex gap-3">
        <button
          onClick={onReportIncident}
          className="px-4 py-2 bg-white text-blue-700 rounded-lg font-medium hover:bg-blue-50 transition-colors"
        >
          Report Incident
        </button>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
      <Activity className="w-8 h-8 mb-2" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

/** The 3-minute story, one click per step. Presets come from the backend catalog. */
function DemoGuide({
  fleet,
  onStartDemo,
  onShowBeforeAfter,
  onViewMachine,
}: {
  fleet: Fleet;
  onStartDemo: (preset: DemoPreset) => void;
  onShowBeforeAfter?: () => void;
  onViewMachine: (machineId: string) => void;
}) {
  const [first, second] = fleet.demo_presets;
  const outcome = fleet.demo_outcome;
  const steps: { title: string; detail: string; action?: { label: string; run: () => void } }[] = [
    {
      title: "Memory impact",
      detail: "Same incident scored with and without memory on the hero machines.",
      action: onShowBeforeAfter ? { label: "See memory impact", run: onShowBeforeAfter } : undefined,
    },
    {
      title: "A problem nobody has seen",
      detail: `${first.incident.machine_id}: TRACE searches memory and withholds a recommendation.`,
      action: { label: "Load incident 1", run: () => onStartDemo(first) },
    },
    {
      title: "Record what worked",
      detail: `On the analysis page, record “${outcome.intervention_category}” as ${outcome.action_outcome}.`,
    },
    {
      title: "It happens again",
      detail: `${second.incident.machine_id}: TRACE recalls step 2 and recommends the fix, citing it.`,
      action: { label: "Load incident 2", run: () => onStartDemo(second) },
    },
    {
      title: "Machine memory",
      detail: `Timeline of ${first.incident.machine_id}, or a long history like CNC-204.`,
      action: { label: `Open ${first.incident.machine_id}`, run: () => onViewMachine(first.incident.machine_id) },
    },
  ];

  return (
    <section aria-labelledby="demo-heading" className="bg-white rounded-xl border border-industrial-200 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h3 id="demo-heading" className="text-base font-semibold text-industrial-900">
          Demo guide: memory in 3 minutes
        </h3>
        <p className="text-xs text-gray-500">
          Before presenting: <code className="bg-gray-100 px-1 rounded">python -m scripts.demo --reset</code>
        </p>
      </div>
      <ol className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {steps.map((step, i) => (
          <li key={step.title} className="rounded-lg bg-gray-50 border border-gray-100 p-3 flex flex-col">
            <p className="text-xs font-semibold text-industrial-600">Step {i + 1}</p>
            <p className="text-sm font-medium text-gray-900">{step.title}</p>
            <p className="text-xs text-gray-600 mt-1 flex-1">{step.detail}</p>
            {step.action && (
              <button
                type="button"
                onClick={step.action.run}
                className="mt-2 self-start text-xs font-medium px-2.5 py-1 rounded-md bg-industrial-600 text-white hover:bg-industrial-700"
              >
                {step.action.label}
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
