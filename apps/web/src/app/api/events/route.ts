import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createEventSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  date: z.string().optional(),
  venue: z.string().optional(),
  description: z.string().optional(),
  tableCount: z.number().int().min(1).max(100).default(10),
  seatsPerTable: z.number().int().min(2).max(20).default(8),
});

// GET /api/events - List all events for the current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const events = await prisma.event.findMany({
      where: { ownerId: session.user.id },
      include: {
        _count: {
          select: { guests: true, plans: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}

// POST /api/events - Create a new event
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createEventSchema.parse(body);

    const event = await prisma.event.create({
      data: {
        name: data.name,
        date: data.date ? new Date(data.date) : null,
        venue: data.venue,
        description: data.description,
        tableCount: data.tableCount,
        seatsPerTable: data.seatsPerTable,
        ownerId: session.user.id,
        objectives: {
          create: {
            noveltyWeight: 0.25,
            diversityWeight: 0.25,
            balanceWeight: 0.25,
            transactionWeight: 0.25,
          },
        },
      },
      include: {
        objectives: true,
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating event:", error);
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    );
  }
}
