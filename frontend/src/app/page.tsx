"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar, type View } from "@/components/Sidebar";
import { Dashboard } from "@/components/Dashboard";
import { ReportIncident } from "@/components/ReportIncident";
import { IncidentAnalysis } from "@/components/IncidentAnalysis";
import { MachineMemory } from "@/components/MachineMemory";
import { BeforeAfterMemory } from "@/components/BeforeAfterMemory";
import { IntelligencePage } from "@/components/intelligence/IntelligencePage";
import { JudgeBar, PresentationContext, type JudgeTarget } from "@/components/JudgeMode";
import type { AnalysisResult, DemoPreset } from "@/types/incident";

const JUDGE_KEY = "trace.judgeMode";

export default function Home() {
  const [currentView, setCurrentView] = useState<View>("dashboard");
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

  return (
    <PresentationContext.Provider value={judgeMode}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:text-industrial-900 focus:px-3 focus:py-2 focus:rounded-lg focus:shadow"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen">
        <Sidebar
          currentView={currentView}
          onNavigate={handleNavigate}
          onViewMachineMemory={handleViewMachineMemory}
          judgeMode={judgeMode}
          onToggleJudgeMode={toggleJudgeMode}
        />
        <main id="main" className={judgeMode ? "flex-1 p-8 pb-28 bg-gray-50 min-w-0" : "flex-1 p-8 bg-gray-50 min-w-0"}>
          <div key={viewKey} className="animate-fade-in max-w-[1400px] mx-auto">
            {renderContent()}
          </div>
        </main>

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
