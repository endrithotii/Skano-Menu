"use client";

// Upload a menu as one PDF or several photos, reorder/remove photo pages, choose flip book or scrolling, preview it.

import { useRef, useState } from "react";
import {
  Upload, FileText, Images, Trash2, Eye, AlertCircle, X,
  ArrowLeft, ArrowRight, Plus, Undo2, BookOpen, ScrollText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { MenuBook } from "@/components/menu-book";
import { ScrollMenu } from "@/components/book-viewer-page";
import { MAX_MENU_PAGES, menuDisplay, parseMenuPages, serializeMenuPages, withMenuDisplay, type MenuDisplay } from "@/lib/menu-pages";

const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // photos (they are shrunk before upload anyway)
const MAX_PDF_SIZE = 40 * 1024 * 1024;
// Bigger files go straight from the browser to storage (Vercel's request limit is about 4.5MB)
const DIRECT_UPLOAD_OVER = 4 * 1024 * 1024;
// Photos are shrunk in the browser so each upload stays well under Vercel's ~4.5MB request limit
const MAX_PHOTO_EDGE = 2400;
const COMPRESS_OVER_BYTES = 1.2 * 1024 * 1024;

export interface MenuState {
  menuPdfUrl: string | null;
  /** File name (PDF) or "N photos" */
  name: string | null;
  /** Menu name typed by the user ("" = use the default / keep the current name) */
  title?: string;
  /** menuPdfUrl of the saved version this was edited from; null = this is a new menu */
  basedOn?: string | null;
}

export async function compressImage(file: File): Promise<File> {
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

let directUploads: Promise<boolean> | null = null;
/** Are direct uploads to storage set up (production)? Asked once */
function directUploadsEnabled(restaurantId: string): Promise<boolean> {
  directUploads ??= fetch(`/api/restaurants/${restaurantId}/upload-menu/client`)
    .then((r) => (r.ok ? r.json() : null)).then((d) => d?.enabled === true).catch(() => false);
  return directUploads;
}

async function directUpload(restaurantId: string, file: File, onProgress: (pct: number) => void): Promise<{ url: string; name: string }> {
  const { upload } = await import("@vercel/blob/client");
  const ext = file.type === "application/pdf" ? ".pdf" : file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : ".jpg";
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const blob = await upload(`menus/menu-${restaurantId}-${unique}${ext}`, file, {
    access: "public",
    handleUploadUrl: `/api/restaurants/${restaurantId}/upload-menu/client`,
    multipart: file.size > 10 * 1024 * 1024,
    onUploadProgress: ({ percentage }) => onProgress(Math.round(percentage)),
  });
  return { url: blob.url, name: file.name };
}

// Uploads a file to storage without changing the live menu. Returns its url.
export async function stageUpload(
  restaurantId: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ url: string; name: string }> {
  if (file.size > DIRECT_UPLOAD_OVER && await directUploadsEnabled(restaurantId)) {
    try {
      return await directUpload(restaurantId, file, onProgress);
    } catch (err) {
      console.error("[upload] direct upload failed", err);
      throw new Error("Upload failed. Please check your connection and try again.");
    }
  }
  return formUpload(restaurantId, file, onProgress);
}

function formUpload(
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
  /** The menu as currently saved (live), used to mark new pages and to undo */
  savedValue?: MenuState;
  /** Called for every file uploaded to storage, so the parent can clean up on Discard */
  onStaged?: (url: string) => void;
  /** Name of the menu that `value.basedOn` belongs to (shown when editing an existing menu) */
  editingTitle?: string | null;
  /** Name used when a new menu is saved without one, e.g. "Aroma's menu - 13 Oct 2026" */
  defaultTitle: string;
  /**
   * "live" (default): the Menu page editor, saved with Save changes.
   * "history": editing an older version in a pop-up; every change stays a version of that same menu.
   */
  context?: "live" | "history";
  /** Shown when the draft has new pages: make them live on save, or only keep them in the history */
  activeChoice?: { value: boolean; onChange: (v: boolean) => void };
}

type Source = "pdf" | "photos";

export function MenuBookEditor({ restaurantId, restaurantSlug, value, onChange, savedValue, onStaged, editingTitle, defaultTitle, context = "live", activeChoice }: MenuBookEditorProps) {
  const inHistory = context === "history";
  const menu = value;
  const pages = parseMenuPages(menu.menuPdfUrl);
  const saved = parseMenuPages(savedValue?.menuPdfUrl ?? null);
  const savedUrls = saved ? (saved.kind === "pdf" ? [saved.url] : saved.urls) : [];

  const [source, setSource] = useState<Source>(pages?.kind === "pdf" ? "pdf" : "photos");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadLabel, setUploadLabel] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(false);
  // Flip book or scrolling; kept here too so it applies to the first upload
  const [displayPref, setDisplayPref] = useState<MenuDisplay>(menuDisplay(menu.menuPdfUrl));
  const display: MenuDisplay = pages ? menuDisplay(menu.menuPdfUrl) : displayPref;
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const photoUrls = pages?.kind === "images" ? pages.urls : [];
  const pdfUrl = pages?.kind === "pdf" ? pages.url : null;
  // The other kind is what's in the draft now, and adding to this tab would replace it
  const replacesPdf = source === "photos" && pages?.kind === "pdf";
  const replacesPhotos = source === "pdf" && pages?.kind === "images";

  const isEditingExisting = !!value.basedOn;
  // Starting over (new PDF, or photos from scratch) makes a new menu; a name typed for it is kept
  const asNewMenu = (): MenuState =>
    inHistory ? value : { ...value, basedOn: null, title: isEditingExisting ? "" : value.title ?? "" };

  function setPhotos(urls: string[], base: MenuState = value) {
    onChange({
      ...base,
      menuPdfUrl: serializeMenuPages(urls.length ? { kind: "images", urls, ...(display === "scroll" ? { display: "scroll" as const } : {}) } : null),
      name: urls.length ? `${urls.length} photos` : null,
    });
  }

  async function uploadPdf(file: File) {
    if (file.type !== "application/pdf") {
      toast.error("Please choose a PDF file.");
      return;
    }
    if (file.size > MAX_PDF_SIZE) {
      toast.error("The PDF is too large. Maximum size is 40MB.");
      return;
    }
    setUploading(true);
    setProgress(0);
    setUploadLabel("Uploading PDF");
    try {
      const { url, name } = await stageUpload(restaurantId, file, setProgress);
      onStaged?.(url);
      onChange({ ...asNewMenu(), menuPdfUrl: withMenuDisplay(url, display), name });
      toast(inHistory ? "PDF added. Press Save version when you're done." : "PDF added. Press Save changes to publish it.", { icon: "💾" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setProgress(0);
      setUploadLabel("");
    }
  }

  async function addPhotos(files: File[]) {
    const photos = files.filter((f) => IMAGE_TYPES.includes(f.type));
    if (!photos.length) {
      toast.error("Please choose photos (JPG, PNG or WEBP).");
      return;
    }
    if (photos.length < files.length) toast("Skipped files that are not photos.");
    if (photos.some((f) => f.size > MAX_FILE_SIZE)) {
      toast.error("A photo is too large. Maximum size is 20MB.");
      return;
    }
    if (photoUrls.length + photos.length > MAX_MENU_PAGES) {
      toast.error(`A menu can have at most ${MAX_MENU_PAGES} pages.`);
      return;
    }

    setUploading(true);
    const urls = [...photoUrls]; // after a PDF this starts empty, so photos replace it
    // Photos added to existing photos = new version of that menu; from scratch = new menu
    const base = photoUrls.length ? value : asNewMenu();
    try {
      for (let i = 0; i < photos.length; i++) {
        setUploadLabel(`Uploading photo ${i + 1} of ${photos.length}`);
        setProgress(0);
        const file = await compressImage(photos[i]);
        const { url } = await stageUpload(restaurantId, file, setProgress);
        onStaged?.(url);
        urls.push(url);
        setPhotos(urls, base);
      }
      toast(`${photos.length === 1 ? "Photo" : `${photos.length} photos`} added. Put them in order, then press ${inHistory ? "Save version" : "Save changes"}.`, { icon: "💾" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setProgress(0);
      setUploadLabel("");
    }
  }

  function handleFiles(files: File[]) {
    if (uploading || !files.length) return;
    // Use the right tab for what was picked: a PDF goes to "PDF file", photos to "Photos"
    const pdf = files.find((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    const photos = files.filter((f) => IMAGE_TYPES.includes(f.type));
    if (pdf && !photos.length) {
      if (source !== "pdf") { setSource("pdf"); toast("That's a PDF, so we switched to PDF file.", { icon: "📄" }); }
      uploadPdf(pdf);
      return;
    }
    if (photos.length) {
      if (source !== "photos") { setSource("photos"); toast("Those are photos, so we switched to Photos.", { icon: "🖼️" }); }
      if (pdf) toast("A PDF and photos can't be mixed in one menu, so only the photos were added.");
      addPhotos(photos);
      return;
    }
    toast.error("Please choose a PDF or photos (JPG, PNG or WEBP).");
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

  const dropProps = {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); },
    onDragLeave: () => setDragOver(false),
    onDrop: handleDrop,
  };

  const progressBox = (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mb-4">
        <Upload className="w-7 h-7 text-blue-500 animate-bounce" />
      </div>
      <p className="font-semibold text-gray-900 mb-1">{uploadLabel || "Uploading"}…</p>
      <p className="text-sm text-gray-500 mb-4">{progress}% complete</p>
      <div className="w-full max-w-xs h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <motion.div className="h-full bg-blue-500 rounded-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
        {/* Menu name */}
        <div>
          <label htmlFor="menu-book-title" className="text-sm font-semibold text-gray-900">Menu name</label>
          <input
            id="menu-book-title"
            type="text"
            maxLength={80}
            value={value.title ?? ""}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            placeholder={isEditingExisting ? editingTitle || defaultTitle : defaultTitle}
            className="mt-1.5 w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1.5">
            {inHistory && !isEditingExisting
              ? `Optional. If you leave it empty it will be called "${defaultTitle}".`
              : inHistory
              ? `Changing the name renames "${editingTitle || defaultTitle}". Saving adds a new version.`
              : !menu.menuPdfUrl
              ? `Optional. If you leave it empty it will be called "${defaultTitle}".`
              : isEditingExisting && value.basedOn !== menu.menuPdfUrl
                ? `Saving adds a new version of "${editingTitle || defaultTitle}" to its history.`
                : isEditingExisting
                  ? `This is "${editingTitle || defaultTitle}". Change the name here to rename it.`
                  : `Saved as a new menu${(value.title ?? "").trim() ? "" : `, called "${defaultTitle}"`}.`}
          </p>
        </div>

        {/* What the book is made from */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-gray-900">Make the book from</div>
            <div className="text-xs text-gray-500">Either one PDF file, or photos of each menu page</div>
          </div>
          <div role="tablist" className="inline-flex p-1 bg-gray-100 rounded-xl">
            {([
              { id: "pdf", label: "PDF file", icon: FileText },
              { id: "photos", label: "Photos", icon: Images },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button key={id} role="tab" aria-selected={source === id} type="button"
                onClick={() => setSource(id)} disabled={uploading}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                  source === id ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Flip book or scrolling */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-gray-900">How customers see it</div>
            <div className="text-xs text-gray-500">
              {display === "book" ? "They flip through the pages like a book" : "They scroll down through the pages, one under the other"}
            </div>
          </div>
          <div role="radiogroup" aria-label="How customers see it" className="inline-flex p-1 bg-gray-100 rounded-xl">
            {([
              { id: "book", label: "Book", icon: BookOpen },
              { id: "scroll", label: "Scrolling", icon: ScrollText },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button key={id} role="radio" aria-checked={display === id} type="button" disabled={uploading}
                onClick={() => {
                  if (display === id) return;
                  setDisplayPref(id);
                  if (pages) onChange({ ...value, menuPdfUrl: withMenuDisplay(menu.menuPdfUrl, id) });
                }}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                  display === id ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
        </div>

        {(replacesPdf || replacesPhotos) && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              {inHistory ? "This version is" : "Your menu is"} a {replacesPdf ? "PDF" : "set of photos"} right now.
              {replacesPdf ? " Adding photos here" : " Uploading a PDF here"} will replace it once you press {inHistory ? "Save version" : "Save changes"}.
            </span>
          </div>
        )}

        {/* ── PDF ── */}
        {source === "pdf" && (
          <>
            {pdfUrl && (
              <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{menu.name ?? "Menu.pdf"}</div>
                  <div className="text-xs text-gray-500">{savedUrls.includes(pdfUrl) ? "Live on your menu" : "New, not saved yet"}</div>
                </div>
                <button onClick={() => onChange({ ...value, menuPdfUrl: null, name: null })} disabled={uploading}
                  className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-50">
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              </div>
            )}
            <div {...dropProps}
              onClick={() => !uploading && pdfInputRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                dragOver ? "border-blue-400 bg-blue-50" : uploading ? "border-gray-200 bg-gray-50 cursor-not-allowed" : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/30"
              }`}>
              <input ref={pdfInputRef} type="file" accept="application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple onChange={handleInputChange} className="hidden" />
              {uploading ? progressBox : (
                <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mb-4">
                    <FileText className="w-7 h-7 text-blue-500" />
                  </div>
                  <p className="font-semibold text-gray-900 mb-1">{pdfUrl ? "Upload a different PDF" : "Upload your menu PDF"}</p>
                  <p className="text-sm text-gray-500">Drag & drop or click · One PDF, max 40MB</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Photos ── */}
        {source === "photos" && (
          <>
            <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,application/pdf,.pdf" multiple onChange={handleInputChange} className="hidden" />
            {photoUrls.length === 0 ? (
              <div {...dropProps}
                onClick={() => !uploading && photoInputRef.current?.click()}
                className={`rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                  dragOver ? "border-blue-400 bg-blue-50" : uploading ? "border-gray-200 bg-gray-50 cursor-not-allowed" : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/30"
                }`}>
                {uploading ? progressBox : (
                  <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mb-4">
                      <Images className="w-7 h-7 text-blue-500" />
                    </div>
                    <p className="font-semibold text-gray-900 mb-1">Add photos of your menu pages</p>
                    <p className="text-sm text-gray-500">Select several at once · JPG, PNG or WEBP · Max 20MB each</p>
                    <p className="text-xs text-gray-400 mt-2">You can put them in order after uploading</p>
                  </div>
                )}
              </div>
            ) : (
              <div {...dropProps} className={`rounded-2xl transition-colors ${dragOver ? "bg-blue-50 ring-2 ring-blue-300" : ""}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-gray-600">
                    <span className="font-semibold text-gray-900">{photoUrls.length} page{photoUrls.length === 1 ? "" : "s"}</span>
                    <span className="text-gray-400"> · use the arrows to change the order</span>
                  </div>
                  <button onClick={() => setPhotos([])} disabled={uploading}
                    className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-50">
                    <Trash2 className="w-3.5 h-3.5" /> Remove all
                  </button>
                </div>
                <ol className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {photoUrls.map((url, i) => (
                    <li key={url} className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Page ${i + 1}`} className="w-full aspect-[3/4] object-cover bg-gray-50" />
                        <span className="absolute top-1.5 left-1.5 text-[11px] font-bold bg-black/65 text-white rounded-md px-1.5 py-0.5">
                          {i === 0 ? "Cover" : `Page ${i + 1}`}
                        </span>
                        {!savedUrls.includes(url) && (
                          <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold bg-amber-400 text-amber-950 rounded-md px-1.5 py-0.5">New</span>
                        )}
                        <button onClick={() => handleDeletePage(i)} disabled={uploading} aria-label={`Remove page ${i + 1}`}
                          className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-white/95 text-red-500 flex items-center justify-center shadow hover:bg-white disabled:opacity-50">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-1 p-1.5 border-t border-gray-100">
                        <button onClick={() => handleMove(i, -1)} disabled={i === 0 || uploading} aria-label="Move earlier"
                          className="flex-1 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-25 disabled:hover:bg-transparent">
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-semibold text-gray-400 tabular-nums w-6 text-center">{i + 1}</span>
                        <button onClick={() => handleMove(i, 1)} disabled={i === photoUrls.length - 1 || uploading} aria-label="Move later"
                          className="flex-1 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-25 disabled:hover:bg-transparent">
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                  {photoUrls.length < MAX_MENU_PAGES && (
                    <li>
                      <button onClick={() => photoInputRef.current?.click()} disabled={uploading}
                        className="w-full h-full min-h-[180px] rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors disabled:opacity-50">
                        {uploading ? (
                          <>
                            <Upload className="w-5 h-5 animate-bounce" />
                            <span className="text-xs font-medium">{uploadLabel}</span>
                            <span className="text-[11px]">{progress}%</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-6 h-6" />
                            <span className="text-xs font-semibold">Add more photos</span>
                          </>
                        )}
                      </button>
                    </li>
                  )}
                </ol>
              </div>
            )}
          </>
        )}

        {activeChoice && (
          <label className="flex items-start gap-2.5 rounded-xl border border-gray-200 px-3 py-2.5 cursor-pointer hover:bg-gray-50">
            <input id="book-make-active" type="checkbox" checked={activeChoice.value} onChange={(e) => activeChoice.onChange(e.target.checked)} className="mt-0.5 w-4 h-4 accent-blue-600" />
            <span>
              <span className="block text-sm font-semibold text-gray-900">Make this the active menu</span>
              <span className="block text-xs text-gray-500">
                {activeChoice.value
                  ? "Customers see it after you press Save changes."
                  : "It's only kept in your menu history. Customers keep seeing the current menu, and you can make it active later."}
              </span>
            </span>
          </label>
        )}

        {/* Preview / undo */}
        <div className="flex items-center gap-4 flex-wrap pt-1 border-t border-gray-100">
          <button onClick={() => setPreview(true)} disabled={!pages || uploading}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-40">
            <Eye className="w-4 h-4" /> {display === "book" ? "Preview book" : "Preview"}
          </button>
          {restaurantSlug && !inHistory && (
            <a href={`/r/${restaurantSlug}`} target="_blank" rel="noopener noreferrer"
              className="mt-3 text-sm font-medium text-gray-500 hover:text-gray-700">
              View live menu
            </a>
          )}
          {savedValue && (savedValue.menuPdfUrl !== menu.menuPdfUrl || (menu.title ?? "") !== (savedValue.title ?? "")) && (
            <button onClick={() => { onChange(savedValue); setSource(saved?.kind === "pdf" ? "pdf" : "photos"); }} disabled={uploading}
              className="mt-3 ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-40">
              <Undo2 className="w-4 h-4" /> {inHistory ? "Undo changes" : "Undo book changes"}
            </button>
          )}
        </div>
      </div>

      {/* Info callout */}
      {!inHistory && (
      <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800 space-y-1">
        <p className="font-semibold">How this works</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-700 text-xs">
          <li>{display === "book" ? "Customers flip through your menu like a real book, page by page." : "Customers scroll down through your menu pages, one under the other."}</li>
          <li>With photos, the first photo is the cover. Use the arrows under each photo to change the order.</li>
          <li>Nothing goes live until you press Save changes at the bottom. Discard throws your changes away.</li>
        </ul>
      </div>
      )}

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
                <span className="font-semibold text-gray-900 truncate">{display === "book" ? "Book preview" : "Scrolling preview"} {savedValue?.menuPdfUrl !== menu.menuPdfUrl && <span className="text-xs font-medium text-amber-600 ml-2">not saved yet</span>}</span>
                <button onClick={() => setPreview(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {display === "scroll" ? (
                <div className="flex-1 overflow-auto bg-[#333333]">
                  <ScrollMenu key={menu.menuPdfUrl} pages={pages} />
                </div>
              ) : (
                <div className="flex-1 overflow-auto bg-gray-50 p-4">
                  <MenuBook key={menu.menuPdfUrl} source={menu.menuPdfUrl} maxHeightRatio={0.68} />
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
