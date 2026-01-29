import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Import the engine types and functions
// Note: In production, these would come from @seatiq/engine package
// For now, we implement the optimization logic inline

interface EngineGuest {
  id: string;
  name: string;
  company?: string;
  department?: string;
  jobTitle?: string;
  seniority?: "JUNIOR" | "MID" | "SENIOR" | "EXECUTIVE";
  guestType: "BUYER" | "SELLER" | "NEUTRAL" | "CATALYST";
  tags?: string[];
}

interface EngineConstraint {
  id: string;
  type: "MUST_SIT_TOGETHER" | "MUST_NOT_SIT_TOGETHER" | "MAX_SELLERS_PER_TABLE" | "MIN_BUYERS_PER_TABLE";
  guestIds: string[];
  value?: number;
}

interface TableAssignment {
  tableId: string;
  guestIds: string[];
}

const optimizeSchema = z.object({
  seed: z.number().int().optional(),
});

// Seeded random number generator
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

function createInitialAssignment(
  guests: EngineGuest[],
  constraints: EngineConstraint[],
  tableCount: number,
  seatsPerTable: number,
  rng: SeededRandom
): TableAssignment[] {
  const tables: TableAssignment[] = [];
  for (let i = 0; i < tableCount; i++) {
    tables.push({ tableId: `table_${i + 1}`, guestIds: [] });
  }

  const assignedGuests = new Set<string>();

  // Handle MUST_SIT_TOGETHER first
  const mustSitTogether = constraints.filter(c => c.type === "MUST_SIT_TOGETHER");
  for (const constraint of mustSitTogether) {
    const groupSize = constraint.guestIds.length;
    const availableTable = tables.find(t => t.guestIds.length + groupSize <= seatsPerTable);
    if (availableTable) {
      for (const guestId of constraint.guestIds) {
        if (!assignedGuests.has(guestId)) {
          availableTable.guestIds.push(guestId);
          assignedGuests.add(guestId);
        }
      }
    }
  }

  // Assign remaining guests
  const remainingGuests = rng.shuffle(guests.filter(g => !assignedGuests.has(g.id)));
  let tableIndex = 0;

  for (const guest of remainingGuests) {
    let attempts = 0;
    while (attempts < tableCount) {
      const table = tables[tableIndex];
      if (table.guestIds.length < seatsPerTable) {
        const mustNotSitWith = constraints
          .filter(c => c.type === "MUST_NOT_SIT_TOGETHER" && c.guestIds.includes(guest.id))
          .flatMap(c => c.guestIds.filter(id => id !== guest.id));

        const hasConflict = table.guestIds.some(id => mustNotSitWith.includes(id));
        if (!hasConflict) {
          table.guestIds.push(guest.id);
          break;
        }
      }
      tableIndex = (tableIndex + 1) % tableCount;
      attempts++;
    }

    if (attempts === tableCount) {
      const availableTable = tables.find(t => t.guestIds.length < seatsPerTable);
      if (availableTable) {
        availableTable.guestIds.push(guest.id);
      }
    }
    tableIndex = (tableIndex + 1) % tableCount;
  }

  return tables;
}

function calculateScores(
  tables: TableAssignment[],
  guests: EngineGuest[],
  weights: { novelty: number; diversity: number; balance: number; transaction: number }
) {
  const guestMap = new Map(guests.map(g => [g.id, g]));
  let noveltyScore = 0;
  let diversityScore = 0;
  let balanceScore = 0;
  let transactionScore = 0;
  let tableCount = 0;

  for (const table of tables) {
    const tableGuests = table.guestIds.map(id => guestMap.get(id)).filter(Boolean) as EngineGuest[];
    if (tableGuests.length === 0) continue;
    tableCount++;

    // Novelty: penalize same company/department
    let noveltyTableScore = 1;
    const companies = new Set(tableGuests.map(g => g.company).filter(Boolean));
    noveltyTableScore = companies.size / tableGuests.length;
    noveltyScore += noveltyTableScore;

    // Diversity: reward mix
    const departments = new Set(tableGuests.map(g => g.department).filter(Boolean));
    diversityScore += (companies.size + departments.size) / (tableGuests.length * 2);

    // Balance: seniority mix
    const seniorities = new Set(tableGuests.map(g => g.seniority).filter(Boolean));
    balanceScore += seniorities.size / 4;

    // Transaction: buyer-seller mix
    const buyers = tableGuests.filter(g => g.guestType === "BUYER");
    const sellers = tableGuests.filter(g => g.guestType === "SELLER");
    if (buyers.length > 0 && sellers.length > 0) {
      transactionScore += 1;
    } else {
      transactionScore += 0.3;
    }
  }

  if (tableCount === 0) {
    return { novelty: 0, diversity: 0, balance: 0, transaction: 0, weighted: 0 };
  }

  const novelty = noveltyScore / tableCount;
  const diversity = diversityScore / tableCount;
  const balance = balanceScore / tableCount;
  const transaction = transactionScore / tableCount;
  const weighted =
    novelty * weights.novelty +
    diversity * weights.diversity +
    balance * weights.balance +
    transaction * weights.transaction;

  return { novelty, diversity, balance, transaction, weighted };
}

