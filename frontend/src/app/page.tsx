"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar, type View } from "@/components/Sidebar";
import { Dashboard } from "@/components/Dashboard";
import { ReportIncident } from "@/components/ReportIncident";
import { IncidentAnalysis } from "@/components/IncidentAnalysis";
import { MachineMemory } from "@/components/MachineMemory";
import { BeforeAfterMemory } from "@/components/BeforeAfterMemory";
import { SliderDashboard } from "@/components/SliderDashboard";
import { IntelligencePage } from "@/components/intelligence/IntelligencePage";
import { JudgeBar, PresentationContext, type JudgeTarget } from "@/components/JudgeMode";
import type { AnalysisResult, DemoPreset } from "@/types/incident";

const JUDGE_KEY = "trace.judgeMode";

export default function Home() {
  const [currentView, setCurrentView] = useState<View>("landing");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState<string>("");
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);
  const [reportPreset, setReportPreset] = useState<DemoPreset | null>(null);
  const [judgeMode, setJudgeMode] = useState(false);

  // Judge mode survives reloads and can be opened with ?judge=1.
  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("judge") === "1";
      setJudgeMode(fromUrl || window.localStorage.getItem(JUDGE_KEY) === "1");
    } catch {
      /* storage unavailable: default off */
    }
  }, []);

  const toggleJudgeMode = (on: boolean) => {
    setJudgeMode(on);
    try {
      window.localStorage.setItem(JUDGE_KEY, on ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const viewKey = `${currentView}:${currentView === "analysis" ? analysisResult?.current_incident.incident_id : ""}:${
    currentView === "memory" ? selectedMachineId : ""
  }:${currentView === "report" ? reportPreset?.key ?? "blank" : ""}`;

  // New page: start at the top and move focus to its heading for keyboard and screen-reader users.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    const heading = document.querySelector<HTMLElement>("main h1");
    heading?.focus({ preventScroll: true });
  }, [viewKey]);

  const openReport = (preset: DemoPreset | null = null) => {
    setReportPreset(preset);
    setCurrentView("report");
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const checkParams = () => {
        const params = new URLSearchParams(window.location.search);
        const v = params.get("view") as View;
        const m = params.get("machine");
        if (m) setSelectedMachineId(m);
        if (v && ["landing", "dashboard", "report", "analysis", "memory", "sliders", "intelligence"].includes(v)) {
          setCurrentView(v);
        }
      };
      checkParams();
      window.addEventListener("popstate", checkParams);

      const handleMessage = (e: MessageEvent) => {
        if (e.data?.action === "navigate" && e.data?.view) {
          setCurrentView(e.data.view);
          const url = new URL(window.location.href);
          url.searchParams.set("view", e.data.view);
          window.history.pushState({}, "", url.toString());
        }
      };
      window.addEventListener("message", handleMessage);

      return () => {
        window.removeEventListener("popstate", checkParams);
        window.removeEventListener("message", handleMessage);
      };
    }
  }, []);

  const handleAnalysisComplete = (result: AnalysisResult) => {
    setAnalysisResult(result);
    setCurrentView("analysis");
  };

  const handleViewMachineMemory = (machineId: string) => {
    setSelectedMachineId(machineId);
    setCurrentView("memory");
  };

  const handleNavigate = (view: View) => {
    if (view === "report") setReportPreset(null);
    if (view === "memory") setSelectedMachineId("");
    setCurrentView(view);
  };

  const handleJudgeTarget = useCallback((target: JudgeTarget) => {
    setShowBeforeAfter(false);
    switch (target.view) {
      case "dashboard":
        setCurrentView("dashboard");
        break;
      case "intelligence":
        setCurrentView("intelligence");
        if (target.compare) setShowBeforeAfter(true);
        break;
      case "report":
        setReportPreset(target.preset);
        setCurrentView("report");
        break;
      case "memory":
        setSelectedMachineId(target.machineId);
        setCurrentView("memory");
        break;
    }
  }, []);

  const renderContent = () => {
    switch (currentView) {
      case "intelligence":
        return <IntelligencePage onViewMachineMemory={handleViewMachineMemory} onCompare={() => setShowBeforeAfter(true)} />;
      case "sliders":
        return (
          <SliderDashboard
            onViewMachineMemory={handleViewMachineMemory}
            onReportIncident={() => openReport()}
          />
        );
      case "report":
        return (
          <ReportIncident
            preset={reportPreset?.incident}
            onAnalysisComplete={handleAnalysisComplete}
            onCancel={() => setCurrentView("dashboard")}
          />
        );
      case "analysis":
        if (analysisResult) {
          return (
            <IncidentAnalysis
              result={analysisResult}
              onBack={() => setCurrentView("dashboard")}
              onViewMachineMemory={handleViewMachineMemory}
            />
          );
        }
        return <Dashboard onReportIncident={() => openReport()} onViewMachineMemory={handleViewMachineMemory} />;
      case "memory":
        return (
          <MachineMemory
            machineId={selectedMachineId}
            onSelectMachine={handleViewMachineMemory}
            onReportIncident={() => openReport()}
            onBack={() => setCurrentView("dashboard")}
          />
        );
      case "dashboard":
      default:
        return <Dashboard onReportIncident={() => openReport()} onViewMachineMemory={handleViewMachineMemory} />;
    }
  };

  // Landing page with 3D iframe
  if (currentView === "landing") {
    return (
      <main className="w-full h-screen fixed inset-0 overflow-hidden bg-[#04060f] z-50">
        <iframe
          src="/landing.html"
          className="w-full h-full border-0"
          title="TRACE 3D Landing Page"
        />
      </main>
    );
  }

  return (
    <PresentationContext.Provider value={judgeMode}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:text-industrial-900 focus:px-3 focus:py-2 focus:rounded-lg focus:shadow"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen liquid-glass-wallpaper text-[#f8fafc] relative overflow-x-hidden selection:bg-[#38bdf8]/30 selection:text-white">
        {/* Luminous Wallpaper Light Waves */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute -top-24 right-1/4 w-[700px] h-[600px] bg-gradient-to-br from-[#2563eb]/28 via-[#0ea5e9]/20 to-transparent rounded-full blur-[130px] transform rotate-12" />
          <div className="absolute top-1/3 -left-20 w-[800px] h-[350px] bg-gradient-to-tr from-[#4f46e5]/22 via-[#38bdf8]/15 to-transparent rounded-full blur-[120px] transform -rotate-12" />
          <div className="absolute -bottom-32 left-10 w-[700px] h-[550px] bg-gradient-to-tr from-[#7c3aed]/25 via-[#2563eb]/20 to-transparent rounded-full blur-[150px]" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-[#0284c7]/18 rounded-full blur-[140px]" />
        </div>

        <div className="relative z-10 flex w-full">
          <Sidebar
            currentView={currentView}
            onNavigate={handleNavigate}
            onViewMachineMemory={handleViewMachineMemory}
            judgeMode={judgeMode}
            onToggleJudgeMode={toggleJudgeMode}
          />
          <main id="main" className={judgeMode ? "flex-1 p-6 md:p-8 lg:p-10 pb-28 min-w-0 overflow-y-auto" : "flex-1 p-6 md:p-8 lg:p-10 min-w-0 overflow-y-auto"}>
            <div key={viewKey} className="animate-fade-in max-w-[1400px] mx-auto">
              {renderContent()}
            </div>
          </main>
        </div>

        {showBeforeAfter && (
          <BeforeAfterMemory
            onClose={() => setShowBeforeAfter(false)}
            onViewMachineMemory={(machineId) => {
              setShowBeforeAfter(false);
              handleViewMachineMemory(machineId);
            }}
          />
        )}
      </div>
      {judgeMode && <JudgeBar onNavigate={handleJudgeTarget} onExit={() => toggleJudgeMode(false)} />}
    </PresentationContext.Provider>
  );
}
