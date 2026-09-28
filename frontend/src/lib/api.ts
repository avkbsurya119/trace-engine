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
  HeroMachine,
  HealthStatus,
} from "@/types/incident";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
  } catch {
    throw new Error(`Cannot reach the TRACE backend at ${API_URL}. Is it running?`);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const detail = Array.isArray(error.detail)
      ? error.detail.map((d: { loc?: string[]; msg: string }) => `${d.loc?.slice(-1)[0] ?? "field"}: ${d.msg}`).join("; ")
      : error.detail;
    throw new Error(detail || `API error: ${response.status}`);
  }

  return response.json();
}

const enc = encodeURIComponent;

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
    fetchAPI<Incident>(`/incidents/${enc(incidentId)}`),

  /**
   * Record the outcome of an incident
   */
  recordOutcome: (
    incidentId: string,
    update: IncidentUpdate
  ): Promise<Incident> =>
    fetchAPI<Incident>(`/incidents/${enc(incidentId)}/outcome`, {
      method: "PATCH",
      body: JSON.stringify(update),
    }),

  /**
   * Get machine memory/history
   */
  getMachineMemory: (machineId: string): Promise<MachineMemory> =>
    fetchAPI<MachineMemory>(`/incidents/machine/${enc(machineId)}/memory`),

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
   * Showcase machines with a live with/without-memory comparison
   */
  getHeroMachines: (): Promise<{ hero_machines: HeroMachine[] }> =>
    fetchAPI("/dashboard/hero-machines"),

  /**
   * Health check
   */
  healthCheck: (): Promise<HealthStatus> => fetchAPI<HealthStatus>("/dashboard/health"),
};
