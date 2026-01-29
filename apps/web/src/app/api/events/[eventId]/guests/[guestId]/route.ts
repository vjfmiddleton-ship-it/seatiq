import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateGuestSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  company: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  seniority: z.enum(["JUNIOR", "MID", "SENIOR", "EXECUTIVE"]).nullable().optional(),
  guestType: z.enum(["BUYER", "SELLER", "NEUTRAL", "CATALYST"]).optional(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  needsReview: z.boolean().optional(),
});

// GET /api/events/[eventId]/guests/[guestId] - Get a single guest
export async function GET(
  _request: NextRequest,
  { params }: { params: { eventId: string; guestId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const guest = await prisma.guest.findFirst({
      where: {
        id: params.guestId,
        eventId: params.eventId,
        event: { ownerId: session.user.id },
      },
    });

    if (!guest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    return NextResponse.json(guest);
  } catch (error) {
    console.error("Error fetching guest:", error);
    return NextResponse.json(
      { error: "Failed to fetch guest" },
      { status: 500 }
    );
  }
}

// PATCH /api/events/[eventId]/guests/[guestId] - Update a guest
export async function PATCH(
  request: NextRequest,
  { params }: { params: { eventId: string; guestId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const existing = await prisma.guest.findFirst({
      where: {
        id: params.guestId,
        eventId: params.eventId,
        event: { ownerId: session.user.id },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = updateGuestSchema.parse(body);

    const guest = await prisma.guest.update({
      where: { id: params.guestId },
      data,
    });

    return NextResponse.json(guest);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error updating guest:", error);
    return NextResponse.json(
      { error: "Failed to update guest" },
      { status: 500 }
    );
  }
}

// DELETE /api/events/[eventId]/guests/[guestId] - Delete a guest
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { eventId: string; guestId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const existing = await prisma.guest.findFirst({
      where: {
        id: params.guestId,
        eventId: params.eventId,
        event: { ownerId: session.user.id },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    await prisma.guest.delete({
      where: { id: params.guestId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting guest:", error);
    return NextResponse.json(
      { error: "Failed to delete guest" },
      { status: 500 }
    );
  }
}
