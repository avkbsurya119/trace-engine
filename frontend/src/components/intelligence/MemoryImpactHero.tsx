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
    <section aria-labelledby="impact-heading" className="bg-white rounded-xl border border-industrial-200 shadow-sm overflow-hidden">
      <div className="px-6 pt-6">
        <p className="text-xs uppercase tracking-wide font-semibold text-industrial-500">Memory impact</p>
        <h2 id="impact-heading" className="text-xl font-bold text-industrial-900 mt-1">
          Every recorded repair becomes evidence for the next technician
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4 p-6">
        <Flow title="Without TRACE memory" icon={<HelpCircle className="w-5 h-5 text-gray-500" aria-hidden />} steps={WITHOUT} muted />
        <Flow title="With TRACE memory" icon={<Brain className="w-5 h-5 text-industrial-600" aria-hidden />} steps={WITH} />
      </div>

      <div className="border-t border-gray-100 bg-gray-50/60 px-6 py-5">
        <p className="text-sm font-semibold text-industrial-900">What the recorded history shows</p>
        <p className="text-xs text-gray-500 mb-3">
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
    <div className={muted ? "rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4" : "rounded-lg border-2 border-industrial-200 bg-industrial-50/60 p-4"}>
      <p className={`flex items-center gap-2 font-semibold ${muted ? "text-gray-600" : "text-industrial-900"}`}>
        {icon}
        {title}
      </p>
      <ol className="mt-3 flex flex-wrap items-center gap-y-2">
        {steps.map((step, i) => (
          <li key={step} className="flex items-center">
            <span className={`text-sm px-3 py-1.5 rounded-md ${muted ? "bg-white text-gray-600 border border-gray-200" : "bg-white text-industrial-900 border border-industrial-200"}`}>
              {step}
            </span>
            {i < steps.length - 1 && <ArrowRight className={`w-3.5 h-3.5 mx-1 ${muted ? "text-gray-300" : "text-industrial-300"}`} aria-hidden />}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Stat({ title, group, note, highlight = false }: { title: string; group: ImpactGroup; note?: string; highlight?: boolean }) {
  return (
    <div className={highlight ? "rounded-lg bg-green-50 border border-green-200 p-4" : "rounded-lg bg-white border border-gray-200 p-4"}>
      <p className="text-xs text-gray-600">{title}</p>
      <p className={`text-3xl font-bold mt-1 ${highlight ? "text-green-800" : "text-gray-900"}`}>{formatPercent(group.success_rate)}</p>
      <p className="text-xs text-gray-600">
        worked · {group.worked} of {group.attempts} attempts · median downtime {formatHours(group.median_downtime_minutes)}
      </p>
      {note && <p className={`text-xs mt-2 ${highlight ? "text-green-800 font-medium" : "text-gray-500"}`}>{note}</p>}
    </div>
  );
}
