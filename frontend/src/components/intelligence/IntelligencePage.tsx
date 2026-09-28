"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Brain, GitCompare, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { IntelligenceReport } from "@/types/incident";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui";
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
  loading: () => <LoadingState label="Loading knowledge network…" />,
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
export function IntelligencePage({
  onViewMachineMemory,
  onCompare,
}: {
  onViewMachineMemory: (machineId: string) => void;
  onCompare: () => void;
}) {
  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = (refresh = false) => {
    setError(null);
    setRefreshing(refresh);
    api
      .getIntelligence({ refresh })
      .then(setReport)
      .catch((e) => setError(e instanceof Error ? e.message : "The backend did not respond."))
      .finally(() => setRefreshing(false));
  };

  useEffect(() => load(), []);

  return (
    <div className="space-y-6">
      <PageHeader
        question="What has TRACE learned?"
        title="TRACE Intelligence"
        subtitle={
          <>
            TRACE remembers · learns · explains · improves.
            {report && (
              <span className="block text-xs text-slate-400 mt-0.5">
                Computed from {report.overview.total_incidents.toLocaleString()} work orders · {formatDate(report.generated_at)}
              </span>
            )}
          </>
        }
        actions={
          <>
            <button type="button" onClick={onCompare} className={BUTTON_PRIMARY}>
              <GitCompare className="w-4 h-4" aria-hidden /> With vs without memory
            </button>
            {report && (
              <button type="button" onClick={() => load(true)} disabled={refreshing} className={BUTTON_SECONDARY}>
                <RefreshCw className={refreshing ? "w-4 h-4 animate-spin" : "w-4 h-4"} aria-hidden /> Refresh
              </button>
            )}
          </>
        }
      />

      {error && <ErrorState title="Could not compute TRACE Intelligence" detail={error} onRetry={() => load(true)} />}
      {!report && !error && <LoadingState label="Reading the factory's accumulated memory…" />}

      {report && report.overview.total_incidents === 0 && (
        <EmptyState icon={<Brain className="w-6 h-6" />} title="Memory is empty">
          Report an incident and record its outcome; every recorded repair becomes knowledge this page summarises.
        </EmptyState>
      )}

      {report && report.overview.total_incidents > 0 && (
        <>
          <KnowledgeOverview overview={report.overview} />

          <nav aria-label="Intelligence sections" className="sticky top-0 z-10 -mx-2 px-2 py-3 glass-panel rounded-xl">
            <ul className="flex flex-wrap gap-1.5">
              {SECTIONS.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="text-xs px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-slate-300 hover:bg-[#38bdf8]/15 hover:border-[#38bdf8]/30 hover:text-white transition-all">
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

          <p className="text-xs text-slate-400">
            Every number on this page is computed from the recorded work orders and the deterministic recommendation engine; nothing
            is generated by an LLM. The history is synthetic but operationally realistic. Replay-based sections show what memory held
            at each point in time, because individual recalls are not logged.
          </p>
        </>
      )}
    </div>
  );
}
