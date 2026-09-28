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
  operating_hours?: number;
  severity?: string;
  technician_id?: string;
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
  intervention_category?: string;
  downtime_minutes?: number;
}

export interface IncidentUpdate {
  action_taken: string;
  action_outcome: ActionOutcome;
  confirmed_root_cause?: string;
  resolution_details?: string;
  resolution_time_minutes?: number;
  technician_notes?: string;
  intervention_category?: string;
  downtime_minutes?: number;
}

export interface HistoricalIncident {
  incident: Incident;
  similarity_score: number;
  relevance_factors: string[];
  recalled_facts: string[];
}

export interface Intervention {
  incident_id: string;
  action: string;
  category: string;
  outcome: ActionOutcome;
  root_cause?: string;
  machine_id: string;
  same_machine: boolean;
  date: string;
  similarity: number;
  relevance: string[];
}

export interface EvidenceSummary {
  intervention_category: string;
  example_action: string;
  successes: number;
  partials: number;
  failures: number;
  unknowns: number;
  same_machine_successes: number;
  same_machine_failures: number;
  score: number;
  incident_ids: Partial<Record<ActionOutcome, string[]>>;
}

export interface Recommendation {
  suggested_action: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA";
  reasoning: string;
  supporting_incidents: string[];
  warnings: string[];
  intervention_category?: string | null;
  basis: string;
  evidence: EvidenceSummary[];
  reasoning_source?: "llm" | "deterministic";
}

export interface MemoryTrace {
  bank?: string;
  tag_filter?: string[];
  query?: string;
  memory_facts_recalled?: number;
  fleet_facts?: number;
  same_machine_facts?: number;
  incidents_recalled?: number;
  incidents_with_outcome?: number;
  evidence_incidents?: number;
  relevance_rule?: string;
}

export interface AnalysisResult {
  current_incident: Incident;
  historical_incidents: HistoricalIncident[];
  successful_interventions: Intervention[];
  failed_interventions: Intervention[];
  partial_interventions: Intervention[];
  recommendation: Recommendation;
  memory_contribution: string;
  memory_trace: MemoryTrace;
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
  machine_type_distribution: {
    [key: string]: number;
  };
  total_downtime_hours: number;
  history_start: string | null;
  history_end: string | null;
  memory_bank: string;
}

export interface FleetMachineType {
  machine_type: string;
  label: string;
  machines: { machine_id: string; production_line: string; model: string }[];
  defect_types: { defect_type: string; symptoms: string[] }[];
  intervention_categories: string[];
}

export interface Fleet {
  machine_types: FleetMachineType[];
}

export interface MachineTimelineEntry {
  incident_id: string;
  timestamp: string;
  defect_type: string;
  description: string;
  action_taken?: string;
  intervention_category?: string;
  action_outcome?: ActionOutcome;
  confirmed_root_cause?: string;
  technician_id?: string;
  technician_notes?: string;
  downtime_minutes?: number;
  severity?: string;
  operating_hours?: number;
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
  machine_type?: string;
  model?: string;
  production_line?: string;
  total_downtime_hours?: number;
  outcome_distribution?: Partial<Record<ActionOutcome, number>>;
  timeline?: MachineTimelineEntry[];
}
