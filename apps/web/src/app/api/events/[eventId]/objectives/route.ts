import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateObjectivesSchema = z
  .object({
    noveltyWeight: z.number().min(0).max(1),
    diversityWeight: z.number().min(0).max(1),
    balanceWeight: z.number().min(0).max(1),
    transactionWeight: z.number().min(0).max(1),
  })
  .refine(
    (data) => {
      const sum =
        data.noveltyWeight +
        data.diversityWeight +
        data.balanceWeight +
        data.transactionWeight;
      return Math.abs(sum - 1) < 0.01;
    },
    { message: "Weights must sum to 1.0" }
  );

// GET /api/events/[eventId]/objectives - Get objectives
export async function GET(
  _request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const objectives = await prisma.objectiveWeights.findFirst({
      where: {
        eventId: params.eventId,
        event: { ownerId: session.user.id },
      },
    });

    if (!objectives) {
      return NextResponse.json(
        { error: "Objectives not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(objectives);
  } catch (error) {
    console.error("Error fetching objectives:", error);
    return NextResponse.json(
      { error: "Failed to fetch objectives" },
      { status: 500 }
    );
  }
}

// PUT /api/events/[eventId]/objectives - Update objectives
export async function PUT(
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
    const data = updateObjectivesSchema.parse(body);

    const objectives = await prisma.objectiveWeights.upsert({
      where: { eventId: params.eventId },
      update: data,
      create: {
        ...data,
        eventId: params.eventId,
      },
    });

    return NextResponse.json(objectives);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error updating objectives:", error);
    return NextResponse.json(
      { error: "Failed to update objectives" },
      { status: 500 }
    );
  }
}
