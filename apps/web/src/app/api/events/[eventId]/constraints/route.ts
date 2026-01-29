import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createConstraintSchema = z.object({
  type: z.enum([
    "MUST_SIT_TOGETHER",
    "MUST_NOT_SIT_TOGETHER",
    "MAX_SELLERS_PER_TABLE",
    "MIN_BUYERS_PER_TABLE",
  ]),
  guestIds: z.array(z.string()).min(1, "At least one guest is required"),
  value: z.number().int().optional(),
  priority: z.number().int().min(1).max(10).default(1),
  notes: z.string().optional(),
});

// GET /api/events/[eventId]/constraints - List all constraints
export async function GET(
  _request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const event = await prisma.event.findFirst({
      where: {
        id: params.eventId,
        ownerId: session.user.id,
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const constraints = await prisma.constraint.findMany({
      where: { eventId: params.eventId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(constraints);
  } catch (error) {
    console.error("Error fetching constraints:", error);
    return NextResponse.json(
      { error: "Failed to fetch constraints" },
      { status: 500 }
    );
  }
}

// POST /api/events/[eventId]/constraints - Create a constraint
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const event = await prisma.event.findFirst({
      where: {
        id: params.eventId,
        ownerId: session.user.id,
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = createConstraintSchema.parse(body);

    // Validate that all guest IDs belong to this event
    const guestCount = await prisma.guest.count({
      where: {
        id: { in: data.guestIds },
        eventId: params.eventId,
      },
    });

    if (guestCount !== data.guestIds.length) {
      return NextResponse.json(
        { error: "Some guest IDs are invalid" },
        { status: 400 }
      );
    }

    const constraint = await prisma.constraint.create({
      data: {
        ...data,
        eventId: params.eventId,
      },
    });

    return NextResponse.json(constraint, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating constraint:", error);
    return NextResponse.json(
      { error: "Failed to create constraint" },
      { status: 500 }
    );
  }
}
