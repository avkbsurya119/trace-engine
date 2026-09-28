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
  HIGH: "bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40 shadow-[0_0_12px_rgba(56,189,248,0.25)]",
  MEDIUM: "bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-[0_0_12px_rgba(251,191,36,0.2)]",
  LOW: "bg-orange-400/20 text-orange-300 border border-orange-400/40",
  INSUFFICIENT_DATA: "bg-white/[0.06] text-[#8290ab] border border-white/10",
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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2.5 text-[#8290ab] hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 rounded-2xl transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold text-white tracking-tight">Incident Analysis</h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/30">
                {current_incident.incident_id}
              </span>
            </div>
            <p className="text-xs text-[#8290ab] mt-0.5">
              Asset {current_incident.machine_id} · Fault: {humanize(current_incident.defect_type)}
            </p>
          </div>
        </div>
        <button
          onClick={() => onViewMachineMemory(current_incident.machine_id)}
          className="btn-neon-outline flex items-center gap-2 px-4 py-2 text-xs font-semibold"
        >
          <Database className="w-4 h-4 text-[#38bdf8]" />
          Recall {current_incident.machine_id} Timeline
        </button>
      </div>

      {/* Pipeline panel + memory moment */}
      <PipelineDebug result={result} />
      <MemoryMoment result={result} />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ---------------- Left: what happened, recommendation, outcome ---------------- */}
        <div className="lg:col-span-3 space-y-6">
          {/* 1. What happened */}
          <Section icon={<FileText className="w-5 h-5 text-[#38bdf8]" />} step="1" title="What Happened">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
              <Field label="Machine" value={`${current_incident.machine_id}`} sub={humanize(current_incident.machine_type)} />
              <Field label="Line" value={current_incident.production_line} />
              <Field label="Problem" value={humanize(current_incident.defect_type)} />
              <Field label="Reported" value={formatDate(current_incident.timestamp)} />
              {current_incident.operating_hours ? (
                <Field label="Operating Hours" value={current_incident.operating_hours.toLocaleString()} />
              ) : null}
              {current_incident.technician_id ? <Field label="Technician" value={current_incident.technician_id} /> : null}
            </div>
            {current_incident.symptoms.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {current_incident.symptoms.map((s) => (
                  <span key={s} className="px-3 py-1 bg-amber-400/10 text-amber-300 border border-amber-400/30 rounded-full text-xs font-medium">
                    {s}
                  </span>
                ))}
              </div>
            )}
            <p className="text-[#f3f6ff] text-sm bg-white/[0.04] p-3.5 rounded-2xl border border-white/10">{current_incident.description}</p>
            {current_incident.sensor_values && Object.keys(current_incident.sensor_values).length > 0 && (
              <p className="text-xs text-[#8290ab] mt-2">
                Readings:{" "}
                {Object.entries(current_incident.sensor_values)
                  .map(([k, v]) => `${humanize(k)} ${v}`)
                  .join(" · ")}
              </p>
            )}
          </Section>

          {/* 5-7. Recommendation (deterministic) */}
          <Section
            icon={<Calculator className="w-5 h-5 text-[#38bdf8]" />}
            step="5"
            title="TRACE Recommendation"
            aside={
              <span className={cn("px-3 py-1 rounded-full text-xs font-semibold border", CONFIDENCE_STYLE[recommendation.confidence])}>
                {recommendation.confidence === "INSUFFICIENT_DATA" ? "Insufficient evidence" : `${recommendation.confidence} confidence`}
              </span>
            }
          >
            <div
              className={cn(
                "rounded-2xl p-4 mb-4 border relative overflow-hidden",
                hasRecommendation ? "bg-[#0d1a38]/90 border-[#38bdf8]/40 shadow-[0_0_25px_rgba(56,189,248,0.15)]" : "bg-white/[0.03] border-white/10 border-dashed"
              )}
            >
              <p className={cn("text-lg font-extrabold tracking-tight", hasRecommendation ? "text-white" : "text-[#8290ab]")}>
                {recommendation.suggested_action}
              </p>
              {hasRecommendation && recommendation.evidence[0] && (
                <p className="text-xs text-[#38bdf8] mt-1 font-mono">
                  Verified historic precedent: “{recommendation.evidence[0].example_action}”
                  {recommendation.supporting_incidents[0] ? ` (${recommendation.supporting_incidents[0]})` : ""}
                </p>
              )}
            </div>

            <div className="text-sm mb-4">
              <p className="text-[#8290ab] text-xs font-semibold uppercase tracking-wider mb-1">Mathematical Scoring Basis</p>
              <p className="text-[#f3f6ff] text-sm">{recommendation.basis}</p>
              <p className="text-xs text-[#50607d] mt-1.5">
                Deterministic formula: successes + ½·partials − failures, weighted toward this machine asset. Zero LLM hallucination on core action.
              </p>
            </div>

            {recommendation.evidence.length > 0 && <EvidenceTable rows={recommendation.evidence} winner={recommendation.intervention_category} />}

            {recommendation.warnings.length > 0 && (
              <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-4 mt-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <p className="font-bold text-amber-300 text-xs uppercase tracking-wider">Cautions from Evidence Records</p>
                </div>
                <ul className="list-disc list-inside text-amber-200/90 text-xs space-y-1">
                  {recommendation.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* AI-written explanation: visually separate from facts */}
            <div className="mt-4 rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                  {recommendation.reasoning_source === "llm" ? "AI synthesis of verified facts" : "Rule-based summary"}
                </p>
              </div>
              <p className="text-sm text-indigo-100/90 leading-relaxed italic">{recommendation.reasoning}</p>
              <p className="text-[11px] text-indigo-400 mt-2">
                Wording synthesis strictly constrained to cited work order IDs.
              </p>
            </div>
          </Section>

          {/* 8. Where the evidence came from */}
          <Section icon={<Search className="w-5 h-5 text-[#38bdf8]" />} step="8" title="Where the evidence came from">
            <ol className="text-sm text-gray-300 space-y-2">
              <li>
                <span className="font-medium text-white">Hindsight recall</span> on bank <code className="text-xs bg-white/10 text-[#38bdf8] px-2 py-0.5 rounded font-mono">{memory_trace.bank}</code>,
                filtered to this machine type (plus a second pass for {current_incident.machine_id} itself):{" "}
                <span className="font-semibold text-white">{memory_trace.memory_facts_recalled ?? 0} memory facts</span> from{" "}
                <span className="font-semibold text-white">{memory_trace.incidents_recalled ?? 0} past work orders</span>.
              </li>
              <li>
                <span className="font-medium text-white">Relevance gate</span> ({memory_trace.relevance_rule}):{" "}
                <span className="font-semibold text-[#38bdf8]">{memory_trace.evidence_incidents ?? 0} kept as evidence</span>
                {historical_incidents.length > 0 ? `, ${sameMachineCount} of them from ${current_incident.machine_id}.` : "."}
              </li>
              <li>
                Every evidence item is the exact <span className="font-medium text-white">SQLite work order</span> behind the recalled memory
                (Hindsight document ID = incident ID).
              </li>
            </ol>
          </Section>

          {/* Record outcome */}
          <Section
            icon={<Save className="w-5 h-5 text-[#38bdf8]" />}
            title="Record outcome"
            aside={
              saved ? (
                <span className="flex items-center gap-1.5 text-[#38bdf8] text-sm font-semibold">
                  <CheckCircle className="w-4 h-4" />
                  Saved to SQLite and Hindsight
                </span>
              ) : null
            }
          >
            {!showOutcomeForm && !saved ? (
              <button
                onClick={() => setShowOutcomeForm(true)}
                className="w-full py-3.5 border border-dashed border-white/20 rounded-2xl text-gray-400 hover:border-[#38bdf8]/60 hover:text-[#38bdf8] hover:bg-white/[0.03] transition-all font-medium text-sm"
              >
                + Record what was done and whether it worked
              </button>
            ) : saved ? (
              <p className="text-gray-300 text-sm">
                Outcome recorded as <strong className="text-white">{outcomeData.action_outcome}</strong> for “{outcomeData.intervention_category || outcomeData.action_taken}”.
                The next similar incident will recall this work order.
              </p>
            ) : (
              <div className="space-y-4">
                {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm">{error}</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-gray-400 mb-1.5">Intervention type</label>
                    <input
                      list="intervention-categories"
                      value={outcomeData.intervention_category ?? ""}
                      onChange={(e) => setOutcomeData((p) => ({ ...p, intervention_category: e.target.value }))}
                      placeholder="Pick or type category"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#141c38] text-white placeholder-gray-500 focus:outline-none focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8] transition-all text-sm"
                    />
                    <datalist id="intervention-categories">
                      {categories.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-gray-400 mb-1.5">Action performed</label>
                    <input
                      type="text"
                      value={outcomeData.action_taken}
                      onChange={(e) => setOutcomeData((p) => ({ ...p, action_taken: e.target.value }))}
                      placeholder="What exactly was done"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#141c38] text-white placeholder-gray-500 focus:outline-none focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8] transition-all text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-gray-400 mb-2">Outcome</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(["SUCCESS", "PARTIAL", "FAILED", "UNKNOWN"] as ActionOutcome[]).map((outcome) => (
                      <button
                        key={outcome}
                        type="button"
                        onClick={() => setOutcomeData((p) => ({ ...p, action_outcome: outcome }))}
                        className={cn(
                          "py-2 px-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all",
                          outcomeData.action_outcome === outcome
                            ? getOutcomeBgColor(outcome) + " ring-1 ring-white/20"
                            : "border-white/10 bg-white/[0.03] text-gray-400 hover:text-white hover:bg-white/[0.07]"
                        )}
                      >
                        {outcome}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium uppercase tracking-wider text-gray-400 mb-1.5">Confirmed root cause</label>
                    <input
                      type="text"
                      value={outcomeData.confirmed_root_cause}
                      onChange={(e) => setOutcomeData((p) => ({ ...p, confirmed_root_cause: e.target.value }))}
                      placeholder="If known"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#141c38] text-white placeholder-gray-500 focus:outline-none focus:border-[#38bdf8] text-sm"
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
                  <label className="block text-xs font-medium uppercase tracking-wider text-gray-400 mb-1.5">Technician notes</label>
                  <textarea
                    value={outcomeData.technician_notes}
                    onChange={(e) => setOutcomeData((p) => ({ ...p, technician_notes: e.target.value }))}
                    rows={2}
                    placeholder="What you found, anything uncertain"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#141c38] text-white placeholder-gray-500 focus:outline-none focus:border-[#38bdf8] text-sm resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowOutcomeForm(false)}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveOutcome}
                    disabled={saving || !outcomeData.action_taken}
                    className="btn-neon-primary px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-40"
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
          <Section icon={<History className="w-5 h-5 text-[#38bdf8]" />} step="2-4" title="What TRACE remembered">
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              Past work orders recalled from Hindsight memory and loaded from the record system. These are historical facts, not AI
              output.
            </p>
            {historical_incidents.length === 0 ? (
              <div className="text-center py-8 px-4 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                <p className="text-gray-300 font-medium">No matching history</p>
                <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">
                  Recall returned {memory_trace.incidents_recalled ?? 0} work orders for this machine type, but none describes this
                  problem with a recorded outcome.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {OUTCOME_GROUPS.map(({ outcome, label, icon: Icon, tone }) => {
                  const items = historical_incidents.filter((h) => h.incident.action_outcome === outcome);
                  if (items.length === 0) return null;
                  return (
                    <div key={outcome}>
                      <p className={cn("flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2.5", tone)}>
                        <Icon className="w-4 h-4" />
                        {label} ({items.length})
                      </p>
                      <div className="space-y-2.5">
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
    <div className="glass-card rounded-2xl p-6 border border-white/10 hover:border-white/15 transition-all">
      <div className="flex items-center gap-2.5 mb-4">
        {icon}
        <h3 className="text-base font-bold text-white flex items-center">
          {step && <span className="text-[#38bdf8] font-mono font-semibold mr-1.5">{step}.</span>}
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
      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">{label}</p>
      <p className="font-semibold text-white mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value?: number; onChange: (v?: number) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wider text-gray-400 mb-1.5">{label}</label>
      <input
        type="number"
        min={0}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : undefined)}
        className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#141c38] text-white placeholder-gray-500 focus:outline-none focus:border-[#38bdf8] text-sm"
      />
    </div>
  );
}

function EvidenceTable({ rows, winner }: { rows: EvidenceSummary[]; winner?: string | null }) {
  const ids = (row: EvidenceSummary, key: ActionOutcome) => (row.incident_ids[key] ?? []).join(", ");
  return (
    <div className="overflow-x-auto">
      <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold mb-2">Evidence tally from past work orders</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-white/10">
            <th className="py-2 pr-2 font-medium">Intervention</th>
            <th className="py-2 px-2 font-medium text-[#38bdf8]">Worked</th>
            <th className="py-2 px-2 font-medium text-amber-400">Partial</th>
            <th className="py-2 px-2 font-medium text-red-400">Failed</th>
            <th className="py-2 px-2 font-medium text-gray-400">Unverified</th>
            <th className="py-2 pl-2 font-medium text-white">On this machine</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((row) => (
            <tr
              key={row.intervention_category}
              className={cn("transition-colors", row.intervention_category === winner ? "bg-[#38bdf8]/10 font-semibold" : "hover:bg-white/[0.02]")}
            >
              <td className="py-2.5 pr-2 text-white">{row.intervention_category}</td>
              <td className="py-2.5 px-2 text-[#38bdf8] font-bold" title={ids(row, "SUCCESS")}>{row.successes}</td>
              <td className="py-2.5 px-2 text-amber-400 font-bold" title={ids(row, "PARTIAL")}>{row.partials}</td>
              <td className="py-2.5 px-2 text-red-400 font-bold" title={ids(row, "FAILED")}>{row.failures}</td>
              <td className="py-2.5 px-2 text-gray-400" title={ids(row, "UNKNOWN")}>{row.unknowns}</td>
              <td className="py-2.5 pl-2 text-gray-300">
                {row.same_machine_successes || row.same_machine_failures
                  ? `${row.same_machine_successes} worked, ${row.same_machine_failures} failed`
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-500 mt-2">Hover a count to see the work order IDs.</p>
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
    <div className={cn("rounded-2xl border transition-all overflow-hidden", sameMachine ? "border-[#38bdf8]/30 bg-[#38bdf8]/[0.03]" : "border-white/10 bg-[#0e1326]/70")}>
      <button onClick={onToggle} className="w-full text-left p-3.5 hover:bg-white/[0.03] transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{incident.intervention_category ?? incident.action_taken}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {incident.incident_id} · {formatDay(incident.timestamp)} · <span className="font-mono text-gray-300">{incident.machine_id}</span>
              {sameMachine && <span className="ml-2 px-2 py-0.5 rounded-full bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/30 font-semibold text-[10px]">THIS MACHINE</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-[#38bdf8] font-mono font-semibold" title="Hindsight semantic similarity">
              {Math.round(similarity_score * 100)}% match
            </span>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-3.5 pb-3.5 border-t border-white/10 text-sm space-y-2.5 pt-3">
          <p className="text-gray-300 leading-relaxed">{incident.description}</p>
          <p className="text-xs text-gray-300">
            <span className="text-gray-400">Action:</span> <strong className="text-white">{incident.action_taken}</strong>{" "}
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-bold ml-1.5", getOutcomeBgColor(incident.action_outcome))}>
              {incident.action_outcome}
            </span>
          </p>
          {incident.confirmed_root_cause && (
            <p className="text-xs text-gray-300">
              <span className="text-gray-400">Confirmed cause:</span> <span className="text-white font-medium">{incident.confirmed_root_cause}</span>
            </p>
          )}
          {incident.technician_notes && (
            <p className="text-xs text-gray-300 italic">
              <span className="text-gray-400 not-italic">Technician {incident.technician_id ?? ""} notes:</span> “{incident.technician_notes}”
            </p>
          )}
          <p className="text-xs text-gray-400">
            Downtime {formatHours(incident.downtime_minutes)}
            {incident.severity ? ` · severity ${incident.severity}` : ""}
            {incident.operating_hours ? ` · ${incident.operating_hours.toLocaleString()} h` : ""}
          </p>
          {recalled_facts.length > 0 && (
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#38bdf8] font-bold mb-1">Recalled from Hindsight memory</p>
              <p className="text-xs text-gray-300 font-mono leading-relaxed">{recalled_facts[0]}</p>
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
      <div className="glass-card border border-dashed border-white/20 rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10">
            <Search className="w-7 h-7 text-gray-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">No Relevant History Found</h3>
            <p className="text-gray-400 text-xs mt-1 leading-relaxed">
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
    <div className="glass-card border border-[#38bdf8]/30 bg-gradient-to-r from-[#38bdf8]/10 via-[#3a6cff]/5 to-transparent rounded-2xl p-6 relative overflow-hidden">
      <div className="flex items-start gap-4">
        <div className="p-3.5 bg-[#38bdf8]/20 border border-[#38bdf8]/30 rounded-2xl text-[#38bdf8]">
          <Brain className="w-7 h-7" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white">
            TRACE Found {count} Related Historical Incident{count !== 1 ? "s" : ""}
            {sameMachine > 0 && (
              <span className="text-sm font-semibold text-[#38bdf8]"> ({sameMachine} on {current_incident.machine_id})</span>
            )}
          </h3>
          <div className="flex flex-wrap gap-3 mt-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#38bdf8]/10 border border-[#38bdf8]/20">
              <CheckCircle className="w-4 h-4 text-[#38bdf8]" />
              <span className="text-[#38bdf8] text-xs font-bold">{successful_interventions.length} worked</span>
            </div>
            {failed_interventions.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-red-400 text-xs font-bold">{failed_interventions.length} failed</span>
              </div>
            )}
            {partial_interventions.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                <MinusCircle className="w-4 h-4 text-amber-400" />
                <span className="text-amber-400 text-xs font-bold">{partial_interventions.length} partial</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
              <Target className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400 text-xs font-bold">{Math.round(top * 100)}% top similarity</span>
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
    <div className="glass-card border border-amber-500/20 rounded-2xl p-4 font-mono text-xs text-gray-300">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-amber-400" />
        <span className="text-amber-400 font-bold uppercase tracking-wider">TRACE PIPELINE</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5">
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
      {status === "success" && <span className="text-[#38bdf8]">✓</span>}
      {status === "skipped" && <span className="text-gray-500">○</span>}
      {!status && <span className="text-gray-500">·</span>}
      <span className="text-gray-400">{label}</span>
      {value && <span className="text-white ml-auto truncate max-w-[50%] font-semibold" title={value}>{value}</span>}
    </div>
  );
}
