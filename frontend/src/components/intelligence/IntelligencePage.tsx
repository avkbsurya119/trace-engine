"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Brain, Loader2, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { IntelligenceReport } from "@/types/incident";
import { KnowledgeOverview } from "./Overview";
import { MemoryImpactHero } from "./MemoryImpactHero";
import { KnowledgeEvolution } from "./Evolution";
import { KnowledgeChanges } from "./KnowledgeChanges";
import { MemoryReuse } from "./MemoryReuse";
import { TrustPanel } from "./TrustPanel";
import { ReliableRepairs } from "./ReliableRepairs";
import { FailurePatterns } from "./FailurePatterns";
import { MachineRanking } from "./MachineRanking";

// The network is the heaviest visual and sits at the bottom: load it on demand.
const KnowledgeNetwork = dynamic(() => import("./KnowledgeNetwork").then((m) => m.KnowledgeNetwork), {
  ssr: false,
  loading: () => <p className="text-sm text-gray-500 p-6">Loading knowledge network…</p>,
});

const SECTIONS = [
  ["impact", "Memory impact"],
  ["evolution", "Evolution"],
  ["growth", "Memory growth"],
  ["reuse", "Reuse"],
  ["trust", "Trust"],
  ["repairs", "Reliable repairs"],
  ["failures", "Failure patterns"],
  ["machines", "Machines"],
  ["network", "Network"],
] as const;

/**
 * TRACE Intelligence: the factory's accumulated memory, computed by the backend
 * from recorded work orders and the deterministic recommendation engine.
 */
export function IntelligencePage({ onViewMachineMemory }: { onViewMachineMemory: (machineId: string) => void }) {
  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = (refresh = false) => {
    setError(null);
    setRefreshing(refresh);
    api
      .getIntelligence({ refresh })
      .then(setReport)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setRefreshing(false));
  };

  useEffect(() => load(), []);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide font-semibold text-industrial-500">
            <Brain className="w-4 h-4" aria-hidden /> TRACE Intelligence
          </p>
          <h2 className="text-2xl font-bold text-industrial-900 mt-1">What the factory's memory has learned</h2>
          <p className="text-industrial-600 mt-1">TRACE remembers · TRACE learns · TRACE explains · TRACE improves</p>
        </div>
        {report && (
          <div className="text-right text-xs text-gray-500">
            <p>Computed from {report.overview.total_incidents.toLocaleString()} work orders · {formatDate(report.generated_at)}</p>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              className="mt-1 inline-flex items-center gap-1 text-industrial-600 hover:text-industrial-800 disabled:opacity-50"
            >
              <RefreshCw className={refreshing ? "w-3.5 h-3.5 animate-spin" : "w-3.5 h-3.5"} aria-hidden /> Refresh
            </button>
          </div>
        )}
      </header>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
          {error}
        </div>
      )}

      {!report && !error && (
        <div className="flex items-center gap-2 text-gray-500 py-16 justify-center" role="status">
          <Loader2 className="w-6 h-6 animate-spin" aria-hidden /> Reading accumulated memory…
        </div>
      )}

      {report && report.overview.total_incidents === 0 && (
        <p className="text-gray-600">Memory is empty. Report an incident and record its outcome to start building knowledge.</p>
      )}

      {report && report.overview.total_incidents > 0 && (
        <>
          <KnowledgeOverview overview={report.overview} />

          <nav aria-label="Intelligence sections" className="sticky top-0 z-10 -mx-2 px-2 py-2 bg-gray-50 border-b border-gray-200">
            <ul className="flex flex-wrap gap-1.5">
              {SECTIONS.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="text-xs px-2.5 py-1 rounded-full border border-gray-200 bg-white text-gray-700 hover:border-industrial-300 hover:text-industrial-800">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div id="impact" className="scroll-mt-16">
            <MemoryImpactHero impact={report.memory_impact} />
          </div>
          <KnowledgeEvolution points={report.evolution} problemsCatalogued={report.overview.problems_catalogued} />
          <KnowledgeChanges changes={report.knowledge_changes} />
          <MemoryReuse reuse={report.reuse} />
          <TrustPanel problems={report.problems} />
          <ReliableRepairs data={report.reliable_repairs} />
          <FailurePatterns data={report.failure_patterns} />
          <MachineRanking machines={report.machines} onOpenMachine={onViewMachineMemory} />
          <KnowledgeNetwork report={report} />

          <p className="text-xs text-gray-500">
            Every number on this page is computed from the recorded work orders and the deterministic recommendation engine; nothing
            is generated by an LLM. The history is synthetic but operationally realistic. Replay-based sections show what memory held
            at each point in time, because individual recalls are not logged.
          </p>
        </>
      )}
    </div>
  );
}
