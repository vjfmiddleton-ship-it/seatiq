/**
 * Zod schemas for runtime validation
 */

import { z } from "zod";

// ============================================================================
// Enums
// ============================================================================

export const SenioritySchema = z.enum(["JUNIOR", "MID", "SENIOR", "EXECUTIVE"]);
export type Seniority = z.infer<typeof SenioritySchema>;

export const GuestTypeSchema = z.enum(["BUYER", "SELLER", "NEUTRAL", "CATALYST"]);
export type GuestType = z.infer<typeof GuestTypeSchema>;

export const ConstraintTypeSchema = z.enum([
  "MUST_SIT_TOGETHER",
  "MUST_NOT_SIT_TOGETHER",
  "MAX_SELLERS_PER_TABLE",
  "MIN_BUYERS_PER_TABLE",
]);
export type ConstraintType = z.infer<typeof ConstraintTypeSchema>;

export const UserRoleSchema = z.enum(["OWNER", "PLANNER"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const PlanStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);
export type PlanStatus = z.infer<typeof PlanStatusSchema>;

// ============================================================================
// Guest Schemas
// ============================================================================

export const GuestCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  company: z.string().optional(),
  department: z.string().optional(),
  jobTitle: z.string().optional(),
  seniority: SenioritySchema.optional(),
  guestType: GuestTypeSchema.default("NEUTRAL"),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
});
export type GuestCreate = z.infer<typeof GuestCreateSchema>;

export const GuestUpdateSchema = GuestCreateSchema.partial();
export type GuestUpdate = z.infer<typeof GuestUpdateSchema>;

export const GuestSchema = GuestCreateSchema.extend({
  id: z.string(),
  eventId: z.string(),
  needsReview: z.boolean().default(false),
  confidence: z.number().min(0).max(1).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Guest = z.infer<typeof GuestSchema>;

// ============================================================================
// Event Schemas
// ============================================================================

export const EventCreateSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  date: z.date().optional(),
  venue: z.string().optional(),
  description: z.string().optional(),
  tableCount: z.number().int().min(1).max(100).default(10),
  seatsPerTable: z.number().int().min(2).max(20).default(8),
});
export type EventCreate = z.infer<typeof EventCreateSchema>;

export const EventUpdateSchema = EventCreateSchema.partial();
export type EventUpdate = z.infer<typeof EventUpdateSchema>;

export const EventSchema = EventCreateSchema.extend({
  id: z.string(),
  ownerId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Event = z.infer<typeof EventSchema>;

// ============================================================================
// Constraint Schemas
// ============================================================================

export const ConstraintCreateSchema = z.object({
  type: ConstraintTypeSchema,
  guestIds: z.array(z.string()).min(1, "At least one guest is required"),
  value: z.number().int().optional(),
  priority: z.number().int().min(1).max(10).default(1),
  notes: z.string().optional(),
});
export type ConstraintCreate = z.infer<typeof ConstraintCreateSchema>;

export const ConstraintSchema = ConstraintCreateSchema.extend({
  id: z.string(),
  eventId: z.string(),
  createdAt: z.date(),
});
export type Constraint = z.infer<typeof ConstraintSchema>;

// ============================================================================
// Objective Weights Schema
// ============================================================================

export const ObjectiveWeightsSchema = z
  .object({
    noveltyWeight: z.number().min(0).max(1).default(0.25),
    diversityWeight: z.number().min(0).max(1).default(0.25),
    balanceWeight: z.number().min(0).max(1).default(0.25),
    transactionWeight: z.number().min(0).max(1).default(0.25),
  })
  .refine(
    (data) => {
      const sum =
        data.noveltyWeight +
        data.diversityWeight +
        data.balanceWeight +
        data.transactionWeight;
      return Math.abs(sum - 1) < 0.01; // Allow small floating point errors
    },
    {
      message: "Objective weights must sum to 1.0",
    }
  );
export type ObjectiveWeights = z.infer<typeof ObjectiveWeightsSchema>;

// ============================================================================
// CSV Import Schemas
// ============================================================================

export const CSVRowSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
  company: z.string().optional(),
  department: z.string().optional(),
  jobTitle: z.string().optional(),
  title: z.string().optional(), // Alias for jobTitle
  role: z.string().optional(), // Alias for jobTitle
  seniority: z.string().optional(),
  type: z.string().optional(), // Maps to guestType
  guestType: z.string().optional(),
  notes: z.string().optional(),
});
export type CSVRow = z.infer<typeof CSVRowSchema>;

// ============================================================================
// API Request/Response Schemas
// ============================================================================

export const GeneratePlanRequestSchema = z.object({
  eventId: z.string(),
  weights: ObjectiveWeightsSchema.optional(),
  seed: z.number().int().optional(),
});
export type GeneratePlanRequest = z.infer<typeof GeneratePlanRequestSchema>;

export const APIErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});
export type APIError = z.infer<typeof APIErrorSchema>;
