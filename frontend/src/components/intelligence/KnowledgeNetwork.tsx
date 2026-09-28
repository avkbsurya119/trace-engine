"use client";

import { useMemo, useState } from "react";
import { Network } from "lucide-react";
import { cn, humanize } from "@/lib/utils";
import type { IntelligenceReport } from "@/types/incident";
import { Section } from "@/components/ui";

type Column = "machine" | "problem" | "repair" | "outcome";
interface Node {
  id: string;
  column: Column;
  label: string;
  value: number;
  detail: string;
  recommended?: boolean;
}
interface Edge {
  from: string;
  to: string;
  value: number;
}

const COLUMNS: { key: Column; title: string }[] = [
  { key: "machine", title: "Machines" },
  { key: "problem", title: "Problems" },
  { key: "repair", title: "Repairs tried" },
  { key: "outcome", title: "Outcomes" },
];
const OUTCOME_FILL: Record<string, string> = { SUCCESS: "#15803d", PARTIAL: "#d97706", FAILED: "#dc2626" };
const OUTCOME_LABEL: Record<string, string> = { SUCCESS: "Worked", PARTIAL: "Partial", FAILED: "Failed" };

/**
 * How the factory's memory is connected for one equipment type:
 * machine -> problem it had -> repairs tried -> what happened.
 * Edge width is the number of work orders; repairs TRACE currently
 * recommends for some problem are marked.
 */
