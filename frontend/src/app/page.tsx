"use client";

import { useEffect, useState } from "react";
import { Sidebar, type View } from "@/components/Sidebar";
import { Dashboard } from "@/components/Dashboard";
import { ReportIncident } from "@/components/ReportIncident";
import { IncidentAnalysis } from "@/components/IncidentAnalysis";
import { MachineMemory } from "@/components/MachineMemory";
import { BeforeAfterMemory } from "@/components/BeforeAfterMemory";
import { SliderDashboard } from "@/components/SliderDashboard";
import { IntelligencePage } from "@/components/intelligence/IntelligencePage";
import type { AnalysisResult, DemoPreset } from "@/types/incident";

export default function Home() {
  const [currentView, setCurrentView] = useState<View>("landing");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState<string>("");
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);
  const [reportPreset, setReportPreset] = useState<DemoPreset | null>(null);

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
    <>
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

        {/* Fixed Sidebar */}
        <div className="fixed top-0 left-0 h-screen z-20">
          <Sidebar
            currentView={currentView}
            onNavigate={handleNavigate}
            onViewMachineMemory={handleViewMachineMemory}
          />
        </div>

        {/* Main Content with left margin for sidebar */}
        <main id="main" className="flex-1 ml-64 p-6 md:p-8 lg:p-10 min-w-0 relative z-10">
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
    </>
  );
}
