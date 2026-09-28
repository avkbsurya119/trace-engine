"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { humanize } from "@/lib/utils";
import type { IncidentCreate, AnalysisResult, Fleet } from "@/types/incident";
import { AlertTriangle, X, Plus, Loader2 } from "lucide-react";

interface ReportIncidentProps {
  onAnalysisComplete: (result: AnalysisResult) => void;
  onCancel: () => void;
}

const NEW_PROBLEM = "__new__";

export function ReportIncident({
  onAnalysisComplete,
  onCancel,
}: ReportIncidentProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<IncidentCreate>({
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
  });

  const [customSymptom, setCustomSymptom] = useState("");
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [defectChoice, setDefectChoice] = useState("");
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
    <div className="max-w-3xl mx-auto">
      <div className="glass-card rounded-3xl border border-[rgba(140,180,255,0.18)] shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#101732]/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-400/10 text-amber-300 border border-amber-400/30">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">
                Report Machine Incident
              </h2>
              <p className="text-xs text-[#8290ab]">Query Hindsight vector memory against 567 historical factory work orders</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-[#8290ab] hover:text-white rounded-xl hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-sm">
              {error}
            </div>
          )}

          {/* Machine Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#8290ab] mb-1.5">Machine Type *</label>
              <select
                required
                value={formData.machine_type}
                onChange={(e) => selectMachineType(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#141c38]/90 border border-[rgba(140,180,255,0.18)] rounded-xl text-sm text-white focus:outline-none focus:border-[#38bdf8]"
              >
                <option value="" className="bg-[#0b0e1b] text-gray-400">{fleet ? "Select machine type" : "Loading..."}</option>
                {fleet?.machine_types.map((t) => (
                  <option key={t.machine_type} value={t.machine_type} className="bg-[#0b0e1b] text-white">
                    {humanize(t.label)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#8290ab] mb-1.5">Machine ID *</label>
              <select
                required
                disabled={!machineType}
                value={formData.machine_id}
                onChange={(e) => selectMachine(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#141c38]/90 border border-[rgba(140,180,255,0.18)] rounded-xl text-sm text-white focus:outline-none focus:border-[#38bdf8] disabled:opacity-40"
              >
                <option value="" className="bg-[#0b0e1b] text-gray-400">Select machine</option>
                {machineType?.machines.map((m) => (
                  <option key={m.machine_id} value={m.machine_id} className="bg-[#0b0e1b] text-white">
                    {m.machine_id} · {m.model} ({m.production_line})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#8290ab] mb-1.5">Production Line</label>
              <input
                readOnly
                value={formData.production_line}
                placeholder="Set by machine"
                className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-[#f3f6ff] opacity-80"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#8290ab] mb-1.5">Operating Hours</label>
              <input
                type="number"
                min={0}
                value={formData.operating_hours ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, operating_hours: e.target.value ? parseInt(e.target.value) : undefined }))
                }
                placeholder="Hour meter"
                className="w-full px-3.5 py-2.5 bg-[#141c38]/90 border border-[rgba(140,180,255,0.18)] rounded-xl text-sm text-white focus:outline-none focus:border-[#38bdf8]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#8290ab] mb-1.5">Technician ID</label>
              <input
                type="text"
                value={formData.technician_id ?? ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, technician_id: e.target.value }))}
                placeholder="e.g. T-117"
                className="w-full px-3.5 py-2.5 bg-[#141c38]/90 border border-[rgba(140,180,255,0.18)] rounded-xl text-sm text-white focus:outline-none focus:border-[#38bdf8]"
              />
            </div>
          </div>

          {/* Problem */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8290ab] mb-1.5">Observed Problem Mode *</label>
            <select
              required
              disabled={!machineType}
              value={defectChoice}
              onChange={(e) => selectDefect(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#141c38]/90 border border-[rgba(140,180,255,0.18)] rounded-xl text-sm text-white focus:outline-none focus:border-[#38bdf8] disabled:opacity-40"
            >
              <option value="" className="bg-[#0b0e1b] text-gray-400">Select problem</option>
              {machineType?.defect_types.map((d) => (
                <option key={d.defect_type} value={d.defect_type} className="bg-[#0b0e1b] text-white">
                  {humanize(d.defect_type)}
                </option>
              ))}
              <option value={NEW_PROBLEM} className="bg-[#0b0e1b] text-[#38bdf8]">Other / not listed...</option>
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
                className="mt-2 w-full px-3.5 py-2.5 bg-[#141c38]/90 border border-[rgba(140,180,255,0.18)] rounded-xl text-sm text-white focus:outline-none focus:border-[#38bdf8]"
              />
            )}
          </div>

          {/* Symptoms */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8290ab] mb-2">Observed Symptoms</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {[...symptomOptions, ...formData.symptoms.filter((s) => !symptomOptions.includes(s))].map((symptom) => (
                <button
                  key={symptom}
                  type="button"
                  onClick={() => toggleSymptom(symptom)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                    formData.symptoms.includes(symptom)
                      ? "bg-[#38bdf8]/20 text-[#38bdf8] border-[#38bdf8]/40 shadow-[0_0_12px_rgba(56,189,248,0.25)] font-bold"
                      : "bg-white/[0.05] text-[#8290ab] border-white/10 hover:text-white hover:bg-white/[0.08]"
                  }`}
                >
                  {symptom}
                </button>
              ))}
              {symptomOptions.length === 0 && formData.symptoms.length === 0 && (
                <span className="text-xs text-[#50607d]">Pick a problem to see historical symptoms, or add your own below.</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add custom symptom..."
                value={customSymptom}
                onChange={(e) => setCustomSymptom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomSymptom())}
                className="flex-1 px-3.5 py-2 bg-[#141c38]/90 border border-[rgba(140,180,255,0.18)] rounded-xl text-xs text-white focus:outline-none focus:border-[#38bdf8]"
              />
              <button
                type="button"
                onClick={addCustomSymptom}
                className="px-3.5 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-white rounded-xl border border-white/10 text-xs flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8290ab] mb-1.5">
              Incident Description *
            </label>
            <textarea
              required
              rows={4}
              placeholder="What was observed, sensor readings, error code display, when it occurred..."
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              className="w-full px-3.5 py-2.5 bg-[#141c38]/90 border border-[rgba(140,180,255,0.18)] rounded-xl text-sm text-white focus:outline-none focus:border-[#38bdf8]"
            />
          </div>

          {/* Suspected Root Cause */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8290ab] mb-1.5">
              Suspected Root Cause (Optional Field Guess)
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
              className="w-full px-3.5 py-2.5 bg-[#141c38]/90 border border-[rgba(140,180,255,0.18)] rounded-xl text-sm text-white focus:outline-none focus:border-[#38bdf8]"
            />
          </div>

          {/* Submit Action */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onCancel}
              className="btn-neon-outline px-5 py-2.5 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-neon-primary px-6 py-2.5 text-sm font-bold text-[#0b0e1b] flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#0b0e1b]" />
                  Querying Vector Memory...
                </>
              ) : (
                "Analyze with TRACE Memory"
              )}
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
