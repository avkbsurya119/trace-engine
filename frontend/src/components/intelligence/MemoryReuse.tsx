"use client";

import { Repeat } from "lucide-react";
import { formatDay, formatPercent, humanize } from "@/lib/utils";
import type { MemoryReuse as MemoryReuseData } from "@/types/incident";
import { Section } from "@/components/ui";
import { BarRow } from "./charts";

/** How often earlier work orders were available as evidence, and which ones carried the most weight. */
export function MemoryReuse({ reuse }: { reuse: MemoryReuseData }) {
  const total = reuse.work_orders || 1;
  const topRepair = Math.max(1, ...reuse.most_recommended_repairs.map((r) => r.times));
  const topCited = Math.max(1, ...reuse.most_cited_work_orders.map((r) => r.times));
  const shares = [
    { label: "Had earlier records of the same problem", value: reuse.with_prior_memory },
    { label: "Memory could recommend a proven fix", value: reuse.with_recommendation },
    { label: "Evidence from the same machine", value: reuse.with_same_machine_memory },
    { label: "Evidence from other machines of the type", value: reuse.with_fleet_memory },
    { label: "Only other machines had seen it (fleet learning)", value: reuse.fleet_only_memory },
  ];

  return (
    <Section icon={<Repeat className="w-5 h-5 text-industrial-600" />} title="Memory reuse" id="reuse">
      <p className="text-sm text-gray-600 -mt-2 mb-4">
        Replay of all {reuse.work_orders.toLocaleString()} work orders: what memory already held when each one was reported. Recall is
        not logged per request, so this measures what was available, not what someone clicked.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Share of work orders</p>
          {shares.map((s) => (
            <BarRow key={s.label} label={s.label} value={s.value} max={total} display={`${formatPercent(s.value / total)} · ${s.value}`} />
          ))}
        </div>
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Repairs memory recommended most often</p>
          {reuse.most_recommended_repairs.map((r) => (
            <BarRow key={r.intervention_category} label={r.intervention_category} value={r.times} max={topRepair} display={`${r.times}×`} />
          ))}
        </div>
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Past work orders cited most as evidence</p>
          {reuse.most_cited_work_orders.map((w) => (
            <BarRow
              key={w.incident_id}
              label={<span className="font-mono text-xs">{w.incident_id}</span>}
              value={w.times}
              max={topCited}
              display={`${w.times}×`}
              sub={`${w.machine_id} · ${humanize(w.defect_type)} · ${w.intervention_category ?? "-"} · ${formatDay(w.timestamp)}`}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}
