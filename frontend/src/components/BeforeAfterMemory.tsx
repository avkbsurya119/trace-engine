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
  X,
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 p-4">
      <div className="glass-card border border-white/15 rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl bg-[#0e1326]/95">
        {/* Header */}
        <div className="border-b border-white/10 p-6 bg-gradient-to-r from-[#38bdf8]/15 via-[#3a6cff]/10 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-[#38bdf8]/20 border border-[#38bdf8]/30 rounded-2xl text-[#38bdf8]">
                <Brain className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white tracking-tight">Before vs After Memory</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  The same incident scored twice, live: once with no memory, once with Hindsight recall
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Hero machine tabs */}
        <div className="border-b border-white/10 px-6 pt-4 bg-white/[0.01]">
          <div className="flex gap-2 flex-wrap pb-3">
            {(heroes ?? []).map((h, i) => (
              <button
                key={h.key}
                onClick={() => setActive(i)}
                className={cn(
                  "px-4 py-2 rounded-xl font-semibold text-xs tracking-wider transition-all",
                  active === i
                    ? "bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40 shadow-[0_0_12px_rgba(56,189,248,0.2)]"
                    : "text-gray-400 hover:text-white hover:bg-white/[0.05] border border-transparent"
                )}
              >
                {h.incident.machine_id} · {h.title}
              </button>
            ))}
          </div>
        </div>

        {!hero ? (
          <div className="p-16 flex flex-col items-center justify-center text-gray-400">
            {error ? (
              <p className="text-red-400">{error}</p>
            ) : (
              <>
                <Loader2 className="w-8 h-8 animate-spin text-[#38bdf8] mb-3" />
                <p className="text-xs font-mono uppercase tracking-widest text-gray-400">
                  Running live neural recall on benchmark fleet...
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Incident Info */}
            <div className="glass-card rounded-2xl p-5 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Incident Profile</h3>
                {onViewMachineMemory && (
                  <button
                    onClick={() => onViewMachineMemory(hero.incident.machine_id)}
                    className="text-xs font-semibold text-[#38bdf8] hover:underline flex items-center gap-1"
                  >
                    View {hero.incident.machine_id} memory bank →
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-gray-400">Machine:</span>
                  <span className="ml-2 font-mono font-bold text-white">{hero.incident.machine_id}</span>
                </div>
                <div>
                  <span className="text-gray-400">Problem:</span>
                  <span className="ml-2 font-semibold text-white">{humanize(hero.incident.defect_type)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-400">Symptoms:</span>
                  <span className="ml-2 text-gray-200">{hero.incident.symptoms.join(", ")}</span>
                </div>
              </div>
              <p className="text-xs text-gray-300 mt-3 pt-3 border-t border-white/10 leading-relaxed italic">{hero.story}</p>
            </div>

            {/* Before/After Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Without Memory */}
              <div className="glass-card rounded-2xl p-6 border border-white/10 bg-white/[0.02] flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-400">
                      <HelpCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-base">Without Memory</h4>
                      <p className="text-xs text-gray-500">Scored with zero historical evidence</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                        <Lightbulb className="w-3.5 h-3.5 text-gray-400" />
                        <span>Generic Guess</span>
                      </div>
                      <p className="text-gray-300 bg-white/[0.03] p-3 rounded-xl border border-white/10 text-xs leading-relaxed">
                        {hero.without_memory.suggested_action}
                      </p>
                    </div>
                    <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 text-gray-400">
                      {CONFIDENCE_LABEL[hero.without_memory.confidence]}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 uppercase tracking-wider mb-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>Basis</span>
                      </div>
                      <p className="text-gray-400 text-xs leading-relaxed">{hero.without_memory.basis}</p>
                    </div>
                  </div>
                </div>

                {/* What trial and error actually cost this machine */}
                <div className="pt-4 border-t border-white/10 mt-6">
                  <p className="text-xs font-semibold text-gray-300 mb-2">
                    Trial & error cost on {hero.incident.machine_id}:
                  </p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Failed attempts</span>
                    <span className="font-mono font-bold text-rose-400">{hero.trial_and_error.attempts_that_did_not_work}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <div className="flex items-center gap-1 text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Wasted downtime</span>
                    </div>
                    <span className="font-mono font-bold text-rose-400">{formatHours(hero.trial_and_error.downtime_minutes)}</span>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {hero.machine_history.map((h) => (
                      <div key={h.incident_id} className="flex items-center justify-between text-[11px] bg-white/[0.02] px-2 py-1 rounded-lg">
                        <span className="text-gray-400">
                          {formatDay(h.timestamp)} · {h.intervention_category}
                        </span>
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold font-mono", getOutcomeBgColor(h.action_outcome))}>
                          {h.action_outcome}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* With Memory */}
              <div className="glass-card rounded-2xl p-6 border border-[#38bdf8]/40 bg-[#38bdf8]/[0.03] shadow-[0_0_25px_rgba(56,189,248,0.08)] flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="p-2.5 bg-[#38bdf8]/20 border border-[#38bdf8]/30 rounded-xl text-[#38bdf8]">
                      <Brain className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-base">With TRACE Memory</h4>
                      <p className="text-xs text-[#38bdf8] font-mono">
                        {hero.memory_trace.incidents_recalled} past records · {hero.evidence_incidents.length} verified facts
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-[#38bdf8] uppercase tracking-wider font-semibold mb-1.5">
                        <Zap className="w-3.5 h-3.5" />
                        <span>Recommended Prescription</span>
                      </div>
                      <p className="text-white bg-[#38bdf8]/10 p-3 rounded-xl border border-[#38bdf8]/30 text-xs font-semibold leading-relaxed">
                        {hero.with_memory.suggested_action}
                      </p>
                    </div>
                    <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/30">
                      {CONFIDENCE_LABEL[hero.with_memory.confidence]}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-300 uppercase tracking-wider mb-1">
                        <History className="w-3.5 h-3.5 text-[#38bdf8]" />
                        <span>Evidence-backed rationale</span>
                      </div>
                      <p className="text-gray-300 text-xs leading-relaxed">{hero.with_memory.basis}</p>
                    </div>

                    {hero.with_memory.supporting_incidents.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 text-xs text-[#38bdf8] font-semibold mb-2">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Supporting Work Orders</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {hero.with_memory.supporting_incidents.map((id) => (
                            <span key={id} className="px-2 py-0.5 bg-white/[0.05] text-[#38bdf8] rounded-md text-[11px] font-mono border border-white/10">
                              {id}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {hero.with_memory.warnings.length > 0 && (
                      <div className="pt-2">
                        <div className="flex items-center gap-1.5 text-xs text-rose-400 font-semibold mb-1.5">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Avoid Ineffective Interventions</span>
                        </div>
                        <div className="space-y-1">
                          {hero.with_memory.warnings.slice(0, 3).map((warning, i) => (
                            <p key={i} className="text-rose-300 text-xs bg-rose-500/10 p-2 rounded-xl border border-rose-500/20">
                              {warning}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#38bdf8]/20 mt-6">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-300">Target Resolution</span>
                    <span className="font-bold text-[#38bdf8]">First-Time Fix</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Impact Summary */}
            <div className="glass-card rounded-2xl p-6 border border-[#38bdf8]/30 bg-gradient-to-r from-[#38bdf8]/15 via-[#3a6cff]/10 to-transparent">
              <h4 className="font-bold text-white text-base mb-3 flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#38bdf8]" />
                TRACE Cognitive Yield
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card rounded-xl p-4 border border-white/10">
                  <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Confidence Shift</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-gray-400 text-xs">{CONFIDENCE_LABEL[hero.without_memory.confidence]}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#38bdf8]" />
                    <span className="font-bold text-[#38bdf8] text-xs">{CONFIDENCE_LABEL[hero.with_memory.confidence]}</span>
                  </div>
                </div>
                <div className="glass-card rounded-xl p-4 border border-white/10">
                  <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Empirical Grounding</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-gray-400 text-xs">0 evidence items</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#38bdf8]" />
                    <span className="font-bold text-white text-xs">{hero.evidence_incidents.length} past work orders</span>
                  </div>
                </div>
                <div className="glass-card rounded-xl p-4 border border-white/10">
                  <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Prevented Trial & Error</p>
                  <p className="font-bold text-white text-xs mt-1.5">
                    {hero.trial_and_error.attempts_that_did_not_work} attempts, {formatHours(hero.trial_and_error.downtime_minutes)} downtime saved
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
                Both predictions are evaluated deterministically in real time; the only difference is the active recall layer powered by Hindsight. Zero hallucinations, 100% auditable evidence.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
