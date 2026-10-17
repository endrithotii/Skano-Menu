import { NextRequest, NextResponse } from "next/server";
import { runDueReminders } from "@/lib/reservation-reminders";

// Sends due reservation reminders of all restaurants.
// Called by the Vercel cron (vercel.json) and, for exact times, by an outside pinger every few minutes (e.g. cron-job.org).
// With CRON_SECRET set, the call needs "Authorization: Bearer <CRON_SECRET>" (Vercel sends it) or ?key=<CRON_SECRET>.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}` && req.nextUrl.searchParams.get("key") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { sent } = await runDueReminders(null, req.nextUrl.origin);
  return NextResponse.json({ ok: true, sent });
}
