import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/events/[eventId]/export - Export seating plan as JSON (for PDF generation client-side)
export async function GET(
  _request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const event = await prisma.event.findFirst({
      where: {
        id: params.eventId,
        ownerId: session.user.id,
      },
      include: {
        guests: true,
        plans: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (event.plans.length === 0) {
      return NextResponse.json(
        { error: "No seating plan generated yet" },
        { status: 400 }
      );
    }

    const plan = event.plans[0];
    const assignments = plan.assignments as Record<string, string[]>;
    const metrics = plan.metrics as {
      novelty: number;
      diversity: number;
      balance: number;
      transaction: number;
      weighted: number;
    };
    const explanations = plan.explanations as {
      perTable: Record<string, string[]>;
      overall: string;
    };

    // Build export data
    const tables = Object.entries(assignments).map(([tableId, guestIds]) => {
      const tableGuests = guestIds
        .map((id) => event.guests.find((g) => g.id === id))
        .filter(Boolean)
        .map((g) => ({
          name: g!.name,
          company: g!.company,
          department: g!.department,
          jobTitle: g!.jobTitle,
          guestType: g!.guestType,
        }));

      return {
        id: tableId,
        name: tableId.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        guests: tableGuests,
        explanations: explanations.perTable[tableId] || [],
      };
    });

    const exportData = {
      event: {
        name: event.name,
        date: event.date,
        venue: event.venue,
        tableCount: event.tableCount,
        seatsPerTable: event.seatsPerTable,
        totalGuests: event.guests.length,
      },
      plan: {
        version: plan.version,
        createdAt: plan.createdAt,
        metrics,
        overallExplanation: explanations.overall,
      },
      tables,
    };

    return NextResponse.json(exportData);
  } catch (error) {
    console.error("Error exporting plan:", error);
    return NextResponse.json(
      { error: "Failed to export plan" },
      { status: 500 }
    );
  }
}
