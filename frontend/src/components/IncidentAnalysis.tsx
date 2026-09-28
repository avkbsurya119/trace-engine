"use client";

import { ArrowLeft, Database, FileText } from "lucide-react";
import { formatDate, humanize } from "@/lib/utils";
import type { AnalysisResult } from "@/types/incident";
import { Field, Section } from "@/components/ui";
import { DecisionSummary } from "@/components/analysis/DecisionSummary";
import { DecisionPipeline } from "@/components/analysis/DecisionPipeline";
import { WhyPanel } from "@/components/analysis/WhyPanel";
import { EvidenceList } from "@/components/analysis/EvidenceList";
import { OutcomeForm } from "@/components/analysis/OutcomeForm";

interface Props {
  result: AnalysisResult;
  onBack: () => void;
  onViewMachineMemory: (machineId: string) => void;
}

/**
 * Incident analysis. Reading order is the judge's questions:
 * what TRACE recommends and how sure it is -> how it decided -> what happened
 * -> why (rules, alternatives) -> what memory held -> record the outcome.
 */
export function IncidentAnalysis({ result, onBack, onViewMachineMemory }: Props) {
  const { current_incident: incident, recommendation } = result;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to dashboard"
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-industrial-900">Incident Analysis</h2>
            <p className="text-industrial-600">
              {incident.incident_id} · {incident.machine_id} · {humanize(incident.defect_type)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onViewMachineMemory(incident.machine_id)}
          className="flex items-center gap-2 px-4 py-2 text-industrial-600 hover:text-industrial-800 hover:bg-industrial-50 rounded-lg"
        >
          <Database className="w-5 h-5" aria-hidden />
          {incident.machine_id} memory
        </button>
      </header>

      <DecisionSummary result={result} />
      <DecisionPipeline result={result} />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Section icon={<FileText className="w-5 h-5 text-industrial-600" />} title="What happened" id="what-happened">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
              <Field label="Machine" value={incident.machine_id} sub={humanize(incident.machine_type)} />
              <Field label="Line" value={incident.production_line} />
              <Field label="Problem" value={humanize(incident.defect_type)} />
              <Field label="Reported" value={formatDate(incident.timestamp)} />
              {incident.operating_hours ? <Field label="Operating hours" value={incident.operating_hours.toLocaleString()} /> : null}
              {incident.technician_id ? <Field label="Technician" value={incident.technician_id} /> : null}
            </div>
            {incident.symptoms.length > 0 && (
              <ul className="flex flex-wrap gap-2 mb-3" aria-label="Symptoms">
                {incident.symptoms.map((s) => (
                  <li key={s} className="px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs">
                    {s}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-gray-700 text-sm">{incident.description}</p>
            {incident.sensor_values && Object.keys(incident.sensor_values).length > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                Readings:{" "}
                {Object.entries(incident.sensor_values)
                  .map(([k, v]) => `${humanize(k)} ${v}`)
                  .join(" · ")}
              </p>
            )}
          </Section>

          <WhyPanel recommendation={recommendation} />
          <OutcomeForm result={result} />
        </div>

        <div className="lg:col-span-2">
          <EvidenceList result={result} />
        </div>
      </div>
    </div>
  );
}
