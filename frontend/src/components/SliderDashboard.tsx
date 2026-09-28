"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { api } from "@/lib/api";
import { cn, formatHours, humanize } from "@/lib/utils";
import type { DashboardStats, HeroMachine, Fleet } from "@/types/incident";
import {
  SlidersHorizontal,
  Brain,
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Play,
  Pause,
  Layers,
  ShieldCheck,
  Zap,
  Activity,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";

interface Props {
  onViewMachineMemory: (machineId: string) => void;
  onReportIncident?: () => void;
}

export function SliderDashboard({ onViewMachineMemory, onReportIncident }: Props) {
  // Navigation tabs within slider dashboard
  const [activeTab, setActiveTab] = useState<"comparison" | "simulator" | "timeline">("comparison");

  // Data
  const [heroes, setHeroes] = useState<HeroMachine[] | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Comparison Split Slider state
  const [activeHeroIdx, setActiveHeroIdx] = useState(0);
  const [sliderPos, setSliderPos] = useState(50); // 0 to 100%
  const [isDragging, setIsDragging] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // 2. What-If Simulator Sliders state
  const [fleetSize, setFleetSize] = useState(39);
  const [downtimeCost, setDowntimeCost] = useState(1850); // $/hour
  const [incidentsPerYear, setIncidentsPerYear] = useState(14.5);
  const [baselineFixRate, setBaselineFixRate] = useState(47); // %
  const [traceAdoption, setTraceAdoption] = useState(85); // %
  const [diagTimeSavedMin, setDiagTimeSavedMin] = useState(45); // min saved per incident

  // 3. Historical Memory Accumulation Timeline Slider state
  const [timelineMonth, setTimelineMonth] = useState(16); // month 1 to 16
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getHeroMachines().then((res) => setHeroes(res.hero_machines)).catch(() => setHeroes(null)),
      api.getDashboardStats().then(setStats).catch(() => setStats(null)),
      api.getFleet().then(setFleet).catch(() => setFleet(null)),
    ]).finally(() => setLoading(false));
  }, []);

  // Timeline auto-play
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setTimelineMonth((prev) => {
          if (prev >= 16) {
            setIsPlaying(false);
            return 16;
          }
          return prev + 1;
        });
      }, 700);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Handle split slider drag
  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (!isDragging || !splitContainerRef.current) return;
    const rect = splitContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = Math.round((x / rect.width) * 100);
    setSliderPos(percent);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging && splitContainerRef.current) {
        const rect = splitContainerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percent = Math.round((x / rect.width) * 100);
        setSliderPos(percent);
      }
    };
    if (isDragging) {
      window.addEventListener("mouseup", handleGlobalMouseUp);
      window.addEventListener("mousemove", handleGlobalMouseMove);
    }
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      window.removeEventListener("mousemove", handleGlobalMouseMove);
    };
  }, [isDragging]);

  // Simulator dynamic calculations
  const simResults = useMemo(() => {
    const totalAnnualIncidents = Math.round(fleetSize * incidentsPerYear);
    const assistedIncidents = Math.round(totalAnnualIncidents * (traceAdoption / 100));

    // Improved first-time fix rate: climbs based on adoption and baseline
    const targetFixRate = Math.min(94, Math.round(baselineFixRate + (88 - baselineFixRate) * (traceAdoption / 100)));
    const firstTimeFixDelta = (targetFixRate - baselineFixRate) / 100;
    const trialAndErrorPrevented = Math.round(assistedIncidents * firstTimeFixDelta);

    // Average downtime per trial-and-error incident is ~280 minutes (4.6 hours)
    const avgTrialDowntimeHours = 4.6;
    const trialDowntimeHoursSaved = Math.round(trialAndErrorPrevented * avgTrialDowntimeHours);
    const diagnosticDowntimeHoursSaved = Math.round((assistedIncidents * (diagTimeSavedMin / 60)));
    const totalDowntimeHoursSaved = trialDowntimeHoursSaved + diagnosticDowntimeHoursSaved;

    const totalFinancialSavings = Math.round(totalDowntimeHoursSaved * downtimeCost);
    const mttrReductionPct = Math.round(((totalDowntimeHoursSaved) / (totalAnnualIncidents * 7.1)) * 100);

    return {
      totalAnnualIncidents,
      assistedIncidents,
      targetFixRate,
      trialAndErrorPrevented,
      totalDowntimeHoursSaved,
      totalFinancialSavings,
      mttrReductionPct: Math.min(55, Math.max(12, mttrReductionPct)),
    };
  }, [fleetSize, downtimeCost, incidentsPerYear, baselineFixRate, traceAdoption, diagTimeSavedMin]);

  // Presets for simulator
  const applyPreset = (type: "small" | "medium" | "large") => {
    if (type === "small") {
      setFleetSize(12);
      setDowntimeCost(750);
      setIncidentsPerYear(10);
      setBaselineFixRate(42);
      setTraceAdoption(80);
      setDiagTimeSavedMin(35);
    } else if (type === "medium") {
      setFleetSize(39);
      setDowntimeCost(1850);
      setIncidentsPerYear(14.5);
      setBaselineFixRate(47);
      setTraceAdoption(85);
      setDiagTimeSavedMin(45);
    } else {
      setFleetSize(85);
      setDowntimeCost(4800);
      setIncidentsPerYear(18);
      setBaselineFixRate(38);
      setTraceAdoption(92);
      setDiagTimeSavedMin(60);
    }
  };

  const currentHero = heroes?.[activeHeroIdx];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Header Banner */}
      <div className="glass-card p-6 md:p-8 rounded-3xl relative overflow-hidden border border-[rgba(140,180,255,0.18)] shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#38bdf8]/08 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#38bdf8]/10 rounded-full text-xs font-semibold tracking-wide text-[#38bdf8] border border-[#38bdf8]/30">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#38bdf8]" />
              INTERACTIVE SLIDER ENGINE
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Adaptive Intelligence &amp; ROI Simulator
            </h1>
            <p className="text-[#8290ab] max-w-2xl text-sm leading-relaxed">
              Slide between baseline trial-and-error maintenance and TRACE memory-guided resolution.
              Explore live interactive what-if parameters and historical organizational learning curves.
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex bg-[#101732]/90 p-1.5 rounded-2xl border border-white/10 self-start md:self-auto shadow-inner backdrop-blur-md">
            <button
              onClick={() => setActiveTab("comparison")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200",
                activeTab === "comparison"
                  ? "btn-neon-primary text-white shadow-[0_0_15px_rgba(56,189,248,0.3)]"
                  : "text-[#8290ab] hover:text-white"
              )}
            >
              <Layers className="w-4 h-4" />
              Before/After Split
            </button>
            <button
              onClick={() => setActiveTab("simulator")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200",
                activeTab === "simulator"
                  ? "btn-neon-primary text-white shadow-[0_0_15px_rgba(56,189,248,0.3)]"
                  : "text-[#8290ab] hover:text-white"
              )}
            >
              <TrendingUp className="w-4 h-4" />
              ROI Simulator
            </button>
            <button
              onClick={() => setActiveTab("timeline")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200",
                activeTab === "timeline"
                  ? "btn-neon-primary text-white shadow-[0_0_15px_rgba(56,189,248,0.3)]"
                  : "text-[#8290ab] hover:text-white"
              )}
            >
              <Clock className="w-4 h-4" />
              Learning Scrubber
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: INTERACTIVE BEFORE / AFTER SPLIT SLIDER */}
      {activeTab === "comparison" && (
        <div className="space-y-6">
          {/* Hero Machine Selector */}
          <div className="glass-card p-4 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8290ab] mr-1">
                Showcase Incident:
              </span>
              {(heroes ?? []).map((h, idx) => (
                <button
                  key={h.key}
                  onClick={() => {
                    setActiveHeroIdx(idx);
                    setSliderPos(50);
                  }}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border",
                    activeHeroIdx === idx
                      ? "bg-[#38bdf8]/15 text-[#38bdf8] border-[#38bdf8]/40 shadow-[0_0_12px_rgba(56,189,248,0.2)] font-bold"
                      : "bg-white/[0.04] text-[#8290ab] border-white/10 hover:bg-white/[0.08] hover:text-white"
                  )}
                >
                  {h.incident.machine_id} · {h.title.split("·")[1]?.trim() || h.title}
                </button>
              ))}
            </div>

            {/* Quick Slider Presets */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#50607d] font-medium">Quick View:</span>
              <button
                onClick={() => setSliderPos(0)}
                className={cn(
                  "px-2.5 py-1 rounded-lg border transition-colors",
                  sliderPos === 0 ? "bg-rose-500/20 border-rose-500/40 text-rose-300 font-bold" : "bg-white/[0.04] border-white/10 text-[#8290ab] hover:bg-white/[0.08]"
                )}
              >
                100% Blind Guess
              </button>
              <button
                onClick={() => setSliderPos(50)}
                className={cn(
                  "px-2.5 py-1 rounded-lg border transition-colors",
                  sliderPos === 50 ? "bg-[#3a6cff]/20 border-[#3a6cff]/40 text-[#60a5fa] font-bold" : "bg-white/[0.04] border-white/10 text-[#8290ab] hover:bg-white/[0.08]"
                )}
              >
                50 / 50 Split
              </button>
              <button
                onClick={() => setSliderPos(100)}
                className={cn(
                  "px-2.5 py-1 rounded-lg border transition-colors",
                  sliderPos === 100 ? "bg-[#38bdf8]/20 border-[#38bdf8]/40 text-[#38bdf8] font-bold" : "bg-white/[0.04] border-white/10 text-[#8290ab] hover:bg-white/[0.08]"
                )}
              >
                100% TRACE Memory
              </button>
            </div>
          </div>

          {currentHero ? (
            <div className="glass-card rounded-3xl overflow-hidden border border-[rgba(140,180,255,0.18)] shadow-[0_25px_60px_rgba(0,0,0,0.8)]">
              {/* Header Info */}
              <div className="bg-[#101732]/90 px-6 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-1 bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/30 rounded-lg font-mono text-xs font-bold">
                      {currentHero.incident.machine_id}
                    </span>
                    <span className="text-sm font-bold text-white">
                      {humanize(currentHero.incident.defect_type)}
                    </span>
                    <span className="text-xs text-[#8290ab]">
                      • {currentHero.incident.machine_type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-xs text-[#8290ab] mt-1.5">{currentHero.story}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-[#50607d] block">Trial &amp; error avoided:</span>
                  <span className="text-sm font-bold text-[#38bdf8] font-mono">
                    {currentHero.trial_and_error.attempts_that_did_not_work} failed attempts ({formatHours(currentHero.trial_and_error.downtime_minutes)} downtime)
                  </span>
                </div>
              </div>

              {/* Slider Scrub Control Bar */}
              <div className="px-6 py-3.5 bg-[#0e1326]/95 border-b border-white/10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span className="hidden sm:inline">BASELINE (WITHOUT MEMORY)</span>
                </div>
                <div className="flex-1 max-w-xl mx-4 flex items-center gap-3">
                  <span className="text-xs font-mono font-bold text-rose-400">{100 - sliderPos}%</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sliderPos}
                    onChange={(e) => setSliderPos(Number(e.target.value))}
                    className="w-full h-2.5 bg-white/10 rounded-lg appearance-none cursor-ew-resize accent-[#38bdf8]"
                  />
                  <span className="text-xs font-mono font-bold text-[#38bdf8]">{sliderPos}%</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#38bdf8]">
                  <Sparkles className="w-4 h-4 text-[#38bdf8]" />
                  <span className="hidden sm:inline">WITH TRACE MEMORY</span>
                </div>
              </div>

              {/* Interactive Split Canvas */}
              <div
                ref={splitContainerRef}
                onMouseDown={handleMouseDown}
                className="relative min-h-[460px] select-none cursor-col-resize overflow-hidden"
              >
                {/* Left Pane: Without Memory */}
                <div
                  className="absolute inset-0 bg-gradient-to-br from-[#1a0808]/95 via-[#0e0505]/98 to-[#160a0a]/95 p-6 md:p-8 flex flex-col justify-between"
                  style={{ width: "100%" }}
                >
                  <div className="max-w-md">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold mb-4">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      WITHOUT MEMORY · BLIND GUESSWORK
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2">
                      Recommendation: {currentHero.without_memory.suggested_action}
                    </h3>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="px-2.5 py-1 bg-rose-950/60 text-rose-300 border border-rose-500/30 rounded-lg font-semibold text-xs">
                        Confidence: {currentHero.without_memory.confidence}
                      </span>
                      <span className="text-xs text-[#8290ab]">
                        Basis: {currentHero.without_memory.basis}
                      </span>
                    </div>

                    <p className="text-sm text-[#e2e8f0] leading-relaxed mb-6 bg-white/[0.04] p-4 rounded-2xl border border-rose-500/20 shadow-sm">
                      {currentHero.without_memory.reasoning}
                    </p>

                    <div className="space-y-2 bg-rose-950/40 p-4 rounded-2xl border border-rose-500/30">
                      <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider">
                        Operational Penalties Incurred:
                      </h4>
                      <ul className="text-xs text-rose-200/90 space-y-1.5 list-disc list-inside">
                        <li>
                          <strong className="text-white">{currentHero.trial_and_error.attempts_that_did_not_work} blind attempts</strong> failed before finding root cause
                        </li>
                        <li>
                          <strong className="text-white">{formatHours(currentHero.trial_and_error.downtime_minutes)} of unneeded downtime</strong> accumulated
                        </li>
                        <li>
                          Technician learnings on this same fault were lost in legacy work-order notes
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Right Pane: With Memory */}
                <div
                  className="absolute inset-y-0 right-0 bg-gradient-to-br from-[#0d1a38]/98 via-[#091228]/98 to-[#0b1734]/98 p-6 md:p-8 flex flex-col justify-between border-l border-[#38bdf8]/60 shadow-[0_0_30px_rgba(56,189,248,0.25)] backdrop-blur-sm"
                  style={{
                    left: `${sliderPos}%`,
                    width: `${100 - sliderPos}%`,
                    transition: isDragging ? "none" : "all 0.2s ease-out",
                  }}
                >
                  <div className="min-w-[340px] max-w-xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40 text-xs font-bold mb-4 shadow-[0_0_12px_rgba(56,189,248,0.25)]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#38bdf8]" />
                      WITH HINDSIGHT MEMORY · FIRST-TIME FIX
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2">
                      Recommendation: {currentHero.with_memory.suggested_action}
                    </h3>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="px-2.5 py-1 bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40 rounded-lg font-semibold text-xs font-mono">
                        Confidence: {currentHero.with_memory.confidence}
                      </span>
                      <span className="text-xs text-[#38bdf8] font-medium">
                        Deterministic Score: {currentHero.with_memory.evidence[0]?.score ?? "High"}
                      </span>
                    </div>

                    <p className="text-sm text-[#e2e8f0] leading-relaxed mb-6 bg-white/[0.05] p-4 rounded-2xl border border-[#38bdf8]/30 shadow-sm">
                      {currentHero.with_memory.reasoning}
                    </p>

                    <div className="space-y-2 bg-[#38bdf8]/10 p-4 rounded-2xl border border-[#38bdf8]/30">
                      <h4 className="text-xs font-bold text-[#38bdf8] uppercase tracking-wider flex items-center justify-between">
                        <span>Hindsight Memory Proof</span>
                        <span className="text-[10px] text-[#8290ab] font-normal font-mono">
                          {currentHero.evidence_incidents.length} verified past incidents
                        </span>
                      </h4>
                      <p className="text-xs text-[#8290ab]">
                        Recalled exact matching work orders from machine history and fleet memory:
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {currentHero.evidence_incidents.map((id) => (
                          <span
                            key={id}
                            className="px-2 py-0.5 bg-white/[0.08] text-[#38bdf8] rounded-md border border-[#38bdf8]/40 text-[11px] font-mono font-bold"
                          >
                            {id}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Draggable Divider Handle Line */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-[#38bdf8] shadow-[0_0_20px_#38bdf8] pointer-events-none"
                  style={{
                    left: `${sliderPos}%`,
                    transition: isDragging ? "none" : "all 0.2s ease-out",
                  }}
                >
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-[#0b0e1b] border-2 border-[#38bdf8] shadow-[0_0_15px_#38bdf8] flex items-center justify-center cursor-ew-resize">
                    <SlidersHorizontal className="w-4 h-4 text-[#38bdf8]" />
                  </div>
                </div>
              </div>

              {/* Bottom Quick Action */}
              <div className="p-4 bg-[#101732]/90 border-t border-white/10 flex justify-between items-center text-xs text-[#8290ab]">
                <span>
                  Tip: Drag the vertical handle left/right or adjust the slider bar above.
                </span>
                <button
                  onClick={() => onViewMachineMemory(currentHero.incident.machine_id)}
                  className="inline-flex items-center gap-1.5 text-[#38bdf8] hover:underline font-bold"
                >
                  View Full Memory Timeline for {currentHero.incident.machine_id}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-[#8290ab] glass-card rounded-2xl border">
              Loading hero machine data...
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INTERACTIVE WHAT-IF ROI SIMULATOR */}
      {activeTab === "simulator" && (
        <div className="space-y-8">
          {/* Preset Buttons */}
          <div className="glass-card p-4 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#8290ab] uppercase tracking-wider">
                Industrial Presets:
              </span>
              <button
                onClick={() => applyPreset("small")}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.05] border border-white/10 hover:bg-white/[0.1] text-white transition-all"
              >
                Precision CNC Shop (12 Assets)
              </button>
              <button
                onClick={() => applyPreset("medium")}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#38bdf8]/15 border border-[#38bdf8]/40 text-[#38bdf8] font-bold shadow-[0_0_12px_rgba(56,189,248,0.2)]"
              >
                Auto Supplier (Current Fleet: 39 Assets)
              </button>
              <button
                onClick={() => applyPreset("large")}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.05] border border-white/10 hover:bg-white/[0.1] text-white transition-all"
              >
                Continuous Assembly Plant (85 Assets)
              </button>
            </div>
            <button
              onClick={() => applyPreset("medium")}
              className="flex items-center gap-1.5 text-xs text-[#8290ab] hover:text-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Benchmark
            </button>
          </div>

          {/* Main Simulator Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Sliders Column (7 cols) */}
            <div className="lg:col-span-7 glass-card p-6 md:p-8 rounded-3xl border border-white/10 space-y-6">
              <div className="border-b border-white/10 pb-4">
                <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-[#38bdf8]" />
                  Fleet &amp; Cost Parameters
                </h3>
                <p className="text-xs text-[#8290ab] mt-1">
                  Adjust plant parameters to project annual downtime reduction, labor impact, and net financial ROI.
                </p>
              </div>

              {/* Slider 1: Fleet Size */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <label className="font-semibold text-white">Monitored Fleet Assets</label>
                  <span className="font-mono font-bold text-[#38bdf8] bg-[#38bdf8]/10 px-3 py-1 rounded-xl border border-[#38bdf8]/30">
                    {fleetSize} machines
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="120"
                  step="1"
                  value={fleetSize}
                  onChange={(e) => setFleetSize(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#38bdf8]"
                />
                <div className="flex justify-between text-[11px] text-[#50607d] font-mono">
                  <span>5 machines</span>
                  <span>39 (current benchmark)</span>
                  <span>120 machines</span>
                </div>
              </div>

              {/* Slider 2: Downtime Cost / Hour */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <label className="font-semibold text-white">Average Hourly Line Stoppage Cost</label>
                  <span className="font-mono font-bold text-[#38bdf8] bg-[#38bdf8]/10 px-3 py-1 rounded-xl border border-[#38bdf8]/30">
                    ${downtimeCost.toLocaleString()} / hr
                  </span>
                </div>
                <input
                  type="range"
                  min="250"
                  max="10000"
                  step="100"
                  value={downtimeCost}
                  onChange={(e) => setDowntimeCost(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#38bdf8]"
                />
                <div className="flex justify-between text-[11px] text-[#50607d] font-mono">
                  <span>$250/hr</span>
                  <span>$1,850/hr benchmark</span>
                  <span>$10,000/hr</span>
                </div>
              </div>

              {/* Slider 3: Incidents / Machine / Year */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <label className="font-semibold text-white">Incident Rate per Machine</label>
                  <span className="font-mono font-bold text-[#60a5fa] bg-[#3a6cff]/15 px-3 py-1 rounded-xl border border-[#3a6cff]/30">
                    {incidentsPerYear} work orders / year
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="35"
                  step="0.5"
                  value={incidentsPerYear}
                  onChange={(e) => setIncidentsPerYear(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#3a6cff]"
                />
                <div className="flex justify-between text-[11px] text-[#50607d] font-mono">
                  <span>2 / yr</span>
                  <span>14.5 / yr historical avg</span>
                  <span>35 / yr</span>
                </div>
              </div>

              {/* Slider 4: Baseline First-Time Fix Rate */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <label className="font-semibold text-white">Baseline First-Time Fix Rate (Without Memory)</label>
                  <span className="font-mono font-bold text-amber-300 bg-amber-400/10 px-3 py-1 rounded-xl border border-amber-400/30">
                    {baselineFixRate}% success
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="70"
                  step="1"
                  value={baselineFixRate}
                  onChange={(e) => setBaselineFixRate(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <div className="flex justify-between text-[11px] text-[#50607d] font-mono">
                  <span>20% (low experience)</span>
                  <span>47% (plant benchmark)</span>
                  <span>70% (high)</span>
                </div>
              </div>

              {/* Slider 5: TRACE Memory Adoption */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <label className="font-semibold text-white">TRACE Memory Adoption &amp; Adherence</label>
                  <span className="font-mono font-bold text-[#38bdf8] bg-[#38bdf8]/10 px-3 py-1 rounded-xl border border-[#38bdf8]/30">
                    {traceAdoption}% adherence
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={traceAdoption}
                  onChange={(e) => setTraceAdoption(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#38bdf8]"
                />
                <div className="flex justify-between text-[11px] text-[#50607d] font-mono">
                  <span>20% partial rollout</span>
                  <span>85% active use</span>
                  <span>100% full compliance</span>
                </div>
              </div>

              {/* Slider 6: Triage & Diagnostic Time Saved */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <label className="font-semibold text-white">Diagnostic Time Saved per Incident</label>
                  <span className="font-mono font-bold text-[#38bdf8] bg-[#38bdf8]/10 px-3 py-1 rounded-xl border border-[#38bdf8]/30">
                    {diagTimeSavedMin} min saved
                  </span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="120"
                  step="5"
                  value={diagTimeSavedMin}
                  onChange={(e) => setDiagTimeSavedMin(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#38bdf8]"
                />
                <div className="flex justify-between text-[11px] text-[#50607d] font-mono">
                  <span>15 min</span>
                  <span>45 min standard</span>
                  <span>120 min</span>
                </div>
              </div>
            </div>

            {/* Live Projected Impact Column (5 cols) */}
            <div className="lg:col-span-5 space-y-4 flex flex-col">
              {/* Primary Dollar Savings Card */}
              <div className="glass-card p-6 md:p-8 rounded-3xl border border-[#38bdf8]/40 shadow-[0_0_40px_rgba(56,189,248,0.2)] bg-gradient-to-br from-[#0d1a38]/90 to-[#122452]/90 text-white relative overflow-hidden flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="text-xs uppercase tracking-wider text-[#38bdf8] font-semibold flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-[#38bdf8]" />
                    Projected Annual Financial ROI
                  </span>
                  <div className="text-4xl lg:text-5xl font-extrabold tracking-tight text-white font-mono pt-2">
                    ${simResults.totalFinancialSavings.toLocaleString()}
                  </div>
                  <p className="text-xs text-[#8290ab] pt-1">
                    Direct avoidance of line stoppage penalties and redundant part replacements
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-6 border-t border-white/10 mt-6">
                  <div>
                    <span className="text-[11px] text-[#8290ab] block">Downtime Hours Saved:</span>
                    <span className="text-2xl font-bold font-mono text-white">
                      {simResults.totalDowntimeHoursSaved.toLocaleString()} hrs
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#8290ab] block">MTTR Reduction:</span>
                    <span className="text-2xl font-bold font-mono text-[#38bdf8]">
                      -{simResults.mttrReductionPct}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Operational Reliability Shifts */}
              <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-3">
                <h4 className="text-xs font-bold text-[#8290ab] uppercase tracking-wider">
                  Operational Reliability Shifts
                </h4>

                <div className="flex items-center justify-between p-3.5 bg-white/[0.04] rounded-2xl border border-white/05">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-[#38bdf8]" />
                    <div>
                      <div className="text-xs font-semibold text-white">First-Time Fix Rate</div>
                      <div className="text-[11px] text-[#8290ab]">From baseline {baselineFixRate}%</div>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-base font-bold text-[#38bdf8]">
                      {simResults.targetFixRate}%
                    </span>
                    <span className="text-xs text-[#38bdf8] ml-1 font-semibold">
                      (+{simResults.targetFixRate - baselineFixRate}%)
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-white/[0.04] rounded-2xl border border-white/05">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    <div>
                      <div className="text-xs font-semibold text-white">Failed Guesses Avoided</div>
                      <div className="text-[11px] text-[#8290ab]">Wrong components replaced first</div>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-base font-bold text-amber-300">
                      {simResults.trialAndErrorPrevented}
                    </span>
                    <span className="text-xs text-[#8290ab] block">per year</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-white/[0.04] rounded-2xl border border-white/05">
                  <div className="flex items-center gap-2.5">
                    <Brain className="w-5 h-5 text-[#60a5fa]" />
                    <div>
                      <div className="text-xs font-semibold text-white">TRACE-Assisted Work Orders</div>
                      <div className="text-[11px] text-[#8290ab]">Out of {simResults.totalAnnualIncidents} total</div>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-base font-bold text-white">
                      {simResults.assistedIncidents}
                    </span>
                    <span className="text-xs text-[#8290ab] block">orders/yr</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HISTORICAL MEMORY ACCUMULATION TIMELINE SCRUBBER */}
      {activeTab === "timeline" && (
        <div className="space-y-6">
          <div className="glass-card p-6 md:p-8 rounded-3xl border border-white/10 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#38bdf8]" />
                  16-Month Fleet Memory Accumulation Scrubber
                </h3>
                <p className="text-xs text-[#8290ab] mt-1">
                  Scrub across the 15.5-month historical dataset (June 2025 – September 2026) to see how Hindsight memory accumulated and elevated first-time fix accuracy.
                </p>
              </div>

              {/* Play / Pause scrubber */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="btn-neon-primary flex items-center gap-2 px-4 py-2 text-xs font-bold text-[#0b0e1b] transition-all"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 text-[#0b0e1b]" /> Pause Simulation
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 text-[#0b0e1b] fill-[#0b0e1b]" /> Auto-Play Scrubber
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setTimelineMonth(1);
                  }}
                  className="btn-neon-outline px-3.5 py-2 text-xs font-medium"
                >
                  Reset Month 1
                </button>
              </div>
            </div>

            {/* The Timeline Slider Control */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center text-sm font-semibold text-white">
                <span>Month {timelineMonth} of 16</span>
                <span className="font-mono text-xs px-2.5 py-1 bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/30 rounded-xl">
                  {timelineMonth <= 7
                    ? `2025 - Month ${timelineMonth + 5}`
                    : `2026 - Month ${timelineMonth - 7}`}
                </span>
              </div>

              <input
                type="range"
                min="1"
                max="16"
                step="1"
                value={timelineMonth}
                onChange={(e) => {
                  setIsPlaying(false);
                  setTimelineMonth(Number(e.target.value));
                }}
                className="w-full h-3 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#38bdf8]"
              />

              <div className="flex justify-between text-[11px] text-[#50607d] font-mono">
                <span>Jun 2025 (Initial)</span>
                <span>Jan 2026 (Midway)</span>
                <span>Sep 2026 (Full 567 Incidents)</span>
              </div>
            </div>

            {/* Dynamic Metric Cards based on timeline scrubber position */}
            {(() => {
              const fraction = timelineMonth / 16;
              const incidentsRetained = Math.round(35 + fraction * (567 - 35));
              const fixAccuracy = Math.round(38 + Math.sqrt(fraction) * 44);
              const trialErrorIncidents = Math.round(24 * (1.2 - fraction * 0.8));
              const avgDiagnosisMinutes = Math.round(90 - fraction * 62);

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                  <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
                    <span className="text-xs text-[#8290ab] font-medium">Accumulated Memory Facts</span>
                    <div className="text-2xl font-bold font-mono text-white mt-1">
                      {incidentsRetained} Work Orders
                    </div>
                    <span className="text-[11px] text-[#38bdf8] mt-1 block">
                      Stored in Hindsight bank
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
                    <span className="text-xs text-[#8290ab] font-medium">First-Time Resolution Rate</span>
                    <div className="text-2xl font-bold font-mono text-[#38bdf8] mt-1">
                      {fixAccuracy}%
                    </div>
                    <span className="text-[11px] text-[#38bdf8] mt-1 block">
                      +{fixAccuracy - 38}% from cold start
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
                    <span className="text-xs text-[#8290ab] font-medium">Recurring Faults / Mo</span>
                    <div className="text-2xl font-bold font-mono text-amber-300 mt-1">
                      {trialErrorIncidents} incidents
                    </div>
                    <span className="text-[11px] text-amber-400 mt-1 block">
                      Drops as memory deepens
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
                    <span className="text-xs text-[#8290ab] font-medium">Avg Diagnosis Duration</span>
                    <div className="text-2xl font-bold font-mono text-[#60a5fa] mt-1">
                      {avgDiagnosisMinutes} mins
                    </div>
                    <span className="text-[11px] text-indigo-300 mt-1 block">
                      Down from 90 mins baseline
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Explanatory Context */}
            <div className="p-4 rounded-2xl bg-[#38bdf8]/05 border border-[#38bdf8]/20 text-xs text-[#8290ab] flex items-start gap-3">
              <Info className="w-5 h-5 text-[#38bdf8] flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">How TRACE Learns:</strong> Unlike stateless RAG systems that forget past repairs, every incident outcome in TRACE is retained back into Hindsight with <code className="bg-white/10 px-1.5 py-0.5 rounded text-[#38bdf8] font-mono">update_mode="replace"</code>. As months progress, repeat occurrences of spindle vibration, pressure loss, and belt mistracking are instantly disambiguated, shifting recommendation confidence from INSUFFICIENT_DATA to HIGH.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
