"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Dashboard } from "@/components/Dashboard";
import { ReportIncident } from "@/components/ReportIncident";
import { IncidentAnalysis } from "@/components/IncidentAnalysis";
import { MachineMemory } from "@/components/MachineMemory";
import { BeforeAfterMemory } from "@/components/BeforeAfterMemory";
import { SliderDashboard } from "@/components/SliderDashboard";
import type { AnalysisResult } from "@/types/incident";

type View = "landing" | "dashboard" | "report" | "analysis" | "memory" | "sliders";

export default function Home() {
  const [currentView, setCurrentView] = useState<View>("landing");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [selectedMachineId, setSelectedMachineId] = useState<string>("");
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const checkParams = () => {
        const params = new URLSearchParams(window.location.search);
        const v = params.get("view") as View;
        const m = params.get("machine");
        if (m) setSelectedMachineId(m);
        if (v && ["landing", "dashboard", "report", "analysis", "memory", "sliders"].includes(v)) {
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
    setCurrentView(view);
    // Clear machine ID when navigating away from memory
    if (view !== "memory") {
      setSelectedMachineId("");
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case "dashboard":
        return (
          <Dashboard
            onReportIncident={() => setCurrentView("report")}
            onViewMachineMemory={handleViewMachineMemory}
            onShowBeforeAfter={() => setShowBeforeAfter(true)}
            onOpenSliders={() => setCurrentView("sliders")}
          />
        );
      case "sliders":
        return (
          <SliderDashboard
            onViewMachineMemory={handleViewMachineMemory}
            onReportIncident={() => setCurrentView("report")}
          />
        );
      case "report":
        return (
          <ReportIncident
            onAnalysisComplete={handleAnalysisComplete}
            onCancel={() => setCurrentView("dashboard")}
          />
        );
      case "analysis":
        return analysisResult ? (
          <IncidentAnalysis
            key={analysisResult.current_incident.incident_id}
            result={analysisResult}
            onBack={() => setCurrentView("dashboard")}
            onViewMachineMemory={handleViewMachineMemory}
          />
        ) : (
          <Dashboard
            onReportIncident={() => setCurrentView("report")}
            onViewMachineMemory={handleViewMachineMemory}
            onOpenSliders={() => setCurrentView("sliders")}
          />
        );
      case "memory":
        return (
          <MachineMemory
            key={selectedMachineId}
            machineId={selectedMachineId}
            onBack={() => setCurrentView("dashboard")}
          />
        );
      default:
        return null;
    }
  };

  if (currentView === "landing") {
    return (
      <main className="w-full h-screen fixed inset-0 overflow-hidden bg-[#04060f] z-50">
        <iframe
          src="/index.html"
          className="w-full h-full border-0"
          title="TRACE 3D Landing Page"
        />
      </main>
    );
  }

  return (
    <div className="flex min-h-screen liquid-glass-wallpaper text-[#f8fafc] relative overflow-x-hidden selection:bg-[#38bdf8]/30 selection:text-white">
      {/* Luminous Wallpaper Light Waves shining through frosted glass */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Top-right vibrant blue/cyan silk glow */}
        <div className="absolute -top-24 right-1/4 w-[700px] h-[600px] bg-gradient-to-br from-[#2563eb]/28 via-[#0ea5e9]/20 to-transparent rounded-full blur-[130px] transform rotate-12" />
        {/* Middle diagonal silk light streak */}
        <div className="absolute top-1/3 -left-20 w-[800px] h-[350px] bg-gradient-to-tr from-[#4f46e5]/22 via-[#38bdf8]/15 to-transparent rounded-full blur-[120px] transform -rotate-12" />
        {/* Bottom-left violet & indigo wave */}
        <div className="absolute -bottom-32 left-10 w-[700px] h-[550px] bg-gradient-to-tr from-[#7c3aed]/25 via-[#2563eb]/20 to-transparent rounded-full blur-[150px]" />
        {/* Ambient horizon rim */}
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-[#0284c7]/18 rounded-full blur-[140px]" />
      </div>

      <div className="relative z-10 flex w-full">
        <Sidebar
          currentView={currentView}
          onNavigate={handleNavigate}
          onViewMachineMemory={handleViewMachineMemory}
        />
        <main className="flex-1 p-6 md:p-8 lg:p-10 min-w-0 overflow-y-auto">
          {renderContent()}
        </main>
      </div>

      {/* Before/After Memory Modal */}
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
  );
}
