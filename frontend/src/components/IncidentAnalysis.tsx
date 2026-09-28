"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { cn, formatDate, getOutcomeBgColor, getConfidenceColor } from "@/lib/utils";
import type {
  AnalysisResult,
  IncidentUpdate,
  ActionOutcome,
  HistoricalIncident,
  Intervention,
} from "@/types/incident";
import {
  ArrowLeft,
  Brain,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Cpu,
  FileText,
  Lightbulb,
  History,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  Database,
} from "lucide-react";

interface Props {
  result: AnalysisResult;
  onBack: () => void;
  onViewMachineMemory: (machineId: string) => void;
}

export function IncidentAnalysis({ result, onBack, onViewMachineMemory }: Props) {
  const [showOutcomeForm, setShowOutcomeForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIncidents, setExpandedIncidents] = useState<Set<string>>(new Set());

  const [outcomeData, setOutcomeData] = useState<IncidentUpdate>({
    action_taken: result.recommendation.suggested_action,
    action_outcome: "SUCCESS",
    confirmed_root_cause: "",
    resolution_details: "",
    resolution_time_minutes: undefined,
    technician_notes: "",
  });

  const handleSaveOutcome = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.recordOutcome(result.current_incident.incident_id, outcomeData);
      setSaved(true);
      setShowOutcomeForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save outcome");
    } finally {
      setSaving(false);
    }
  };

  const toggleIncidentExpand = (id: string) => {
    setExpandedIncidents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const { current_incident, historical_incidents, recommendation, memory_contribution } = result;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-industrial-900">
              Incident Analysis
            </h2>
            <p className="text-industrial-600">
              {current_incident.incident_id}
            </p>
          </div>
        </div>
        <button
          onClick={() => onViewMachineMemory(current_incident.machine_id)}
          className="flex items-center gap-2 px-4 py-2 text-industrial-600 hover:text-industrial-800 hover:bg-industrial-50 rounded-lg"
        >
          <Database className="w-5 h-5" />
          View Machine Memory
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Current Incident & Recommendation */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Incident Summary */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-industrial-600" />
              <h3 className="text-lg font-semibold text-industrial-900">
                Current Incident
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500">Machine</p>
                <p className="font-medium">
                  {current_incident.machine_id} ({current_incident.machine_type})
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Production Line</p>
                <p className="font-medium">{current_incident.production_line}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Defect Type</p>
                <p className="font-medium">{current_incident.defect_type}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Reported</p>
                <p className="font-medium">{formatDate(current_incident.timestamp)}</p>
              </div>
            </div>

            {current_incident.symptoms.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">Symptoms</p>
                <div className="flex flex-wrap gap-2">
                  {current_incident.symptoms.map((symptom) => (
                    <span
                      key={symptom}
                      className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-sm"
                    >
                      {symptom}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-sm text-gray-500 mb-1">Description</p>
              <p className="text-gray-700">{current_incident.description}</p>
            </div>
          </div>

          {/* AI Recommendation */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-semibold text-industrial-900">
                AI Recommendation
              </h3>
              <span
                className={cn(
                  "ml-auto px-3 py-1 rounded-full text-sm font-medium",
                  recommendation.confidence === "HIGH"
                    ? "bg-green-100 text-green-800"
                    : recommendation.confidence === "MEDIUM"
                    ? "bg-amber-100 text-amber-800"
                    : recommendation.confidence === "LOW"
                    ? "bg-red-100 text-red-800"
                    : "bg-gray-100 text-gray-800"
                )}
              >
                {recommendation.confidence} Confidence
              </span>
            </div>

            <div className="bg-industrial-50 rounded-lg p-4 mb-4">
              <p className="text-lg font-medium text-industrial-900">
                {recommendation.suggested_action}
              </p>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm text-gray-500">Reasoning</p>
                {recommendation.reasoning_source && (
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded",
                      recommendation.reasoning_source === "llm"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-600"
                    )}
                  >
                    {recommendation.reasoning_source === "llm" ? "AI-phrased" : "Rule-based"}
                  </span>
                )}
              </div>
              <p className="text-gray-700">{recommendation.reasoning}</p>
            </div>

            {recommendation.warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <p className="font-medium text-amber-800">Warnings</p>
                </div>
                <ul className="list-disc list-inside text-amber-700 text-sm space-y-1">
                  {recommendation.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Memory Contribution */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-5 h-5 text-purple-500" />
              <h3 className="text-lg font-semibold text-industrial-900">
                Memory Contribution
              </h3>
            </div>
            <p className="text-gray-700">{memory_contribution}</p>
          </div>

          {/* Record Outcome */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Save className="w-5 h-5 text-industrial-600" />
                <h3 className="text-lg font-semibold text-industrial-900">
                  Record Outcome
                </h3>
              </div>
              {saved && (
                <span className="flex items-center gap-1 text-green-600 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Saved to Memory
                </span>
              )}
            </div>

            {!showOutcomeForm && !saved ? (
              <button
                onClick={() => setShowOutcomeForm(true)}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-industrial-500 hover:text-industrial-600 transition-colors"
              >
                Click to record the outcome of your intervention
              </button>
            ) : saved ? (
              <p className="text-gray-600">
                Outcome has been saved to Hindsight memory. This experience will
                help improve future recommendations for similar incidents.
              </p>
            ) : (
              <div className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Action Performed
                  </label>
                  <input
                    type="text"
                    value={outcomeData.action_taken}
                    onChange={(e) =>
                      setOutcomeData((prev) => ({
                        ...prev,
                        action_taken: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-industrial-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Outcome
                  </label>
                  <div className="flex gap-2">
                    {(["SUCCESS", "PARTIAL", "FAILED", "UNKNOWN"] as ActionOutcome[]).map(
                      (outcome) => (
                        <button
                          key={outcome}
                          type="button"
                          onClick={() =>
                            setOutcomeData((prev) => ({
                              ...prev,
                              action_outcome: outcome,
                            }))
                          }
                          className={cn(
                            "flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors",
                            outcomeData.action_outcome === outcome
                              ? getOutcomeBgColor(outcome) + " border-transparent"
                              : "border-gray-300 text-gray-700 hover:bg-gray-50"
                          )}
                        >
                          {outcome}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirmed Root Cause
                  </label>
                  <input
                    type="text"
                    value={outcomeData.confirmed_root_cause}
                    onChange={(e) =>
                      setOutcomeData((prev) => ({
                        ...prev,
                        confirmed_root_cause: e.target.value,
                      }))
                    }
                    placeholder="What was the actual root cause?"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-industrial-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Resolution Time (minutes)
                    </label>
                    <input
                      type="number"
                      value={outcomeData.resolution_time_minutes || ""}
                      onChange={(e) =>
                        setOutcomeData((prev) => ({
                          ...prev,
                          resolution_time_minutes: e.target.value
                            ? parseInt(e.target.value)
                            : undefined,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-industrial-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Resolution Details
                  </label>
                  <textarea
                    value={outcomeData.resolution_details}
                    onChange={(e) =>
                      setOutcomeData((prev) => ({
                        ...prev,
                        resolution_details: e.target.value,
                      }))
                    }
                    rows={2}
                    placeholder="How was the issue resolved?"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-industrial-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Technician Notes
                  </label>
                  <textarea
                    value={outcomeData.technician_notes}
                    onChange={(e) =>
                      setOutcomeData((prev) => ({
                        ...prev,
                        technician_notes: e.target.value,
                      }))
                    }
                    rows={2}
                    placeholder="Any additional observations..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-industrial-500"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowOutcomeForm(false)}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveOutcome}
                    disabled={saving || !outcomeData.action_taken}
                    className="flex items-center gap-2 px-4 py-2 bg-industrial-600 text-white rounded-lg hover:bg-industrial-700 disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save to Memory
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Historical Evidence */}
        <div className="space-y-6">
          {/* Historical Incidents */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-industrial-600" />
              <h3 className="text-lg font-semibold text-industrial-900">
                Historical Evidence
              </h3>
            </div>

            {historical_incidents.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No similar incidents found in memory.
              </p>
            ) : (
              <div className="space-y-3">
                {historical_incidents.map((hist) => (
                  <HistoricalIncidentCard
                    key={hist.incident.incident_id}
                    historical={hist}
                    expanded={expandedIncidents.has(hist.incident.incident_id)}
                    onToggle={() => toggleIncidentExpand(hist.incident.incident_id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Successful Interventions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <h3 className="text-lg font-semibold text-industrial-900">
                Successful Actions
              </h3>
            </div>

            {result.successful_interventions.length === 0 ? (
              <p className="text-gray-500 text-sm">No successful interventions recorded.</p>
            ) : (
              <div className="space-y-2">
                {result.successful_interventions.map((intervention) => (
                  <InterventionCard
                    key={intervention.incident_id}
                    intervention={intervention}
                    type="success"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Failed Interventions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <XCircle className="w-5 h-5 text-red-500" />
              <h3 className="text-lg font-semibold text-industrial-900">
                Failed Actions
              </h3>
            </div>

            {result.failed_interventions.length === 0 ? (
              <p className="text-gray-500 text-sm">No failed interventions recorded.</p>
            ) : (
              <div className="space-y-2">
                {result.failed_interventions.map((intervention) => (
                  <InterventionCard
                    key={intervention.incident_id}
                    intervention={intervention}
                    type="failed"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoricalIncidentCard({
  historical,
  expanded,
  onToggle,
}: {
  historical: HistoricalIncident;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { incident, similarity_score, relevance_factors } = historical;
  const similarityPercent = Math.round(similarity_score * 100);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium",
              similarityPercent >= 80
                ? "bg-green-100 text-green-700"
                : similarityPercent >= 60
                ? "bg-amber-100 text-amber-700"
                : "bg-gray-100 text-gray-700"
            )}
          >
            {similarityPercent}%
          </div>
          <div className="text-left">
            <p className="font-medium text-sm">{incident.incident_id}</p>
            <p className="text-xs text-gray-500">{incident.defect_type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {incident.action_outcome && (
            <span className={cn("text-xs px-2 py-1 rounded", getOutcomeBgColor(incident.action_outcome))}>
              {incident.action_outcome}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-gray-100">
          <div className="mt-3 space-y-2 text-sm">
            <div>
              <span className="text-gray-500">Machine:</span>{" "}
              <span className="font-medium">{incident.machine_id}</span>
            </div>
            {incident.action_taken && (
              <div>
                <span className="text-gray-500">Action:</span>{" "}
                <span className="font-medium">{incident.action_taken}</span>
              </div>
            )}
            {incident.confirmed_root_cause && (
              <div>
                <span className="text-gray-500">Root Cause:</span>{" "}
                <span className="font-medium">{incident.confirmed_root_cause}</span>
              </div>
            )}
            {relevance_factors.length > 0 && (
              <div>
                <span className="text-gray-500">Relevance:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {relevance_factors.map((factor, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded"
                    >
                      {factor}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InterventionCard({
  intervention,
  type,
}: {
  intervention: Intervention;
  type: "success" | "failed";
}) {
  return (
    <div
      className={cn(
        "p-3 rounded-lg text-sm",
        type === "success" ? "bg-green-50" : "bg-red-50"
      )}
    >
      <p className={cn("font-medium", type === "success" ? "text-green-800" : "text-red-800")}>
        {intervention.action}
      </p>
      {intervention.root_cause && (
        <p className={cn("text-xs mt-1", type === "success" ? "text-green-600" : "text-red-600")}>
          Root cause: {intervention.root_cause}
        </p>
      )}
      <p className="text-xs text-gray-500 mt-1">
        From {intervention.incident_id} ({Math.round(intervention.similarity * 100)}% similar)
      </p>
    </div>
  );
}
