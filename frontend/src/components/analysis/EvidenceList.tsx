"use client";

import { useState } from "react";
import { CheckCircle, ChevronDown, ChevronUp, Clock, HelpCircle, History, Layers, MinusCircle, RefreshCw, XCircle } from "lucide-react";
import { cn, formatDay, formatHours, humanize } from "@/lib/utils";
import type { ActionOutcome, AnalysisResult, CrossMachineEvidence, HistoricalIncident, PatternAlert } from "@/types/incident";
import { OutcomePill, Section } from "@/components/ui";

const OUTCOME_GROUPS: { outcome: ActionOutcome; label: string; icon: typeof CheckCircle; tone: string }[] = [
  { outcome: "SUCCESS", label: "Worked", icon: CheckCircle, tone: "text-green-700" },
  { outcome: "FAILED", label: "Failed", icon: XCircle, tone: "text-red-700" },
  { outcome: "PARTIAL", label: "Partially worked", icon: MinusCircle, tone: "text-amber-700" },
  { outcome: "UNKNOWN", label: "Outcome not verified", icon: HelpCircle, tone: "text-gray-600" },
];

const RECENCY: Record<string, { text: string; style: string }> = {
  high: { text: "Recent", style: "bg-green-50 text-green-700" },
  medium: { text: "Older", style: "bg-amber-50 text-amber-700" },
  low: { text: "Historical", style: "bg-gray-100 text-gray-600" },
};

/** Past work orders recalled from Hindsight, grouped by what happened. */
export function EvidenceList({ result }: { result: AnalysisResult }) {
  const { historical_incidents, current_incident, memory_trace } = result;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <Section icon={<History className="w-5 h-5 text-industrial-600" />} title="What TRACE remembered" id="remembered">
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
                  <Icon className="w-4 h-4" aria-hidden />
                  {label} ({items.length})
                </p>
                <ul className="space-y-2">
                  {items.map((h) => (
                    <li key={h.incident.incident_id}>
                      <HistoryCard
                        historical={h}
                        currentMachine={current_incident.machine_id}
                        expanded={expanded.has(h.incident.incident_id)}
                        onToggle={() => toggle(h.incident.incident_id)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {(result.pattern_alert || (result.cross_machine_evidence?.length ?? 0) > 0) && (
        <div className="mt-6 pt-5 border-t border-gray-100 space-y-4">
          {result.pattern_alert && <PatternSummary alert={result.pattern_alert} />}
          {result.cross_machine_evidence && result.cross_machine_evidence.length > 0 && (
            <CrossMachineSummary evidence={result.cross_machine_evidence} />
          )}
        </div>
      )}
    </Section>
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
  const { incident, similarity_score, recalled_facts, recency_label, days_ago } = historical;
  const sameMachine = incident.machine_id === currentMachine;
  const recency = recency_label ? RECENCY[recency_label] : undefined;
  const panelId = `evidence-${incident.incident_id}`;

  return (
    <div className={cn("border rounded-lg overflow-hidden transition-shadow duration-150 hover:shadow-md", sameMachine ? "border-industrial-300" : "border-gray-200")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="w-full text-left p-3 hover:bg-gray-50"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{incident.intervention_category ?? incident.action_taken}</p>
            <p className="text-xs text-gray-500 flex flex-wrap items-center gap-1">
              {incident.incident_id} · {formatDay(incident.timestamp)} · {incident.machine_id}
              {sameMachine && <span className="px-1.5 py-0.5 rounded bg-industrial-100 text-industrial-700">this machine</span>}
              {recency && (
                <span className={cn("px-1.5 py-0.5 rounded inline-flex items-center gap-1", recency.style)} title={`${days_ago} days ago`}>
                  <Clock className="w-3 h-3" aria-hidden />
                  {recency.text}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-500" title="Hindsight semantic similarity">
              {Math.round(similarity_score * 100)}% match
            </span>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" aria-hidden /> : <ChevronDown className="w-4 h-4 text-gray-400" aria-hidden />}
          </div>
        </div>
      </button>

      {expanded && (
        <div id={panelId} className="px-3 pb-3 border-t border-gray-100 text-sm space-y-2 pt-2">
          <p className="text-gray-700">{incident.description}</p>
          <p>
            <span className="text-gray-500">Action:</span> {incident.action_taken} <OutcomePill outcome={incident.action_outcome} className="ml-1" />
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

/** Recurring-problem summary computed from the retrieved evidence. */
function PatternSummary({ alert }: { alert: PatternAlert }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <RefreshCw className="w-4 h-4" aria-hidden />
        {alert.is_recurring ? "Recurring problem" : "Seen before"}: {humanize(alert.defect_type)}
      </p>
      <p className="text-sm text-amber-900 mt-1">
        {alert.total_occurrences} related work orders in the retrieved evidence, {alert.first_occurrence} – {alert.most_recent}
        {alert.machines_affected.length > 1 ? `, across ${alert.machines_affected.length} machines` : ""}.
      </p>
      <p className="text-xs text-amber-800 mt-1">
        <span className="text-green-700 font-medium">{alert.successful_resolutions} resolved</span> ·{" "}
        <span className="text-red-700 font-medium">{alert.failed_resolutions} failed</span> ·{" "}
        <span className="text-amber-700 font-medium">{alert.partial_resolutions} partial</span>
      </p>
    </div>
  );
}

/** Interventions that worked on several other machines of the same type. */
function CrossMachineSummary({ evidence }: { evidence: CrossMachineEvidence[] }) {
  const significant = evidence.filter((e) => e.success_count >= 2).slice(0, 3);
  if (significant.length === 0) return null;
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-blue-900">
        <Layers className="w-4 h-4" aria-hidden />
        Worked on other machines of this type
      </p>
      <ul className="mt-2 space-y-2">
        {significant.map((item) => (
          <li key={item.intervention_category} className="text-sm">
            <span className="font-medium text-gray-900">{item.intervention_category}</span>
            <span className="text-gray-600">
              {" "}
              · worked on {item.machines_succeeded.length} machine(s)
              {item.machines_failed.length > 0 ? `, failed on ${item.machines_failed.length}` : ""}
            </span>
            <span className="block text-xs text-gray-500">
              {item.machines_succeeded.slice(0, 5).join(", ")}
              {item.machines_succeeded.length > 5 ? ` +${item.machines_succeeded.length - 5}` : ""} · {item.cross_machine_confidence} evidence
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
