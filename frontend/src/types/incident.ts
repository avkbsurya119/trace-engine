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
  // Recency data
  recency_score?: number;
  recency_label?: "high" | "medium" | "low";
  days_ago?: number;
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
  // Recency data
  recency_score?: number;
  recency_label?: "high" | "medium" | "low";
  days_ago?: number;
}

export interface PatternAlert {
  defect_type: string;
  total_occurrences: number;
  first_occurrence: string;
  most_recent: string;
  successful_resolutions: number;
  failed_resolutions: number;
  partial_resolutions: number;
  machines_affected: string[];
  is_recurring: boolean;
}

export interface CrossMachineEvidence {
  intervention_category: string;
  example_action: string;
  machines_succeeded: string[];
  machines_failed: string[];
  success_count: number;
  total_count: number;
  cross_machine_confidence: "strong" | "moderate" | "weak" | "none";
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
  attempts: number;
  success_rate: number | null;
  verdict: "selected" | "rejected";
  verdict_reason: string;
}

export interface ConfidenceCheck {
  level: "EVIDENCE" | "HIGH" | "MEDIUM" | "DOWNGRADE";
  rule: string;
  passed: boolean;
  detail: string;
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
  confidence_checks: ConfidenceCheck[];
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
  // New features
  pattern_alert?: PatternAlert;
  cross_machine_evidence?: CrossMachineEvidence[];
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
  memory_growth: MemoryGrowthPoint[];
}

export interface MemoryGrowthPoint {
  month: string;
  incidents: number;
  cumulative_incidents: number;
  cumulative_outcomes: number;
}

export interface FleetMachineType {
  machine_type: string;
  label: string;
  machines: { machine_id: string; production_line: string; model: string }[];
  defect_types: { defect_type: string; symptoms: string[] }[];
  intervention_categories: string[];
  hero_machine_id?: string | null;
}

export interface DemoPreset {
  key: string;
  label: string;
  incident: IncidentCreate;
}

