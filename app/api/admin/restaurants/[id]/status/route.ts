import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { parseJsonField } from "@/lib/utils";
import { notifyOwner, appUrl } from "@/lib/reservation-reminders";
import { emailConfigured, sendEmail, simpleHtml } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

const VALID_STATUSES = ["ACTIVE", "PENDING", "SUSPENDED"] as const;
type Status = (typeof VALID_STATUSES)[number];

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const restaurant = await prisma.restaurant.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { status } = body;

    if (!status || !VALID_STATUSES.includes(status as Status)) {
      return NextResponse.json(
        {
          error: `status must be one of: ${VALID_STATUSES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const updated = await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { status: status as string },
    });

    // Approved: tell the owner (a notification in the dashboard and an email).
    // Sent after the answer, so a slow mail server never makes approving fail.
    if (status === "ACTIVE" && restaurant.status !== "ACTIVE") {
      const first = restaurant.status === "PENDING";
      const text = first
        ? `Your restaurant ${restaurant.name} has been approved. Customers can see your menu now.`
        : `Your restaurant ${restaurant.name} is active again. Customers can see your menu now.`;
      const origin = req.nextUrl.origin;
      after(async () => {
        await notifyOwner(restaurant.id, text).catch((e) => console.error("[approve] notification", e));
        const owner = await prisma.user.findFirst({ where: { id: restaurant.ownerId }, select: { email: true, name: true } }).catch(() => null);
        if (owner?.email && emailConfigured()) {
          const link = `${appUrl(origin)}/dashboard`;
          await sendEmail({
            to: owner.email, subject: first ? `${restaurant.name} has been approved` : `${restaurant.name} is active again`,
            text: `Hi ${owner.name || ""},\n\n${text}\n\nOpen your dashboard: ${link}\n\nSkano Menu`,
            html: simpleHtml(first ? "Your restaurant has been approved" : "Your restaurant is active again", [`Hi ${owner.name || ""},`, text], "Skano Menu", { label: "Open your dashboard", href: link, tone: "primary" }),
          }).catch((e) => console.error("[approve] email", e));
        }
      });
    }

    return NextResponse.json({
      restaurant: {
        ...updated,
        cuisine: parseJsonField<string[]>(updated.cuisine, []),
      },
    });
  } catch (error) {
    console.error("[PUT /api/admin/restaurants/[id]/status]", error);
    return NextResponse.json(
      { error: `Could not change the status: ${error instanceof Error ? error.message : String(error)}`.slice(0, 300) },
      { status: 500 }
    );
  }
}
