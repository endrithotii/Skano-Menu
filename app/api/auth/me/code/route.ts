import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { emailConfigured, sendEmail, simpleHtml } from "@/lib/email";
import { CODE_MINUTES, makeTicket, newCode, tooManyCodes } from "@/lib/account-codes";

// "My account": email a 6-digit code (see lib/account-codes.ts).
// POST { purpose: "me" }                 -> to the email you have now (instead of your current password)
// POST { purpose: "email", email: new }  -> to the new email (to confirm it)
// -> { ticket, sentTo, expiresAt }
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const user: { id: string; email: string; name: string; password: string } | null =
      await prisma.user.findUnique({ where: { id: session.id }, select: { id: true, email: true, name: true, password: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const purpose = b.purpose === "email" ? "email" : "me";
    const to = purpose === "email" ? (typeof b.email === "string" ? b.email.trim().slice(0, 120) : "") : user.email;
    if (purpose === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return NextResponse.json({ error: "This email doesn't look right", field: "email" }, { status: 400 });
      if (to.toLowerCase() === user.email.toLowerCase()) return NextResponse.json({ error: "This is already your email", field: "email" }, { status: 400 });
      const taken = await prisma.user.findFirst({ where: { email: to, NOT: { id: user.id } }, select: { id: true } });
      if (taken) return NextResponse.json({ error: "Another account already uses this email", field: "email" }, { status: 409 });
    }
    if (!emailConfigured()) return NextResponse.json({ error: "Sending emails isn't set up on the platform yet, so we can't send a code. Use your current password." }, { status: 503 });
    const wait = tooManyCodes(user.id);
    if (wait) return NextResponse.json({ error: wait }, { status: 429 });

    const code = newCode();
    const { ticket, expiresAt } = await makeTicket(user, purpose, to, code);
    const what = purpose === "email" ? "confirm your new email" : "change your account without your current password";
    const lines = [`Hi ${user.name},`, `Your code to ${what} on SkanoMenu is:`, code, `It works for ${CODE_MINUTES} minutes.`];
    const res = await sendEmail({
      to, subject: `Your SkanoMenu code: ${code}`,
      text: `${lines.join("\n")}\n\nDidn't ask for it? Ignore this email. Nobody can use the code without being signed in to your account.`,
      html: simpleHtml("Your SkanoMenu code", lines, "Didn't ask for it? Ignore this email. Nobody can use the code without being signed in to your account."),
    });
    if (!res.sent) return NextResponse.json({ error: "We couldn't send the email. Please try again in a moment." }, { status: 502 });
    return NextResponse.json({ ticket, sentTo: to, expiresAt });
  } catch (error) {
    console.error("[POST /api/auth/me/code]", error);
    return NextResponse.json({ error: "Could not send the code. Please try again." }, { status: 500 });
  }
}
