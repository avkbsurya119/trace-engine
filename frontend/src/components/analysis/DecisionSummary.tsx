"use client";

import { CheckCircle, XCircle, MinusCircle, Brain, ShieldOff, Search, Database, Filter, ClipboardEdit } from "lucide-react";
import { humanize } from "@/lib/utils";
import type { AnalysisResult } from "@/types/incident";
import { ConfidenceMeter, type Confidence } from "@/components/ui";

/**
 * First thing on the analysis page: the recommendation (or the explicit
 * decision to withhold one) and what memory contributed to it.
 */
export function DecisionSummary({ result }: { result: AnalysisResult }) {
  const { recommendation, current_incident, historical_incidents, memory_trace } = result;
  const winner = recommendation.evidence.find((e) => e.verdict === "selected");

  if (!recommendation.intervention_category) {
    return <WithheldRecommendation result={result} />;
  }

  const sameMachine = historical_incidents.filter((h) => h.incident.machine_id === current_incident.machine_id).length;

  return (
    <section aria-label="Recommendation" className="glass-card overflow-hidden">
      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <p className="text-xs uppercase tracking-wide text-[#38bdf8] font-semibold">TRACE recommends</p>
          <p className="text-2xl font-bold text-white mt-1">{recommendation.suggested_action}</p>
          {winner && (
            <p className="text-sm text-slate-300 mt-1">
              Most recent successful instance: "{winner.example_action}"
              {recommendation.supporting_incidents[0] ? ` (${recommendation.supporting_incidents[0]})` : ""}
            </p>
          )}
          <div className="mt-4">
            <ConfidenceMeter
              confidence={recommendation.confidence as Confidence}
              successes={winner?.successes}
              attempts={winner?.attempts}
            />
          </div>
          <p className="text-sm text-slate-200 mt-3">{recommendation.basis}</p>
          <p className="text-xs text-slate-400 mt-1">
            Chosen by deterministic scoring of recorded outcomes. The AI only writes the summary below.
          </p>
        </div>

        <div className="glass-pod p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <Brain className="w-4 h-4 text-[#38bdf8]" aria-hidden />
            What memory contributed
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <Stat label="Past work orders recalled" value={memory_trace.incidents_recalled ?? 0} />
            <Stat label="Kept as evidence" value={historical_incidents.length} />
            <Stat label={`From ${current_incident.machine_id} itself`} value={sameMachine} />
          </dl>
          {winner && (
            <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-white/10 text-sm">
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle className="w-4 h-4" aria-hidden /> {winner.successes} worked
              </span>
              <span className="flex items-center gap-1 text-red-400">
                <XCircle className="w-4 h-4" aria-hidden /> {winner.failures} failed
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <MinusCircle className="w-4 h-4" aria-hidden /> {winner.partials} partial
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-semibold text-white tabular-nums">{value}</dd>
    </div>
  );
}

/** Shown when TRACE has no reliable evidence: what was searched and why nothing is recommended. */
function WithheldRecommendation({ result }: { result: AnalysisResult }) {
  const { current_incident, memory_trace, recommendation } = result;
  const everFailed = recommendation.evidence.length > 0;
  const steps = [
    {
      icon: Database,
      title: `Searched ${current_incident.machine_id}'s own history`,
      detail: `${memory_trace.same_machine_facts ?? 0} memory facts recalled`,
    },
    {
      icon: Search,
      title: `Searched the fleet of ${humanize(current_incident.machine_type)}s`,
      detail: `${memory_trace.fleet_facts ?? 0} memory facts from ${memory_trace.incidents_recalled ?? 0} past work orders`,
    },
    {
      icon: Filter,
      title: "Kept only reliable evidence",
      detail: everFailed
        ? `${result.historical_incidents.length} similar incident(s), but no intervention has a recorded success`
        : `none describes "${humanize(current_incident.defect_type)}" with a recorded outcome (${memory_trace.relevance_rule})`,
    },
  ];

  return (
    <section aria-label="Recommendation withheld" className="glass-card border-2 border-dashed border-slate-600 p-6">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-slate-700/50 rounded-full" aria-hidden>
          <ShieldOff className="w-7 h-7 text-slate-400" />
        </div>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Recommendation intentionally withheld</p>
          <h3 className="text-xl font-bold text-white mt-1">
            TRACE has no reliable evidence for this problem, so it will not guess.
          </h3>
          <ol className="mt-4 space-y-2">
            {steps.map(({ icon: Icon, title, detail }) => (
              <li key={title} className="flex items-start gap-3 text-sm">
                <Icon className="w-4 h-4 mt-0.5 text-[#38bdf8] flex-shrink-0" aria-hidden />
                <span>
                  <span className="font-medium text-white">{title}</span>
                  <span className="text-slate-400"> · {detail}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex items-start gap-3 bg-[#38bdf8]/10 border border-[#38bdf8]/20 rounded-xl p-3 text-sm text-slate-200">
            <ClipboardEdit className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#38bdf8]" aria-hidden />
            <p>
              Diagnose on site, then <strong className="text-white">record what you did and whether it worked</strong> below. The next time this
              problem is reported, TRACE will recall your work order as evidence.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
