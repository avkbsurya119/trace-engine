"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Dashboard } from "@/components/Dashboard";
import { ReportIncident } from "@/components/ReportIncident";
import { IncidentAnalysis } from "@/components/IncidentAnalysis";
import { MachineMemory } from "@/components/MachineMemory";
import { BeforeAfterMemory } from "@/components/BeforeAfterMemory";
import { IntelligencePage } from "@/components/intelligence/IntelligencePage";
import type { AnalysisResult, DemoPreset } from "@/types/incident";

type View = "dashboard" | "intelligence" | "report" | "analysis" | "memory";

export default function Home() {
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [selectedMachineId, setSelectedMachineId] = useState<string>("");
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);
  const [reportPreset, setReportPreset] = useState<DemoPreset | null>(null);

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
            onReportIncident={() => openReport()}
            onStartDemo={openReport}
            onViewMachineMemory={handleViewMachineMemory}
            onShowBeforeAfter={() => setShowBeforeAfter(true)}
          />
        );
      case "intelligence":
        return <IntelligencePage onViewMachineMemory={handleViewMachineMemory} />;
      case "report":
        return (
          <ReportIncident
            key={reportPreset?.key ?? "blank"}
            preset={reportPreset?.incident}
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
            onReportIncident={() => openReport()}
            onStartDemo={openReport}
            onViewMachineMemory={handleViewMachineMemory}
            onShowBeforeAfter={() => setShowBeforeAfter(true)}
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

  return (
    <div className="flex min-h-screen">
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        onViewMachineMemory={handleViewMachineMemory}
      />
      <main className="flex-1 p-8 bg-gray-50">{renderContent()}</main>

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
