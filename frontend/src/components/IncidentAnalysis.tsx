"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn, formatDate, formatDay, formatHours, getOutcomeBgColor, humanize } from "@/lib/utils";
import type {
  AnalysisResult,
  IncidentUpdate,
  ActionOutcome,
  HistoricalIncident,
  EvidenceSummary,
} from "@/types/incident";
import {
  ArrowLeft,
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
  Sparkles,
  Calculator,
  Search,
  HelpCircle,
  MinusCircle,
  Brain,
  Target,
  Zap,
} from "lucide-react";

interface Props {
  result: AnalysisResult;
  onBack: () => void;
  onViewMachineMemory: (machineId: string) => void;
}

const OUTCOME_GROUPS: { outcome: ActionOutcome; label: string; icon: typeof CheckCircle; tone: string }[] = [
  { outcome: "SUCCESS", label: "Worked", icon: CheckCircle, tone: "text-green-700" },
  { outcome: "FAILED", label: "Failed", icon: XCircle, tone: "text-red-700" },
  { outcome: "PARTIAL", label: "Partially worked", icon: MinusCircle, tone: "text-amber-700" },
  { outcome: "UNKNOWN", label: "Outcome not verified", icon: HelpCircle, tone: "text-gray-600" },
];

const CONFIDENCE_STYLE: Record<string, string> = {
  HIGH: "bg-green-100 text-green-800 border-green-200",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
  LOW: "bg-orange-100 text-orange-800 border-orange-200",
  INSUFFICIENT_DATA: "bg-gray-100 text-gray-700 border-gray-300",
};

