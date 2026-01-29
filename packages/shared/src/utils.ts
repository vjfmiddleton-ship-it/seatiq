/**
 * Shared utility functions for SeatIQ
 */

import { CSV_COLUMN_MAPPINGS, GUEST_TYPES, SENIORITY_LEVELS } from "./constants";
import type { GuestType, Seniority } from "./schemas";

/**
 * Normalizes a CSV column header to a standard field name
 */
export function normalizeColumnName(header: string): string | undefined {
  const normalized = header.toLowerCase().trim();
  return CSV_COLUMN_MAPPINGS[normalized];
}

/**
 * Parses a seniority string to the enum value
 */
export function parseSeniority(value: string | undefined): Seniority | undefined {
  if (!value) return undefined;

  const normalized = value.toUpperCase().trim();

  // Direct match
  if (SENIORITY_LEVELS.includes(normalized as Seniority)) {
    return normalized as Seniority;
  }

  // Common aliases
  const aliases: Record<string, Seniority> = {
    JR: "JUNIOR",
    JUNIOR: "JUNIOR",
    ENTRY: "JUNIOR",
    "ENTRY LEVEL": "JUNIOR",
    MID: "MID",
    MIDDLE: "MID",
    "MID-LEVEL": "MID",
    MIDLEVEL: "MID",
    SR: "SENIOR",
    SENIOR: "SENIOR",
    LEAD: "SENIOR",
    PRINCIPAL: "SENIOR",
    EXEC: "EXECUTIVE",
    EXECUTIVE: "EXECUTIVE",
    "C-LEVEL": "EXECUTIVE",
    CLEVEL: "EXECUTIVE",
    VP: "EXECUTIVE",
    DIRECTOR: "SENIOR",
    MANAGER: "MID",
  };

  return aliases[normalized];
}

/**
 * Parses a guest type string to the enum value
 */
export function parseGuestType(value: string | undefined): GuestType {
  if (!value) return "NEUTRAL";

  const normalized = value.toUpperCase().trim();

  // Direct match
  if (GUEST_TYPES.includes(normalized as GuestType)) {
    return normalized as GuestType;
  }

  // Common aliases
  const aliases: Record<string, GuestType> = {
    BUYER: "BUYER",
    BUY: "BUYER",
    CUSTOMER: "BUYER",
    CLIENT: "BUYER",
    PROSPECT: "BUYER",
    SELLER: "SELLER",
    SELL: "SELLER",
    VENDOR: "SELLER",
    SUPPLIER: "SELLER",
    SALES: "SELLER",
    NEUTRAL: "NEUTRAL",
    ATTENDEE: "NEUTRAL",
    GUEST: "NEUTRAL",
    CATALYST: "CATALYST",
    HOST: "CATALYST",
    FACILITATOR: "CATALYST",
    MODERATOR: "CATALYST",
  };

  return aliases[normalized] ?? "NEUTRAL";
}

/**
 * Generates a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}

/**
 * Formats a date for display
 */
export function formatDate(date: Date | string | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Formats a score as a percentage
 */
export function formatScore(score: number): string {
  return `${(score * 100).toFixed(0)}%`;
}

/**
 * Clamps a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Normalizes objective weights to sum to 1.0
 */
export function normalizeWeights(weights: {
  noveltyWeight: number;
  diversityWeight: number;
  balanceWeight: number;
  transactionWeight: number;
}): typeof weights {
  const sum =
    weights.noveltyWeight +
    weights.diversityWeight +
    weights.balanceWeight +
    weights.transactionWeight;

  if (sum === 0) {
    return {
      noveltyWeight: 0.25,
      diversityWeight: 0.25,
      balanceWeight: 0.25,
      transactionWeight: 0.25,
    };
  }

  return {
    noveltyWeight: weights.noveltyWeight / sum,
    diversityWeight: weights.diversityWeight / sum,
    balanceWeight: weights.balanceWeight / sum,
    transactionWeight: weights.transactionWeight / sum,
  };
}

/**
 * Parses CSV content into rows
 */
export function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]).map((h) => h.trim());

  // Parse rows
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = values[j]?.trim() ?? "";
      const normalizedHeader = normalizeColumnName(header);
      if (normalizedHeader) {
        row[normalizedHeader] = value;
      } else {
        // Keep original header for unknown columns
        row[header] = value;
      }
    }

    // Only add rows with a name
    if (row.name) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Parses a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quotes
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}
