"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { humanize } from "@/lib/utils";
import type { IncidentCreate, AnalysisResult, Fleet } from "@/types/incident";
import { AnalysisProgress } from "@/components/analysis/AnalysisProgress";
import { Plus, Loader2, Search } from "lucide-react";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, ErrorState, PageHeader } from "@/components/ui";
import { usePresentation } from "@/components/JudgeMode";

interface ReportIncidentProps {
  onAnalysisComplete: (result: AnalysisResult) => void;
  onCancel: () => void;
  /** Pre-filled incident (Judge mode or demo preset). */
  preset?: IncidentCreate | null;
}

const EMPTY_INCIDENT: IncidentCreate = {
  machine_id: "",
  machine_type: "",
  production_line: "",
  defect_type: "",
  symptoms: [],
  sensor_values: {},
  operating_conditions: {},
  description: "",
  suspected_root_cause: "",
  operating_hours: undefined,
  technician_id: "",
};

const NEW_PROBLEM = "__new__";

export function ReportIncident({
  onAnalysisComplete,
  onCancel,
  preset,
}: ReportIncidentProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<IncidentCreate>({ ...EMPTY_INCIDENT, ...(preset ?? {}) });

  const [customSymptom, setCustomSymptom] = useState("");
  const presenting = usePresentation();
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [defectChoice, setDefectChoice] = useState(preset?.defect_type ?? "");
  const [newDefect, setNewDefect] = useState("");

  useEffect(() => {
    api
      .getFleet()
      .then(setFleet)
      .catch(() => setError("Could not load the machine list from the backend. Is it running?"));
  }, []);

  const machineType = useMemo(
    () => fleet?.machine_types.find((t) => t.machine_type === formData.machine_type),
    [fleet, formData.machine_type]
  );
  const symptomOptions = useMemo(
    () => machineType?.defect_types.find((d) => d.defect_type === defectChoice)?.symptoms ?? [],
    [machineType, defectChoice]
  );

  const loadPreset = (key: string) => {
    const found = fleet?.demo_presets.find((p) => p.key === key);
    if (!found) return;
    setFormData({ ...EMPTY_INCIDENT, ...found.incident });
    setDefectChoice(found.incident.defect_type);
    setNewDefect("");
    setError(null);
  };

  const selectMachineType = (value: string) => {
    setFormData((prev) => ({ ...prev, machine_type: value, machine_id: "", production_line: "", defect_type: "", symptoms: [] }));
    setDefectChoice("");
  };

  const selectMachine = (value: string) => {
    const machine = machineType?.machines.find((m) => m.machine_id === value);
    setFormData((prev) => ({ ...prev, machine_id: value, production_line: machine?.production_line ?? "" }));
  };

  const selectDefect = (value: string) => {
    setDefectChoice(value);
    setFormData((prev) => ({ ...prev, defect_type: value === NEW_PROBLEM ? toKey(newDefect) : value, symptoms: [] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: IncidentCreate = {
        ...formData,
        defect_type: defectChoice === NEW_PROBLEM ? toKey(newDefect) : formData.defect_type,
        suspected_root_cause: formData.suspected_root_cause || undefined,
        technician_id: formData.technician_id || undefined,
      };
      const result = await api.analyzeIncident(payload);
      onAnalysisComplete(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze incident");
    } finally {
      setLoading(false);
    }
  };

  const toggleSymptom = (symptom: string) => {
    setFormData((prev) => ({
      ...prev,
      symptoms: prev.symptoms.includes(symptom)
        ? prev.symptoms.filter((s) => s !== symptom)
        : [...prev.symptoms, symptom],
    }));
  };

  const addCustomSymptom = () => {
    if (customSymptom.trim() && !formData.symptoms.includes(customSymptom.trim())) {
      setFormData((prev) => ({
        ...prev,
        symptoms: [...prev.symptoms, customSymptom.trim()],
      }));
      setCustomSymptom("");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        question="What happened?"
        title="Report incident"
        breadcrumb={[{ label: "Dashboard", onClick: onCancel }, { label: "Report incident" }]}
        subtitle="Describe the problem as the operator saw it. TRACE searches memory for similar work orders as soon as you analyze."
      />
      <div className={CARD}>
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && <ErrorState title="The incident could not be analyzed" detail={error} />}

          {fleet && fleet.demo_presets.length > 0 && !presenting && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-industrial-50 border border-industrial-100 px-3 py-2">
              <label htmlFor="demo-preset" className="text-sm text-industrial-800 font-medium">
                Load a demo incident
              </label>
              <select
                id="demo-preset"
                defaultValue=""
                onChange={(e) => {
                  loadPreset(e.target.value);
                  e.target.value = "";
                }}
                className="flex-1 min-w-[14rem] px-2 py-1.5 border border-industrial-200 rounded-md text-sm bg-white"
              >
                <option value="">Choose…</option>
                {fleet.demo_presets.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Machine */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-industrial-700 mb-1">Machine type *</label>
              <select
                required
                value={formData.machine_type}
                onChange={(e) => selectMachineType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500"
              >
                <option value="">{fleet ? "Select machine type" : "Loading..."}</option>
                {fleet?.machine_types.map((t) => (
                  <option key={t.machine_type} value={t.machine_type}>
                    {humanize(t.label)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-industrial-700 mb-1">Machine *</label>
              <select
                required
                disabled={!machineType}
                value={formData.machine_id}
                onChange={(e) => selectMachine(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500 disabled:bg-gray-50"
              >
                <option value="">Select machine</option>
                {machineType?.machines.map((m) => (
                  <option key={m.machine_id} value={m.machine_id}>
                    {m.machine_id} · {m.model} ({m.production_line})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-industrial-700 mb-1">Production line</label>
              <input
                readOnly
                value={formData.production_line}
                placeholder="Set by machine"
                className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-industrial-700 mb-1">Operating hours</label>
              <input
                type="number"
                min={0}
                value={formData.operating_hours ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, operating_hours: e.target.value ? parseInt(e.target.value) : undefined }))
                }
                placeholder="Hour meter"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-industrial-700 mb-1">Technician ID</label>
              <input
                type="text"
                value={formData.technician_id ?? ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, technician_id: e.target.value }))}
                placeholder="e.g. T-117"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500"
              />
            </div>
          </div>

          {/* Problem */}
          <div>
            <label className="block text-sm font-medium text-industrial-700 mb-1">Problem *</label>
            <select
              required
              disabled={!machineType}
              value={defectChoice}
              onChange={(e) => selectDefect(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500 disabled:bg-gray-50"
            >
              <option value="">Select problem</option>
              {machineType?.defect_types.map((d) => (
                <option key={d.defect_type} value={d.defect_type}>
                  {humanize(d.defect_type)}
                </option>
              ))}
              <option value={NEW_PROBLEM}>Other / not listed...</option>
            </select>
            {defectChoice === NEW_PROBLEM && (
              <input
                required
                type="text"
                value={newDefect}
                onChange={(e) => {
                  setNewDefect(e.target.value);
                  setFormData((prev) => ({ ...prev, defect_type: toKey(e.target.value) }));
                }}
                placeholder="Short name for the problem, e.g. chip conveyor jam"
                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500"
              />
            )}
          </div>

          {/* Symptoms */}
          <div>
            <label className="block text-sm font-medium text-industrial-700 mb-2">Observed symptoms</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {[...symptomOptions, ...formData.symptoms.filter((s) => !symptomOptions.includes(s))].map((symptom) => (
                <button
                  key={symptom}
                  type="button"
                  onClick={() => toggleSymptom(symptom)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    formData.symptoms.includes(symptom)
                      ? "bg-industrial-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {symptom}
                </button>
              ))}
              {symptomOptions.length === 0 && formData.symptoms.length === 0 && (
                <span className="text-sm text-gray-400">Pick a problem to see common symptoms, or add your own.</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add symptom"
                value={customSymptom}
                onChange={(e) => setCustomSymptom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomSymptom())}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500"
              />
              <button
                type="button"
                onClick={addCustomSymptom}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-industrial-700 mb-1">
              Incident Description *
            </label>
            <textarea
              required
              rows={4}
              placeholder="What was seen, when, on which part or product, readings..."
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500"
            />
          </div>

          {/* Suspected Root Cause */}
          <div>
            <label className="block text-sm font-medium text-industrial-700 mb-1">
              Suspected Root Cause (Optional)
            </label>
            <input
              type="text"
              placeholder="Initial theory about the cause"
              value={formData.suspected_root_cause}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  suspected_root_cause: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500"
            />
          </div>

          {loading && <AnalysisProgress machineId={formData.machine_id} machineType={formData.machine_type} />}

          {/* Submit */}
          <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
            <button type="button" onClick={onCancel} className={BUTTON_SECONDARY}>
              Cancel
            </button>
            <button type="submit" disabled={loading} className={BUTTON_PRIMARY}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Search className="w-4 h-4" aria-hidden />}
              {loading ? "Consulting memory…" : "Analyze incident"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function toKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
