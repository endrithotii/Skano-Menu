// Browser side: makes a photo smaller (keeps 360 photos sharp enough) and uploads it. See lib/image-files.ts.

/** maxSide: longest side in pixels. 360 photos: 4096 (what phones can show), normal photos: 2000 */
export async function shrinkImage(file: File, maxSide: number, quality = 0.85): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 2.5 * 1024 * 1024 && file.type === "image/jpeg") { bitmap.close(); return file; }
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  let q = quality;
  for (;;) {
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", q));
    if (!blob) throw new Error("Could not read this photo");
    if (blob.size < 4.2 * 1024 * 1024 || q <= 0.5) return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
    q -= 0.1;
  }
}

/** Is this probably a 360 photo? (equirectangular photos are twice as wide as high) */
export async function looks360(file: File): Promise<boolean> {
  try { const b = await createImageBitmap(file); const r = b.width / b.height; b.close(); return Math.abs(r - 2) < 0.05; } catch { return false; }
}

export async function uploadImage(path: string, file: File, opts: { maxSide: number; fields?: Record<string, string> }): Promise<string> {
  const small = await shrinkImage(file, opts.maxSide);
  const form = new FormData();
  form.append("file", small);
  for (const [k, v] of Object.entries(opts.fields ?? {})) form.append(k, v);
  const res = await fetch(path, { method: "POST", body: form }).catch(() => null);
  const d = await res?.json().catch(() => null);
  if (!res?.ok || !d?.url) throw new Error(d?.error ?? "The upload didn't work. Please try again.");
  return d.url;
}
