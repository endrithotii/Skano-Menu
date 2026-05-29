import { NextResponse } from "next/server";

// Returns the VAPID public key so the client can subscribe to push notifications.
// This is public by design — the VAPID public key is not secret.
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    return NextResponse.json({ error: "Push not configured" }, { status: 503 });
  }
  return NextResponse.json({ key });
}
