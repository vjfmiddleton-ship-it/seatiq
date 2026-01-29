/**
 * Shared constants for SeatIQ
 */

export const SENIORITY_LEVELS = ["JUNIOR", "MID", "SENIOR", "EXECUTIVE"] as const;

export const GUEST_TYPES = ["BUYER", "SELLER", "NEUTRAL", "CATALYST"] as const;

export const CONSTRAINT_TYPES = [
  "MUST_SIT_TOGETHER",
  "MUST_NOT_SIT_TOGETHER",
  "MAX_SELLERS_PER_TABLE",
  "MIN_BUYERS_PER_TABLE",
] as const;

export const OBJECTIVE_NAMES = {
  novelty: "New Connections",
  diversity: "Cross-Department",
  balance: "Balanced Tables",
  transaction: "Business Opportunities",
} as const;

export const OBJECTIVE_DESCRIPTIONS = {
  novelty:
    "Maximize opportunities for guests to meet new people outside their usual circles",
  diversity:
    "Encourage interaction across departments, companies, and industries",
  balance:
    "Create balanced conversations with diverse seniority and expertise",
  transaction:
    "Optimize for sales opportunities and strategic partnerships",
} as const;

export const DEFAULT_OBJECTIVE_WEIGHTS = {
  noveltyWeight: 0.25,
  diversityWeight: 0.25,
  balanceWeight: 0.25,
  transactionWeight: 0.25,
} as const;

export const DEFAULT_TABLE_COUNT = 10;
export const DEFAULT_SEATS_PER_TABLE = 8;
export const MAX_TABLE_COUNT = 100;
export const MAX_SEATS_PER_TABLE = 20;
export const MIN_SEATS_PER_TABLE = 2;

export const OPTIMIZATION_DEFAULTS = {
  maxIterations: 1000,
  seed: 42,
} as const;

// CSV column mappings (case-insensitive)
export const CSV_COLUMN_MAPPINGS: Record<string, string> = {
  // Name
  name: "name",
  "full name": "name",
  "guest name": "name",
  attendee: "name",

  // Email
  email: "email",
  "email address": "email",
  "e-mail": "email",

  // Company
  company: "company",
  organization: "company",
  org: "company",
  employer: "company",
  firm: "company",

  // Department
  department: "department",
  dept: "department",
  team: "department",
  division: "department",

  // Job Title
  title: "jobTitle",
  "job title": "jobTitle",
  jobtitle: "jobTitle",
  role: "jobTitle",
  position: "jobTitle",

  // Seniority
  seniority: "seniority",
  level: "seniority",
  "experience level": "seniority",

  // Guest Type
  type: "guestType",
  "guest type": "guestType",
  guesttype: "guestType",
  category: "guestType",

  // Notes
  notes: "notes",
  comments: "notes",
  remarks: "notes",
};
