// Photos the dashboard uploads (floor plan views, 360 photos, dish photos, receipts).
// Vercel Blob in production, public/uploads when developing locally. Same idea as lib/menu-files.ts.

import { randomUUID } from "crypto";

export const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
/** One request is capped at ~4.5MB on Vercel: the browser makes photos smaller first (lib/image-upload.ts) */
export const MAX_IMAGE = 4.4 * 1024 * 1024;

export async function saveImageFile(file: File, folder: "floor" | "dishes" | "receipts", restaurantId: string): Promise<string> {
  const ext = file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : ".jpg";
  const name = `${folder}-${restaurantId}-${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`images/${name}`, await file.arrayBuffer(), { access: "public", contentType: file.type });
    return blob.url;
  }
  if (process.env.NODE_ENV === "production") throw new Error("BLOB_READ_WRITE_TOKEN is not configured. Please add it in your Vercel project environment variables.");
  const { writeFile, mkdir } = await import("fs/promises");
  const { join } = await import("path");
  const dir = join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${name}`;
}
