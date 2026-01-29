/**
 * Core types for the SeatIQ seating optimization engine
 */

export type Seniority = "JUNIOR" | "MID" | "SENIOR" | "EXECUTIVE";
export type GuestType = "BUYER" | "SELLER" | "NEUTRAL" | "CATALYST";
export type ConstraintType =
  | "MUST_SIT_TOGETHER"
  | "MUST_NOT_SIT_TOGETHER"
  | "MAX_SELLERS_PER_TABLE"
  | "MIN_BUYERS_PER_TABLE";

/**
 * Guest representation for the optimization engine
 */
export interface Guest {
  id: string;
  name: string;
  company?: string;
  department?: string;
  jobTitle?: string;
  seniority?: Seniority;
  guestType: GuestType;
  tags?: string[];
  /** Optional: IDs of guests this person has met before */
  knownConnections?: string[];
}

/**
 * Hard constraint that MUST be satisfied
 */
export interface Constraint {
  id: string;
  type: ConstraintType;
  /** Guest IDs involved in this constraint */
  guestIds: string[];
  /** For numeric constraints (e.g., max sellers per table) */
  value?: number;
  priority?: number;
}

/**
 * Weights for soft objectives (must sum to 1.0)
 */
export interface ObjectiveWeights {
  /** Objective A: Maximize new professional connections */
  novelty: number;
  /** Objective B: Maximize cross-department/company interaction */
  diversity: number;
  /** Objective C: Maximize balanced, high-quality conversations */
  balance: number;
  /** Objective D: Maximize sales & transactional opportunities */
  transaction: number;
}

/**
 * Assignment of guests to a single table
 */
export interface TableAssignment {
  tableId: string;
  guestIds: string[];
}

/**
 * Complete seating plan
 */
export interface SeatingPlan {
  tables: TableAssignment[];
}

/**
 * Computed metrics for a seating plan
 */
export interface PlanMetrics {
  /** Score for Objective A (0-1) */
  novelty: number;
  /** Score for Objective B (0-1) */
  diversity: number;
  /** Score for Objective C (0-1) */
  balance: number;
  /** Score for Objective D (0-1) */
  transaction: number;
  /** Weighted combination of all scores */
  weighted: number;
}

/**
 * Reason code for explaining placement decisions
 */
export interface ReasonCode {
  code: string;
  tableId: string;
  guestIds: string[];
  description: string;
  impact: "positive" | "negative" | "neutral";
  objective?: "novelty" | "diversity" | "balance" | "transaction";
}

/**
 * Explanations for a seating plan
 */
export interface PlanExplanations {
  /** Explanations per table */
  perTable: Record<string, string[]>;
  /** Overall summary */
  overall: string;
  /** Raw reason codes (for AI to convert to human-readable text) */
  reasonCodes: ReasonCode[];
}

/**
 * Complete result of the optimization process
 */
export interface OptimizationResult {
  plan: SeatingPlan;
  metrics: PlanMetrics;
  explanations: PlanExplanations;
  warnings: string[];
  /** Whether all hard constraints are satisfied */
  feasible: boolean;
  /** Number of iterations performed */
  iterations: number;
}

/**
 * Configuration for the optimization process
 */
export interface OptimizationConfig {
  /** Number of tables */
  tableCount: number;
  /** Seats per table */
  seatsPerTable: number;
  /** Maximum iterations for local search */
  maxIterations?: number;
  /** Random seed for deterministic results */
  seed?: number;
}