export interface Fleet {
  machine_types: FleetMachineType[];
  demo_presets: DemoPreset[];
  demo_outcome: IncidentUpdate;
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

export interface HeroMachine {
  key: string;
  title: string;
  story: string;
  incident: IncidentCreate;
  without_memory: Recommendation;
  with_memory: Recommendation;
  evidence_incidents: string[];
  memory_trace: MemoryTrace;
  trial_and_error: {
    attempts_that_did_not_work: number;
    downtime_minutes: number;
    incident_ids: string[];
  };
  machine_history: {
    incident_id: string;
    timestamp: string;
    intervention_category?: string;
    action_outcome?: ActionOutcome;
    downtime_minutes?: number;
  }[];
}

export interface HealthStatus {
  status: "healthy" | "degraded";
  service: string;
  checks: {
    sqlite: { ok: boolean; incidents?: number; error?: string };
    hindsight: { ok: boolean; bank?: string; error?: string };
    llm: { ok: boolean; model?: string | null };
  };
}

// ---------------------------------------------------------------- TRACE Intelligence

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA";

export interface IntelligenceOverview {
  total_incidents: number;
  machines: number;
  equipment_types: number;
  successful_repairs: number;
  failed_repairs: number;
  partial_repairs: number;
  unverified_repairs: number;
  recorded_outcomes: number;
  memory_entries: number;
  problems_catalogued: number;
  problems_with_proven_fix: number;
  knowledge_coverage: number;
  confidence_distribution: Record<ConfidenceLevel, number>;
  first_record: string | null;
  knowledge_age_days: number;
}

export interface EvolutionPoint {
  month: string;
  incidents: number;
  outcomes_recorded: number;
  successful_repairs: number;
  new_machines: number;
  cumulative_incidents: number;
  cumulative_outcomes: number;
  cumulative_machines: number;
  problems_high: number;
  problems_medium: number;
  problems_low: number;
  problems_with_fix: number;
  memory_available_rate: number;
}

export interface ImpactGroup {
  attempts: number;
  worked: number;
  success_rate: number | null;
  median_downtime_minutes: number | null;
}

export interface MemoryImpact {
  no_memory: ImpactGroup;
  memory_no_answer: ImpactGroup;
  followed: ImpactGroup;
  not_followed: ImpactGroup;
}

export interface MemoryReuse {
  work_orders: number;
  with_prior_memory: number;
  with_recommendation: number;
  with_same_machine_memory: number;
  with_fleet_memory: number;
  fleet_only_memory: number;
  most_recommended_repairs: { intervention_category: string; times: number }[];
  most_cited_work_orders: {
    incident_id: string;
    times: number;
    machine_id: string;
    defect_type: string;
    intervention_category?: string | null;
    timestamp: string;
  }[];
}

export interface MachineProblemKnowledge {
  defect_type: string;
  occurrences: number;
  proven_here: string[];
  confidence: ConfidenceLevel;
  recommended?: string | null;
  fleet_evidence: number;
}

export interface MachineIntelligence {
  rank: number;
  machine_id: string;
  machine_type: string;
  production_line: string;
  model?: string | null;
  incidents: number;
  verified_outcomes: number;
  success_rate: number | null;
  problems_seen: number;
  problems_with_proven_fix_here: number;
  memory_completeness: number;
  downtime_hours: number;
  problems: MachineProblemKnowledge[];
}

export interface FailurePatterns {
  months: string[];
  top_problems: {
    machine_type: string;
    defect_type: string;
    occurrences: number;
    machines_affected: number;
    outcomes: Partial<Record<ActionOutcome, number>>;
    monthly: number[] | null;
  }[];
  by_equipment_type: { machine_type: string; incidents: number; problems: { defect_type: string; occurrences: number }[] }[];
  recurring: { machine_id: string; machine_type: string; defect_type: string; occurrences: number }[];
}

export interface RepairReliability {
  machine_type: string;
  defect_type: string;
  intervention_category: string;
  attempts: number;
  successes: number;
  partials: number;
  failures: number;
  unverified: number;
  success_rate: number | null;
  reliability: number;
  sample: "strong" | "moderate" | "small";
}

export interface KnowledgeChange {
  incident_id: string;
  timestamp: string;
  machine_id: string;
  machine_type: string;
  defect_type: string;
  intervention_category?: string | null;
  outcome: ActionOutcome;
  confidence_before: ConfidenceLevel;
  confidence_after: ConfidenceLevel;
  recommended_after?: string | null;
  evidence_after: number;
}

export interface NetworkEquipment {
  machine_type: string;
  label: string;
  problems: {
    defect_type: string;
    occurrences: number;
    repairs: {
      intervention_category: string;
      attempts: number;
      successes: number;
      failures: number;
      partials: number;
      success_rate: number | null;
    }[];
  }[];
}

export interface ProblemSummary {
  machine_type: string;
  defect_type: string;
  evidence_count: number;
  confidence: ConfidenceLevel;
  recommended?: string | null;
}

export interface IntelligenceReport {
  generated_at: string;
  compute_ms?: number;
  overview: IntelligenceOverview;
  evolution: EvolutionPoint[];
  memory_impact: MemoryImpact;
  reuse: MemoryReuse;
  machines: MachineIntelligence[];
  failure_patterns: FailurePatterns;
  reliable_repairs: {
    min_attempts: number;
    method: string;
    ranked: RepairReliability[];
    least_reliable: RepairReliability[];
    small_sample_count: number;
  };
  knowledge_changes: KnowledgeChange[];
  network: NetworkEquipment[];
  problems: ProblemSummary[];
}

export interface ProblemKnowledge {
  machine_type: string;
  defect_type: string;
  machine_id?: string | null;
  evidence_count: number;
  recommendation: Recommendation;
}
