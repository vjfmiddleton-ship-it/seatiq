/**
 * Explanation generation for seating plans
 *
 * Generates reason codes and human-readable explanations based on
 * deterministic metrics. AI can later enhance these explanations
 * but cannot invent facts not present in the structured data.
 */

import type {
  Constraint,
  Guest,
  PlanExplanations,
  PlanMetrics,
  ReasonCode,
  SeatingPlan,
} from "./types";

/**
 * Generates explanations for a seating plan
 */
export function generateExplanations(
  plan: SeatingPlan,
  guests: Guest[],
  metrics: PlanMetrics,
  constraints: Constraint[]
): PlanExplanations {
  const guestMap = new Map<string, Guest>();
  for (const guest of guests) {
    guestMap.set(guest.id, guest);
  }

  const reasonCodes: ReasonCode[] = [];
  const perTable: Record<string, string[]> = {};

  // Generate per-table explanations and reason codes
  for (const table of plan.tables) {
    const tableExplanations: string[] = [];
    const tableGuests = table.guestIds
      .map((id) => guestMap.get(id))
      .filter((g): g is Guest => g !== undefined);

    if (tableGuests.length === 0) continue;

    // Analyze company diversity
    const companies = new Set(tableGuests.map((g) => g.company).filter(Boolean));
    if (companies.size > 1) {
      const explanation = `Cross-company networking: ${companies.size} different companies represented`;
      tableExplanations.push(explanation);
      reasonCodes.push({
        code: "COMPANY_DIVERSITY",
        tableId: table.tableId,
        guestIds: table.guestIds,
        description: explanation,
        impact: "positive",
        objective: "diversity",
      });
    } else if (companies.size === 1 && tableGuests.length > 2) {
      const companyName = Array.from(companies)[0];
      const explanation = `Same company table: All guests from ${companyName}`;
      tableExplanations.push(explanation);
      reasonCodes.push({
        code: "SAME_COMPANY",
        tableId: table.tableId,
        guestIds: table.guestIds,
        description: explanation,
        impact: "negative",
        objective: "novelty",
      });
    }

    // Analyze department diversity
    const departments = new Set(
      tableGuests.map((g) => g.department).filter(Boolean)
    );
    if (departments.size > 2) {
      const explanation = `Department mix: ${departments.size} different departments`;
      tableExplanations.push(explanation);
      reasonCodes.push({
        code: "DEPARTMENT_DIVERSITY",
        tableId: table.tableId,
        guestIds: table.guestIds,
        description: explanation,
        impact: "positive",
        objective: "diversity",
      });
    }

    // Analyze seniority mix
    const seniorityLevels = new Set(
      tableGuests.map((g) => g.seniority).filter(Boolean)
    );
    if (seniorityLevels.size > 2) {
      const explanation = `Balanced seniority: ${seniorityLevels.size} experience levels`;
      tableExplanations.push(explanation);
      reasonCodes.push({
        code: "SENIORITY_MIX",
        tableId: table.tableId,
        guestIds: table.guestIds,
        description: explanation,
        impact: "positive",
        objective: "balance",
      });
    }

    // Analyze buyer-seller dynamics
    const buyers = tableGuests.filter((g) => g.guestType === "BUYER");
    const sellers = tableGuests.filter((g) => g.guestType === "SELLER");
    const catalysts = tableGuests.filter((g) => g.guestType === "CATALYST");

    if (buyers.length > 0 && sellers.length > 0) {
      const explanation = `Business opportunity: ${buyers.length} buyer(s) and ${sellers.length} seller(s)`;
      tableExplanations.push(explanation);
      reasonCodes.push({
        code: "BUYER_SELLER_MIX",
        tableId: table.tableId,
        guestIds: [...buyers.map((b) => b.id), ...sellers.map((s) => s.id)],
        description: explanation,
        impact: "positive",
        objective: "transaction",
      });
    }

    if (catalysts.length > 0) {
      const catalystNames = catalysts.map((c) => c.name).join(", ");
      const explanation = `Conversation catalyst: ${catalystNames}`;
      tableExplanations.push(explanation);
      reasonCodes.push({
        code: "CATALYST_PRESENT",
        tableId: table.tableId,
        guestIds: catalysts.map((c) => c.id),
        description: explanation,
        impact: "positive",
        objective: "balance",
      });
    }

    // Check for competing sellers
    const sellerCompanies = sellers
      .map((s) => s.company)
      .filter((c): c is string => c !== undefined);
    const uniqueSellerCompanies = new Set(sellerCompanies);
    if (sellerCompanies.length > uniqueSellerCompanies.size) {
      const explanation = `Note: Multiple sellers from the same company`;
      tableExplanations.push(explanation);
      reasonCodes.push({
        code: "COMPETING_SELLERS",
        tableId: table.tableId,
        guestIds: sellers.map((s) => s.id),
        description: explanation,
        impact: "negative",
        objective: "transaction",
      });
    }

    // Check for constraint-driven placements
    for (const constraint of constraints) {
      if (constraint.type === "MUST_SIT_TOGETHER") {
        const constraintGuests = constraint.guestIds.filter((id) =>
          table.guestIds.includes(id)
        );
        if (constraintGuests.length === constraint.guestIds.length) {
          const guestNames = constraintGuests
            .map((id) => guestMap.get(id)?.name)
            .filter(Boolean)
            .join(", ");
          const explanation = `Grouped by request: ${guestNames}`;
          tableExplanations.push(explanation);
          reasonCodes.push({
            code: "MUST_SIT_TOGETHER_SATISFIED",
            tableId: table.tableId,
            guestIds: constraintGuests,
            description: explanation,
            impact: "neutral",
          });
        }
      }
    }

    perTable[table.tableId] = tableExplanations;
  }

  // Generate overall summary
  const overall = generateOverallSummary(metrics, plan, guests, reasonCodes);

  return { perTable, overall, reasonCodes };
}

/**
 * Generates overall summary of the seating plan
 */
function generateOverallSummary(
  metrics: PlanMetrics,
  plan: SeatingPlan,
  guests: Guest[],
  reasonCodes: ReasonCode[]
): string {
  const parts: string[] = [];

  // Overall score
  parts.push(
    `Overall optimization score: ${(metrics.weighted * 100).toFixed(1)}%`
  );

  // Highlight best objective
  const objectives = [
    { name: "new connections", score: metrics.novelty },
    { name: "cross-department mixing", score: metrics.diversity },
    { name: "balanced conversations", score: metrics.balance },
    { name: "business opportunities", score: metrics.transaction },
  ];
  objectives.sort((a, b) => b.score - a.score);

  if (objectives[0].score >= 0.7) {
    parts.push(
      `Strong performance in ${objectives[0].name} (${(objectives[0].score * 100).toFixed(0)}%)`
    );
  }

  // Count positive/negative impacts
  const positiveCount = reasonCodes.filter((r) => r.impact === "positive").length;
  const negativeCount = reasonCodes.filter((r) => r.impact === "negative").length;

  if (positiveCount > negativeCount * 2) {
    parts.push("Well-balanced tables with good networking potential");
  } else if (negativeCount > positiveCount) {
    parts.push("Some trade-offs were made to satisfy hard constraints");
  }

  // Table count and guest count
  const tablesWithGuests = plan.tables.filter((t) => t.guestIds.length > 0);
  parts.push(
    `${guests.length} guests across ${tablesWithGuests.length} tables`
  );

  return parts.join(". ") + ".";
}
