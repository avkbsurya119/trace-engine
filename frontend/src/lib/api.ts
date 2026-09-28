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
  IntelligenceReport,
  ProblemKnowledge,
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

// The fleet catalog is static per backend run and the hero comparison is
// expensive (six recalls), so both are fetched once per page session.
let fleetCache: Promise<Fleet> | null = null;
let heroCache: Promise<{ hero_machines: HeroMachine[] }> | null = null;
let intelligenceCache: Promise<IntelligenceReport> | null = null;

function cached<T>(get: () => Promise<T> | null, set: (p: Promise<T> | null) => void, load: () => Promise<T>) {
  const existing = get();
  if (existing) return existing;
  const promise = load().catch((err) => {
    set(null); // do not cache failures
    throw err;
  });
  set(promise);
  return promise;
}

export const api = {
  /**
   * Submit an incident for analysis
   */
  analyzeIncident: (incident: IncidentCreate): Promise<AnalysisResult> => {
    intelligenceCache = null; // a new work order changes the intelligence report
    return fetchAPI<AnalysisResult>("/incidents/analyze", {
      method: "POST",
      body: JSON.stringify(incident),
    });
  },

  /**
   * Get a specific incident by ID
   */
  getIncident: (incidentId: string): Promise<Incident> =>
    fetchAPI<Incident>(`/incidents/${enc(incidentId)}`),

  /**
   * Record the outcome of an incident
   */
  // Recording an outcome changes what memory knows, so the cached hero
  // comparison is dropped.
  recordOutcome: (incidentId: string, update: IncidentUpdate): Promise<Incident> => {
    heroCache = null;
    intelligenceCache = null;
    return fetchAPI<Incident>(`/incidents/${enc(incidentId)}/outcome`, {
      method: "PATCH",
      body: JSON.stringify(update),
    });
  },

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
  getFleet: (): Promise<Fleet> =>
    cached(() => fleetCache, (p) => (fleetCache = p), () => fetchAPI<Fleet>("/dashboard/fleet")),

  /**
   * Showcase machines with a live with/without-memory comparison
   */
  getHeroMachines: (options?: { refresh?: boolean }): Promise<{ hero_machines: HeroMachine[] }> => {
    if (options?.refresh) heroCache = null;
    return cached(() => heroCache, (p) => (heroCache = p), () => fetchAPI("/dashboard/hero-machines"));
  },

  /**
   * TRACE Intelligence: accumulated-memory report (cached per session)
   */
  getIntelligence: (options?: { refresh?: boolean }): Promise<IntelligenceReport> => {
    if (options?.refresh) intelligenceCache = null;
    return cached(() => intelligenceCache, (p) => (intelligenceCache = p), () => fetchAPI<IntelligenceReport>("/intelligence"));
  },

  /**
   * What TRACE would recommend for one problem from all recorded outcomes
   */
  getProblemKnowledge: (machineType: string, defectType: string, machineId?: string): Promise<ProblemKnowledge> => {
    const params = new URLSearchParams({ machine_type: machineType, defect_type: defectType });
    if (machineId) params.set("machine_id", machineId);
    return fetchAPI<ProblemKnowledge>(`/intelligence/problem?${params}`);
  },

  /**
   * Health check
   */
  healthCheck: (): Promise<HealthStatus> => fetchAPI<HealthStatus>("/dashboard/health"),
};
