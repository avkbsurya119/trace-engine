"use client";

import { AlertTriangle, CheckCircle2, Circle, Scale, Sparkles, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionOutcome, ConfidenceCheck, EvidenceSummary, Recommendation } from "@/types/incident";
import { Section } from "@/components/ui";

const LEVEL_TITLE: Record<ConfidenceCheck["level"], string> = {
  EVIDENCE: "Evidence",
  HIGH: "Needed for HIGH",
  MEDIUM: "Needed for MEDIUM",
  DOWNGRADE: "Downgrade check",
};

/** Why this action, why this confidence, why not the alternatives, and the AI wording. */
export function WhyPanel({
  recommendation,
  summaryLabel,
}: {
  recommendation: Recommendation;
  /** Overrides the summary box label (e.g. where the LLM is intentionally not used). */
  summaryLabel?: string;
}) {
  return (
    <Section icon={<Scale className="w-5 h-5 text-industrial-600" />} title="Why this recommendation" id="why">
      <ConfidenceChecklist checks={recommendation.confidence_checks} />
      {recommendation.evidence.length > 0 && <EvidenceTable rows={recommendation.evidence} />}

      {recommendation.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-5">
          <p className="flex items-center gap-2 font-medium text-amber-800 text-sm mb-1">
            <AlertTriangle className="w-4 h-4" aria-hidden />
            Cautions from the evidence
          </p>
          <ul className="list-disc list-inside text-amber-800 text-sm space-y-1">
            {recommendation.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* AI-written wording: visually separate from computed facts */}
      <div className="mt-5 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50/60 p-4">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-purple-700 mb-2">
          <Sparkles className="w-4 h-4" aria-hidden />
          {summaryLabel ??
            (recommendation.reasoning_source === "llm" ? "AI-written summary of the evidence above" : "Rule-based summary (AI unavailable)")}
        </p>
        <p className="text-sm text-purple-950 italic">{recommendation.reasoning}</p>
        <p className="text-xs text-purple-700 mt-2">
          Wording only. It cannot change the action or confidence, and any work order it cites is checked against the retrieved
          records.
        </p>
      </div>
    </Section>
  );
}

function ConfidenceChecklist({ checks }: { checks: ConfidenceCheck[] }) {
  if (checks.length === 0) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">How the confidence was calculated</p>
      <ul className="space-y-1.5">
        {checks.map((check) => (
          <li key={check.rule} className="flex items-start gap-2 text-sm">
            {check.passed ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" aria-label="met" />
            ) : (
              <Circle className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" aria-label="not met" />
            )}
            <span className="flex-1">
              <span className="text-xs text-gray-400 mr-1.5">{LEVEL_TITLE[check.level]}</span>
              <span className={cn(check.passed ? "text-gray-900" : "text-gray-500")}>{check.rule}</span>
              {check.detail && <span className="text-gray-500"> · {check.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EvidenceTable({ rows }: { rows: EvidenceSummary[] }) {
  const maxScore = Math.max(1, ...rows.map((r) => Math.abs(r.score)));
  const ids = (row: EvidenceSummary, key: ActionOutcome) => (row.incident_ids[key] ?? []).join(", ") || "none";

  return (
    <div className="mt-5 overflow-x-auto">
      <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">Every intervention in the evidence</p>
      <table className="w-full text-sm">
        <caption className="sr-only">
          Recorded outcomes per intervention, its score, and why it was or was not recommended
        </caption>
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b">
            <th scope="col" className="py-1.5 pr-2 font-medium">Intervention</th>
            <th scope="col" className="py-1.5 px-2 font-medium text-green-700">Worked</th>
            <th scope="col" className="py-1.5 px-2 font-medium text-amber-700">Partial</th>
            <th scope="col" className="py-1.5 px-2 font-medium text-red-700">Failed</th>
            <th scope="col" className="py-1.5 px-2 font-medium">Unverified</th>
            <th scope="col" className="py-1.5 px-2 font-medium" title="successes + ½·partials − failures, ±½ on this machine">
              Score
            </th>
            <th scope="col" className="py-1.5 pl-2 font-medium">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = row.verdict === "selected";
            return (
              <tr key={row.intervention_category} className={cn("border-b last:border-0 align-top", selected && "bg-green-50/70")}>
                <th scope="row" className="py-2 pr-2 text-left font-medium text-gray-900">
                  {row.intervention_category}
                  {(row.same_machine_successes > 0 || row.same_machine_failures > 0) && (
                    <span className="block text-xs font-normal text-industrial-600">
                      on this machine: {row.same_machine_successes} worked, {row.same_machine_failures} failed
                    </span>
                  )}
                </th>
                <td className="py-2 px-2 text-green-700 tabular-nums" title={ids(row, "SUCCESS")}>{row.successes}</td>
                <td className="py-2 px-2 text-amber-700 tabular-nums" title={ids(row, "PARTIAL")}>{row.partials}</td>
                <td className="py-2 px-2 text-red-700 tabular-nums" title={ids(row, "FAILED")}>{row.failures}</td>
                <td className="py-2 px-2 text-gray-500 tabular-nums" title={ids(row, "UNKNOWN")}>{row.unknowns}</td>
                <td className="py-2 px-2 w-28">
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-gray-800 w-8 text-right">{row.score}</span>
                    <span className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden" aria-hidden>
                      <span
                        className={cn("block h-full rounded-full", row.score >= 0 ? "bg-green-600" : "bg-red-500")}
                        style={{ width: `${(Math.abs(row.score) / maxScore) * 100}%` }}
                      />
                    </span>
                  </div>
                </td>
                <td className="py-2 pl-2">
                  <span className={cn("flex items-start gap-1 text-xs", selected ? "text-green-800 font-medium" : "text-gray-600")}>
                    {selected ? (
                      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" aria-hidden />
                    )}
                    <span>
                      <span className="sr-only">{selected ? "Selected: " : "Not chosen: "}</span>
                      {row.verdict_reason}
                    </span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 mt-1">Hover a count to see the work order IDs.</p>
    </div>
  );
}
