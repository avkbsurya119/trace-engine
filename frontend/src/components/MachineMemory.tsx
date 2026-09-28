"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { cn, formatDate, getOutcomeBgColor } from "@/lib/utils";
import type { MachineMemory as MachineMemoryType } from "@/types/incident";
import {
  ArrowLeft,
  Database,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Activity,
  Loader2,
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
      if (!machineId) {
        setLoading(false);
        return;
      }

      try {
        const data = await api.getMachineMemory(machineId);
        setMemory(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load machine memory");
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
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold text-industrial-900">Machine Memory</h2>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      </div>
    );
  }

  if (!machineId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold text-industrial-900">Machine Memory</h2>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <Database className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">Enter a machine ID to view its memory.</p>
        </div>
      </div>
    );
  }

  if (memory?.message || memory?.total_incidents === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-industrial-900">Machine Memory</h2>
            <p className="text-industrial-600">{machineId}</p>
          </div>
        </div>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-industrial-900">Machine Memory</h2>
          <p className="text-industrial-600">{machineId}</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-industrial-100 rounded-lg">
              <Activity className="w-6 h-6 text-industrial-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Incidents</p>
              <p className="text-2xl font-bold text-industrial-900">
                {memory?.total_incidents || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Successful Fixes</p>
              <p className="text-2xl font-bold text-industrial-900">
                {memory?.successful_interventions
                  ? Object.keys(memory.successful_interventions).length
                  : 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Failed Attempts</p>
              <p className="text-2xl font-bold text-industrial-900">
                {memory?.failed_interventions
                  ? Object.keys(memory.failed_interventions).length
                  : 0}
              </p>
            </div>
          </div>
        </div>
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

          {memory?.recurring_defects && memory.recurring_defects.length > 0 ? (
            <div className="space-y-3">
              {memory.recurring_defects.map(([defect, count]) => (
                <div key={defect} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">
                        {defect}
                      </span>
                      <span className="text-sm text-gray-500">{count} incidents</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-amber-500 h-2 rounded-full"
                        style={{
                          width: `${Math.min(
                            (count / (memory.total_incidents || 1)) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No recurring defects identified.</p>
          )}
        </div>

        {/* Recent Incidents Timeline */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-industrial-600" />
            <h3 className="text-lg font-semibold text-industrial-900">
              Recent Incidents
            </h3>
          </div>

          {memory?.recent_incidents && memory.recent_incidents.length > 0 ? (
            <div className="space-y-3">
              {memory.recent_incidents.map((incident) => (
                <div
                  key={incident.incident_id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <div
                    className={cn(
                      "w-3 h-3 rounded-full flex-shrink-0",
                      incident.action_outcome === "SUCCESS"
                        ? "bg-green-500"
                        : incident.action_outcome === "FAILED"
                        ? "bg-red-500"
                        : incident.action_outcome === "PARTIAL"
                        ? "bg-amber-500"
                        : "bg-gray-400"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {incident.defect_type}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(incident.timestamp)}
                    </p>
                  </div>
                  {incident.action_outcome && (
                    <span
                      className={cn(
                        "text-xs px-2 py-1 rounded flex-shrink-0",
                        getOutcomeBgColor(incident.action_outcome)
                      )}
                    >
                      {incident.action_outcome}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No recent incidents.</p>
          )}
        </div>

        {/* Successful Interventions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <h3 className="text-lg font-semibold text-industrial-900">
              What Has Worked
            </h3>
          </div>

          {memory?.successful_interventions &&
          Object.keys(memory.successful_interventions).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(memory.successful_interventions).map(
                ([action, defects]) => (
                  <div key={action} className="p-3 bg-green-50 rounded-lg">
                    <p className="font-medium text-green-800">{action}</p>
                    <p className="text-sm text-green-600 mt-1">
                      Resolved: {defects.join(", ")}
                    </p>
                  </div>
                )
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              No successful interventions recorded yet.
            </p>
          )}
        </div>

        {/* Failed Interventions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <XCircle className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-semibold text-industrial-900">
              What Hasn&apos;t Worked
            </h3>
          </div>

          {memory?.failed_interventions &&
          Object.keys(memory.failed_interventions).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(memory.failed_interventions).map(
                ([action, defects]) => (
                  <div key={action} className="p-3 bg-red-50 rounded-lg">
                    <p className="font-medium text-red-800">{action}</p>
                    <p className="text-sm text-red-600 mt-1">
                      Failed for: {defects.join(", ")}
                    </p>
                  </div>
                )
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No failed interventions recorded.</p>
          )}
        </div>
      </div>

      {/* Memory Insight */}
      <div className="bg-gradient-to-r from-industrial-50 to-purple-50 rounded-lg border border-industrial-200 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <TrendingUp className="w-6 h-6 text-industrial-600" />
          </div>
          <div>
            <h3 className="font-semibold text-industrial-900 mb-1">
              Memory Insight
            </h3>
            <p className="text-industrial-700">
              This machine has {memory?.total_incidents || 0} incident(s) in memory.
              {memory?.recurring_defects && memory.recurring_defects.length > 0 && (
                <span>
                  {" "}
                  The most common issue is{" "}
                  <strong>{memory.recurring_defects[0][0]}</strong> with{" "}
                  {memory.recurring_defects[0][1]} occurrence(s).
                </span>
              )}
              {memory?.successful_interventions &&
                Object.keys(memory.successful_interventions).length > 0 && (
                  <span>
                    {" "}
                    TRACE has learned {Object.keys(memory.successful_interventions).length}{" "}
                    successful intervention(s) that can be applied to future incidents.
                  </span>
                )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
