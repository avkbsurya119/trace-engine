/**
 * API client for TRACE backend
 */

import type {
  IncidentCreate,
  IncidentUpdate,
  Incident,
  AnalysisResult,
  DashboardStats,
  MachineMemory,
  Fleet,
} from "@/types/incident";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

export const api = {
  /**
   * Submit an incident for analysis
   */
  analyzeIncident: (incident: IncidentCreate): Promise<AnalysisResult> =>
    fetchAPI<AnalysisResult>("/incidents/analyze", {
      method: "POST",
      body: JSON.stringify(incident),
    }),

  /**
   * Get a specific incident by ID
   */
  getIncident: (incidentId: string): Promise<Incident> =>
    fetchAPI<Incident>(`/incidents/${incidentId}`),

  /**
   * Record the outcome of an incident
   */
  recordOutcome: (
    incidentId: string,
    update: IncidentUpdate
  ): Promise<Incident> =>
    fetchAPI<Incident>(`/incidents/${incidentId}/outcome`, {
      method: "PATCH",
      body: JSON.stringify(update),
    }),

  /**
   * Get machine memory/history
   */
  getMachineMemory: (machineId: string): Promise<MachineMemory> =>
    fetchAPI<MachineMemory>(`/incidents/machine/${machineId}/memory`),

  /**
   * Get dashboard statistics
   */
  getDashboardStats: (): Promise<DashboardStats> =>
    fetchAPI<DashboardStats>("/dashboard/stats"),

  /**
   * Machine types, machines, defect types and intervention categories
   */
  getFleet: (): Promise<Fleet> => fetchAPI<Fleet>("/dashboard/fleet"),

  /**
   * Health check
   */
  healthCheck: (): Promise<{ status: string; service: string }> =>
    fetchAPI("/dashboard/health"),
};
