"use client";

import { ArrowRight, GitCommitVertical } from "lucide-react";
import { cn, formatDay, humanize } from "@/lib/utils";
import type { ConfidenceLevel, KnowledgeChange } from "@/types/incident";
import { CONFIDENCE_LABEL, OutcomePill, Section } from "@/components/ui";

const ORDER: Record<ConfidenceLevel, number> = { INSUFFICIENT_DATA: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
const TONE: Record<ConfidenceLevel, string> = {
  HIGH: "bg-green-900/20 text-green-300",
  MEDIUM: "bg-amber-900/20 text-amber-300",
  LOW: "bg-orange-900/20 text-orange-300",
  INSUFFICIENT_DATA: "bg-slate-700/50 text-slate-300",
};

/** Knowledge before -> work order recorded -> knowledge after, for the latest changes. */
export function KnowledgeChanges({ changes }: { changes: KnowledgeChange[] }) {
  if (changes.length === 0) return null;
  // Illustrate with the latest change that strengthened knowledge; the list shows both directions.
  const example = changes.find((c) => ORDER[c.confidence_after] > ORDER[c.confidence_before]) ?? changes[0];

  return (
    <Section icon={<GitCommitVertical className="w-5 h-5 text-[#38bdf8]" />} title="Memory growth: every outcome changes what TRACE knows" id="growth">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-3 mb-5">
        <Stage title="Knowledge before" body={<Level level={example.confidence_before} />} sub={`${humanize(example.defect_type)} · ${humanize(example.machine_type)}`} />
        <ArrowRight className="hidden md:block w-5 h-5 text-slate-500" aria-hidden />
        <Stage
          title="Work order recorded"
          body={
            <span className="text-sm">
              {example.incident_id} · {example.intervention_category} <OutcomePill outcome={example.outcome} className="ml-1" />
            </span>
          }
          sub={`${example.machine_id} · ${formatDay(example.timestamp)}`}
        />
        <ArrowRight className="hidden md:block w-5 h-5 text-slate-500" aria-hidden />
        <Stage
          title="Knowledge after"
          body={<Level level={example.confidence_after} />}
          sub={`${example.evidence_after} outcomes · recommends ${example.recommended_after ?? "nothing yet"}`}
        />
      </div>

      <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">Latest changes in confidence</p>
      <ul className="divide-y divide-white/10">
        {changes.map((c) => {
          const up = ORDER[c.confidence_after] > ORDER[c.confidence_before];
          return (
            <li key={c.incident_id} className="py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className={cn("text-xs font-semibold w-16", up ? "text-green-400" : "text-orange-400")}>{up ? "Stronger" : "Weaker"}</span>
              <span className="font-medium text-white">{humanize(c.defect_type)}</span>
              <span className="text-slate-400">{humanize(c.machine_type)}</span>
              <span className="flex items-center gap-1">
                <Level level={c.confidence_before} small />
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" aria-label="to" />
                <Level level={c.confidence_after} small />
              </span>
              <span className="text-slate-400">
                after {c.incident_id} ({c.intervention_category}, <OutcomePill outcome={c.outcome} />)
              </span>
              <span className="text-xs text-slate-500 ml-auto">{formatDay(c.timestamp)}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-slate-400 mt-2">
        Failed or partial repairs lower confidence too; TRACE never hides evidence against a fix.
      </p>
    </Section>
  );
}

function Stage({ title, body, sub }: { title: string; body: React.ReactNode; sub: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-700/50 p-3">
      <p className="text-xs text-slate-400">{title}</p>
      <div className="mt-1">{body}</div>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  );
}

function Level({ level, small = false }: { level: ConfidenceLevel; small?: boolean }) {
  return <span className={cn("rounded font-medium", small ? "text-xs px-1.5 py-0.5" : "text-sm px-2 py-0.5", TONE[level])}>{CONFIDENCE_LABEL[level]}</span>;
}
