"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { DashboardStats } from "@/types/incident";
import { formatDay, humanize } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  HelpCircle,
  Plus,
  Server,
  Clock,
} from "lucide-react";

interface DashboardProps {
  onReportIncident: () => void;
  onViewMachineMemory: (machineId: string) => void;
}

export function Dashboard({
  onReportIncident,
  onViewMachineMemory,
}: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-industrial-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-industrial-900">Dashboard</h2>
          <p className="text-industrial-600">
            Maintenance memory overview
          </p>
          {stats?.history_start && stats?.history_end && (
            <p className="text-xs text-gray-500 mt-1">
              Synthetic, operationally realistic work-order history · {formatDay(stats.history_start)} –{" "}
              {formatDay(stats.history_end)} · Hindsight bank {stats.memory_bank}
            </p>
          )}
        </div>
        <button
          onClick={onReportIncident}
          className="flex items-center gap-2 px-4 py-2 bg-industrial-600 text-white rounded-lg hover:bg-industrial-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Report Incident
        </button>
      </div>

      {error ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
          {error}
        </div>
      ) : stats ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Incidents"
              value={stats.total_incidents}
              icon={<AlertTriangle className="w-6 h-6 text-industrial-500" />}
              color="bg-white"
            />
            <StatCard
              title="Downtime logged"
              value={`${Math.round(stats.total_downtime_hours).toLocaleString()} h`}
              icon={<Clock className="w-6 h-6 text-amber-500" />}
              color="bg-white"
            />
            <StatCard
              title="Machines"
              value={`${stats.unique_machines} (${Object.keys(stats.machine_type_distribution ?? {}).length} types)`}
              icon={<Server className="w-6 h-6 text-blue-500" />}
              color="bg-white"
            />
            <StatCard
              title="Repairs that worked"
              value={`${
                stats.incidents_with_outcome > 0
                  ? Math.round(
                      (stats.outcome_distribution.SUCCESS /
                        stats.incidents_with_outcome) *
                        100
                    )
                  : 0
              }%`}
              icon={<CheckCircle className="w-6 h-6 text-green-500" />}
              color="bg-white"
            />
          </div>

          {/* Outcome Distribution */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-industrial-900 mb-4">
              Intervention Outcomes
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <OutcomeBar
                label="Success"
                count={stats.outcome_distribution.SUCCESS}
                total={stats.incidents_with_outcome}
                color="bg-green-500"
              />
              <OutcomeBar
                label="Partial"
                count={stats.outcome_distribution.PARTIAL}
                total={stats.incidents_with_outcome}
                color="bg-amber-500"
              />
              <OutcomeBar
                label="Failed"
                count={stats.outcome_distribution.FAILED}
                total={stats.incidents_with_outcome}
                color="bg-red-500"
              />
              <OutcomeBar
                label="Unknown"
                count={stats.outcome_distribution.UNKNOWN}
                total={stats.incidents_with_outcome}
                color="bg-gray-400"
              />
            </div>
          </div>

          {/* Defect Types */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-industrial-900 mb-4">
              Most frequent problems
            </h3>
            {Object.keys(stats.defect_type_distribution).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(stats.defect_type_distribution)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 8)
                  .map(([defect, count]) => (
                    <div key={defect} className="flex items-center gap-4">
                      <span className="w-52 text-sm text-industrial-700">
                        {humanize(defect)}
                      </span>
                      <div className="flex-1 bg-gray-200 rounded-full h-4">
                        <div
                          className="bg-industrial-500 h-4 rounded-full"
                          style={{
                            width: `${Math.min(
                              (count / stats.total_incidents) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium text-industrial-900 w-8">
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-industrial-500 text-center py-8">
                No incidents recorded yet. Report your first incident to start
                building memory.
              </p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className={`${color} rounded-lg shadow-sm border border-gray-200 p-6`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-industrial-600">{title}</p>
          <p className="text-2xl font-bold text-industrial-900 mt-1">{value}</p>
        </div>
        {icon}
      </div>
    </div>
  );
}

function OutcomeBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="text-center">
      <div className="h-24 flex items-end justify-center mb-2">
        <div
          className={`${color} w-12 rounded-t`}
          style={{ height: `${Math.max(percentage, 5)}%` }}
        />
      </div>
      <p className="text-sm font-medium text-industrial-900">{count}</p>
      <p className="text-xs text-industrial-600">{label}</p>
    </div>
  );
}