function generateExplanations(
  tables: TableAssignment[],
  guests: EngineGuest[]
): { perTable: Record<string, string[]>; overall: string } {
  const guestMap = new Map(guests.map(g => [g.id, g]));
  const perTable: Record<string, string[]> = {};

  for (const table of tables) {
    const tableGuests = table.guestIds.map(id => guestMap.get(id)).filter(Boolean) as EngineGuest[];
    if (tableGuests.length === 0) continue;

    const explanations: string[] = [];
    const companies = new Set(tableGuests.map(g => g.company).filter(Boolean));
    const buyers = tableGuests.filter(g => g.guestType === "BUYER");
    const sellers = tableGuests.filter(g => g.guestType === "SELLER");

    if (companies.size > 1) {
      explanations.push(`Cross-company networking: ${companies.size} companies represented`);
    }
    if (buyers.length > 0 && sellers.length > 0) {
      explanations.push(`Business opportunity: ${buyers.length} buyer(s), ${sellers.length} seller(s)`);
    }

    perTable[table.tableId] = explanations.length > 0 ? explanations : ["General networking table"];
  }

  const overall = `Optimized seating for ${guests.length} guests across ${tables.filter(t => t.guestIds.length > 0).length} tables.`;
  return { perTable, overall };
}

// POST /api/events/[eventId]/optimize - Generate a new seating plan
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch event with all data
    const event = await prisma.event.findFirst({
      where: {
        id: params.eventId,
        ownerId: session.user.id,
      },
      include: {
        guests: true,
        constraints: true,
        objectives: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (event.guests.length === 0) {
      return NextResponse.json(
        { error: "No guests to optimize. Add guests first." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const options = optimizeSchema.parse(body);
    const seed = options.seed ?? Date.now();

    // Convert to engine types
    const engineGuests: EngineGuest[] = event.guests.map(g => ({
      id: g.id,
      name: g.name,
      company: g.company || undefined,
      department: g.department || undefined,
      jobTitle: g.jobTitle || undefined,
      seniority: g.seniority as EngineGuest["seniority"],
      guestType: g.guestType as EngineGuest["guestType"],
      tags: g.tags,
    }));

    const engineConstraints: EngineConstraint[] = event.constraints.map(c => ({
      id: c.id,
      type: c.type as EngineConstraint["type"],
      guestIds: c.guestIds,
      value: c.value || undefined,
    }));

    const weights = event.objectives || {
      noveltyWeight: 0.25,
      diversityWeight: 0.25,
      balanceWeight: 0.25,
      transactionWeight: 0.25,
    };

    // Check feasibility
    const totalSeats = event.tableCount * event.seatsPerTable;
    if (event.guests.length > totalSeats) {
      return NextResponse.json(
        {
          error: `Not enough seats: ${event.guests.length} guests but only ${totalSeats} seats (${event.tableCount} tables × ${event.seatsPerTable} seats)`,
        },
        { status: 400 }
      );
    }

    // Run optimization
    const rng = new SeededRandom(seed);
    const tables = createInitialAssignment(
      engineGuests,
      engineConstraints,
      event.tableCount,
      event.seatsPerTable,
      rng
    );

    // Calculate metrics
    const metrics = calculateScores(tables, engineGuests, {
      novelty: weights.noveltyWeight,
      diversity: weights.diversityWeight,
      balance: weights.balanceWeight,
      transaction: weights.transactionWeight,
    });

    // Generate explanations
    const explanations = generateExplanations(tables, engineGuests);

    // Get next version number
    const lastPlan = await prisma.planVersion.findFirst({
      where: { eventId: params.eventId },
      orderBy: { version: "desc" },
    });
    const nextVersion = (lastPlan?.version ?? 0) + 1;

    // Create plan
    const plan = await prisma.planVersion.create({
      data: {
        eventId: params.eventId,
        version: nextVersion,
        status: "DRAFT",
        assignments: Object.fromEntries(tables.map(t => [t.tableId, t.guestIds])),
        metrics,
        explanations,
        warnings: [],
      },
    });

    return NextResponse.json({
      plan,
      tables,
      metrics,
      explanations,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error optimizing seating:", error);
    return NextResponse.json(
      { error: "Failed to optimize seating" },
      { status: 500 }
    );
  }
}
