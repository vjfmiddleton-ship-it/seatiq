/**
 * Core optimization algorithm for seating assignments
 *
 * Uses a deterministic two-phase approach:
 * 1. Greedy initial assignment respecting hard constraints
 * 2. Local search optimization to improve soft objective scores
 */

import { validateConstraints, checkFeasibility } from "./constraints";
import { calculateAllMetrics } from "./scoring";
import { generateExplanations } from "./explanations";
import type {
  Constraint,
  Guest,
  ObjectiveWeights,
  OptimizationConfig,
  OptimizationResult,
  SeatingPlan,
  TableAssignment,
} from "./types";

/**
 * Seeded pseudo-random number generator for deterministic results
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

/**
 * Main optimization function
 */
export function optimize(
  guests: Guest[],
  constraints: Constraint[],
  weights: ObjectiveWeights,
  config: OptimizationConfig
): OptimizationResult {
  const { tableCount, seatsPerTable, maxIterations = 1000, seed = 42 } = config;
  const rng = new SeededRandom(seed);

  // Check feasibility first
  const feasibility = checkFeasibility(guests, constraints, tableCount, seatsPerTable);
  if (!feasibility.feasible) {
    return createInfeasibleResult(feasibility.reason || "Infeasible constraints");
  }

  // Phase 1: Greedy initial assignment
  let plan = createInitialAssignment(guests, constraints, tableCount, seatsPerTable, rng);

  // Validate initial assignment
  let validation = validateConstraints(plan, constraints, guests);
  if (!validation.valid) {
    // Try to repair the assignment
    plan = repairAssignment(plan, constraints, guests, tableCount, seatsPerTable, rng);
    validation = validateConstraints(plan, constraints, guests);
  }

  // Calculate initial metrics
  let metrics = calculateAllMetrics(plan, guests, weights);
  let iterations = 0;

  // Phase 2: Local search optimization
  let improved = true;
  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    // Try swapping pairs between tables
    for (let t1 = 0; t1 < plan.tables.length && !improved; t1++) {
      for (let t2 = t1 + 1; t2 < plan.tables.length && !improved; t2++) {
        const table1 = plan.tables[t1];
        const table2 = plan.tables[t2];

        for (let g1 = 0; g1 < table1.guestIds.length && !improved; g1++) {
          for (let g2 = 0; g2 < table2.guestIds.length && !improved; g2++) {
            // Try swap
            const newPlan = swapGuests(plan, t1, g1, t2, g2);
            const newValidation = validateConstraints(newPlan, constraints, guests);

            if (newValidation.valid) {
              const newMetrics = calculateAllMetrics(newPlan, guests, weights);
              if (newMetrics.weighted > metrics.weighted) {
                plan = newPlan;
                metrics = newMetrics;
                improved = true;
              }
            }
          }
        }
      }
    }

    // Try moving individuals to different tables
    if (!improved) {
      for (let t1 = 0; t1 < plan.tables.length && !improved; t1++) {
        for (let t2 = 0; t2 < plan.tables.length && !improved; t2++) {
          if (t1 === t2) continue;

          const table1 = plan.tables[t1];
          const table2 = plan.tables[t2];

          // Check if table2 has room
          if (table2.guestIds.length >= seatsPerTable) continue;

          for (let g = 0; g < table1.guestIds.length && !improved; g++) {
            const newPlan = moveGuest(plan, t1, g, t2);
            const newValidation = validateConstraints(newPlan, constraints, guests);

            if (newValidation.valid) {
              const newMetrics = calculateAllMetrics(newPlan, guests, weights);
              if (newMetrics.weighted > metrics.weighted) {
                plan = newPlan;
                metrics = newMetrics;
                improved = true;
              }
            }
          }
        }
      }
    }
  }

  // Generate explanations
  const explanations = generateExplanations(plan, guests, metrics, constraints);

  // Collect warnings
  const warnings = collectWarnings(guests, plan);

  // Final validation
  const finalValidation = validateConstraints(plan, constraints, guests);

  return {
    plan,
    metrics,
    explanations,
    warnings,
    feasible: finalValidation.valid,
    iterations,
  };
}

/**
 * Creates initial assignment using greedy approach
 */
