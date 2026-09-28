"use client";

import { Activity } from "lucide-react";
import { humanize } from "@/lib/utils";
import type { FailurePatterns as FailurePatternsData } from "@/types/incident";
import { Section } from "@/components/ui";
import { BarRow, Sparkline } from "./charts";

/** Which problems happen most, where, how often they return, and how their frequency changed. */
export function FailurePatterns({ data }: { data: FailurePatternsData }) {
  const top = Math.max(1, ...data.top_problems.map((p) => p.occurrences));
  return (
    <Section icon={<Activity className="w-5 h-5 text-[#38bdf8]" />} title="Failure pattern intelligence" id="failures">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="text-left text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">Most common problems</caption>
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-white/10">
                <th scope="col" className="py-1.5 pr-2 font-medium">Problem</th>
                <th scope="col" className="py-1.5 px-2 font-medium w-40">Work orders</th>
                <th scope="col" className="py-1.5 px-2 font-medium text-right">Machines</th>
                <th scope="col" className="py-1.5 px-2 font-medium">Outcomes (worked / partial / failed)</th>
                <th scope="col" className="py-1.5 pl-2 font-medium">Trend</th>
              </tr>
            </thead>
            <tbody>
              {data.top_problems.map((p) => (
                <tr key={`${p.machine_type}|${p.defect_type}`} className="border-b border-white/10 last:border-0">
                  <th scope="row" className="py-2 pr-2 text-left font-medium text-white">
                    {humanize(p.defect_type)} <span className="block text-xs font-normal text-slate-400">{humanize(p.machine_type)}</span>
                  </th>
                  <td className="py-2 px-2">
                    <BarRow label="" value={p.occurrences} max={top} />
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">{p.machines_affected}</td>
                  <td className="py-2 px-2 text-xs tabular-nums">
                    <span className="text-green-400">{p.outcomes.SUCCESS ?? 0}</span> /{" "}
                    <span className="text-amber-400">{p.outcomes.PARTIAL ?? 0}</span> /{" "}
                    <span className="text-red-400">{p.outcomes.FAILED ?? 0}</span>
                  </td>
                  <td className="py-2 pl-2">{p.monthly ? <Sparkline values={p.monthly} label={`${humanize(p.defect_type)} per month`} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">Recurring on the same machine (≥ 3 times)</p>
            <ul className="space-y-1.5 text-sm">
              {data.recurring.slice(0, 8).map((r) => (
                <li key={`${r.machine_id}|${r.defect_type}`} className="flex justify-between gap-2">
                  <span>
                    <span className="font-medium text-white">{r.machine_id}</span> · {humanize(r.defect_type)}
                  </span>
                  <span className="tabular-nums text-slate-300">{r.occurrences}×</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">By equipment type</p>
            <ul className="space-y-2 text-sm">
              {data.by_equipment_type.map((t) => (
                <li key={t.machine_type}>
                  <span className="font-medium text-white">{humanize(t.machine_type)}</span>{" "}
                  <span className="text-slate-400">· {t.incidents} work orders</span>
                  <span className="block text-xs text-slate-400">
                    {t.problems.slice(0, 3).map((p) => `${humanize(p.defect_type)} (${p.occurrences})`).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Section>
  );
}
