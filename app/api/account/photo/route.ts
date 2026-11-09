import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { loadPhotos, mainRestaurantOf, photoOf, restaurantsOf, setPhoto } from "@/lib/user-photos";

// Profile photos (see lib/user-photos.ts)
// GET    -> { mine: url | null, people: { userId: url } }   people: everyone at your restaurant who has a photo
// POST   form-data "file" (JPG, PNG or WEBP, up to 5 MB) -> { url }   your own photo only
// DELETE -> { success: true }                                          removes your photo

const MAX_SIZE = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

/** Delete an old photo file. Never throws: a leftover file must not stop the change. */
async function removeFile(url: string | null) {
  if (!url || !url.includes(".blob.vercel-storage.com/")) return;
  try { const { del } = await import("@vercel/blob"); await del(url); } catch (e) { console.error("[account/photo] could not delete old file", e); }
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const restaurantId = await mainRestaurantOf(session.id);
  const [mine, people] = await Promise.all([photoOf(session.id), restaurantId ? loadPhotos(restaurantId) : Promise.resolve({})]);
  return NextResponse.json({ mine, people }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await restaurantsOf(session.id)).length) {
    return NextResponse.json({ error: "Profile photos are for people who work at a restaurant." }, { status: 400 });
  }
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a photo first." }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "The photo is too big. Up to 5 MB." }, { status: 400 });
    if (!TYPES.includes(file.type)) return NextResponse.json({ error: "Use a JPG, PNG or WEBP photo." }, { status: 400 });

    const { put } = await import("@vercel/blob");
    const blob = await put(`avatars/${session.id}-${Date.now()}.jpg`, await file.arrayBuffer(), { access: "public", contentType: file.type });
    const old = await setPhoto(session.id, blob.url);
    if (old && old !== blob.url) await removeFile(old);
    return NextResponse.json({ url: blob.url });
  } catch (e) {
    console.error("[POST /api/account/photo]", e);
    return NextResponse.json({ error: "The upload didn't work. Please try again." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const old = await setPhoto(session.id, null);
  await removeFile(old);
  return NextResponse.json({ success: true });
}