export function KnowledgeNetwork({ report }: { report: IntelligenceReport }) {
  const types = report.network.map((n) => n.machine_type);
  const [type, setType] = useState(types[0] ?? "");
  const [focus, setFocus] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => build(report, type), [report, type]);
  const byColumn = COLUMNS.map((c) => nodes.filter((n) => n.column === c.key));
  const rows = Math.max(...byColumn.map((c) => c.length), 1);
  const W = 1000;
  const rowH = 30;
  const H = rows * rowH + 40;
  const colX = [110, 400, 690, 930];
  const pos = new Map<string, { x: number; y: number }>();
  byColumn.forEach((col, ci) => {
    const offset = ((rows - col.length) * rowH) / 2;
    col.forEach((n, i) => pos.set(n.id, { x: colX[ci], y: 36 + offset + i * rowH }));
  });
  const maxEdge = Math.max(1, ...edges.map((e) => e.value));
  const connected = focus ? new Set(edges.filter((e) => e.from === focus || e.to === focus).flatMap((e) => [e.from, e.to])) : null;
  const focused = nodes.find((n) => n.id === focus);

  return (
    <Section icon={<Network className="w-5 h-5 text-industrial-600" />} title="Knowledge network" id="network">
      <div className="flex flex-wrap items-center gap-2 -mt-2 mb-3" role="group" aria-label="Equipment type">
        {report.network.map((n) => (
          <button
            key={n.machine_type}
            type="button"
            aria-pressed={type === n.machine_type}
            onClick={() => {
              setType(n.machine_type);
              setFocus(null);
            }}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border",
              type === n.machine_type ? "bg-industrial-600 text-white border-industrial-600" : "border-gray-200 text-gray-700 hover:bg-gray-50"
            )}
          >
            {humanize(n.label)}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 mb-2">
        Hover or tab to a node to trace its connections. Line width = number of work orders. ★ = what TRACE currently recommends for a problem.
      </p>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[720px] h-auto" role="group" aria-label={`Knowledge network for ${humanize(type)}`}>
          {COLUMNS.map((c, i) => (
            <text key={c.key} x={colX[i]} y={16} textAnchor="middle" fontSize={12} fontWeight={600} fill="#374151">
              {c.title}
            </text>
          ))}
          {edges.map((e) => {
            const a = pos.get(e.from)!;
            const b = pos.get(e.to)!;
            const lit = !focus || e.from === focus || e.to === focus;
            const mid = (a.x + b.x) / 2;
            return (
              <path
                key={`${e.from}>${e.to}`}
                d={`M${a.x + 70},${a.y} C${mid},${a.y} ${mid},${b.y} ${b.x - 70},${b.y}`}
                fill="none"
                stroke={focus && lit ? "#466968" : "#cbd5d4"}
                strokeOpacity={lit ? 0.85 : 0.15}
                strokeWidth={1 + (e.value / maxEdge) * 7}
              />
            );
          })}
          {nodes.map((n) => {
            const p = pos.get(n.id)!;
            const dim = connected && !connected.has(n.id);
            const fill = n.column === "outcome" ? OUTCOME_FILL[n.id.split(":")[1]] : n.id === focus ? "#466968" : "#ffffff";
            const text = n.column === "outcome" || n.id === focus ? "#ffffff" : "#1f2937";
            return (
              <g
                key={n.id}
                tabIndex={0}
                role="button"
                aria-label={`${n.label}: ${n.detail}`}
                onMouseEnter={() => setFocus(n.id)}
                onFocus={() => setFocus(n.id)}
                onMouseLeave={() => setFocus(null)}
                onBlur={() => setFocus(null)}
                opacity={dim ? 0.3 : 1}
                style={{ cursor: "default", outline: "none" }}
              >
                <rect x={p.x - 70} y={p.y - 11} width={140} height={22} rx={6} fill={fill} stroke="#9fb5b3" strokeWidth={1} />
                <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={11} fill={text}>
                  {n.recommended ? "★ " : ""}
                  {n.label.length > 20 ? `${n.label.slice(0, 19)}…` : n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="min-h-[2.5rem] mt-2 text-sm text-gray-700" aria-live="polite">
        {focused ? (
          <p>
            <strong>{focused.label}</strong>: {focused.detail}
          </p>
        ) : (
          <p className="text-gray-400">Select a node to see its numbers.</p>
        )}
      </div>

      <div className="sr-only">
        <h4>Network as text</h4>
        <ul>
          {edges.map((e) => (
            <li key={`${e.from}>${e.to}`}>
              {nodes.find((n) => n.id === e.from)?.label} to {nodes.find((n) => n.id === e.to)?.label}: {e.value} work orders
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function build(report: IntelligenceReport, type: string): { nodes: Node[]; edges: Edge[] } {
  const net = report.network.find((n) => n.machine_type === type);
  if (!net) return { nodes: [], edges: [] };
  const recommended = new Set(report.problems.filter((p) => p.machine_type === type && p.recommended).map((p) => p.recommended!));
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  for (const m of report.machines.filter((m) => m.machine_type === type)) {
    nodes.push({ id: `m:${m.machine_id}`, column: "machine", label: m.machine_id, value: m.incidents, detail: `${m.incidents} work orders, ${m.problems_with_proven_fix_here} problems with a proven fix here` });
    for (const p of m.problems) edges.push({ from: `m:${m.machine_id}`, to: `p:${p.defect_type}`, value: p.occurrences });
  }

  const repairs = new Map<string, { attempts: number; successes: number; failures: number; partials: number }>();
  for (const p of net.problems) {
    nodes.push({ id: `p:${p.defect_type}`, column: "problem", label: humanize(p.defect_type), value: p.occurrences, detail: `${p.occurrences} work orders with a recorded outcome` });
    for (const r of p.repairs) {
      edges.push({ from: `p:${p.defect_type}`, to: `r:${r.intervention_category}`, value: r.attempts + 0 });
      const agg = repairs.get(r.intervention_category) ?? { attempts: 0, successes: 0, failures: 0, partials: 0 };
      agg.attempts += r.attempts;
      agg.successes += r.successes;
      agg.failures += r.failures;
      agg.partials += r.partials;
      repairs.set(r.intervention_category, agg);
    }
  }
  // Problems a machine had but with no repair in the top list still need a node.
  const problemIds = new Set(nodes.filter((n) => n.column === "problem").map((n) => n.id));
  for (const e of edges) {
    if (e.to.startsWith("p:") && !problemIds.has(e.to)) {
      problemIds.add(e.to);
      nodes.push({ id: e.to, column: "problem", label: humanize(e.to.slice(2)), value: 0, detail: "no repairs recorded" });
    }
  }

  const outcomeTotals = { SUCCESS: 0, PARTIAL: 0, FAILED: 0 };
  for (const [name, r] of Array.from(repairs.entries()).sort((a, b) => b[1].attempts - a[1].attempts)) {
    nodes.push({
      id: `r:${name}`,
      column: "repair",
      label: name,
      value: r.attempts,
      recommended: recommended.has(name),
      detail: `${r.attempts} attempts: ${r.successes} worked, ${r.partials} partial, ${r.failures} failed${recommended.has(name) ? " · currently recommended for a problem" : ""}`,
    });
    const split: [keyof typeof outcomeTotals, number][] = [["SUCCESS", r.successes], ["PARTIAL", r.partials], ["FAILED", r.failures]];
    for (const [outcome, n] of split) {
      if (n) edges.push({ from: `r:${name}`, to: `o:${outcome}`, value: n });
      outcomeTotals[outcome] += n;
    }
  }
  for (const outcome of ["SUCCESS", "PARTIAL", "FAILED"] as const) {
    nodes.push({ id: `o:${outcome}`, column: "outcome", label: OUTCOME_LABEL[outcome], value: outcomeTotals[outcome], detail: `${outcomeTotals[outcome]} attempts` });
  }
  return { nodes, edges: edges.filter((e) => e.value > 0) };
}
