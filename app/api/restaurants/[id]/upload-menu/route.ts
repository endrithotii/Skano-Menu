import { NextRequest, NextResponse } from "next/server";
import { extname } from "path";
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

async function saveFile(file: File, restaurantId: string, ext: string): Promise<string> {
  const filename = `menus/menu-${restaurantId}-${Date.now()}${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(filename, file.stream(), {
      access: "public",
      contentType: file.type,
    });
    return blob.url;
  }

  // Local fallback for development
  const { writeFile, mkdir } = await import("fs/promises");
  const { join } = await import("path");
  const uploadsDir = join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const localFilename = `menu-${restaurantId}-${Date.now()}${ext}`;
  const filepath = join(uploadsDir, localFilename);
  const bytes = await file.arrayBuffer();
  await writeFile(filepath, Buffer.from(bytes));
  return `/uploads/${localFilename}`;
}

async function deleteFile(url: string): Promise<void> {
  if (url.startsWith("http")) {
    const { del } = await import("@vercel/blob");
    await del(url).catch(() => {});
    return;
  }
  // Local file (relative path like /uploads/...)
  const { unlink } = await import("fs/promises");
  const { join } = await import("path");
  const filepath = join(process.cwd(), "public", url);
  await unlink(filepath).catch(() => {});
}

export async function POST(req: NextRequest, { params }: Params) {
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

    // Delete the previous file before replacing
    if (restaurant.menuPdfUrl) {
      await deleteFile(restaurant.menuPdfUrl);
    }

    const url = await saveFile(file, restaurant.id, ext);

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
      await deleteFile(restaurant.menuPdfUrl);
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
