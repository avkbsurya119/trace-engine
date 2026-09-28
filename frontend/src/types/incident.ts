/**
 * TypeScript types for TRACE incident data
 */

export type ActionOutcome = "SUCCESS" | "PARTIAL" | "FAILED" | "UNKNOWN";

export interface SensorValues {
  [key: string]: number | string;
}

export interface OperatingConditions {
  [key: string]: number | string;
}

export interface IncidentCreate {
  machine_id: string;
  machine_type: string;
  production_line: string;
  defect_type: string;
  symptoms: string[];
  sensor_values?: SensorValues;
  operating_conditions?: OperatingConditions;
  description: string;
  suspected_root_cause?: string;
}

export interface Incident extends IncidentCreate {
  incident_id: string;
  timestamp: string;
  confirmed_root_cause?: string;
  action_taken?: string;
  action_outcome?: ActionOutcome;
  resolution_details?: string;
  resolution_time_minutes?: number;
  technician_notes?: string;
}

export interface IncidentUpdate {
  action_taken: string;
  action_outcome: ActionOutcome;
  confirmed_root_cause?: string;
  resolution_details?: string;
  resolution_time_minutes?: number;
  technician_notes?: string;
}

export interface HistoricalIncident {
  incident: Incident;
  similarity_score: number;
  relevance_factors: string[];
}

export interface Intervention {
  incident_id: string;
  action: string;
  root_cause?: string;
  similarity: number;
  relevance: string[];
}

export interface Recommendation {
  suggested_action: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA";
  reasoning: string;
  supporting_incidents: string[];
  warnings: string[];
  reasoning_source?: "llm" | "deterministic";
}

export interface AnalysisResult {
  current_incident: Incident;
  historical_incidents: HistoricalIncident[];
  successful_interventions: Intervention[];
  failed_interventions: Intervention[];
  recommendation: Recommendation;
  memory_contribution: string;
}

export interface DashboardStats {
  total_incidents: number;
  incidents_with_outcome: number;
  unique_machines: number;
  outcome_distribution: {
    SUCCESS: number;
    PARTIAL: number;
    FAILED: number;
    UNKNOWN: number;
  };
  defect_type_distribution: {
    [key: string]: number;
  };
}

export interface MachineMemory {
  machine_id: string;
  total_incidents: number;
  recurring_defects: [string, number][];
  successful_interventions: {
    [action: string]: string[];
  };
  failed_interventions: {
    [action: string]: string[];
  };
  recent_incidents: {
    incident_id: string;
    timestamp: string;
    defect_type: string;
    action_outcome?: ActionOutcome;
  }[];
  message?: string;
}
