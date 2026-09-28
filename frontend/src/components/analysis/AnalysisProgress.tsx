"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { cn, humanize } from "@/lib/utils";

/**
 * Shown while POST /incidents/analyze is running. The stages are the real
 * pipeline stages; they advance on elapsed time only (the request is a single
 * call), and the page switches to the result as soon as it arrives, so this
 * never delays anything. Real counts are shown on the analysis page.
 */
export function AnalysisProgress({ machineId, machineType }: { machineId: string; machineType: string }) {
  const stages = [
    { at: 0, label: `Searching ${machineId || "this machine"}'s own history in Hindsight` },
    { at: 500, label: `Searching the fleet of ${humanize(machineType) || "this machine type"}s` },
    { at: 1300, label: "Ranking similar past incidents by meaning" },
    { at: 2200, label: "Filtering evidence: same problem, recorded outcome" },
    { at: 3000, label: "Scoring interventions (deterministic)" },
    { at: 3800, label: "Saving this incident to memory" },
    { at: 4600, label: "Writing the plain-language explanation" },
  ];
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), 150);
    return () => clearInterval(timer);
  }, []);

  const current = stages.reduce((idx, stage, i) => (elapsed >= stage.at ? i : idx), 0);

  return (
    <div className="rounded-lg border border-industrial-200 bg-industrial-50 p-4" role="status" aria-live="polite">
      <p className="text-sm font-semibold text-industrial-900 mb-2">TRACE is consulting memory…</p>
      <ol className="space-y-1.5">
        {stages.map((stage, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li
              key={stage.label}
              className={cn(
                "flex items-center gap-2 text-sm transition-opacity duration-300",
                i > current ? "opacity-40" : "opacity-100"
              )}
            >
              {done ? (
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" aria-hidden />
              ) : active ? (
                <Loader2 className="w-4 h-4 text-industrial-600 animate-spin flex-shrink-0" aria-hidden />
              ) : (
                <span className="w-4 h-4 flex-shrink-0 rounded-full border border-gray-300" aria-hidden />
              )}
              <span className={cn(active ? "text-industrial-900 font-medium" : "text-gray-700")}>{stage.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
