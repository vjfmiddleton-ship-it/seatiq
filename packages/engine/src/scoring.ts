/**
 * Scoring functions for the seating optimization objectives
 */

import type {
  Guest,
  ObjectiveWeights,
  PlanMetrics,
  SeatingPlan,
  TableAssignment,
} from "./types";

/**
 * Calculate novelty score (Objective A)
 * Maximizes new professional connections by penalizing:
 * - Same company at same table
 * - Same department at same table
 * - Known connections at same table
 */
export function calculateNoveltyScore(
  plan: SeatingPlan,
  guests: Guest[]
): number {
  const guestMap = new Map<string, Guest>();
  for (const guest of guests) {
    guestMap.set(guest.id, guest);
  }

  let totalScore = 0;
  let totalPairs = 0;

  for (const table of plan.tables) {
    const tableGuests = table.guestIds
      .map((id) => guestMap.get(id))
      .filter((g): g is Guest => g !== undefined);

    // Score each pair at the table
    for (let i = 0; i < tableGuests.length; i++) {
      for (let j = i + 1; j < tableGuests.length; j++) {
        const g1 = tableGuests[i];
        const g2 = tableGuests[j];
        let pairScore = 1.0;

        // Penalize same company (-0.4)
        if (g1.company && g2.company && g1.company === g2.company) {
          pairScore -= 0.4;
        }

        // Penalize same department (-0.3)
        if (g1.department && g2.department && g1.department === g2.department) {
          pairScore -= 0.3;
        }

        // Penalize known connections (-0.3)
        if (
          g1.knownConnections?.includes(g2.id) ||
          g2.knownConnections?.includes(g1.id)
        ) {
          pairScore -= 0.3;
        }

        totalScore += Math.max(0, pairScore);
        totalPairs++;
      }
    }
  }

  return totalPairs > 0 ? totalScore / totalPairs : 1.0;
}

/**
 * Calculate diversity score (Objective B)
 * Rewards mix of companies, departments, and industries at each table
 */
export function calculateDiversityScore(
  plan: SeatingPlan,
  guests: Guest[]
): number {
  const guestMap = new Map<string, Guest>();
  for (const guest of guests) {
    guestMap.set(guest.id, guest);
  }

  let totalScore = 0;

  for (const table of plan.tables) {
    const tableGuests = table.guestIds
      .map((id) => guestMap.get(id))
      .filter((g): g is Guest => g !== undefined);

    if (tableGuests.length === 0) continue;

    // Count unique values
    const companies = new Set(tableGuests.map((g) => g.company).filter(Boolean));
    const departments = new Set(
      tableGuests.map((g) => g.department).filter(Boolean)
    );

    // Diversity = unique values / total guests (normalized)
    const companyDiversity = companies.size / Math.max(1, tableGuests.length);
    const deptDiversity = departments.size / Math.max(1, tableGuests.length);

    // Average the two diversity scores
    totalScore += (companyDiversity + deptDiversity) / 2;
  }

  const tablesWithGuests = plan.tables.filter((t) => t.guestIds.length > 0);
  return tablesWithGuests.length > 0 ? totalScore / tablesWithGuests.length : 1.0;
}

/**
 * Calculate balance score (Objective C)
 * Rewards tables with balanced seniority mix and avoids all-one-type tables
 */
export function calculateBalanceScore(
  plan: SeatingPlan,
  guests: Guest[]
): number {
  const guestMap = new Map<string, Guest>();
  for (const guest of guests) {
    guestMap.set(guest.id, guest);
  }

  let totalScore = 0;

  for (const table of plan.tables) {
    const tableGuests = table.guestIds
      .map((id) => guestMap.get(id))
      .filter((g): g is Guest => g !== undefined);

    if (tableGuests.length === 0) continue;

    // Seniority balance
    const seniorityCount = new Map<string, number>();
    for (const guest of tableGuests) {
      if (guest.seniority) {
        seniorityCount.set(
          guest.seniority,
          (seniorityCount.get(guest.seniority) || 0) + 1
        );
      }
    }

    // Calculate entropy-like score for seniority distribution
    let seniorityScore = 0;
    if (seniorityCount.size > 0) {
      const total = Array.from(seniorityCount.values()).reduce(
        (a, b) => a + b,
        0
      );
      const idealPerLevel = total / 4; // 4 seniority levels
      for (const count of seniorityCount.values()) {
        // Penalize deviation from ideal distribution
        seniorityScore +=
          1 - Math.abs(count - idealPerLevel) / Math.max(1, idealPerLevel);
      }
      seniorityScore /= seniorityCount.size;
    } else {
      seniorityScore = 0.5; // No seniority data, neutral score
    }

    // Guest type balance (avoid all-one-type)
    const typeCount = new Map<string, number>();
    for (const guest of tableGuests) {
      typeCount.set(
        guest.guestType,
        (typeCount.get(guest.guestType) || 0) + 1
      );
    }

    let typeScore = typeCount.size > 1 ? 1.0 : 0.5; // Reward diversity in guest types

    totalScore += (seniorityScore + typeScore) / 2;
  }

  const tablesWithGuests = plan.tables.filter((t) => t.guestIds.length > 0);
  return tablesWithGuests.length > 0 ? totalScore / tablesWithGuests.length : 1.0;
}

