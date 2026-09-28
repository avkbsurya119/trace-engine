"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Cpu } from "lucide-react";
import { cn, formatPercent, humanize } from "@/lib/utils";
import type { MachineIntelligence } from "@/types/incident";
import { CONFIDENCE_LABEL, Section } from "@/components/ui";

const TONE = {
  HIGH: "bg-green-100 text-green-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  LOW: "bg-orange-100 text-orange-800",
  INSUFFICIENT_DATA: "bg-gray-100 text-gray-700",
} as const;

/**
 * Machines ranked by how much proven knowledge TRACE holds for them:
 * problems with a fix that worked on that machine, then verified outcomes,
 * then success rate. Click a row for the machine's knowledge per problem.
 */
export function MachineRanking({ machines, onOpenMachine }: { machines: MachineIntelligence[]; onOpenMachine: (id: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? machines : machines.slice(0, 10);

  return (
    <Section icon={<Cpu className="w-5 h-5 text-industrial-600" />} title="Machine intelligence ranking" id="machines">
      <p className="text-sm text-gray-600 -mt-2 mb-3">
        Ranked by problems with a fix proven on that machine, then verified outcomes, then success rate. Completeness is the share
        of its work orders with a verified outcome (worked, partial or failed).
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Machines ranked by accumulated knowledge</caption>
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th scope="col" className="py-1.5 pr-2 font-medium">#</th>
              <th scope="col" className="py-1.5 pr-2 font-medium">Machine</th>
              <th scope="col" className="py-1.5 px-2 font-medium text-right">Proven fixes</th>
              <th scope="col" className="py-1.5 px-2 font-medium text-right">Work orders</th>
              <th scope="col" className="py-1.5 px-2 font-medium text-right">Verified</th>
              <th scope="col" className="py-1.5 px-2 font-medium text-right">Worked</th>
              <th scope="col" className="py-1.5 px-2 font-medium text-right">Completeness</th>
              <th scope="col" className="py-1.5 px-2 font-medium text-right">Downtime</th>
              <th scope="col" className="py-1.5 pl-2 font-medium"><span className="sr-only">Details</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const isOpen = open === m.machine_id;
              return (
                <MachineRow key={m.machine_id} machine={m} isOpen={isOpen} onToggle={() => setOpen(isOpen ? null : m.machine_id)} onOpenMachine={onOpenMachine} />
              );
            })}
          </tbody>
        </table>
      </div>
      {machines.length > 10 && (
        <button type="button" onClick={() => setShowAll(!showAll)} className="mt-3 text-sm text-industrial-600 hover:text-industrial-800">
          {showAll ? "Show top 10" : `Show all ${machines.length} machines`}
        </button>
      )}
    </Section>
  );
}

function MachineRow({
  machine: m,
  isOpen,
  onToggle,
  onOpenMachine,
}: {
  machine: MachineIntelligence;
  isOpen: boolean;
  onToggle: () => void;
  onOpenMachine: (id: string) => void;
}) {
  const panelId = `machine-intel-${m.machine_id}`;
  return (
    <>
      <tr className={cn("border-b", isOpen && "bg-industrial-50/50")}>
        <td className="py-2 pr-2 text-gray-400 tabular-nums">{m.rank}</td>
        <th scope="row" className="py-2 pr-2 text-left">
          <span className="font-medium text-gray-900">{m.machine_id}</span>
          <span className="block text-xs font-normal text-gray-500">
            {humanize(m.machine_type)} · {m.production_line}
          </span>
        </th>
        <td className="py-2 px-2 text-right tabular-nums font-medium">
          {m.problems_with_proven_fix_here} / {m.problems_seen}
        </td>
        <td className="py-2 px-2 text-right tabular-nums">{m.incidents}</td>
        <td className="py-2 px-2 text-right tabular-nums">{m.verified_outcomes}</td>
        <td className="py-2 px-2 text-right tabular-nums">{formatPercent(m.success_rate)}</td>
        <td className="py-2 px-2 text-right tabular-nums">{formatPercent(m.memory_completeness)}</td>
        <td className="py-2 px-2 text-right tabular-nums">{m.downtime_hours} h</td>
        <td className="py-2 pl-2 text-right">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-controls={panelId}
            aria-label={`${isOpen ? "Hide" : "Show"} knowledge for ${m.machine_id}`}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
          >
            {isOpen ? <ChevronUp className="w-4 h-4" aria-hidden /> : <ChevronDown className="w-4 h-4" aria-hidden />}
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr id={panelId} className="border-b bg-industrial-50/30">
          <td />
          <td colSpan={8} className="py-3 pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {m.problems.map((p) => (
                <div key={p.defect_type} className="rounded-md bg-white border border-gray-200 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-900">
                      {humanize(p.defect_type)} <span className="text-gray-500 font-normal">· {p.occurrences}× here</span>
                    </span>
                    <span className={cn("text-xs px-1.5 py-0.5 rounded", TONE[p.confidence])}>{CONFIDENCE_LABEL[p.confidence]}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    TRACE would recommend: <strong>{p.recommended ?? "nothing (no proven fix)"}</strong> · from {p.fleet_evidence} outcomes fleet-wide
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Proven on {m.machine_id}: {p.proven_here.length ? p.proven_here.join(", ") : "none yet"}
                  </p>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => onOpenMachine(m.machine_id)} className="mt-3 text-sm font-medium text-industrial-600 hover:text-industrial-800">
              Open {m.machine_id} memory timeline →
            </button>
          </td>
        </tr>
      )}
    </>
  );
}
