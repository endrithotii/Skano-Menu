// Staff documents (contracts, certificates, ...): private files. Only /api/restaurants/[id]/hr/documents/[docId] hands them out,
// after checking who asks. The storage address is never sent to a browser.
//   Production: Vercel Blob with private access. If the store only allows public files, a public file with a long
//   random name is used instead (still never shown to anyone, the download always goes through the check).
//   Developing locally: a folder outside public/.

import { newFileKey, type StoredFile } from "@/lib/hr-store";

export const DOC_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};
/** One request is capped at ~4.5MB on Vercel */
export const MAX_DOC = 4.4 * 1024 * 1024;

const localDir = async () => {
  const { join } = await import("path");
  return join(process.cwd(), ".data", "hr-files");
};

export async function saveDocFile(file: File, restaurantId: string): Promise<StoredFile> {
  const key = newFileKey(restaurantId, DOC_TYPES[file.type] ?? "");
  const body = Buffer.from(await file.arrayBuffer());
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    try {
      await put(key, body, { access: "private", contentType: file.type, addRandomSuffix: false });
      return { key, access: "private" };
    } catch (error) {
      console.warn("[hr-files] private upload not possible, using a hidden public file", error instanceof Error ? error.message : error);
      const blob = await put(key, body, { access: "public", contentType: file.type, addRandomSuffix: true });
      return { key: blob.url, access: "public" };
    }
  }
  if (process.env.NODE_ENV === "production") throw new Error("BLOB_READ_WRITE_TOKEN is not configured. Please add it in your Vercel project environment variables.");
  const { writeFile, mkdir } = await import("fs/promises");
  const { join } = await import("path");
  const dir = await localDir();
  await mkdir(dir, { recursive: true });
  const name = key.replace(/\//g, "_");
  await writeFile(join(dir, name), body);
  return { key: name, access: "local" };
}

export async function readDocFile(f: StoredFile): Promise<ReadableStream<Uint8Array> | Buffer | null> {
  if (f.access === "private") {
    const { get } = await import("@vercel/blob");
    const res = await get(f.key, { access: "private" });
    return res?.stream ?? null;
  }
  if (f.access === "public") {
    const res = await fetch(f.key).catch(() => null);
    return res?.ok && res.body ? res.body : null;
  }
  const { readFile } = await import("fs/promises");
  const { join } = await import("path");
  if (!/^[\w.-]+$/.test(f.key)) return null;
  return readFile(join(await localDir(), f.key)).catch(() => null);
}

export async function deleteDocFile(f: StoredFile) {
  try {
    if (f.access === "local") {
      const { unlink } = await import("fs/promises");
      const { join } = await import("path");
      if (/^[\w.-]+$/.test(f.key)) await unlink(join(await localDir(), f.key));
      return;
    }
    const { del } = await import("@vercel/blob");
    await del(f.key);
  } catch (error) {
    console.error("[hr-files] could not delete", error);
  }
}
