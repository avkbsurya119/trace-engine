"use client";

import { ArrowRight, Brain, HelpCircle } from "lucide-react";
import { formatHours, formatPercent } from "@/lib/utils";
import type { ImpactGroup, MemoryImpact } from "@/types/incident";

const WITHOUT = ["No historical evidence", "Trial and error", "Unknown confidence"];
const WITH = [
  "Historical incidents retrieved",
  "Evidence analyzed",
  "Successful repairs identified",
  "Confidence calculated",
  "Recommendation generated",
  "Future memory updated",
];

/** Why TRACE exists: the two paths, then what the recorded history shows. */
export function MemoryImpactHero({ impact }: { impact: MemoryImpact }) {
  const { followed, not_followed: differed, no_memory: none } = impact;
  const gain =
    followed.success_rate != null && differed.success_rate != null ? Math.round((followed.success_rate - differed.success_rate) * 100) : null;
  const saved =
    followed.median_downtime_minutes != null && differed.median_downtime_minutes != null
      ? differed.median_downtime_minutes - followed.median_downtime_minutes
      : null;

  return (
    <section aria-labelledby="impact-heading" className="glass-card rounded-xl border border-white/10 overflow-hidden">
      <div className="px-6 pt-6">
        <p className="text-xs uppercase tracking-wide font-semibold text-[#38bdf8]">Memory impact</p>
        <h2 id="impact-heading" className="text-xl font-bold text-white mt-1">
          Every recorded repair becomes evidence for the next technician
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4 p-6">
        <Flow title="Without TRACE memory" icon={<HelpCircle className="w-5 h-5 text-slate-400" aria-hidden />} steps={WITHOUT} muted />
        <Flow title="With TRACE memory" icon={<Brain className="w-5 h-5 text-[#38bdf8]" aria-hidden />} steps={WITH} />
      </div>

      <div className="border-t border-white/10 bg-slate-700/50 px-6 py-5">
        <p className="text-sm font-semibold text-white">What the recorded history shows</p>
        <p className="text-xs text-slate-400 mb-3">
          Replay of every past work order in time order: what memory would have recommended at that moment, compared with what the
          technician actually did.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Stat
            title="Action matched memory's recommendation"
            group={followed}
            highlight
            note={
              gain != null
                ? `${gain >= 0 ? "+" : ""}${gain} points vs a different action${saved != null && saved > 0 ? `, ${formatHours(saved)} less median downtime` : ""}`
                : undefined
            }
          />
          <Stat title="Memory had an answer, a different action was taken" group={differed} />
          <Stat
            title="No earlier record of this problem"
            group={none}
            note={`First occurrences only (n=${none.attempts}); a different mix of problems, so not a like-for-like comparison.`}
          />
        </div>
      </div>
    </section>
  );
}

function Flow({ title, icon, steps, muted = false }: { title: string; icon: React.ReactNode; steps: string[]; muted?: boolean }) {
  return (
    <div className={muted ? "rounded-lg border-2 border-dashed border-slate-500 bg-slate-700/50 p-4" : "rounded-lg border-2 border-[#38bdf8]/30 bg-[#38bdf8]/10 p-4"}>
      <p className={`flex items-center gap-2 font-semibold ${muted ? "text-slate-400" : "text-white"}`}>
        {icon}
        {title}
      </p>
      <ol className="mt-3 flex flex-wrap items-center gap-y-2">
        {steps.map((step, i) => (
          <li key={step} className="flex items-center">
            <span className={`text-sm px-3 py-1.5 rounded-md ${muted ? "bg-slate-800 text-slate-400 border border-white/10" : "bg-slate-800 text-white border border-[#38bdf8]/30"}`}>
              {step}
            </span>
            {i < steps.length - 1 && <ArrowRight className={`w-3.5 h-3.5 mx-1 ${muted ? "text-slate-500" : "text-[#38bdf8]/50"}`} aria-hidden />}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Stat({ title, group, note, highlight = false }: { title: string; group: ImpactGroup; note?: string; highlight?: boolean }) {
  return (
    <div className={highlight ? "rounded-lg bg-green-900/20 border border-green-500/30 p-4" : "rounded-lg glass-pod border border-white/10 p-4"}>
      <p className="text-xs text-slate-400">{title}</p>
      <p className={`text-3xl font-bold mt-1 ${highlight ? "text-green-300" : "text-white"}`}>{formatPercent(group.success_rate)}</p>
      <p className="text-xs text-slate-400">
        worked · {group.worked} of {group.attempts} attempts · median downtime {formatHours(group.median_downtime_minutes)}
      </p>
      {note && <p className={`text-xs mt-2 ${highlight ? "text-green-300 font-medium" : "text-slate-400"}`}>{note}</p>}
    </div>
  );
}
