/**
 * Constraint validation for the seating optimization engine
 */

import type { Constraint, Guest, SeatingPlan, TableAssignment } from "./types";

export interface ValidationResult {
  valid: boolean;
  violations: ConstraintViolation[];
}

export interface ConstraintViolation {
  constraintId: string;
  constraintType: string;
  message: string;
  tableId?: string;
  guestIds: string[];
}

/**
 * Validates that a seating plan satisfies all hard constraints
 */
export function validateConstraints(
  plan: SeatingPlan,
  constraints: Constraint[],
  guests: Guest[]
): ValidationResult {
  const violations: ConstraintViolation[] = [];

  // Build lookup maps
  const guestToTable = new Map<string, string>();
  for (const table of plan.tables) {
    for (const guestId of table.guestIds) {
      guestToTable.set(guestId, table.tableId);
    }
  }

  const tableToGuests = new Map<string, string[]>();
  for (const table of plan.tables) {
    tableToGuests.set(table.tableId, table.guestIds);
  }

  const guestMap = new Map<string, Guest>();
  for (const guest of guests) {
    guestMap.set(guest.id, guest);
  }

  for (const constraint of constraints) {
    switch (constraint.type) {
      case "MUST_SIT_TOGETHER": {
        const violation = checkMustSitTogether(constraint, guestToTable);
        if (violation) violations.push(violation);
        break;
      }
      case "MUST_NOT_SIT_TOGETHER": {
        const violation = checkMustNotSitTogether(constraint, guestToTable);
        if (violation) violations.push(violation);
        break;
      }
      case "MAX_SELLERS_PER_TABLE": {
        const tableViolations = checkMaxSellersPerTable(
          constraint,
          tableToGuests,
          guestMap
        );
        violations.push(...tableViolations);
        break;
      }
      case "MIN_BUYERS_PER_TABLE": {
        const tableViolations = checkMinBuyersPerTable(
          constraint,
          tableToGuests,
          guestMap
        );
        violations.push(...tableViolations);
        break;
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

function checkMustSitTogether(
  constraint: Constraint,
  guestToTable: Map<string, string>
): ConstraintViolation | null {
  const tables = new Set<string>();

  for (const guestId of constraint.guestIds) {
    const table = guestToTable.get(guestId);
    if (table) {
      tables.add(table);
    }
  }

  if (tables.size > 1) {
    return {
      constraintId: constraint.id,
      constraintType: "MUST_SIT_TOGETHER",
      message: `Guests must sit together but are at ${tables.size} different tables`,
      guestIds: constraint.guestIds,
    };
  }

  return null;
}

function checkMustNotSitTogether(
  constraint: Constraint,
  guestToTable: Map<string, string>
): ConstraintViolation | null {
  const tables = new Map<string, string[]>();

  for (const guestId of constraint.guestIds) {
    const table = guestToTable.get(guestId);
    if (table) {
      const existing = tables.get(table) || [];
      existing.push(guestId);
      tables.set(table, existing);
    }
  }

  for (const [tableId, guestIds] of tables) {
    if (guestIds.length > 1) {
      return {
        constraintId: constraint.id,
        constraintType: "MUST_NOT_SIT_TOGETHER",
        message: `Guests must not sit together but ${guestIds.length} are at the same table`,
        tableId,
        guestIds,
      };
    }
  }

  return null;
}

function checkMaxSellersPerTable(
  constraint: Constraint,
  tableToGuests: Map<string, string[]>,
  guestMap: Map<string, Guest>
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  const maxSellers = constraint.value ?? 2;

  for (const [tableId, guestIds] of tableToGuests) {
    const sellers = guestIds.filter((id) => {
      const guest = guestMap.get(id);
      return guest?.guestType === "SELLER";
    });

    if (sellers.length > maxSellers) {
      violations.push({
        constraintId: constraint.id,
        constraintType: "MAX_SELLERS_PER_TABLE",
        message: `Table has ${sellers.length} sellers, max allowed is ${maxSellers}`,
        tableId,
        guestIds: sellers,
      });
    }
  }

  return violations;
}

function checkMinBuyersPerTable(
  constraint: Constraint,
  tableToGuests: Map<string, string[]>,
  guestMap: Map<string, Guest>
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  const minBuyers = constraint.value ?? 1;

  for (const [tableId, guestIds] of tableToGuests) {
    // Skip empty tables
    if (guestIds.length === 0) continue;

    const buyers = guestIds.filter((id) => {
      const guest = guestMap.get(id);
      return guest?.guestType === "BUYER";
    });

    if (buyers.length < minBuyers) {
      violations.push({
        constraintId: constraint.id,
        constraintType: "MIN_BUYERS_PER_TABLE",
        message: `Table has ${buyers.length} buyers, minimum required is ${minBuyers}`,
        tableId,
        guestIds: buyers,
      });
    }
  }

  return violations;
}

/**
 * Checks if it's feasible to satisfy all constraints
 */
export function checkFeasibility(
  guests: Guest[],
  constraints: Constraint[],
  tableCount: number,
  seatsPerTable: number
): { feasible: boolean; reason?: string } {
  // Check capacity
  const totalSeats = tableCount * seatsPerTable;
  if (guests.length > totalSeats) {
    return {
      feasible: false,
      reason: `Not enough seats: ${guests.length} guests but only ${totalSeats} seats`,
    };
  }

  // Check MUST_SIT_TOGETHER constraints don't exceed table size
  for (const constraint of constraints) {
    if (constraint.type === "MUST_SIT_TOGETHER") {
      if (constraint.guestIds.length > seatsPerTable) {
        return {
          feasible: false,
          reason: `MUST_SIT_TOGETHER constraint has ${constraint.guestIds.length} guests but tables only have ${seatsPerTable} seats`,
        };
      }
    }
  }

  return { feasible: true };
}
