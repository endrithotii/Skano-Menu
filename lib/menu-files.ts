// Server-side storage helpers for uploaded menu files (PDF / photos).
// Files live in Vercel Blob in production, or in public/uploads during local development.

import { randomUUID } from "crypto";

export async function saveMenuFile(file: File, restaurantId: string, ext: string): Promise<string> {
  const unique = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const filename = `menus/menu-${restaurantId}-${unique}${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const bytes = await file.arrayBuffer();
    const blob = await put(filename, bytes, {
      access: "public",
      contentType: file.type,
    });
    return blob.url;
  }

  // Production without blob token — fail clearly
  if (process.env.NODE_ENV === "production") {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured. Please add it in your Vercel project environment variables.");
  }

  // Local fallback for development only
  const { writeFile, mkdir } = await import("fs/promises");
  const { join } = await import("path");
  const uploadsDir = join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const localFilename = `menu-${restaurantId}-${unique}${ext}`;
  await writeFile(join(uploadsDir, localFilename), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${localFilename}`;
}

export async function deleteMenuFile(url: string): Promise<void> {
  if (url.startsWith("http")) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return;
    const { del } = await import("@vercel/blob");
    await del(url).catch(() => {});
    return;
  }
  // Local file (relative path like /uploads/...)
  if (!url.startsWith("/uploads/") || url.includes("..")) return;
  const { unlink } = await import("fs/promises");
  const { join } = await import("path");
  await unlink(join(process.cwd(), "public", url)).catch(() => {});
}

// Files uploaded for this restaurant are named menus/menu-<restaurantId>-... (blob) or /uploads/menu-<restaurantId>-... (local)
export function isOwnMenuUpload(url: string, restaurantId: string): boolean {
  const marker = `/menu-${restaurantId}-`;
  if (url.startsWith("/uploads/")) return url.includes(marker) && !url.includes("..");
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".blob.vercel-storage.com") && u.pathname.includes(marker);
  } catch {
    return false;
  }
}
