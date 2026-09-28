"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Dashboard } from "@/components/Dashboard";
import { ReportIncident } from "@/components/ReportIncident";
import { IncidentAnalysis } from "@/components/IncidentAnalysis";
import { MachineMemory } from "@/components/MachineMemory";
import { BeforeAfterMemory } from "@/components/BeforeAfterMemory";
import type { AnalysisResult } from "@/types/incident";

type View = "dashboard" | "report" | "analysis" | "memory";

export default function Home() {
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [selectedMachineId, setSelectedMachineId] = useState<string>("");
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);

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
