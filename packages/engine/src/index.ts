/**
 * SeatIQ Seating Optimization Engine
 *
 * A deterministic-first algorithm for corporate event seating optimization.
 * Hard constraints MUST be enforced; soft objectives are optimized with weights.
 */

export { optimize } from "./optimizer";
export { validateConstraints } from "./constraints";
export {
  calculateNoveltyScore,
  calculateDiversityScore,
  calculateBalanceScore,
  calculateTransactionScore,
  calculateWeightedScore,
} from "./scoring";
export { generateExplanations } from "./explanations";

export type {
  Guest,
  Constraint,
  ObjectiveWeights,
  SeatingPlan,
  TableAssignment,
  OptimizationResult,
  OptimizationConfig,
  ReasonCode,
} from "./types";
