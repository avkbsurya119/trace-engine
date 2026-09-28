"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { IncidentCreate, AnalysisResult } from "@/types/incident";
import { AlertTriangle, X, Plus, Loader2 } from "lucide-react";

interface ReportIncidentProps {
  onAnalysisComplete: (result: AnalysisResult) => void;
  onCancel: () => void;
}

const MACHINE_TYPES = [
  "CNC",
  "Injection_Molding",
  "Hydraulic_Press",
  "Robotic_Welder",
  "Laser_Cutter",
  "Conveyor_System",
  "Assembly_Robot",
  "3D_Printer",
];

const DEFECT_TYPES = [
  "surface_roughness",
  "tool_wear",
  "short_shot",
  "flash_defect",
  "sink_marks",
  "pressure_loss",
  "seal_failure",
  "weld_spatter",
  "arc_deviation",
  "dross_buildup",
  "dimensional_error",
  "vibration_anomaly",
];

const COMMON_SYMPTOMS = [
  "rough surface finish",
  "high spindle vibration",
  "tool chatter",
  "excessive tool wear",
  "incomplete fill",
  "visible voids",
  "pressure fluctuation",
  "weld spatter",
  "arc instability",
  "inconsistent bead",
  "dross accumulation",
  "edge roughness",
];

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
  });

  const [customSymptom, setCustomSymptom] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await api.analyzeIncident(formData);
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
    if (customSymptom.trim() && !formData.symptoms.includes(customSymptom)) {
      setFormData((prev) => ({
        ...prev,
        symptoms: [...prev.symptoms, customSymptom.trim()],
      }));
      setCustomSymptom("");
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            <h2 className="text-xl font-bold text-industrial-900">
              Report Incident
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
              {error}
            </div>
          )}

          {/* Machine Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-industrial-700 mb-1">
                Machine ID *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., CNC-07"
                value={formData.machine_id}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, machine_id: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-industrial-700 mb-1">
                Production Line *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Line A"
                value={formData.production_line}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    production_line: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-industrial-700 mb-1">
                Machine Type *
              </label>
              <select
                required
                value={formData.machine_type}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, machine_type: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500"
              >
                <option value="">Select machine type</option>
                {MACHINE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-industrial-700 mb-1">
                Defect Type *
              </label>
              <select
                required
                value={formData.defect_type}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, defect_type: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500"
              >
                <option value="">Select defect type</option>
                {DEFECT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Symptoms */}
          <div>
            <label className="block text-sm font-medium text-industrial-700 mb-2">
              Observed Symptoms
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {COMMON_SYMPTOMS.map((symptom) => (
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
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add custom symptom"
                value={customSymptom}
                onChange={(e) => setCustomSymptom(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addCustomSymptom())}
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
              placeholder="Describe the incident in detail..."
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

          {/* Submit */}
          <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-industrial-600 text-white rounded-lg hover:bg-industrial-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze Incident"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
