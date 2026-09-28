"use client";

import { formatDay, formatPercent } from "@/lib/utils";
import type { ConfidenceLevel, IntelligenceOverview } from "@/types/incident";
import { CONFIDENCE_LABEL } from "@/components/ui";
import { AnimatedNumber } from "./charts";

const LEVEL_FILL: Record<ConfidenceLevel, string> = {
  HIGH: "bg-green-600",
  MEDIUM: "bg-amber-500",
  LOW: "bg-orange-500",
  INSUFFICIENT_DATA: "bg-gray-300",
};

/** Factory knowledge in numbers. Every value is computed by the backend. */
export function KnowledgeOverview({ overview }: { overview: IntelligenceOverview }) {
  const months = Math.round(overview.knowledge_age_days / 30.4);
  const cards: { label: string; value: number; format?: (n: number) => string; sub: string }[] = [
    { label: "Work orders in memory", value: overview.total_incidents, sub: `${overview.memory_entries.toLocaleString()} Hindsight memories, one per work order` },
    { label: "Machines", value: overview.machines, sub: `${overview.equipment_types} equipment types` },
    { label: "Recorded outcomes", value: overview.recorded_outcomes, sub: `${overview.unverified_repairs} not verified by the technician` },
    { label: "Repairs that worked", value: overview.successful_repairs, sub: `${overview.partial_repairs} partial · ${overview.failed_repairs} failed` },
    {
      label: "Knowledge coverage",
      value: overview.knowledge_coverage,
      format: (n) => formatPercent(n),
      sub: `${overview.problems_with_proven_fix} of ${overview.problems_catalogued} known problems have a proven fix`,
    },
    {
      label: "Knowledge age",
      value: months,
      format: (n) => `${Math.round(n)} months`,
      sub: overview.first_record ? `since ${formatDay(overview.first_record)}` : "",
    },
  ];
  const dist = overview.confidence_distribution;
  const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;

  return (
    <section aria-labelledby="overview-heading" className="space-y-4">
      <h2 id="overview-heading" className="sr-only">
        Factory knowledge overview
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className="text-2xl font-bold text-industrial-900 mt-1">
              <AnimatedNumber value={c.value} format={c.format} />
            </p>
            <p className="text-xs text-gray-500 mt-1 leading-snug">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-industrial-900">How confidently TRACE can answer each known problem today</p>
          <p className="text-xs text-gray-500">The recommendation engine scored every problem over all recorded outcomes</p>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden mt-3 gap-0.5" aria-hidden>
          {(Object.keys(dist) as ConfidenceLevel[]).map((level) =>
            dist[level] ? <div key={level} className={LEVEL_FILL[level]} style={{ width: `${(dist[level] / total) * 100}%` }} /> : null
          )}
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm">
          {(Object.keys(dist) as ConfidenceLevel[]).map((level) => (
            <li key={level} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm ${LEVEL_FILL[level]}`} aria-hidden />
              <span className="text-gray-700">{CONFIDENCE_LABEL[level]}</span>
              <span className="font-semibold text-gray-900 tabular-nums">{dist[level]}</span>
              <span className="text-gray-500">problems</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
