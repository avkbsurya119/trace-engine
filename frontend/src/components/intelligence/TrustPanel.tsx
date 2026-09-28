"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { humanize } from "@/lib/utils";
import type { ProblemKnowledge, ProblemSummary } from "@/types/incident";
import { ConfidenceMeter, ErrorState, LoadingState, Section, type Confidence } from "@/components/ui";
import { WhyPanel } from "@/components/analysis/WhyPanel";

/** Pick any problem: see what TRACE would recommend from all recorded outcomes, and exactly why. */
export function TrustPanel({ problems }: { problems: ProblemSummary[] }) {
  const options = useMemo(
    () => [...problems].filter((p) => p.evidence_count > 0).sort((a, b) => b.evidence_count - a.evidence_count),
    [problems]
  );
  // Start with the best-evidenced problem TRACE answers with HIGH confidence.
  const initial = options.find((p) => p.confidence === "HIGH") ?? options[0];
  const [selected, setSelected] = useState(initial ? `${initial.machine_type}|${initial.defect_type}` : "");
  const [data, setData] = useState<ProblemKnowledge | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    const [machineType, defectType] = selected.split("|");
    let cancelled = false;
    setData(null);
    setError(null);
    api
      .getProblemKnowledge(machineType, defectType)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load"));
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const winner = data?.recommendation.evidence.find((e) => e.verdict === "selected");

  return (
    <Section icon={<ShieldCheck className="w-5 h-5 text-[#38bdf8]" />} title="Recommendation trust" id="trust">
      <div className="flex flex-wrap items-center gap-3 -mt-2 mb-4">
        <label htmlFor="trust-problem" className="text-sm text-slate-400">
          Problem
        </label>
        <select
          id="trust-problem"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="px-3 py-1.5 border border-white/10 rounded-md text-sm bg-slate-800 text-white"
        >
          {options.map((p) => (
            <option key={`${p.machine_type}|${p.defect_type}`} value={`${p.machine_type}|${p.defect_type}`}>
              {humanize(p.defect_type)} · {humanize(p.machine_type)} ({p.evidence_count} outcomes)
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-400">
          Fleet-level: scored by the same deterministic engine the analysis uses, over every recorded outcome (no machine weighting).
        </span>
      </div>

      {error && <ErrorState title="Could not score this problem" detail={error} />}
      {!data && !error && <LoadingState label="Scoring every recorded outcome for this problem…" className="py-8" />}
      {data && (
        <div className="space-y-4">
          <div className="rounded-lg bg-[#38bdf8]/10 border border-[#38bdf8]/30 p-4">
            <p className="text-xs uppercase tracking-wide text-[#38bdf8] font-semibold">TRACE would recommend</p>
            <p className="text-lg font-bold text-white">{data.recommendation.suggested_action}</p>
            <div className="mt-2">
              <ConfidenceMeter confidence={data.recommendation.confidence as Confidence} successes={winner?.successes} attempts={winner?.attempts} />
            </div>
            <p className="text-sm text-slate-300 mt-2">
              {data.recommendation.basis} Evidence: {data.evidence_count} recorded outcomes.
            </p>
          </div>
          <WhyPanel recommendation={data.recommendation} summaryLabel="Rule-based summary (this page uses no LLM)" />
        </div>
      )}
    </Section>
  );
}