export function IncidentAnalysis({ result, onBack, onViewMachineMemory }: Props) {
  const { current_incident, historical_incidents, recommendation, memory_trace } = result;
  const hasRecommendation = Boolean(recommendation.intervention_category);

  const [showOutcomeForm, setShowOutcomeForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [outcomeData, setOutcomeData] = useState<IncidentUpdate>({
    action_taken: hasRecommendation
      ? recommendation.evidence[0]?.example_action ?? recommendation.suggested_action
      : "",
    intervention_category: recommendation.intervention_category ?? "",
    action_outcome: "SUCCESS",
    confirmed_root_cause: "",
    resolution_details: "",
    resolution_time_minutes: undefined,
    downtime_minutes: undefined,
    technician_notes: "",
  });

  useEffect(() => {
    api
      .getFleet()
      .then((fleet) => {
        const type = fleet.machine_types.find((t) => t.machine_type === current_incident.machine_type);
        setCategories(type?.intervention_categories ?? []);
      })
      .catch(() => setCategories([]));
  }, [current_incident.machine_type]);

  const handleSaveOutcome = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.recordOutcome(current_incident.incident_id, {
        ...outcomeData,
        intervention_category: outcomeData.intervention_category || outcomeData.action_taken,
      });
      setSaved(true);
      setShowOutcomeForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save outcome");
    } finally {
      setSaving(false);
    }
  };

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const sameMachineCount = historical_incidents.filter(
    (h) => h.incident.machine_id === current_incident.machine_id
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-industrial-900">Incident Analysis</h2>
            <p className="text-industrial-600">
              {current_incident.incident_id} · {current_incident.machine_id} · {humanize(current_incident.defect_type)}
            </p>
          </div>
        </div>
        <button
          onClick={() => onViewMachineMemory(current_incident.machine_id)}
          className="flex items-center gap-2 px-4 py-2 text-industrial-600 hover:text-industrial-800 hover:bg-industrial-50 rounded-lg"
        >
          <Database className="w-5 h-5" />
          {current_incident.machine_id} memory
        </button>
      </div>

      {/* Pipeline panel + memory moment */}
      <PipelineDebug result={result} />
      <MemoryMoment result={result} />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ---------------- Left: what happened, recommendation, outcome ---------------- */}
        <div className="lg:col-span-3 space-y-6">
          {/* 1. What happened */}
          <Section icon={<FileText className="w-5 h-5 text-industrial-600" />} step="1" title="What happened">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
              <Field label="Machine" value={`${current_incident.machine_id}`} sub={humanize(current_incident.machine_type)} />
              <Field label="Line" value={current_incident.production_line} />
              <Field label="Problem" value={humanize(current_incident.defect_type)} />
              <Field label="Reported" value={formatDate(current_incident.timestamp)} />
              {current_incident.operating_hours ? (
                <Field label="Operating hours" value={current_incident.operating_hours.toLocaleString()} />
              ) : null}
              {current_incident.technician_id ? <Field label="Technician" value={current_incident.technician_id} /> : null}
            </div>
            {current_incident.symptoms.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {current_incident.symptoms.map((s) => (
                  <span key={s} className="px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs">
                    {s}
                  </span>
                ))}
              </div>
            )}
            <p className="text-gray-700 text-sm">{current_incident.description}</p>
            {current_incident.sensor_values && Object.keys(current_incident.sensor_values).length > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                Readings:{" "}
                {Object.entries(current_incident.sensor_values)
                  .map(([k, v]) => `${humanize(k)} ${v}`)
                  .join(" · ")}
              </p>
            )}
          </Section>

          {/* 5-7. Recommendation (deterministic) */}
          <Section
            icon={<Calculator className="w-5 h-5 text-industrial-600" />}
            step="5"
            title="What TRACE recommends"
            aside={
              <span className={cn("px-3 py-1 rounded-full text-sm font-semibold border", CONFIDENCE_STYLE[recommendation.confidence])}>
                {recommendation.confidence === "INSUFFICIENT_DATA" ? "Insufficient evidence" : `${recommendation.confidence} confidence`}
              </span>
            }
          >
            <div
              className={cn(
                "rounded-lg p-4 mb-3 border",
                hasRecommendation ? "bg-industrial-50 border-industrial-200" : "bg-gray-50 border-gray-300 border-dashed"
              )}
            >
              <p className={cn("text-lg font-semibold", hasRecommendation ? "text-industrial-900" : "text-gray-600")}>
                {recommendation.suggested_action}
              </p>
              {hasRecommendation && recommendation.evidence[0] && (
                <p className="text-sm text-industrial-700 mt-1">
                  Most recent successful instance: “{recommendation.evidence[0].example_action}”
                  {recommendation.supporting_incidents[0] ? ` (${recommendation.supporting_incidents[0]})` : ""}
                </p>
              )}
            </div>

            <div className="text-sm mb-4">
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">6-7. Why this confidence (computed)</p>
              <p className="text-gray-800">{recommendation.basis}</p>
              <p className="text-xs text-gray-500 mt-1">
                Selected by deterministic scoring of recorded outcomes: successes + ½·partials − failures, weighted toward this
                machine. The AI does not choose the action.
              </p>
            </div>

            {recommendation.evidence.length > 0 && <EvidenceTable rows={recommendation.evidence} winner={recommendation.intervention_category} />}

            {recommendation.warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <p className="font-medium text-amber-800 text-sm">Cautions from the evidence</p>
                </div>
                <ul className="list-disc list-inside text-amber-800 text-sm space-y-1">
                  {recommendation.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* AI-written explanation: visually separate from facts */}
            <div className="mt-4 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50/60 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                  {recommendation.reasoning_source === "llm" ? "AI-written summary of the evidence above" : "Rule-based summary (AI unavailable)"}
                </p>
              </div>
              <p className="text-sm text-purple-950 italic">{recommendation.reasoning}</p>
              <p className="text-xs text-purple-600 mt-2">
                Wording only. Generated from the computed evidence; it cannot change the action or confidence, and any incident ID it
                cites is checked against the retrieved records.
              </p>
            </div>
          </Section>

          {/* 8. Where the evidence came from */}
          <Section icon={<Search className="w-5 h-5 text-industrial-600" />} step="8" title="Where the evidence came from">
            <ol className="text-sm text-gray-700 space-y-2">
              <li>
                <span className="font-medium">Hindsight recall</span> on bank <code className="text-xs bg-gray-100 px-1 rounded">{memory_trace.bank}</code>,
                filtered to this machine type (plus a second pass for {current_incident.machine_id} itself):{" "}
                <span className="font-medium">{memory_trace.memory_facts_recalled ?? 0} memory facts</span> from{" "}
                <span className="font-medium">{memory_trace.incidents_recalled ?? 0} past work orders</span>.
              </li>
              <li>
                <span className="font-medium">Relevance gate</span> ({memory_trace.relevance_rule}):{" "}
                <span className="font-medium">{memory_trace.evidence_incidents ?? 0} kept as evidence</span>
                {historical_incidents.length > 0 ? `, ${sameMachineCount} of them from ${current_incident.machine_id}.` : "."}
              </li>
              <li>
                Every evidence item is the exact <span className="font-medium">SQLite work order</span> behind the recalled memory
                (Hindsight document ID = incident ID).
              </li>
            </ol>
          </Section>

          {/* Record outcome */}
          <Section
            icon={<Save className="w-5 h-5 text-industrial-600" />}
            title="Record outcome"
            aside={
              saved ? (
                <span className="flex items-center gap-1 text-green-600 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Saved to SQLite and Hindsight
                </span>
              ) : null
            }
          >
            {!showOutcomeForm && !saved ? (
              <button
                onClick={() => setShowOutcomeForm(true)}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-industrial-500 hover:text-industrial-600 transition-colors"
              >
                Record what was done and whether it worked
              </button>
            ) : saved ? (
              <p className="text-gray-600 text-sm">
                Outcome recorded as <strong>{outcomeData.action_outcome}</strong> for “{outcomeData.intervention_category || outcomeData.action_taken}”.
                The next similar incident will recall this work order.
              </p>
            ) : (
              <div className="space-y-4">
                {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">{error}</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Intervention type</label>
                    <input
                      list="intervention-categories"
                      value={outcomeData.intervention_category ?? ""}
                      onChange={(e) => setOutcomeData((p) => ({ ...p, intervention_category: e.target.value }))}
                      placeholder="Pick or type"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-industrial-500"
                    />
                    <datalist id="intervention-categories">
                      {categories.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Action performed</label>
                    <input
                      type="text"
                      value={outcomeData.action_taken}
                      onChange={(e) => setOutcomeData((p) => ({ ...p, action_taken: e.target.value }))}
                      placeholder="What exactly was done"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-industrial-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Outcome</label>
                  <div className="flex gap-2">
                    {(["SUCCESS", "PARTIAL", "FAILED", "UNKNOWN"] as ActionOutcome[]).map((outcome) => (
                      <button
                        key={outcome}
                        type="button"
                        onClick={() => setOutcomeData((p) => ({ ...p, action_outcome: outcome }))}
                        className={cn(
                          "flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors",
                          outcomeData.action_outcome === outcome
                            ? getOutcomeBgColor(outcome) + " border-transparent"
                            : "border-gray-300 text-gray-700 hover:bg-gray-50"
                        )}
                      >
                        {outcome}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirmed root cause</label>
                    <input
                      type="text"
                      value={outcomeData.confirmed_root_cause}
                      onChange={(e) => setOutcomeData((p) => ({ ...p, confirmed_root_cause: e.target.value }))}
                      placeholder="If known"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-industrial-500"
                    />
                  </div>
                  <NumberField
                    label="Repair time (min)"
                    value={outcomeData.resolution_time_minutes}
                    onChange={(v) => setOutcomeData((p) => ({ ...p, resolution_time_minutes: v }))}
                  />
                  <NumberField
                    label="Downtime (min)"
                    value={outcomeData.downtime_minutes}
                    onChange={(v) => setOutcomeData((p) => ({ ...p, downtime_minutes: v }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Technician notes</label>
                  <textarea
                    value={outcomeData.technician_notes}
                    onChange={(e) => setOutcomeData((p) => ({ ...p, technician_notes: e.target.value }))}
                    rows={2}
                    placeholder="What you found, anything uncertain"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-industrial-500"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setShowOutcomeForm(false)} className="px-4 py-2 text-gray-700 hover:text-gray-900">
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveOutcome}
                    disabled={saving || !outcomeData.action_taken}
                    className="flex items-center gap-2 px-4 py-2 bg-industrial-600 text-white rounded-lg hover:bg-industrial-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? "Saving..." : "Save to memory"}
                  </button>
                </div>
              </div>
            )}
          </Section>
        </div>

        {/* ---------------- Right: what TRACE remembered ---------------- */}
        <div className="lg:col-span-2 space-y-6">
          <Section icon={<History className="w-5 h-5 text-industrial-600" />} step="2-4" title="What TRACE remembered">
            <p className="text-xs text-gray-500 mb-4">
              Past work orders recalled from Hindsight memory and loaded from the record system. These are historical facts, not AI
              output.
            </p>
            {historical_incidents.length === 0 ? (
              <div className="text-center py-6 px-3 border border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-700 font-medium">No matching history</p>
                <p className="text-gray-500 text-sm mt-1">
                  Recall returned {memory_trace.incidents_recalled ?? 0} work orders for this machine type, but none describes this
                  problem with a recorded outcome.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {OUTCOME_GROUPS.map(({ outcome, label, icon: Icon, tone }) => {
                  const items = historical_incidents.filter((h) => h.incident.action_outcome === outcome);
                  if (items.length === 0) return null;
                  return (
                    <div key={outcome}>
                      <p className={cn("flex items-center gap-1.5 text-sm font-semibold mb-2", tone)}>
                        <Icon className="w-4 h-4" />
                        {label} ({items.length})
                      </p>
                      <div className="space-y-2">
                        {items.map((h) => (
                          <HistoryCard
                            key={h.incident.incident_id}
                            historical={h}
                            currentMachine={current_incident.machine_id}
                            expanded={expanded.has(h.incident.incident_id)}
                            onToggle={() => toggle(h.incident.incident_id)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon,
  step,
  title,
  aside,
  children,
}: {
  icon: React.ReactNode;
  step?: string;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-lg font-semibold text-industrial-900">
          {step && <span className="text-industrial-400 font-normal mr-1">{step}.</span>}
          {title}
        </h3>
        {aside && <div className="ml-auto">{aside}</div>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value?: number; onChange: (v?: number) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="number"
        min={0}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : undefined)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-industrial-500"
      />
    </div>
  );
}

function EvidenceTable({ rows, winner }: { rows: EvidenceSummary[]; winner?: string | null }) {
  const ids = (row: EvidenceSummary, key: ActionOutcome) => (row.incident_ids[key] ?? []).join(", ");
  return (
    <div className="overflow-x-auto">
      <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Evidence tally from past work orders</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b">
            <th className="py-1.5 pr-2 font-medium">Intervention</th>
            <th className="py-1.5 px-2 font-medium text-green-700">Worked</th>
            <th className="py-1.5 px-2 font-medium text-amber-700">Partial</th>
            <th className="py-1.5 px-2 font-medium text-red-700">Failed</th>
            <th className="py-1.5 px-2 font-medium">Unverified</th>
            <th className="py-1.5 pl-2 font-medium">On this machine</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.intervention_category}
              className={cn("border-b last:border-0", row.intervention_category === winner && "bg-green-50/60 font-medium")}
            >
              <td className="py-1.5 pr-2">{row.intervention_category}</td>
              <td className="py-1.5 px-2 text-green-700" title={ids(row, "SUCCESS")}>{row.successes}</td>
              <td className="py-1.5 px-2 text-amber-700" title={ids(row, "PARTIAL")}>{row.partials}</td>
              <td className="py-1.5 px-2 text-red-700" title={ids(row, "FAILED")}>{row.failures}</td>
              <td className="py-1.5 px-2 text-gray-500" title={ids(row, "UNKNOWN")}>{row.unknowns}</td>
              <td className="py-1.5 pl-2 text-gray-700">
                {row.same_machine_successes || row.same_machine_failures
                  ? `${row.same_machine_successes} worked, ${row.same_machine_failures} failed`
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 mt-1">Hover a count to see the work order IDs.</p>
    </div>
  );
}

function HistoryCard({
  historical,
  currentMachine,
  expanded,
  onToggle,
}: {
  historical: HistoricalIncident;
  currentMachine: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { incident, similarity_score, recalled_facts } = historical;
  const sameMachine = incident.machine_id === currentMachine;

  return (
    <div className={cn("border rounded-lg overflow-hidden", sameMachine ? "border-industrial-300" : "border-gray-200")}>
      <button onClick={onToggle} className="w-full text-left p-3 hover:bg-gray-50">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{incident.intervention_category ?? incident.action_taken}</p>
            <p className="text-xs text-gray-500">
              {incident.incident_id} · {formatDay(incident.timestamp)} · {incident.machine_id}
              {sameMachine && <span className="ml-1 px-1.5 py-0.5 rounded bg-industrial-100 text-industrial-700">this machine</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-500" title="Hindsight semantic similarity">
              {Math.round(similarity_score * 100)}% match
            </span>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 text-sm space-y-2 pt-2">
          <p className="text-gray-700">{incident.description}</p>
          <p>
            <span className="text-gray-500">Action:</span> {incident.action_taken}{" "}
            <span className={cn("text-xs px-1.5 py-0.5 rounded ml-1", getOutcomeBgColor(incident.action_outcome))}>
              {incident.action_outcome}
            </span>
          </p>
          {incident.confirmed_root_cause && (
            <p>
              <span className="text-gray-500">Confirmed cause:</span> {incident.confirmed_root_cause}
            </p>
          )}
          {incident.technician_notes && (
            <p className="text-gray-700">
              <span className="text-gray-500">Technician {incident.technician_id ?? ""} notes:</span> “{incident.technician_notes}”
            </p>
          )}
          <p className="text-xs text-gray-500">
            Downtime {formatHours(incident.downtime_minutes)}
            {incident.severity ? ` · severity ${incident.severity}` : ""}
            {incident.operating_hours ? ` · ${incident.operating_hours.toLocaleString()} h` : ""}
          </p>
          {recalled_facts.length > 0 && (
            <div className="bg-gray-50 rounded p-2">
              <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-0.5">Recalled from Hindsight memory</p>
              <p className="text-xs text-gray-600 font-mono leading-relaxed">{recalled_facts[0]}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MemoryMoment({ result }: { result: AnalysisResult }) {
  const { historical_incidents, successful_interventions, failed_interventions, partial_interventions, current_incident } = result;
  const count = historical_incidents.length;

  if (count === 0) {
    return (
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-dashed border-gray-300 rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-gray-200 rounded-full">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-700">No Relevant History Found</h3>
            <p className="text-gray-500 mt-1">
              Hindsight recalled {result.memory_trace.incidents_recalled ?? 0} work orders for this machine type, but none
              describes this problem with a recorded outcome. TRACE will not guess an action; record the outcome to start
              building memory.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const sameMachine = historical_incidents.filter((h) => h.incident.machine_id === current_incident.machine_id).length;
  const top = historical_incidents.reduce((m, h) => Math.max(m, h.similarity_score), 0);

  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
      <div className="flex items-start gap-4">
        <div className="p-4 bg-green-100 rounded-full">
          <Brain className="w-8 h-8 text-green-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-green-800">
            TRACE Found {count} Related Historical Incident{count !== 1 ? "s" : ""}
            {sameMachine > 0 && (
              <span className="text-base font-medium text-green-700"> ({sameMachine} on {current_incident.machine_id})</span>
            )}
          </h3>
          <div className="flex flex-wrap gap-4 mt-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-700 font-medium">{successful_interventions.length} worked</span>
            </div>
            {failed_interventions.length > 0 && (
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" />
                <span className="text-red-600 font-medium">{failed_interventions.length} failed</span>
              </div>
            )}
            {partial_interventions.length > 0 && (
              <div className="flex items-center gap-2">
                <MinusCircle className="w-5 h-5 text-amber-500" />
                <span className="text-amber-700 font-medium">{partial_interventions.length} partially worked</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              <span className="text-blue-600 font-medium">{Math.round(top * 100)}% top similarity</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PipelineDebug({ result }: { result: AnalysisResult }) {
  const { memory_trace: trace, recommendation } = result;
  return (
    <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-yellow-400" />
        <span className="text-yellow-400 font-semibold">TRACE PIPELINE</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
        <PipelineStep label="Hindsight recall (fleet + this machine)" value={`${trace.memory_facts_recalled ?? 0} facts`} status="success" />
        <PipelineStep label="Past work orders recalled" value={`${trace.incidents_recalled ?? 0}`} />
        <PipelineStep label="Relevance gate: kept as evidence" value={`${trace.evidence_incidents ?? 0}`} />
        <PipelineStep label="SQLite cross-reference" status="success" />
        <PipelineStep label="Deterministic scoring" value={recommendation.intervention_category ?? "no evidence-backed action"} status="success" />
        <PipelineStep label="Confidence" value={recommendation.confidence} />
        <PipelineStep
          label="LLM phrasing (wording only)"
          value={recommendation.reasoning_source === "llm" ? "applied" : "fallback: rule-based"}
          status={recommendation.reasoning_source === "llm" ? "success" : "skipped"}
        />
      </div>
    </div>
  );
}

function PipelineStep({ label, status, value }: { label: string; status?: "success" | "skipped"; value?: string }) {
  return (
    <div className="flex items-center gap-2">
      {status === "success" && <span className="text-green-400">✓</span>}
      {status === "skipped" && <span className="text-gray-500">○</span>}
      {!status && <span className="text-gray-500">·</span>}
      <span className="text-gray-400">{label}</span>
      {value && <span className="text-white ml-auto truncate max-w-[50%]" title={value}>{value}</span>}
    </div>
  );
}