function createInitialAssignment(
  guests: Guest[],
  constraints: Constraint[],
  tableCount: number,
  seatsPerTable: number,
  rng: SeededRandom
): SeatingPlan {
  // Initialize empty tables
  const tables: TableAssignment[] = [];
  for (let i = 0; i < tableCount; i++) {
    tables.push({ tableId: `table_${i + 1}`, guestIds: [] });
  }

  // Handle MUST_SIT_TOGETHER constraints first
  const mustSitTogether = constraints.filter(
    (c) => c.type === "MUST_SIT_TOGETHER"
  );
  const assignedGuests = new Set<string>();

  for (const constraint of mustSitTogether) {
    // Find a table with enough room
    const groupSize = constraint.guestIds.length;
    const availableTable = tables.find(
      (t) => t.guestIds.length + groupSize <= seatsPerTable
    );

    if (availableTable) {
      for (const guestId of constraint.guestIds) {
        if (!assignedGuests.has(guestId)) {
          availableTable.guestIds.push(guestId);
          assignedGuests.add(guestId);
        }
      }
    }
  }

  // Assign remaining guests with round-robin approach
  const remainingGuests = rng.shuffle(
    guests.filter((g) => !assignedGuests.has(g.id))
  );

  let tableIndex = 0;
  for (const guest of remainingGuests) {
    // Find next table with room, respecting MUST_NOT_SIT_TOGETHER
    let attempts = 0;
    while (attempts < tableCount) {
      const table = tables[tableIndex];

      if (table.guestIds.length < seatsPerTable) {
        // Check MUST_NOT_SIT_TOGETHER constraints
        const mustNotSitWith = constraints
          .filter(
            (c) =>
              c.type === "MUST_NOT_SIT_TOGETHER" && c.guestIds.includes(guest.id)
          )
          .flatMap((c) => c.guestIds.filter((id) => id !== guest.id));

        const hasConflict = table.guestIds.some((id) =>
          mustNotSitWith.includes(id)
        );

        if (!hasConflict) {
          table.guestIds.push(guest.id);
          break;
        }
      }

      tableIndex = (tableIndex + 1) % tableCount;
      attempts++;
    }

    // If no valid table found, assign to first available (constraint will be violated)
    if (attempts === tableCount) {
      const availableTable = tables.find(
        (t) => t.guestIds.length < seatsPerTable
      );
      if (availableTable) {
        availableTable.guestIds.push(guest.id);
      }
    }

    tableIndex = (tableIndex + 1) % tableCount;
  }

  return { tables };
}

/**
 * Attempts to repair constraint violations
 */
function repairAssignment(
  plan: SeatingPlan,
  constraints: Constraint[],
  guests: Guest[],
  tableCount: number,
  seatsPerTable: number,
  rng: SeededRandom
): SeatingPlan {
  const newPlan = { tables: plan.tables.map((t) => ({ ...t, guestIds: [...t.guestIds] })) };

  // Repair MUST_NOT_SIT_TOGETHER violations
  const mustNotSit = constraints.filter((c) => c.type === "MUST_NOT_SIT_TOGETHER");

  for (const constraint of mustNotSit) {
    for (const table of newPlan.tables) {
      const conflictingGuests = table.guestIds.filter((id) =>
        constraint.guestIds.includes(id)
      );

      while (conflictingGuests.length > 1) {
        const guestToMove = conflictingGuests.pop()!;
        const guestIndex = table.guestIds.indexOf(guestToMove);

        // Find alternative table
        const alternativeTable = newPlan.tables.find(
          (t) =>
            t !== table &&
            t.guestIds.length < seatsPerTable &&
            !t.guestIds.some((id) => constraint.guestIds.includes(id))
        );

        if (alternativeTable) {
          table.guestIds.splice(guestIndex, 1);
          alternativeTable.guestIds.push(guestToMove);
        }
      }
    }
  }

  return newPlan;
}

/**
 * Swaps two guests between tables
 */
function swapGuests(
  plan: SeatingPlan,
  tableIndex1: number,
  guestIndex1: number,
  tableIndex2: number,
  guestIndex2: number
): SeatingPlan {
  const newTables = plan.tables.map((t) => ({
    ...t,
    guestIds: [...t.guestIds],
  }));

  const temp = newTables[tableIndex1].guestIds[guestIndex1];
  newTables[tableIndex1].guestIds[guestIndex1] =
    newTables[tableIndex2].guestIds[guestIndex2];
  newTables[tableIndex2].guestIds[guestIndex2] = temp;

  return { tables: newTables };
}

/**
 * Moves a guest from one table to another
 */
function moveGuest(
  plan: SeatingPlan,
  fromTableIndex: number,
  guestIndex: number,
  toTableIndex: number
): SeatingPlan {
  const newTables = plan.tables.map((t) => ({
    ...t,
    guestIds: [...t.guestIds],
  }));

  const guest = newTables[fromTableIndex].guestIds.splice(guestIndex, 1)[0];
  newTables[toTableIndex].guestIds.push(guest);

  return { tables: newTables };
}

/**
 * Collects warnings about the seating plan
 */
function collectWarnings(guests: Guest[], plan: SeatingPlan): string[] {
  const warnings: string[] = [];
  const guestMap = new Map<string, Guest>();
  for (const guest of guests) {
    guestMap.set(guest.id, guest);
  }

  // Check for guests without company info
  for (const guest of guests) {
    if (!guest.company) {
      warnings.push(`Guest "${guest.name}" has no company specified`);
    }
  }

  // Check for unassigned guests
  const assignedGuests = new Set<string>();
  for (const table of plan.tables) {
    for (const guestId of table.guestIds) {
      assignedGuests.add(guestId);
    }
  }

  for (const guest of guests) {
    if (!assignedGuests.has(guest.id)) {
      warnings.push(`Guest "${guest.name}" was not assigned to any table`);
    }
  }

  return warnings;
}

/**
 * Creates result for infeasible problems
 */
function createInfeasibleResult(reason: string): OptimizationResult {
  return {
    plan: { tables: [] },
    metrics: { novelty: 0, diversity: 0, balance: 0, transaction: 0, weighted: 0 },
    explanations: {
      perTable: {},
      overall: `Unable to create seating plan: ${reason}`,
      reasonCodes: [],
    },
    warnings: [reason],
    feasible: false,
    iterations: 0,
  };
}
