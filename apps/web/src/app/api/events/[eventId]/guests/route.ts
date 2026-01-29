import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createGuestSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  company: z.string().optional(),
  department: z.string().optional(),
  jobTitle: z.string().optional(),
  seniority: z.enum(["JUNIOR", "MID", "SENIOR", "EXECUTIVE"]).optional(),
  guestType: z.enum(["BUYER", "SELLER", "NEUTRAL", "CATALYST"]).default("NEUTRAL"),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

const bulkCreateGuestsSchema = z.object({
  guests: z.array(createGuestSchema),
});

// GET /api/events/[eventId]/guests - List all guests for an event
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

    const guests = await prisma.guest.findMany({
      where: { eventId: params.eventId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(guests);
  } catch (error) {
    console.error("Error fetching guests:", error);
    return NextResponse.json(
      { error: "Failed to fetch guests" },
      { status: 500 }
    );
  }
}

// POST /api/events/[eventId]/guests - Create guest(s)
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

    // Check if this is a bulk create
    if (body.guests && Array.isArray(body.guests)) {
      const data = bulkCreateGuestsSchema.parse(body);

      const guests = await prisma.guest.createMany({
        data: data.guests.map((guest) => ({
          ...guest,
          email: guest.email || null,
          eventId: params.eventId,
        })),
      });

      return NextResponse.json(
        { count: guests.count, message: `Created ${guests.count} guests` },
        { status: 201 }
      );
    }

    // Single guest create
    const data = createGuestSchema.parse(body);

    const guest = await prisma.guest.create({
      data: {
        ...data,
        email: data.email || null,
        eventId: params.eventId,
      },
    });

    return NextResponse.json(guest, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating guest:", error);
    return NextResponse.json(
      { error: "Failed to create guest" },
      { status: 500 }
    );
  }
}

// DELETE /api/events/[eventId]/guests - Delete all guests for an event
export async function DELETE(
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

    const result = await prisma.guest.deleteMany({
      where: { eventId: params.eventId },
    });

    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("Error deleting guests:", error);
    return NextResponse.json(
      { error: "Failed to delete guests" },
      { status: 500 }
    );
  }
}
