"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn, formatDay, formatHours, getOutcomeBgColor, humanize } from "@/lib/utils";
import type { HeroMachine } from "@/types/incident";
import {
  Brain,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Lightbulb,
  History,
  Zap,
  ArrowRight,
  HelpCircle,
  Loader2,
} from "lucide-react";

interface Props {
  onClose: () => void;
  onViewMachineMemory?: (machineId: string) => void;
}

const CONFIDENCE_LABEL: Record<string, string> = {
  HIGH: "HIGH confidence",
  MEDIUM: "MEDIUM confidence",
  LOW: "LOW confidence",
  INSUFFICIENT_DATA: "Insufficient evidence",
};

export function BeforeAfterMemory({ onClose, onViewMachineMemory }: Props) {
  const [heroes, setHeroes] = useState<HeroMachine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    api
      .getHeroMachines()
      .then((data) => setHeroes(data.hero_machines))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  const hero = heroes?.[active];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-industrial-600 to-industrial-700 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">Before vs After Memory</h2>
                <p className="text-industrial-200">
                  The same incident scored twice, live: once with no memory, once with Hindsight recall
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white text-2xl">
              &times;
            </button>
          </div>
        </div>

        {/* Hero machine tabs */}
        <div className="border-b border-gray-200 px-6 pt-4">
          <div className="flex gap-2 flex-wrap">
            {(heroes ?? []).map((h, i) => (
              <button
                key={h.key}
                onClick={() => setActive(i)}
                className={cn(
                  "px-4 py-2 rounded-t-lg font-medium text-sm transition-colors",
                  active === i
                    ? "bg-industrial-100 text-industrial-800 border-b-2 border-industrial-600"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                )}
              >
                {h.incident.machine_id} · {h.title}
              </button>
            ))}
          </div>
        </div>

        {!hero ? (
          <div className="p-12 flex flex-col items-center text-gray-500">
            {error ? (
              <p className="text-red-700">{error}</p>
            ) : (
              <>
                <Loader2 className="w-8 h-8 animate-spin mb-3" />
                <p className="text-sm">Running recall and scoring for the hero machines...</p>
              </>
            )}
          </div>
        ) : (
          <div className="p-6">
            {/* Incident Info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">Incident Report</h3>
                {onViewMachineMemory && (
                  <button
                    onClick={() => onViewMachineMemory(hero.incident.machine_id)}
                    className="text-sm text-industrial-600 hover:text-industrial-800"
                  >
                    {hero.incident.machine_id} memory →
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Machine:</span>
                  <span className="ml-2 font-medium">{hero.incident.machine_id}</span>
                </div>
                <div>
                  <span className="text-gray-500">Problem:</span>
                  <span className="ml-2 font-medium">{humanize(hero.incident.defect_type)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Symptoms:</span>
                  <span className="ml-2 font-medium">{hero.incident.symptoms.join(", ")}</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">{hero.story}</p>
            </div>

            {/* Before/After Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Without Memory */}
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 bg-gray-50">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-gray-200 rounded-lg">
                    <HelpCircle className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-700">Without Memory</h4>
                    <p className="text-xs text-gray-500">Scored with no historical evidence</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <Lightbulb className="w-4 h-4" />
                      <span>Recommendation</span>
                    </div>
                    <p className="text-gray-700 bg-white p-3 rounded-lg border border-gray-200 text-sm">
                      {hero.without_memory.suggested_action}
                    </p>
                  </div>
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                    {CONFIDENCE_LABEL[hero.without_memory.confidence]}
                  </span>
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Basis</span>
                    </div>
                    <p className="text-gray-600 text-sm">{hero.without_memory.basis}</p>
                  </div>

                  {/* What trial and error actually cost this machine */}
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      What trial and error cost {hero.incident.machine_id} on this problem
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Attempts that didn&apos;t work</span>
                      <span className="font-medium text-gray-800">{hero.trial_and_error.attempts_that_did_not_work}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Clock className="w-4 h-4" />
                        <span>Downtime on those attempts</span>
                      </div>
                      <span className="font-medium text-gray-800">{formatHours(hero.trial_and_error.downtime_minutes)}</span>
                    </div>
                    <div className="mt-3 space-y-1">
                      {hero.machine_history.map((h) => (
                        <div key={h.incident_id} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">
                            {formatDay(h.timestamp)} · {h.intervention_category}
                          </span>
                          <span className={cn("px-1.5 py-0.5 rounded", getOutcomeBgColor(h.action_outcome))}>
                            {h.action_outcome}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* With Memory */}
              <div className="border-2 border-green-200 rounded-xl p-6 bg-green-50">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-green-200 rounded-lg">
                    <Brain className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-green-800">With Memory</h4>
                    <p className="text-xs text-green-600">
                      {hero.memory_trace.incidents_recalled} work orders recalled ·{" "}
                      {hero.evidence_incidents.length} kept as evidence
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-green-700 mb-1">
                      <Zap className="w-4 h-4" />
                      <span>Recommendation</span>
                    </div>
                    <p className="text-green-900 bg-white p-3 rounded-lg border border-green-200 text-sm font-medium">
                      {hero.with_memory.suggested_action}
                    </p>
                  </div>
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-green-200 text-green-800">
                    {CONFIDENCE_LABEL[hero.with_memory.confidence]}
                  </span>
                  <div>
                    <div className="flex items-center gap-2 text-sm text-green-700 mb-1">
                      <History className="w-4 h-4" />
                      <span>Evidence-based basis (computed)</span>
                    </div>
                    <p className="text-green-800 text-sm">{hero.with_memory.basis}</p>
                  </div>

                  {hero.with_memory.supporting_incidents.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 text-sm text-green-700 mb-2">
                        <CheckCircle className="w-4 h-4" />
                        <span>Supporting incidents</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {hero.with_memory.supporting_incidents.map((id) => (
                          <span key={id} className="px-2 py-1 bg-white text-green-700 rounded text-xs border border-green-200">
                            {id}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {hero.with_memory.warnings.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 text-sm text-amber-700 mb-2">
                        <XCircle className="w-4 h-4" />
                        <span>What didn&apos;t work</span>
                      </div>
                      <div className="space-y-1">
                        {hero.with_memory.warnings.slice(0, 3).map((warning, i) => (
                          <p key={i} className="text-amber-700 text-xs bg-amber-50 p-2 rounded border border-amber-200">
                            {warning}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Impact Summary */}
            <div className="mt-6 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-6 text-white">
              <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Memory Impact
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/10 rounded-lg p-4">
                  <p className="text-green-200 text-sm">Confidence</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-white/60">{CONFIDENCE_LABEL[hero.without_memory.confidence]}</span>
                    <ArrowRight className="w-4 h-4" />
                    <span className="font-bold">{CONFIDENCE_LABEL[hero.with_memory.confidence]}</span>
                  </div>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <p className="text-green-200 text-sm">Evidence behind the answer</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-white/60">0 work orders</span>
                    <ArrowRight className="w-4 h-4" />
                    <span className="font-bold">{hero.evidence_incidents.length} work orders</span>
                  </div>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <p className="text-green-200 text-sm">Past trial and error on this machine</p>
                  <p className="font-bold mt-1">
                    {hero.trial_and_error.attempts_that_did_not_work} attempt(s),{" "}
                    {formatHours(hero.trial_and_error.downtime_minutes)} downtime
                  </p>
                </div>
              </div>
              <p className="text-xs text-green-100 mt-4">
                Both sides are computed now by the same deterministic scorer; the only difference is whether Hindsight recall
                supplies evidence. Nothing here is stored.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
