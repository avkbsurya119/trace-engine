"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp, FileText, Search, Filter, Calculator, Gauge, Lightbulb, Sparkles } from "lucide-react";
import { cn, humanize } from "@/lib/utils";
import type { AnalysisResult } from "@/types/incident";
import { CONFIDENCE_LABEL, type Confidence } from "@/components/ui";

type StepKey = "incident" | "retrieval" | "filtering" | "scoring" | "confidence" | "recommendation" | "explanation";

/**
 * "How TRACE reached this decision": every stage of the pipeline with the
 * numbers it actually produced for this incident. Click a stage to expand it.
 */
export function DecisionPipeline({ result }: { result: AnalysisResult }) {
  const [open, setOpen] = useState<StepKey | null>(null);
  const { current_incident: incident, memory_trace: trace, recommendation: rec, historical_incidents } = result;
  const winner = rec.evidence.find((e) => e.verdict === "selected");
  const passed = rec.confidence_checks.filter((c) => c.passed).length;

  const steps: { key: StepKey; icon: typeof FileText; label: string; summary: string; detail: React.ReactNode }[] = [
    {
      key: "incident",
      icon: FileText,
      label: "Incident",
      summary: `${incident.machine_id} · ${humanize(incident.defect_type)}`,
      detail: (
        <p>
          {humanize(incident.machine_type)} on {incident.production_line}; {incident.symptoms.length} symptom(s) reported. The
          report is turned into a natural-language query before anything is stored, so the new incident can never match itself.
        </p>
      ),
    },
    {
      key: "retrieval",
      icon: Search,
      label: "Memory retrieval",
      summary: `${trace.incidents_recalled ?? 0} work orders`,
      detail: (
        <div className="space-y-2">
          <p>
            Two Hindsight recalls ran in parallel on bank <Code>{trace.bank}</Code>: the fleet of this machine type{" "}
            (<strong>{trace.fleet_facts ?? 0}</strong> memory facts) and {incident.machine_id}&apos;s own history (
            <strong>{trace.same_machine_facts ?? 0}</strong> facts). Facts were grouped into{" "}
            <strong>{trace.incidents_recalled ?? 0}</strong> past work orders and loaded from SQLite by incident ID.
          </p>
          <p className="text-gray-500">Tag filters: {(trace.tag_filter ?? []).map((t) => <Code key={t}>{t}</Code>)}</p>
          {trace.query && (
            <details className="text-gray-500">
              <summary className="cursor-pointer">Query sent to memory</summary>
              <p className="mt-1 font-mono text-xs bg-gray-50 rounded p-2">{trace.query}</p>
            </details>
          )}
        </div>
      ),
    },
    {
      key: "filtering",
      icon: Filter,
      label: "Filtering",
      summary: `${historical_incidents.length} kept`,
      detail: (
        <p>
          Of {trace.incidents_with_outcome ?? 0} recalled work orders with a recorded outcome, <strong>{historical_incidents.length}</strong>{" "}
          passed the relevance rule ({trace.relevance_rule}). This machine&apos;s own incidents rank first, then the closest
          fleet matches (similarity × recency); at most 15 are kept.
        </p>
      ),
    },
    {
      key: "scoring",
      icon: Calculator,
      label: "Scoring",
      summary: winner ? `${rec.evidence.length} option${rec.evidence.length === 1 ? "" : "s"} compared` : "nothing to score",
      detail: (
        <p>
          Each intervention scores <Code>successes + ½·partials − failures</Code>, ±½ for outcomes on {incident.machine_id}.
          {winner
            ? ` ${winner.intervention_category} scored highest (${winner.score}) of ${rec.evidence.length} interventions that appear in the evidence.`
            : " No intervention has a recorded success, so none can be recommended."}
        </p>
      ),
    },
    {
      key: "confidence",
      icon: Gauge,
      label: "Confidence",
      summary: CONFIDENCE_LABEL[rec.confidence as Confidence],
      detail: (
        <p>
          {passed} of {rec.confidence_checks.length} confidence rules met. The full checklist is under
          &ldquo;Why this recommendation&rdquo;.
        </p>
      ),
    },
    {
      key: "recommendation",
      icon: Lightbulb,
      label: "Recommendation",
      summary: rec.intervention_category ?? "withheld",
      detail: <p>{rec.basis}</p>,
    },
    {
      key: "explanation",
      icon: Sparkles,
      label: "Groq explanation",
      summary: rec.reasoning_source === "llm" ? "applied" : "rule-based",
      detail: (
        <p>
          {rec.reasoning_source === "llm"
            ? "Groq rewrote the computed result into plain language. It received only the tallies, IDs and decision above; its text was checked to cite only retrieved work orders."
            : "The LLM was unavailable or its text failed validation, so TRACE's own rule-based wording is shown."}{" "}
          It cannot change the action or the confidence.
        </p>
      ),
    },
  ];

  return (
    <section aria-labelledby="pipeline-heading" className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <h3 id="pipeline-heading" className="text-sm font-semibold text-industrial-900 mb-3">
        How TRACE reached this decision
        <span className="font-normal text-gray-500"> · click a stage for details</span>
      </h3>
      <ol className="flex flex-wrap items-stretch gap-1">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isOpen = open === step.key;
          return (
            <li key={step.key} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : step.key)}
                aria-expanded={isOpen}
                aria-controls="pipeline-detail"
                className={cn(
                  "text-left rounded-lg border px-3 py-2 transition-colors min-w-[7.5rem]",
                  isOpen ? "border-industrial-500 bg-industrial-50" : "border-gray-200 hover:border-industrial-300 hover:bg-gray-50"
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold text-industrial-800">
                  <Icon className="w-3.5 h-3.5" aria-hidden />
                  {step.label}
                </span>
                <span className="block text-xs text-gray-600 mt-0.5 truncate max-w-[10rem]">{step.summary}</span>
              </button>
              {i < steps.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" aria-hidden />}
            </li>
          );
        })}
      </ol>
      <div id="pipeline-detail" aria-live="polite">
        {open && (
          <div className="mt-3 rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700">
            <p className="flex items-center justify-between font-semibold text-industrial-900 mb-1">
              {steps.find((s) => s.key === open)?.label}
              <button type="button" onClick={() => setOpen(null)} aria-label="Close stage details" className="text-gray-400 hover:text-gray-600">
                <ChevronUp className="w-4 h-4" aria-hidden />
              </button>
            </p>
            {steps.find((s) => s.key === open)?.detail}
          </div>
        )}
        {!open && (
          <p className="mt-2 text-xs text-gray-400 flex items-center gap-1">
            <ChevronDown className="w-3 h-3" aria-hidden /> Each stage shows the numbers it produced for this incident.
          </p>
        )}
      </div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="text-xs bg-gray-100 px-1 py-0.5 rounded mx-0.5">{children}</code>;
}
