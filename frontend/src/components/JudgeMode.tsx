"use client";

/**
 * Judge mode: a presentation layer over the existing screens. It hides
 * operator/developer controls (via usePresentation) and adds a presenter bar
 * that walks the 5-minute story one click per step. It adds no data or logic;
 * demo incidents come from the backend catalog like everywhere else.
 */

import { createContext, useContext, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Presentation, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DemoPreset, Fleet } from "@/types/incident";

export const PresentationContext = createContext(false);
export const usePresentation = () => useContext(PresentationContext);

export type JudgeTarget =
  | { view: "dashboard" }
  | { view: "intelligence"; compare?: boolean }
  | { view: "report"; preset: DemoPreset }
  | { view: "memory"; machineId: string };

interface Step {
  title: string;
  say: string;
  target: (fleet: Fleet) => JudgeTarget | null;
}

const STEPS: Step[] = [
  {
    title: "What is happening",
    say: "The fleet today: work orders, outcomes, the problems that keep coming back.",
    target: () => ({ view: "dashboard" }),
  },
  {
    title: "Memory changes the answer",
    say: "Same incident, scored live with and without memory on three real machine histories.",
    target: () => ({ view: "intelligence", compare: true }),
  },
  {
    title: "A problem nobody has seen",
    say: "Analyze it: TRACE searches memory and withholds a recommendation. Then record what worked.",
    target: (fleet) => (fleet.demo_presets[0] ? { view: "report", preset: fleet.demo_presets[0] } : null),
  },
  {
    title: "It happens again",
    say: "Analyze again: TRACE recalls the first work order, recommends the fix and shows why.",
    target: (fleet) => (fleet.demo_presets[1] ? { view: "report", preset: fleet.demo_presets[1] } : null),
  },
  {
    title: "What happened before",
    say: "The machine's timeline now holds both work orders.",
    target: (fleet) => (fleet.demo_presets[0] ? { view: "memory", machineId: fleet.demo_presets[0].incident.machine_id } : null),
  },
  {
    title: "What TRACE has learned",
    say: "Knowledge growth, reliable repairs and the replay: when technicians follow memory, more repairs work.",
    target: () => ({ view: "intelligence" }),
  },
];

export function JudgeBar({ onNavigate, onExit }: { onNavigate: (target: JudgeTarget) => void; onExit: () => void }) {
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    api.getFleet().then(setFleet).catch(() => setFleet(null));
  }, []);

  const go = (index: number) => {
    if (!fleet) return;
    const target = STEPS[index].target(fleet);
    if (!target) return;
    setStep(index);
    onNavigate(target);
  };

  // Arrow keys move between steps unless the presenter is typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (e.key === "ArrowRight" && step < STEPS.length - 1) go(step + 1);
      if (e.key === "ArrowLeft" && step > 0) go(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const current = STEPS[step];

  return (
    <div
      role="region"
      aria-label="Presentation steps"
      className="fixed bottom-0 left-64 right-0 z-40 border-t border-industrial-700 bg-industrial-900 text-white shadow-2xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-industrial-300">
          <Presentation className="w-4 h-4" aria-hidden /> Judge mode
        </span>

        <ol className="flex items-center gap-1" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={i === step ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${s.title}`}
                className={cn(
                  "w-7 h-7 rounded-full text-xs font-semibold transition-colors",
                  i === step ? "bg-white text-industrial-900" : i < step ? "bg-industrial-600 text-white" : "bg-industrial-800 text-industrial-300 hover:bg-industrial-700"
                )}
              >
                {i + 1}
              </button>
            </li>
          ))}
        </ol>

        <div className="flex-1 min-w-[14rem]" aria-live="polite">
          <p className="text-sm font-semibold">{current.title}</p>
          <p className="text-xs text-industrial-300">{current.say}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => go(step - 1)}
            disabled={step === 0 || !fleet}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-industrial-800 hover:bg-industrial-700 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden /> Back
          </button>
          <button
            type="button"
            onClick={() => go(step + 1)}
            disabled={step === STEPS.length - 1 || !fleet}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-white text-industrial-900 font-medium hover:bg-industrial-50 disabled:opacity-40"
          >
            Next <ChevronRight className="w-4 h-4" aria-hidden />
          </button>
          <button type="button" onClick={onExit} aria-label="Exit judge mode" className="p-1.5 rounded-lg text-industrial-300 hover:text-white hover:bg-industrial-800">
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
