"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, FileText, Image as ImageIcon, Trash2, Eye, CheckCircle, AlertCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

interface UploadedMenu {
  url: string;
  name: string;
}

export default function UploadMenuPage() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantSlug, setRestaurantSlug] = useState<string | null>(null);
  const [existing, setExisting] = useState<UploadedMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadStats() {
      const res = await fetch("/api/dashboard/stats");
      if (!res.ok) return;
      const data = await res.json();
      setRestaurantId(data.restaurantId);
      setRestaurantSlug(data.restaurant?.slug ?? null);
      if (data.restaurant?.menuPdfUrl) {
        setExisting({ url: data.restaurant.menuPdfUrl, name: data.restaurant.menuPdfName ?? "Menu" });
      }
      setLoading(false);
    }
    loadStats();
  }, []);

  async function handleFile(file: File) {
    if (!restaurantId) return;

    const allowed = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Unsupported file type. Use PDF, JPG, PNG, or WEBP.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 20MB.");
      return;
    }

    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      setUploading(false);
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        setExisting({ url: data.url, name: data.name });
        setProgress(100);
        toast.success("Menu uploaded successfully!");
      } else {
        const data = JSON.parse(xhr.responseText);
        toast.error(data.error ?? "Upload failed");
        setProgress(0);
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setProgress(0);
      toast.error("Upload failed. Please try again.");
    };

    xhr.open("POST", `/api/restaurants/${restaurantId}/upload-menu`);
    xhr.send(formData);
  }

  async function handleDelete() {
    if (!restaurantId || !existing) return;
    setDeleting(true);
    const res = await fetch(`/api/restaurants/${restaurantId}/upload-menu`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      setExisting(null);
      toast.success("Menu removed.");
    } else {
      toast.error("Failed to remove menu.");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  const isPdf = existing?.url?.toLowerCase().endsWith(".pdf");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Scanned Menu</h1>
        <p className="text-gray-500 text-sm mt-1">
          Upload your physical menu as a PDF or image. Customers can view it directly on your public menu page.
        </p>
      </div>

      {/* Current upload */}
      <AnimatePresence>
        {existing && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                {isPdf ? (
                  <FileText className="w-6 h-6 text-orange-500" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-orange-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-sm font-semibold text-gray-900 truncate">{existing.name}</span>
                </div>
                <p className="text-xs text-gray-500">
                  {isPdf ? "PDF document" : "Image file"} · Visible on your public menu page
                </p>
                <div className="flex gap-3 mt-3">
                  <button
                    onClick={() => setPreview(true)}
                    className="flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" /> Preview
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
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 transition-colors ml-auto disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deleting ? "Removing..." : "Remove"}
                  </button>
                </div>
              </div>
            </div>
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
            ? "border-orange-400 bg-orange-50"
            : uploading
            ? "border-gray-200 bg-gray-50 cursor-not-allowed"
            : "border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/30"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={handleInputChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          {uploading ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center mb-4">
                <Upload className="w-7 h-7 text-orange-500 animate-bounce" />
              </div>
              <p className="font-semibold text-gray-900 mb-1">Uploading…</p>
              <p className="text-sm text-gray-500 mb-4">{progress}% complete</p>
              <div className="w-full max-w-xs h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-orange-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </>
          ) : (
            <>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors ${dragOver ? "bg-orange-200" : "bg-orange-100"}`}>
                <Upload className={`w-7 h-7 transition-colors ${dragOver ? "text-orange-600" : "text-orange-500"}`} />
              </div>
              <p className="font-semibold text-gray-900 mb-1">
                {dragOver ? "Drop your file here" : "Drag & drop or click to upload"}
              </p>
              <p className="text-sm text-gray-500">PDF, JPG, PNG, or WEBP · Max 20MB</p>
              {existing && (
                <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Uploading a new file will replace the current one
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
          <li>Your uploaded menu appears as a "View Scanned Menu" button on your public page.</li>
          <li>Customers can view it alongside or instead of your digital menu.</li>
          <li>You can still create and manage a digital menu separately.</li>
          <li>Replacing or removing the file updates immediately — no refresh needed.</li>
        </ul>
      </div>

      {/* Preview modal */}
      <AnimatePresence>
        {preview && existing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setPreview(false)}>
            <motion.div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            />
            <motion.div
              className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <span className="font-semibold text-gray-900 truncate">{existing.name}</span>
                <button onClick={() => setPreview(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-auto bg-gray-50 p-4">
                {isPdf ? (
                  <iframe
                    src={existing.url}
                    title="Menu preview"
                    className="w-full h-full min-h-[500px] rounded-lg border border-gray-200"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={existing.url}
                    alt="Menu preview"
                    className="max-w-full mx-auto rounded-lg shadow-sm"
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
