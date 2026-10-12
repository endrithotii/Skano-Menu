"use client";

// Upload a menu as one PDF or several photos, reorder/remove photo pages, preview the flip book.

import { useRef, useState } from "react";
import {
  Upload, FileText, Image as ImageIcon, Trash2, Eye, CheckCircle, AlertCircle, X,
  ChevronLeft, ChevronRight, Plus, BookOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { MenuBook } from "@/components/menu-book";
import { MAX_MENU_PAGES, parseMenuPages } from "@/lib/menu-pages";

const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 20 * 1024 * 1024;
// Photos are shrunk in the browser so each upload stays well under Vercel's ~4.5MB request limit
const MAX_PHOTO_EDGE = 2400;
const COMPRESS_OVER_BYTES = 1.2 * 1024 * 1024;

interface MenuState {
  menuPdfUrl: string | null;
  name: string | null;
}

async function compressImage(file: File): Promise<File> {
  if (file.size <= COMPRESS_OVER_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

// Uploads a file to storage without changing the live menu. Returns its url.
function stageUpload(
  restaurantId: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ url: string; name: string }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", "stage");

    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: { url?: string; name?: string; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON response, e.g. the platform rejected the request body
      }
      if (xhr.status === 200 && data.url) {
        resolve({ url: data.url, name: data.name ?? file.name });
      } else if (xhr.status === 413) {
        reject(new Error("File is too large for the server (about 4.5 MB max). Compress the PDF or upload photos instead."));
      } else {
        reject(new Error(data.error ?? "Upload failed"));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed. Please try again."));
    xhr.open("POST", `/api/restaurants/${restaurantId}/upload-menu`);
    xhr.send(formData);
  });
}

export interface MenuBookEditorProps {
  restaurantId: string;
  restaurantSlug?: string | null;
  /** Draft menu (not saved yet). The parent saves it with the Save button. */
  value: MenuState;
  onChange: (next: MenuState) => void;
  /** Urls of the menu as currently saved, used to mark new pages */
  savedUrls?: string[];
  /** Called for every file uploaded to storage, so the parent can clean up on Discard */
  onStaged?: (url: string) => void;
}

export function MenuBookEditor({ restaurantId, restaurantSlug, value, onChange, savedUrls = [], onStaged }: MenuBookEditorProps) {
  const menu = value;
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadLabel, setUploadLabel] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addPhotosRef = useRef<HTMLInputElement>(null);

  const pages = parseMenuPages(menu.menuPdfUrl);
  const photoUrls = pages?.kind === "images" ? pages.urls : [];
  const busy = false;

  function setPhotos(urls: string[]) {
    onChange(urls.length ? { menuPdfUrl: JSON.stringify(urls), name: `${urls.length} photos` } : { menuPdfUrl: null, name: null });
  }

  async function handleFiles(fileList: File[]) {
    if (!restaurantId || uploading || !fileList.length) return;

    const pdfs = fileList.filter((f) => f.type === "application/pdf");
    const photos = fileList.filter((f) => IMAGE_TYPES.includes(f.type));

    if (pdfs.length + photos.length !== fileList.length) {
      toast.error("Unsupported file type. Use PDF, JPG, PNG, or WEBP.");
      return;
    }
    if (pdfs.length && (pdfs.length > 1 || photos.length)) {
      toast.error("Upload one PDF, or one or more photos, not both.");
      return;
    }
    if (fileList.some((f) => f.size > MAX_FILE_SIZE)) {
      toast.error("A file is too large. Maximum size is 20MB.");
      return;
    }

    // New photos are added after existing photo pages; a PDF (or photos after a PDF) replaces the menu
    const appendToPhotos = photos.length > 0 && pages?.kind === "images";
    if (photos.length && (appendToPhotos ? photoUrls.length : 0) + photos.length > MAX_MENU_PAGES) {
      toast.error(`A menu can have at most ${MAX_MENU_PAGES} pages.`);
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      if (pdfs.length) {
        setUploadLabel("Uploading PDF");
        const { url, name } = await stageUpload(restaurantId, pdfs[0], setProgress);
        onStaged?.(url);
        onChange({ menuPdfUrl: url, name });
      } else {
        const urls = appendToPhotos ? [...photoUrls] : [];
        for (let i = 0; i < photos.length; i++) {
          setUploadLabel(`Uploading photo ${i + 1} of ${photos.length}`);
          setProgress(0);
          const file = await compressImage(photos[i]);
          const { url } = await stageUpload(restaurantId, file, setProgress);
          onStaged?.(url);
          urls.push(url);
          setPhotos(urls);
        }
      }
      toast("Added. Press Save to publish it.", { icon: "💾" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setProgress(0);
      setUploadLabel("");
    }
  }

  function handleDeleteAll() {
    if (!pages) return;
    onChange({ menuPdfUrl: null, name: null });
  }

  function handleDeletePage(index: number) {
    setPhotos(photoUrls.filter((_, i) => i !== index));
  }

  function handleMove(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= photoUrls.length) return;
    const order = [...photoUrls];
    [order[index], order[target]] = [order[target], order[index]];
    setPhotos(order);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(Array.from(e.dataTransfer.files));
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    handleFiles(files);
  }

  return (
    <div className="space-y-6">
      {/* Current upload */}
      <AnimatePresence>
        {pages && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                {pages.kind === "pdf" ? (
                  <FileText className="w-6 h-6 text-blue-500" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-blue-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {pages.kind === "pdf" ? menu.name ?? "Menu.pdf" : `${photoUrls.length} page${photoUrls.length === 1 ? "" : "s"}`}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {pages.kind === "pdf" ? "PDF document" : "Photos"} · Shown as a flip book on your public menu page
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
                  <button
                    onClick={() => setPreview(true)}
                    className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" /> Preview book
                  </button>
                  {restaurantSlug && (
                    <a
                      href={`/r/${restaurantSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      View public page
                    </a>
                  )}
                  <button
                    onClick={handleDeleteAll}
                    disabled={busy || uploading}
                    className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 transition-colors ml-auto disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove all
                  </button>
                </div>
              </div>
            </div>

            {/* Photo pages: reorder / delete */}
            {pages.kind === "images" && (
              <div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {photoUrls.map((url, i) => (
                    <div key={url} className="group relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Page ${i + 1}`} className="w-full aspect-[3/4] object-cover" />
                      <span className="absolute top-1.5 left-1.5 text-[10px] font-bold bg-black/60 text-white rounded-md px-1.5 py-0.5">
                        {i === 0 ? "Cover" : i + 1}
                      </span>
                      {!savedUrls.includes(url) && (
                        <span className="absolute bottom-9 left-1.5 text-[10px] font-bold bg-amber-400 text-amber-950 rounded-md px-1.5 py-0.5">
                          New
                        </span>
                      )}
                      <button
                        onClick={() => handleDeletePage(i)}
                        disabled={busy || uploading}
                        aria-label={`Remove page ${i + 1}`}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-white/90 text-red-500 flex items-center justify-center shadow-sm hover:bg-white disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute bottom-0 inset-x-0 flex justify-between p-1.5">
                        <button
                          onClick={() => handleMove(i, -1)}
                          disabled={i === 0 || busy || uploading}
                          aria-label="Move earlier"
                          className="w-6 h-6 rounded-md bg-white/90 text-gray-700 flex items-center justify-center shadow-sm disabled:opacity-0"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMove(i, 1)}
                          disabled={i === photoUrls.length - 1 || busy || uploading}
                          aria-label="Move later"
                          className="w-6 h-6 rounded-md bg-white/90 text-gray-700 flex items-center justify-center shadow-sm disabled:opacity-0"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {photoUrls.length < MAX_MENU_PAGES && (
                    <button
                      onClick={() => addPhotosRef.current?.click()}
                      disabled={uploading}
                      className="rounded-xl border-2 border-dashed border-gray-200 aspect-[3/4] flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors disabled:opacity-50"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="text-xs font-medium">Add pages</span>
                    </button>
                  )}
                </div>
                <input
                  ref={addPhotosRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  multiple
                  onChange={handleInputChange}
                  className="hidden"
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer ${
          dragOver
            ? "border-blue-400 bg-blue-50"
            : uploading
            ? "border-gray-200 bg-gray-50 cursor-not-allowed"
            : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          multiple
          onChange={handleInputChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          {uploading ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mb-4">
                <Upload className="w-7 h-7 text-blue-500 animate-bounce" />
              </div>
              <p className="font-semibold text-gray-900 mb-1">{uploadLabel || "Uploading"}…</p>
              <p className="text-sm text-gray-500 mb-4">{progress}% complete</p>
              <div className="w-full max-w-xs h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-blue-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </>
          ) : (
            <>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors ${dragOver ? "bg-blue-200" : "bg-blue-100"}`}>
                <BookOpen className={`w-7 h-7 transition-colors ${dragOver ? "text-blue-600" : "text-blue-500"}`} />
              </div>
              <p className="font-semibold text-gray-900 mb-1">
                {dragOver ? "Drop your files here" : "Drag & drop or click to upload"}
              </p>
              <p className="text-sm text-gray-500">One PDF, or several photos (JPG, PNG, WEBP) · Max 20MB each</p>
              {pages?.kind === "images" && (
                <p className="text-xs text-gray-500 mt-3">New photos are added as extra pages at the end</p>
              )}
              {pages?.kind === "pdf" && (
                <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Uploading will replace the current PDF
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Info callout */}
      <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800 space-y-1">
        <p className="font-semibold">How this works</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-700 text-xs">
          <li>Your menu is shown as a book customers can swipe through, page by page.</li>
          <li>The first page is the cover. With photos you can reorder pages with the arrows.</li>
          <li>Nothing goes live until you press Save. Discard throws your changes away.</li>
        </ul>
      </div>

      {/* Preview modal */}
      <AnimatePresence>
        {preview && pages && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setPreview(false)}>
            <motion.div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            />
            <motion.div
              className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <span className="font-semibold text-gray-900 truncate">Book preview</span>
                <button onClick={() => setPreview(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-auto bg-gray-50 p-4">
                <MenuBook key={menu.menuPdfUrl} source={menu.menuPdfUrl} maxHeightRatio={0.68} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
