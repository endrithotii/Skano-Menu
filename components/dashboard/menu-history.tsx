"use client";

// List of every PDF / photo menu that was saved, newest first.
// Shows which one customers see now, when each was uploaded, and lets the user make an older one active again.
// "Make active" only puts it in the draft: like every other change on the Menu page it goes live with Save changes.

import { useCallback, useEffect, useState } from "react";
import { FileText, Images, Eye, Trash2, History, CheckCircle2, Clock, X, Loader2, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { MenuBook } from "@/components/menu-book";

export interface MenuVersion {
  id: string;
  label: string;
  menuPdfUrl: string;
  menuPdfName: string | null;
  kind: "pdf" | "photos";
  pageCount: number | null;
  thumbnail: string | null;
  createdAt: string;
  approximateDate: boolean;
  isLive: boolean;
}

interface MenuHistoryProps {
  restaurantId: string;
  /** Saved (live) values, used to reload the list after Save */
  liveMenuPdfUrl: string | null;
  liveMode: "dynamic" | "static";
  /** The book currently in the editor (may be unsaved) */
  draftMenuPdfUrl: string | null;
  onUseVersion: (version: MenuVersion) => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function MenuHistory({ restaurantId, liveMenuPdfUrl, liveMode, draftMenuPdfUrl, onUseVersion }: MenuHistoryProps) {
  const [versions, setVersions] = useState<MenuVersion[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState<MenuVersion | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchVersions = useCallback(async (): Promise<MenuVersion[]> => {
    const res = await fetch(`/api/restaurants/${restaurantId}/menu-history`);
    if (!res.ok) throw new Error("history");
    const data = await res.json();
    return data.versions ?? [];
  }, [restaurantId]);

  const load = useCallback(() => {
    fetchVersions()
      .then((list) => { setVersions(list); setFailed(false); })
      .catch(() => setFailed(true));
  }, [fetchVersions]);

  // Reload whenever what's live changes (after Save)
  useEffect(() => {
    let cancelled = false;
    fetchVersions()
      .then((list) => { if (!cancelled) { setVersions(list); setFailed(false); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [fetchVersions, liveMenuPdfUrl, liveMode]);

  async function remove(v: MenuVersion) {
    if (!window.confirm(`Delete "${v.label}" from the history? This can't be undone.`)) return;
    setDeleting(v.id);
    const res = await fetch(`/api/restaurants/${restaurantId}/menu-history?versionId=${encodeURIComponent(v.id)}`, { method: "DELETE" }).catch(() => null);
    setDeleting(null);
    if (res?.ok) {
      setVersions((list) => (list ? list.filter((x) => x.id !== v.id) : list));
      toast.success("Removed from history");
    } else {
      const data = await res?.json().catch(() => null);
      toast.error(data?.error ?? "Could not delete this version");
    }
  }

  const draftIsDifferent = draftMenuPdfUrl !== liveMenuPdfUrl;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-1">
        <History className="w-4 h-4 text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-900">Menu history</h2>
        {versions && <span className="text-xs text-gray-400">· {versions.length} version{versions.length === 1 ? "" : "s"}</span>}
      </div>
      <p className="text-xs text-gray-500 mb-4">Every PDF or photo menu you save is kept here. Pick an older one to make it active again.</p>

      {!versions && !failed && (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading history
        </div>
      )}
      {failed && (
        <div className="text-sm text-gray-500 py-4 text-center">
          Could not load the history. <button onClick={load} className="text-blue-600 font-medium underline">Try again</button>
        </div>
      )}
      {versions && versions.length === 0 && (
        <div className="text-sm text-gray-400 py-6 text-center">No saved menus yet. After you save a PDF or photos, they show up here.</div>
      )}

      {versions && versions.length > 0 && (
        <ul className="space-y-2">
          {versions.map((v) => {
            const live = v.isLive;
            const shownToCustomers = live && liveMode === "static";
            const pending = !live && draftIsDifferent && v.menuPdfUrl === draftMenuPdfUrl;
            const replacedByDraft = live && draftIsDifferent;

            let status: { text: string; cls: string; icon: React.ReactNode };
            if (pending) {
              status = { text: "Active after you save", cls: "bg-amber-100 text-amber-800 border-amber-200", icon: <Clock className="w-3.5 h-3.5" /> };
            } else if (shownToCustomers && !replacedByDraft) {
              status = { text: "Active", cls: "bg-green-100 text-green-800 border-green-200", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
            } else if (shownToCustomers && replacedByDraft) {
              status = { text: "Active now · replaced when you save", cls: "bg-green-50 text-green-700 border-green-200", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
            } else if (live) {
              status = { text: "Saved book · digital menu is shown", cls: "bg-blue-50 text-blue-700 border-blue-100", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
            } else {
              status = { text: "Inactive", cls: "bg-gray-100 text-gray-500 border-gray-200", icon: null };
            }

            const highlight = pending ? "border-amber-300 bg-amber-50/40" : shownToCustomers ? "border-green-300 bg-green-50/40" : "border-gray-100";

            return (
              <li key={v.id} className={`flex items-center gap-3 rounded-xl border p-3 ${highlight}`}>
                {/* Thumbnail */}
                <button onClick={() => setPreview(v)} className="w-12 h-16 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 shrink-0 flex items-center justify-center" aria-label={`Preview ${v.label}`}>
                  {v.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <FileText className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 truncate max-w-[16rem]">{v.label}</span>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${status.cls}`}>
                      {status.icon}{status.text}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                    {v.kind === "pdf" ? <FileText className="w-3.5 h-3.5" /> : <Images className="w-3.5 h-3.5" />}
                    <span>{v.kind === "pdf" ? "PDF" : `${v.pageCount ?? 0} photos`}</span>
                    <span>·</span>
                    <span>{v.approximateDate ? `Uploaded on or before ${formatDate(v.createdAt)}` : `Uploaded ${formatDate(v.createdAt)}`}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setPreview(v)} title="Preview"
                    className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50">
                    <Eye className="w-4 h-4" />
                  </button>
                  {!(shownToCustomers && !replacedByDraft) && !pending && (
                    <button onClick={() => onUseVersion(v)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                      <RotateCcw className="w-3.5 h-3.5" /> Make active
                    </button>
                  )}
                  {!live && (
                    <button onClick={() => remove(v)} disabled={deleting === v.id} title="Delete from history"
                      className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50">
                      {deleting === v.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Preview modal */}
      <AnimatePresence>
        {preview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
            <motion.div className="fixed inset-0 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div
              className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{preview.label}</div>
                  <div className="text-xs text-gray-500">{preview.approximateDate ? "Uploaded on or before " : "Uploaded "}{formatDate(preview.createdAt)}</div>
                </div>
                <div className="flex items-center gap-2">
                  {!(preview.isLive && liveMode === "static" && !draftIsDifferent) && preview.menuPdfUrl !== draftMenuPdfUrl && (
                    <button onClick={() => { onUseVersion(preview); setPreview(null); }}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                      <RotateCcw className="w-4 h-4" /> Make active
                    </button>
                  )}
                  <button onClick={() => setPreview(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-gray-50 p-4">
                <MenuBook key={preview.menuPdfUrl} source={preview.menuPdfUrl} maxHeightRatio={0.66} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
