import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join, extname } from "path";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

const MAX_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
const ALLOWED_EXTS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: idOrSlug } = await params;

    const restaurant = await prisma.restaurant.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: { id: true, ownerId: true },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    if (session.role !== "SUPER_ADMIN" && restaurant.ownerId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 20MB." },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: PDF, JPG, PNG, WEBP." },
        { status: 400 }
      );
    }

    const ext = extname(file.name).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      return NextResponse.json(
        { error: "Invalid file extension." },
        { status: 400 }
      );
    }

    const uploadsDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const filename = `menu-${restaurant.id}-${Date.now()}${ext}`;
    const filepath = join(uploadsDir, filename);

    const bytes = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(bytes));

    const url = `/uploads/${filename}`;

    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { menuPdfUrl: url, menuPdfName: file.name },
    });

    return NextResponse.json({ url, name: file.name });
  } catch (error) {
    console.error("[POST /api/restaurants/[id]/upload-menu]", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: idOrSlug } = await params;

    const restaurant = await prisma.restaurant.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: { id: true, ownerId: true, menuPdfUrl: true },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    if (session.role !== "SUPER_ADMIN" && restaurant.ownerId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (restaurant.menuPdfUrl) {
      const { unlink } = await import("fs/promises");
      const filepath = join(process.cwd(), "public", restaurant.menuPdfUrl);
      await unlink(filepath).catch(() => {});
    }

    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { menuPdfUrl: null, menuPdfName: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/restaurants/[id]/upload-menu]", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