/**
 * Calculate transaction score (Objective D)
 * Maximizes sales opportunities by rewarding buyer-seller proximity
 * and penalizing competitor sellers at the same table
 */
export function calculateTransactionScore(
  plan: SeatingPlan,
  guests: Guest[]
): number {
  const guestMap = new Map<string, Guest>();
  for (const guest of guests) {
    guestMap.set(guest.id, guest);
  }

  let totalScore = 0;

  for (const table of plan.tables) {
    const tableGuests = table.guestIds
      .map((id) => guestMap.get(id))
      .filter((g): g is Guest => g !== undefined);

    if (tableGuests.length === 0) continue;

    const buyers = tableGuests.filter((g) => g.guestType === "BUYER");
    const sellers = tableGuests.filter((g) => g.guestType === "SELLER");
    const catalysts = tableGuests.filter((g) => g.guestType === "CATALYST");

    let tableScore = 0;

    // Reward buyer-seller pairs
    if (buyers.length > 0 && sellers.length > 0) {
      tableScore += 0.4;
    }

    // Reward catalyst presence
    if (catalysts.length > 0 && (buyers.length > 0 || sellers.length > 0)) {
      tableScore += 0.2;
    }

    // Penalize multiple sellers from same company (competitors)
    const sellerCompanies = sellers
      .map((s) => s.company)
      .filter((c): c is string => c !== undefined);
    const uniqueSellerCompanies = new Set(sellerCompanies);
    if (sellerCompanies.length > uniqueSellerCompanies.size) {
      tableScore -= 0.3; // Competitors at same table
    }

    // Reward balanced buyer-seller ratio
    if (sellers.length > 0 && buyers.length > 0) {
      const ratio = Math.min(buyers.length, sellers.length) /
        Math.max(buyers.length, sellers.length);
      tableScore += 0.2 * ratio;
    }

    // Penalize tables with only sellers or only buyers
    if (
      (sellers.length > 0 && buyers.length === 0) ||
      (buyers.length > 0 && sellers.length === 0)
    ) {
      tableScore -= 0.2;
    }

    totalScore += Math.max(0, Math.min(1, 0.5 + tableScore));
  }

  const tablesWithGuests = plan.tables.filter((t) => t.guestIds.length > 0);
  return tablesWithGuests.length > 0 ? totalScore / tablesWithGuests.length : 0.5;
}

/**
 * Calculate weighted combination of all objective scores
 */
export function calculateWeightedScore(
  metrics: Omit<PlanMetrics, "weighted">,
  weights: ObjectiveWeights
): number {
  return (
    metrics.novelty * weights.novelty +
    metrics.diversity * weights.diversity +
    metrics.balance * weights.balance +
    metrics.transaction * weights.transaction
  );
}

/**
 * Calculate all metrics for a seating plan
 */
export function calculateAllMetrics(
  plan: SeatingPlan,
  guests: Guest[],
  weights: ObjectiveWeights
): PlanMetrics {
  const novelty = calculateNoveltyScore(plan, guests);
  const diversity = calculateDiversityScore(plan, guests);
  const balance = calculateBalanceScore(plan, guests);
  const transaction = calculateTransactionScore(plan, guests);

  const weighted = calculateWeightedScore(
    { novelty, diversity, balance, transaction },
    weights
  );

  return { novelty, diversity, balance, transaction, weighted };
}
