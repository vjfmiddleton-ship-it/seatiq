import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/events/[eventId]/constraints/[constraintId] - Delete a constraint
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { eventId: string; constraintId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const existing = await prisma.constraint.findFirst({
      where: {
        id: params.constraintId,
        eventId: params.eventId,
        event: { ownerId: session.user.id },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Constraint not found" },
        { status: 404 }
      );
    }

    await prisma.constraint.delete({
      where: { id: params.constraintId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting constraint:", error);
    return NextResponse.json(
      { error: "Failed to delete constraint" },
      { status: 500 }
    );
  }
}
