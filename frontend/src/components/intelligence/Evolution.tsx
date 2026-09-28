"use client";

import { TrendingUp } from "lucide-react";
import { formatPercent } from "@/lib/utils";
import type { EvolutionPoint } from "@/types/incident";
import { Section } from "@/components/ui";
import { MonthlyLine } from "./charts";

/** How the factory's knowledge grew, month by month (small multiples, one measure each). */
export function KnowledgeEvolution({ points, problemsCatalogued }: { points: EvolutionPoint[]; problemsCatalogued: number }) {
  const months = points.map((p) => p.month);
  const first = points[0];
  const last = points[points.length - 1];
  const panels = [
    {
      title: "Recorded outcomes in memory",
      values: points.map((p) => p.cumulative_outcomes),
      note: `${first.cumulative_outcomes} → ${last.cumulative_outcomes}`,
    },
    {
      title: `Problems TRACE can answer (of ${problemsCatalogued})`,
      values: points.map((p) => p.problems_with_fix),
      note: `${first.problems_with_fix} → ${last.problems_with_fix} have a proven fix`,
      max: problemsCatalogued,
    },
    {
      title: "Problems answered with HIGH confidence",
      values: points.map((p) => p.problems_high),
      note: `${first.problems_high} → ${last.problems_high}`,
      max: problemsCatalogued,
    },
    {
      title: "New work orders that already had memory",
      values: points.map((p) => p.memory_available_rate),
      note: `${formatPercent(first.memory_available_rate)} → ${formatPercent(last.memory_available_rate)} of the month's work orders`,
      format: (v: number) => formatPercent(v),
      max: 1,
    },
  ];

  return (
    <Section icon={<TrendingUp className="w-5 h-5 text-industrial-600" />} title="Knowledge evolution" id="evolution">
      <p className="text-sm text-gray-600 -mt-2 mb-4">
        Replayed month by month: at each month end the recommendation engine re-scored every known problem using only the outcomes
        recorded so far. TRACE gets more capable as technicians record what worked.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
        {panels.map((panel) => (
          <div key={panel.title}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-gray-900">{panel.title}</p>
              <p className="text-xs text-gray-500">{panel.note}</p>
            </div>
            <MonthlyLine months={months} values={panel.values} label={panel.title} format={panel.format} max={panel.max} height={130} />
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-4">
        Machines with history: {first.cumulative_machines} → {last.cumulative_machines}. Work orders added in the last month:{" "}
        {last.incidents} ({last.outcomes_recorded} with outcomes).
      </p>
    </Section>
  );
}
