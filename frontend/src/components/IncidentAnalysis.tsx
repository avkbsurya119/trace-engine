"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { cn, formatDate, getOutcomeBgColor } from "@/lib/utils";
import type {
  AnalysisResult,
  IncidentUpdate,
  ActionOutcome,
  HistoricalIncident,
} from "@/types/incident";
import {
  ArrowLeft,
  Brain,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  History,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  Database,
  Search,
  HelpCircle,
  BarChart3,
  Eye,
  Zap,
  Target,
  Shield,
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
  const [showEvidenceDrawer, setShowEvidenceDrawer] = useState(false);
  const [showPipeline, setShowPipeline] = useState(false);

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

  const { current_incident, historical_incidents, recommendation } = result;
  const hasHistory = historical_incidents.length > 0;
  const successCount = result.successful_interventions.length;
  const failCount = result.failed_interventions.length;

  const interventionStats = buildInterventionStats(result);

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
            <p className="text-industrial-600">{current_incident.incident_id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPipeline(!showPipeline)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
          >
            <Eye className="w-4 h-4" />
            Pipeline
          </button>
          <button
            onClick={() => onViewMachineMemory(current_incident.machine_id)}
            className="flex items-center gap-2 px-4 py-2 text-industrial-600 hover:text-industrial-800 hover:bg-industrial-50 rounded-lg"
          >
            <Database className="w-5 h-5" />
            Machine Memory
          </button>
        </div>
      </div>

      {/* Pipeline Debug Panel */}
      {showPipeline && <PipelineDebug result={result} />}

      {/* Memory Moment - The Key Differentiator */}
      <MemoryMoment
        hasHistory={hasHistory}
        historicalCount={historical_incidents.length}
        successCount={successCount}
        failCount={failCount}
        topSimilarity={historical_incidents[0]?.similarity_score}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Incident */}
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

          {/* Recommendation */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-industrial-600" />
                  <h3 className="text-lg font-semibold text-industrial-900">
                    Recommendation
                  </h3>
                </div>
                <ConfidenceBadge
                  confidence={recommendation.confidence}
                  historicalCount={historical_incidents.length}
                  successCount={successCount}
                  failCount={failCount}
                />
              </div>

              <div className="bg-gradient-to-r from-industrial-50 to-industrial-100 rounded-lg p-4 mb-4">
                <p className="text-lg font-semibold text-industrial-900">
                  {recommendation.suggested_action}
                </p>
              </div>

              {/* Why button */}
              <button
                onClick={() => setShowEvidenceDrawer(!showEvidenceDrawer)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors mb-4"
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-industrial-600" />
                  <span className="font-medium text-industrial-800">
                    Why does TRACE recommend this?
                  </span>
                </div>
                {showEvidenceDrawer ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {showEvidenceDrawer && (
                <EvidenceDrawer
                  interventionStats={interventionStats}
                  reasoning={recommendation.reasoning}
                  reasoningSource={recommendation.reasoning_source}
                  supportingIncidents={recommendation.supporting_incidents}
                />
              )}

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
          </div>

          {/* Intervention Chart */}
          {interventionStats.length > 0 && (
            <InterventionChart interventionStats={interventionStats} />
          )}

          {/* Record Outcome */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-500" />
                <h3 className="text-lg font-semibold text-industrial-900">
                  Teach TRACE What Happened
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
              <div className="text-center py-6">
                <p className="text-gray-600 mb-4">
                  Record the outcome to help TRACE learn. Future similar incidents
                  will benefit from this experience.
                </p>
                <button
                  onClick={() => setShowOutcomeForm(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <Save className="w-5 h-5" />
                  Record Outcome
                </button>
              </div>
            ) : saved ? (
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-green-800">
                      TRACE will remember this incident
                    </p>
                    <p className="text-green-700 text-sm mt-1">
                      Next time a similar issue occurs, TRACE will recall this
                      experience to improve recommendations.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <OutcomeForm
                outcomeData={outcomeData}
                setOutcomeData={setOutcomeData}
                onSave={handleSaveOutcome}
                onCancel={() => setShowOutcomeForm(false)}
                saving={saving}
                error={error}
              />
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Historical Incidents */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-industrial-600" />
              <h3 className="text-lg font-semibold text-industrial-900">
                Historical Evidence
              </h3>
            </div>

            {!hasHistory ? (
              <div className="text-center py-8">
                <Search className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">No relevant history</p>
                <p className="text-gray-400 text-sm mt-1">
                  This appears to be a new type of incident
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {historical_incidents.slice(0, 5).map((hist) => (
                  <HistoricalIncidentCard
                    key={hist.incident.incident_id}
                    historical={hist}
                  />
                ))}
                {historical_incidents.length > 5 && (
                  <p className="text-sm text-gray-500 text-center">
                    +{historical_incidents.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Evidence Summary */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-industrial-900 mb-4">
              Evidence Summary
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Similar incidents</span>
                <span className="font-semibold">{historical_incidents.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-gray-600">Successful</span>
                </div>
                <span className="font-semibold text-green-600">{successCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-gray-600">Failed</span>
                </div>
                <span className="font-semibold text-red-600">{failCount}</span>
              </div>
              {historical_incidents[0] && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-gray-600">Top similarity</span>
                  <span className="font-semibold">
                    {Math.round(historical_incidents[0].similarity_score * 100)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MemoryMoment({
  hasHistory,
  historicalCount,
  successCount,
  failCount,
  topSimilarity,
}: {
  hasHistory: boolean;
  historicalCount: number;
  successCount: number;
  failCount: number;
  topSimilarity?: number;
}) {
  if (!hasHistory) {
    return (
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-dashed border-gray-300 rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-gray-200 rounded-full">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-700">
              No Relevant History Found
            </h3>
            <p className="text-gray-500 mt-1">
              TRACE doesn&apos;t have enough historical evidence for this type of
              incident. Record the outcome to start building memory.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
      <div className="flex items-start gap-4">
        <div className="p-4 bg-green-100 rounded-full">
          <Brain className="w-8 h-8 text-green-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-green-800">
            TRACE Found {historicalCount} Related Historical Incident
            {historicalCount !== 1 ? "s" : ""}
          </h3>
          <div className="flex flex-wrap gap-4 mt-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-700 font-medium">
                {successCount} intervention{successCount !== 1 ? "s" : ""} succeeded
              </span>
            </div>
            {failCount > 0 && (
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" />
                <span className="text-red-600 font-medium">
                  {failCount} intervention{failCount !== 1 ? "s" : ""} failed
                </span>
              </div>
            )}
            {topSimilarity && (
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-500" />
                <span className="text-blue-600 font-medium">
                  {Math.round(topSimilarity * 100)}% top similarity
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfidenceBadge({
  confidence,
  historicalCount,
  successCount,
}: {
  confidence: string;
  historicalCount: number;
  successCount: number;
  failCount: number;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  const getStyle = () => {
    switch (confidence) {
      case "HIGH":
        return "bg-green-100 text-green-800 border-green-200";
      case "MEDIUM":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "LOW":
        return "bg-orange-100 text-orange-800 border-orange-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getExplanation = () => {
    switch (confidence) {
      case "HIGH":
        return `${historicalCount} similar incidents, ${successCount} successful outcomes`;
      case "MEDIUM":
        return `${historicalCount} similar incidents, mixed outcomes`;
      case "LOW":
        return `Limited evidence: ${historicalCount} incident(s)`;
      default:
        return "Insufficient historical evidence";
    }
  };

  return (
    <div className="relative">
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={cn(
          "px-3 py-1.5 rounded-full text-sm font-medium border flex items-center gap-1.5",
          getStyle()
        )}
      >
        <Shield className="w-4 h-4" />
        {confidence === "INSUFFICIENT_DATA" ? "INSUFFICIENT DATA" : confidence}
      </button>
      {showTooltip && (
        <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg z-10">
          <p className="font-medium mb-1">Why {confidence}?</p>
          <p className="text-gray-300">{getExplanation()}</p>
        </div>
      )}
    </div>
  );
}

interface InterventionStat {
  action: string;
  success: number;
  failed: number;
  total: number;
}

function buildInterventionStats(result: AnalysisResult): InterventionStat[] {
  const stats: Record<string, InterventionStat> = {};
  result.successful_interventions.forEach((int) => {
    if (!stats[int.action]) {
      stats[int.action] = { action: int.action, success: 0, failed: 0, total: 0 };
    }
    stats[int.action].success++;
    stats[int.action].total++;
  });
  result.failed_interventions.forEach((int) => {
    if (!stats[int.action]) {
      stats[int.action] = { action: int.action, success: 0, failed: 0, total: 0 };
    }
    stats[int.action].failed++;
    stats[int.action].total++;
  });
  return Object.values(stats).sort((a, b) => b.total - a.total);
}

function EvidenceDrawer({
  interventionStats,
  reasoning,
  reasoningSource,
  supportingIncidents,
}: {
  interventionStats: InterventionStat[];
  reasoning: string;
  reasoningSource?: string;
  supportingIncidents: string[];
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
      <h4 className="font-medium text-gray-800 mb-3">Why TRACE recommends this</h4>

      {interventionStats.length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">Historical outcomes:</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4">Intervention</th>
                <th className="text-right py-2 px-2 text-green-600">Success</th>
                <th className="text-right py-2 pl-2 text-red-600">Failed</th>
              </tr>
            </thead>
            <tbody>
              {interventionStats.slice(0, 5).map((stat, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-gray-700">{stat.action}</td>
                  <td className="py-2 px-2 text-right font-medium text-green-600">
                    {stat.success}
                  </td>
                  <td className="py-2 pl-2 text-right font-medium text-red-600">
                    {stat.failed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm text-gray-600">Explanation:</p>
          {reasoningSource && (
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded",
                reasoningSource === "llm"
                  ? "bg-purple-100 text-purple-700"
                  : "bg-gray-200 text-gray-600"
              )}
            >
              {reasoningSource === "llm" ? "AI-phrased" : "Rule-based"}
            </span>
          )}
        </div>
        <p className="text-gray-700 text-sm">{reasoning}</p>
      </div>

      {supportingIncidents.length > 0 && (
        <div>
          <p className="text-sm text-gray-600 mb-1">Supporting incidents:</p>
          <div className="flex flex-wrap gap-1">
            {supportingIncidents.map((id) => (
              <span
                key={id}
                className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded"
              >
                {id}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500 italic">
          TRACE computes recommendations from historical outcomes. The LLM only
          verbalizes the evidence.
        </p>
      </div>
    </div>
  );
}

function InterventionChart({
  interventionStats,
}: {
  interventionStats: InterventionStat[];
}) {
  const maxTotal = Math.max(...interventionStats.map((s) => s.total), 1);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-industrial-600" />
        <h3 className="text-lg font-semibold text-industrial-900">
          Historical Interventions
        </h3>
      </div>
      <div className="space-y-4">
        {interventionStats.map((stat, i) => (
          <div key={i}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700 truncate pr-4">{stat.action}</span>
              <span className="text-gray-500 flex-shrink-0">
                {stat.success} success · {stat.failed} failed
              </span>
            </div>
            <div className="flex h-6 bg-gray-100 rounded overflow-hidden">
              <div
                className="bg-green-500"
                style={{ width: `${(stat.success / maxTotal) * 100}%` }}
              />
              <div
                className="bg-red-500"
                style={{ width: `${(stat.failed / maxTotal) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-6 mt-4 pt-4 border-t">
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

function PipelineDebug({ result }: { result: AnalysisResult }) {
  return (
    <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-yellow-400" />
        <span className="text-yellow-400 font-semibold">TRACE PIPELINE</span>
      </div>
      <div className="space-y-1">
        <PipelineStep label="Incident received" status="success" />
        <PipelineStep label="Hindsight recall" status="success" />
        <PipelineStep
          label="Retrieved memories"
          value={result.historical_incidents.length.toString()}
        />
        {result.historical_incidents[0] && (
          <PipelineStep
            label="Top similarity"
            value={`${Math.round(result.historical_incidents[0].similarity_score * 100)}%`}
          />
        )}
        <PipelineStep label="Deterministic scoring" status="success" />
        <PipelineStep
          label="Recommendation"
          value={
            result.recommendation.suggested_action.length > 40
              ? result.recommendation.suggested_action.slice(0, 40) + "..."
              : result.recommendation.suggested_action
          }
        />
        <PipelineStep label="Confidence" value={result.recommendation.confidence} />
        <PipelineStep
          label="LLM explanation"
          status={result.recommendation.reasoning_source === "llm" ? "success" : "skipped"}
        />
        <PipelineStep label="SQLite cross-reference" status="success" />
      </div>
    </div>
  );
}

function PipelineStep({
  label,
  status,
  value,
}: {
  label: string;
  status?: "success" | "skipped";
  value?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {status === "success" && <span className="text-green-400">✓</span>}
      {status === "skipped" && <span className="text-gray-500">○</span>}
      {!status && <span className="text-gray-500">·</span>}
      <span className="text-gray-400">{label}</span>
      {value && <span className="text-white ml-auto">{value}</span>}
    </div>
  );
}

function HistoricalIncidentCard({ historical }: { historical: HistoricalIncident }) {
  const { incident, similarity_score } = historical;
  const similarityPercent = Math.round(similarity_score * 100);

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-900">
          {incident.incident_id}
        </span>
        <div className="flex items-center gap-2">
          {incident.action_outcome && (
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded",
                getOutcomeBgColor(incident.action_outcome)
              )}
            >
              {incident.action_outcome}
            </span>
          )}
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-full font-medium",
              similarityPercent >= 80
                ? "bg-green-100 text-green-700"
                : similarityPercent >= 60
                ? "bg-amber-100 text-amber-700"
                : "bg-gray-100 text-gray-700"
            )}
          >
            {similarityPercent}%
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-2">{incident.defect_type}</p>
      {incident.action_taken && (
        <p className="text-sm text-gray-700">
          <span className="text-gray-500">Action:</span> {incident.action_taken}
        </p>
      )}
    </div>
  );
}

function OutcomeForm({
  outcomeData,
  setOutcomeData,
  onSave,
  onCancel,
  saving,
  error,
}: {
  outcomeData: IncidentUpdate;
  setOutcomeData: (fn: (prev: IncidentUpdate) => IncidentUpdate) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
          {error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          What action was performed?
        </label>
        <input
          type="text"
          value={outcomeData.action_taken}
          onChange={(e) =>
            setOutcomeData((prev) => ({ ...prev, action_taken: e.target.value }))
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
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
                  setOutcomeData((prev) => ({ ...prev, action_outcome: outcome }))
                }
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg border text-sm font-medium",
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
          What was the root cause?
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
          placeholder="The actual cause of the issue"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Resolution details
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
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        />
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 hover:text-gray-900"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving || !outcomeData.action_taken}
          className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save to Machine Memory
            </>
          )}
        </button>
      </div>
    </div>
  );
}
