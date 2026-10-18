import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { forbidUnless } from "@/lib/staff-access";
import { IMAGE_TYPES, MAX_IMAGE, saveImageFile } from "@/lib/image-files";
import type { Permission } from "@/lib/permissions";

// Uploads a photo for the dashboard. POST form { file, purpose: "floor" | "dish" } -> { url }
//   floor: views from the tables and photos of the areas (needs "Floor plan and tables")
//   dish:  photos of the dishes (needs "Add ingredients and details")
// The photo is only used once the page that uploaded it is saved.

type Params = { params: Promise<{ id: string }> };
const PURPOSE: Record<string, { need: Permission; folder: "floor" | "dishes" }> = {
  floor: { need: "floor.edit", folder: "floor" },
  dish: { need: "details.edit", folder: "dishes" },
};

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const r = await prisma.restaurant.findFirst({ where: { OR: [{ id }, { slug: id }] }, select: { id: true, ownerId: true } });
    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const form = await req.formData();
    const p = PURPOSE[String(form.get("purpose"))];
    if (!p) return NextResponse.json({ error: "Unknown purpose" }, { status: 400 });
    const denied = await forbidUnless(session, r, p.need);
    if (denied) return denied;
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No photo" }, { status: 400 });
    if (!IMAGE_TYPES.includes(file.type)) return NextResponse.json({ error: "Please use a JPG, PNG or WEBP photo." }, { status: 400 });
    if (file.size > MAX_IMAGE) return NextResponse.json({ error: "This photo is too big. Please use a smaller one." }, { status: 400 });
    return NextResponse.json({ url: await saveImageFile(file, p.folder, r.id) });
  } catch (error) {
    console.error("[upload-image]", error);
    return NextResponse.json({ error: "The upload didn't work. Please try again." }, { status: 500 });
  }
}
