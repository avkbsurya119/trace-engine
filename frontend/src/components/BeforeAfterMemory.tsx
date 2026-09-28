"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Brain,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Lightbulb,
  History,
  Zap,
  ArrowRight,
  HelpCircle,
} from "lucide-react";

interface Props {
  onClose: () => void;
}

export function BeforeAfterMemory({ onClose }: Props) {
  const [activeScenario, setActiveScenario] = useState<"cnc" | "imm" | "weld">(
    "cnc"
  );

  const scenarios = {
    cnc: {
      title: "CNC Surface Roughness",
      machine: "CNC-01",
      defect: "surface_roughness",
      symptoms: ["rough surface finish", "high spindle vibration"],
      before: {
        recommendation: "Check tooling, verify spindle alignment, inspect coolant flow, review feed rates...",
        confidence: "INSUFFICIENT_DATA",
        reasoning: "No historical data available. Generic troubleshooting steps recommended.",
        timeToResolve: "45+ min",
        outcome: "Trial and error",
      },
      after: {
        recommendation: "Reduce spindle speed to 3500 RPM",
        confidence: "HIGH",
        reasoning: "Based on 4 similar incidents on CNC machines. This intervention succeeded 3 times (75% success rate). Most recent: TRC-CNC-001-E resolved in 8 minutes.",
        supportingIncidents: ["TRC-CNC-001", "TRC-CNC-001-C", "TRC-CNC-001-E"],
        warnings: ["TRC-CNC-002: Coolant adjustment FAILED for this defect"],
        timeToResolve: "8-12 min",
        outcome: "Evidence-based fix",
      },
    },
    imm: {
      title: "Injection Molding Short Shot",
      machine: "IMM-01",
      defect: "short_shot",
      symptoms: ["incomplete filling", "low part weight"],
      before: {
        recommendation: "Verify material supply, check barrel temperature, inspect nozzle, review injection parameters...",
        confidence: "INSUFFICIENT_DATA",
        reasoning: "No historical data available. Standard injection molding troubleshooting.",
        timeToResolve: "30+ min",
        outcome: "Trial and error",
      },
      after: {
        recommendation: "Increase injection pressure to 95-96 bar",
        confidence: "HIGH",
        reasoning: "Based on 2 similar short shot incidents on IMM-01. Pressure increase resolved the issue both times.",
        supportingIncidents: ["TRC-IMM-001", "TRC-IMM-001-D"],
        warnings: [],
        timeToResolve: "10-14 min",
        outcome: "Evidence-based fix",
      },
    },
    weld: {
      title: "Weld Porosity",
      machine: "WELD-01",
      defect: "weld_porosity",
      symptoms: ["gas pores", "surface cavities"],
      before: {
        recommendation: "Check gas supply, clean nozzle, verify arc parameters, inspect base material...",
        confidence: "INSUFFICIENT_DATA",
        reasoning: "No historical data available. Standard welding porosity checklist.",
        timeToResolve: "35+ min",
        outcome: "Trial and error",
      },
      after: {
        recommendation: "Increase shielding gas flow to 18 L/min",
        confidence: "HIGH",
        reasoning: "Based on 2 porosity incidents on WELD-01. Gas flow increase resolved porosity immediately both times.",
        supportingIncidents: ["TRC-WELD-001", "TRC-WELD-001-E"],
        warnings: ["TRC-WELD-002: Nozzle cleaning alone was PARTIAL - combine with gas flow"],
        timeToResolve: "12-16 min",
        outcome: "Evidence-based fix",
      },
    },
  };

  const scenario = scenarios[activeScenario];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-industrial-600 to-industrial-700 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">Before vs After Memory</h2>
                <p className="text-industrial-200">
                  See how TRACE recommendations improve with organizational memory
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white text-2xl"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Scenario Tabs */}
        <div className="border-b border-gray-200 px-6 pt-4">
          <div className="flex gap-2">
            {Object.entries(scenarios).map(([key, s]) => (
              <button
                key={key}
                onClick={() => setActiveScenario(key as "cnc" | "imm" | "weld")}
                className={cn(
                  "px-4 py-2 rounded-t-lg font-medium text-sm transition-colors",
                  activeScenario === key
                    ? "bg-industrial-100 text-industrial-800 border-b-2 border-industrial-600"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                )}
              >
                {s.title}
              </button>
            ))}
          </div>
        </div>

        {/* Scenario Details */}
        <div className="p-6">
          {/* Incident Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Incident Report</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Machine:</span>
                <span className="ml-2 font-medium">{scenario.machine}</span>
              </div>
              <div>
                <span className="text-gray-500">Defect:</span>
                <span className="ml-2 font-medium">{scenario.defect}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Symptoms:</span>
                <span className="ml-2 font-medium">
                  {scenario.symptoms.join(", ")}
                </span>
              </div>
            </div>
          </div>

          {/* Before/After Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Before Memory */}
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 bg-gray-50">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-gray-200 rounded-lg">
                  <HelpCircle className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-700">Without Memory</h4>
                  <p className="text-xs text-gray-500">First incident of this type</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                    <Lightbulb className="w-4 h-4" />
                    <span>Recommendation</span>
                  </div>
                  <p className="text-gray-700 bg-white p-3 rounded-lg border border-gray-200 text-sm">
                    {scenario.before.recommendation}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium",
                      "bg-gray-200 text-gray-600"
                    )}
                  >
                    {scenario.before.confidence}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Reasoning</span>
                  </div>
                  <p className="text-gray-600 text-sm italic">
                    {scenario.before.reasoning}
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Clock className="w-4 h-4" />
                      <span>Typical resolution:</span>
                    </div>
                    <span className="font-medium text-gray-700">
                      {scenario.before.timeToResolve}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-gray-500">Approach:</span>
                    <span className="text-amber-600 font-medium">
                      {scenario.before.outcome}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* After Memory */}
            <div className="border-2 border-green-200 rounded-xl p-6 bg-green-50">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-green-200 rounded-lg">
                  <Brain className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h4 className="font-bold text-green-800">With Memory</h4>
                  <p className="text-xs text-green-600">
                    TRACE recalls historical outcomes
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-sm text-green-700 mb-1">
                    <Zap className="w-4 h-4" />
                    <span>Recommendation</span>
                  </div>
                  <p className="text-green-900 bg-white p-3 rounded-lg border border-green-200 text-sm font-medium">
                    {scenario.after.recommendation}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium",
                      "bg-green-200 text-green-800"
                    )}
                  >
                    {scenario.after.confidence}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm text-green-700 mb-1">
                    <History className="w-4 h-4" />
                    <span>Evidence-Based Reasoning</span>
                  </div>
                  <p className="text-green-800 text-sm">
                    {scenario.after.reasoning}
                  </p>
                </div>

                {/* Supporting Incidents */}
                <div>
                  <div className="flex items-center gap-2 text-sm text-green-700 mb-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>Supporting Incidents</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {scenario.after.supportingIncidents.map((id) => (
                      <span
                        key={id}
                        className="px-2 py-1 bg-white text-green-700 rounded text-xs border border-green-200"
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Warnings */}
                {scenario.after.warnings.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm text-amber-700 mb-2">
                      <XCircle className="w-4 h-4" />
                      <span>What Didn&apos;t Work</span>
                    </div>
                    {scenario.after.warnings.map((warning, i) => (
                      <p
                        key={i}
                        className="text-amber-700 text-xs bg-amber-50 p-2 rounded border border-amber-200"
                      >
                        {warning}
                      </p>
                    ))}
                  </div>
                )}

                <div className="pt-4 border-t border-green-200">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-green-700">
                      <Clock className="w-4 h-4" />
                      <span>Typical resolution:</span>
                    </div>
                    <span className="font-medium text-green-900">
                      {scenario.after.timeToResolve}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-green-700">Approach:</span>
                    <span className="text-green-800 font-medium">
                      {scenario.after.outcome}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Impact Summary */}
          <div className="mt-6 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-6 text-white">
            <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Memory Impact
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/10 rounded-lg p-4">
                <p className="text-green-200 text-sm">Resolution Time</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-white/60 line-through">
                    {scenario.before.timeToResolve}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                  <span className="font-bold">{scenario.after.timeToResolve}</span>
                </div>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <p className="text-green-200 text-sm">Confidence</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-white/60">
                    {scenario.before.confidence}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                  <span className="font-bold">{scenario.after.confidence}</span>
                </div>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <p className="text-green-200 text-sm">Approach</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-white/60">Trial & Error</span>
                  <ArrowRight className="w-4 h-4" />
                  <span className="font-bold">Evidence-Based</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
