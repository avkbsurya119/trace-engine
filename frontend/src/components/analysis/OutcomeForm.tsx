"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Brain, CheckCircle, Loader2, Save } from "lucide-react";
import { api } from "@/lib/api";
import { cn, getOutcomeBgColor, humanize } from "@/lib/utils";
import type { ActionOutcome, AnalysisResult, IncidentUpdate } from "@/types/incident";
import { Section } from "@/components/ui";

const OUTCOMES: ActionOutcome[] = ["SUCCESS", "PARTIAL", "FAILED", "UNKNOWN"];

interface Growth {
  problemBefore: number;
  problemAfter: number;
  fleetOutcomes: number;
}

/** Record what was done; afterwards show how memory grew because of it. */
export function OutcomeForm({ result }: { result: AnalysisResult }) {
  const { current_incident: incident, recommendation } = result;
  const winner = recommendation.evidence.find((e) => e.verdict === "selected");

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [growth, setGrowth] = useState<Growth | null>(null);
  const [data, setData] = useState<IncidentUpdate>({
    action_taken: winner?.example_action ?? "",
    intervention_category: recommendation.intervention_category ?? "",
    action_outcome: "SUCCESS",
    confirmed_root_cause: "",
    resolution_details: "",
    resolution_time_minutes: undefined,
    downtime_minutes: undefined,
    technician_notes: "",
  });

  useEffect(() => {
    api
      .getFleet()
      .then((fleet) => {
        const type = fleet.machine_types.find((t) => t.machine_type === incident.machine_type);
        setCategories(type?.intervention_categories ?? []);
      })
      .catch(() => setCategories([]));
  }, [incident.machine_type]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.recordOutcome(incident.incident_id, {
        ...data,
        intervention_category: data.intervention_category || data.action_taken,
      });
      setSaved(true);
      setOpen(false);
      // Read back what memory now holds (SQLite is the source of truth).
      const [memory, stats] = await Promise.all([api.getMachineMemory(incident.machine_id), api.getDashboardStats()]);
      const after = (memory.timeline ?? []).filter((t) => t.defect_type === incident.defect_type && t.action_outcome).length;
      setGrowth({ problemBefore: Math.max(0, after - 1), problemAfter: after, fleetOutcomes: stats.incidents_with_outcome });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save outcome");
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof IncidentUpdate>(key: K, value: IncidentUpdate[K]) => setData((prev) => ({ ...prev, [key]: value }));

  return (
    <Section
      icon={<Save className="w-5 h-5 text-industrial-600" />}
      title="Record outcome"
      id="record-outcome"
      aside={
        saved ? (
          <span className="flex items-center gap-1 text-green-700 text-sm" role="status">
            <CheckCircle className="w-4 h-4" aria-hidden />
            Saved to SQLite and Hindsight
          </span>
        ) : null
      }
    >
      {saved ? (
        <div className="space-y-3">
          <p className="text-gray-700 text-sm">
            Recorded <strong>{data.action_outcome}</strong> for “{data.intervention_category || data.action_taken}”. The next similar
            incident will recall this work order as evidence.
          </p>
          {growth && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-green-900">
                <Brain className="w-4 h-4" aria-hidden />
                Memory grew
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 text-sm">
                <div>
                  <p className="text-green-800">
                    {humanize(incident.defect_type)} on {incident.machine_id}
                  </p>
                  <p className="flex items-center gap-2 font-semibold text-green-900">
                    <span className="text-green-700/70">{growth.problemBefore}</span>
                    <ArrowRight className="w-4 h-4" aria-hidden />
                    <span>{growth.problemAfter}</span>
                    <span className="font-normal text-green-800">recorded outcome(s)</span>
                  </p>
                </div>
                <div>
                  <p className="text-green-800">Whole fleet</p>
                  <p className="font-semibold text-green-900">
                    {growth.fleetOutcomes.toLocaleString()} <span className="font-normal text-green-800">outcomes in memory</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-industrial-500 hover:text-industrial-600 transition-colors"
        >
          Record what was done and whether it worked
        </button>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block text-sm font-medium text-gray-700">
              Intervention type
              <input
                list="intervention-categories"
                value={data.intervention_category ?? ""}
                onChange={(e) => set("intervention_category", e.target.value)}
                placeholder="Pick or type"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg font-normal"
              />
              <datalist id="intervention-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Action performed
              <input
                required
                value={data.action_taken}
                onChange={(e) => set("action_taken", e.target.value)}
                placeholder="What exactly was done"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg font-normal"
              />
            </label>
          </div>

          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-1">Outcome</legend>
            <div className="flex gap-2" role="group">
              {OUTCOMES.map((outcome) => (
                <button
                  key={outcome}
                  type="button"
                  aria-pressed={data.action_outcome === outcome}
                  onClick={() => set("action_outcome", outcome)}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors",
                    data.action_outcome === outcome
                      ? getOutcomeBgColor(outcome) + " border-transparent"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  )}
                >
                  {outcome}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block text-sm font-medium text-gray-700">
              Confirmed root cause
              <input
                value={data.confirmed_root_cause}
                onChange={(e) => set("confirmed_root_cause", e.target.value)}
                placeholder="If known"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg font-normal"
              />
            </label>
            <NumberField label="Repair time (min)" value={data.resolution_time_minutes} onChange={(v) => set("resolution_time_minutes", v)} />
            <NumberField label="Downtime (min)" value={data.downtime_minutes} onChange={(v) => set("downtime_minutes", v)} />
          </div>

          <label className="block text-sm font-medium text-gray-700">
            Technician notes
            <textarea
              value={data.technician_notes}
              onChange={(e) => set("technician_notes", e.target.value)}
              rows={2}
              placeholder="What you found, anything uncertain"
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg font-normal"
            />
          </label>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-gray-700 hover:text-gray-900">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !data.action_taken}
              className="flex items-center gap-2 px-4 py-2 bg-industrial-600 text-white rounded-lg hover:bg-industrial-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Save className="w-4 h-4" aria-hidden />}
              {saving ? "Saving..." : "Save to memory"}
            </button>
          </div>
        </form>
      )}
    </Section>
  );
}

function NumberField({ label, value, onChange }: { label: string; value?: number; onChange: (v?: number) => void }) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <input
        type="number"
        min={0}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : undefined)}
        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg font-normal"
      />
    </label>
  );
}
