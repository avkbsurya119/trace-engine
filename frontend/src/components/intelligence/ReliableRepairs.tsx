"use client";

import { Award } from "lucide-react";
import { cn, formatPercent, humanize } from "@/lib/utils";
import type { IntelligenceReport, RepairReliability } from "@/types/incident";
import { Section } from "@/components/ui";

const SAMPLE_TONE = { strong: "bg-green-50 text-green-800", moderate: "bg-amber-50 text-amber-800", small: "bg-gray-100 text-gray-600" };

/** Repairs ranked by a conservative success rate, so a 2-for-2 fix never outranks a 12-for-14 one. */
export function ReliableRepairs({ data }: { data: IntelligenceReport["reliable_repairs"] }) {
  return (
    <Section icon={<Award className="w-5 h-5 text-industrial-600" />} title="Most reliable repairs" id="repairs">
      <p className="text-sm text-gray-600 -mt-2 mb-3">
        Ranked by reliability: {data.method} Only repairs tried at least {data.min_attempts} times are ranked;{" "}
        {data.small_sample_count} repair/problem pairs have fewer attempts and are left out rather than over-trusted.
      </p>
      <RepairTable rows={data.ranked} caption="Most reliable repairs" ranked />
      {data.least_reliable.length > 0 && (
        <>
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mt-6 mb-2">Least reliable (tried often, rarely worked)</p>
          <RepairTable rows={data.least_reliable} caption="Least reliable repairs" />
        </>
      )}
    </Section>
  );
}

function RepairTable({ rows, caption, ranked = false }: { rows: RepairReliability[]; caption: string; ranked?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b">
            {ranked && <th scope="col" className="py-1.5 pr-2 font-medium">#</th>}
            <th scope="col" className="py-1.5 pr-2 font-medium">Repair</th>
            <th scope="col" className="py-1.5 px-2 font-medium">Problem</th>
            <th scope="col" className="py-1.5 px-2 font-medium text-right">Attempts</th>
            <th scope="col" className="py-1.5 px-2 font-medium text-right text-green-700">Worked</th>
            <th scope="col" className="py-1.5 px-2 font-medium text-right text-amber-700">Partial</th>
            <th scope="col" className="py-1.5 px-2 font-medium text-right text-red-700">Failed</th>
            <th scope="col" className="py-1.5 px-2 font-medium w-36">Success rate</th>
            <th scope="col" className="py-1.5 px-2 font-medium text-right" title="95% Wilson lower bound">Reliability</th>
            <th scope="col" className="py-1.5 pl-2 font-medium">Sample</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.machine_type}|${r.defect_type}|${r.intervention_category}`} className="border-b last:border-0">
              {ranked && <td className="py-2 pr-2 text-gray-400 tabular-nums">{i + 1}</td>}
              <th scope="row" className="py-2 pr-2 text-left font-medium text-gray-900">{r.intervention_category}</th>
              <td className="py-2 px-2 text-gray-600">
                {humanize(r.defect_type)} <span className="text-xs text-gray-400">· {humanize(r.machine_type)}</span>
              </td>
              <td className="py-2 px-2 text-right tabular-nums">{r.attempts}</td>
              <td className="py-2 px-2 text-right tabular-nums text-green-700">{r.successes}</td>
              <td className="py-2 px-2 text-right tabular-nums text-amber-700">{r.partials}</td>
              <td className="py-2 px-2 text-right tabular-nums text-red-700">{r.failures}</td>
              <td className="py-2 px-2">
                <div className="flex items-center gap-2">
                  <span className="tabular-nums w-10 text-right">{formatPercent(r.success_rate)}</span>
                  <span className="flex-1 h-1.5 bg-gray-100 rounded-full" aria-hidden>
                    <span className="block h-full rounded-full bg-green-600" style={{ width: `${(r.success_rate ?? 0) * 100}%` }} />
                  </span>
                </div>
              </td>
              <td className="py-2 px-2 text-right tabular-nums font-medium">{formatPercent(r.reliability)}</td>
              <td className="py-2 pl-2">
                <span className={cn("text-xs px-1.5 py-0.5 rounded", SAMPLE_TONE[r.sample])}>{r.sample}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
