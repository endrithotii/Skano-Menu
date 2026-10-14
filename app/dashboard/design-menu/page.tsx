"use client";

// "Design your digital Menu": build a menu like in Canva.
// Saving asks for a name and stores the design. Its pages are also saved as a menu in the Menu history,
// so it can be picked on the Menu page as the single menu or linked from a menu tree.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Eye, Save, Loader2, X, Trash2, Smartphone, Monitor, Download, FileText, Images, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";
import { DesignEditor } from "@/components/design/design-editor";
import { downloadDesignImages, downloadDesignPdf, exportDesignPages, previewDesignPages } from "@/components/design/export-pages";
import { BookViewerPage, parseSocialLinks, type SocialLinks } from "@/components/book-viewer-page";
import { designImageUrls, type MenuDesign } from "@/lib/menu-design-types";
import { serializeMenuPages } from "@/lib/menu-pages";
import { formatDay, formatDayTime } from "@/lib/format-date";
import { useUnsavedChanges } from "@/lib/navigation-guard";

interface DesignSummary { id: string; name: string; pages: number; updatedAt: string }

const strip = (d: MenuDesign | null) => {
  if (!d) return null;
  const { pageImages: _p, ...rest } = d;
  void _p;
  return JSON.stringify(rest);
};
const defaultName = () => `Digital Menu - ${formatDay(new Date())}`;

export default function DesignMenuPage() {
  const [restaurant, setRestaurant] = useState<{ id: string; name: string; slug: string | null } | null>(null);
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const [designs, setDesigns] = useState<DesignSummary[] | null>(null);
  const [current, setCurrent] = useState<{ id: string | null; name: string }>({ id: null, name: "" });
  const [savedJson, setSavedJson] = useState<string | null>(null);
  const [draft, setDraft] = useState<MenuDesign | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [loadingDesign, setLoadingDesign] = useState(true);
  const [saveOpen, setSaveOpen] = useState(false);
  const [preview, setPreview] = useState<{ menuPdfUrl: string | null; device: "phone" | "computer" } | null>(null);
  const staged = useRef<string[]>([]);
  // What customers see now: the menu type, and whether it's the open design's menu
  const [live, setLive] = useState<{ primaryMenu: string; isLive: boolean }>({ primaryMenu: "dynamic", isLive: false });

  const dirty = !!draft && strip(draft) !== savedJson;
  useUnsavedChanges(dirty, "Your menu design isn't saved yet. Leave without saving?");

  const loadList = useCallback(async (rid: string) => {
    const r = await fetch(`/api/restaurants/${rid}/menu-design`).catch(() => null);
    const d = r?.ok ? await r.json() : null;
    const list: DesignSummary[] = d?.designs ?? [];
    setDesigns(list);
    if (d?.primaryMenu) setLive((l) => ({ ...l, primaryMenu: d.primaryMenu }));
    return list;
  }, []);

  const openDesign = useCallback(async (rid: string, id: string) => {
    setLoadingDesign(true);
    const r = await fetch(`/api/restaurants/${rid}/menu-design?id=${encodeURIComponent(id)}`).catch(() => null);
    const d = r?.ok ? await r.json() : null;
    if (d?.design) {
      setCurrent({ id: d.design.id, name: d.design.name });
      setDraft(d.design.design);
      setSavedJson(strip(d.design.design));
      setLive({ primaryMenu: d.primaryMenu ?? "dynamic", isLive: d.isLive === true });
    } else {
      toast.error("Could not open this design.");
    }
    setEditorKey((k) => k + 1);
    setLoadingDesign(false);
  }, []);

  // Restaurant, then the designs (the last changed one opens)
  useEffect(() => {
    (async () => {
      const stats = await fetch("/api/dashboard/stats").then((r) => r.json()).catch(() => null);
      if (!stats?.restaurantId) { setLoadingDesign(false); return; }
      const r = { id: stats.restaurantId as string, name: stats.restaurant?.name ?? "", slug: stats.restaurant?.slug ?? null };
      setRestaurant(r);
      if (r.slug) {
        fetch(`/api/restaurants/${r.slug}`).then((x) => (x.ok ? x.json() : null))
          .then((x) => setSocialLinks(parseSocialLinks(x?.restaurant?.socialLinks))).catch(() => {});
      }
      const list = await loadList(r.id);
      if (list.length) await openDesign(r.id, list[0].id);
      else setLoadingDesign(false);
    })();
  }, [loadList, openDesign]);

  /** Deletes photos uploaded while designing that the kept design doesn't use */
  function dropStaged(keep: string[]) {
    if (!restaurant) return;
    for (const url of staged.current) {
      if (!keep.includes(url)) fetch(`/api/restaurants/${restaurant.id}/upload-menu?staged=${encodeURIComponent(url)}`, { method: "DELETE" }).catch(() => {});
    }
    staged.current = [];
  }

  function leaveCurrent(): boolean {
    if (dirty && !window.confirm("Your changes to this design aren't saved. Discard them?")) return false;
    dropStaged([]);
    return true;
  }

  function switchTo(value: string) {
    if (!restaurant || value === (current.id ?? "new")) return;
    if (!leaveCurrent()) return;
    if (value === "new") {
      setLive((l) => ({ ...l, isLive: false }));
      setCurrent({ id: null, name: "" });
      setDraft(null);
      setSavedJson(null);
      setEditorKey((k) => k + 1);
    } else {
      openDesign(restaurant.id, value);
    }
  }

  async function deleteCurrent() {
    if (!restaurant || !current.id) return;
    if (!window.confirm(`Delete the design "${current.name}"? The menu you saved from it stays in your Menu history.`)) return;
    const r = await fetch(`/api/restaurants/${restaurant.id}/menu-design?id=${encodeURIComponent(current.id)}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) { toast.error("Could not delete the design."); return; }
    dropStaged([]);
    toast.success("Design deleted");
    const list = await loadList(restaurant.id);
    if (list.length) await openDesign(restaurant.id, list[0].id);
    else { setLive((l) => ({ ...l, isLive: false })); setCurrent({ id: null, name: "" }); setDraft(null); setSavedJson(null); setEditorKey((k) => k + 1); }
  }

  async function openPreview() {
    if (!draft) return;
    setPreview({ menuPdfUrl: null, device: window.innerWidth < 640 ? "phone" : "computer" });
    try {
      const pages = await previewDesignPages(draft);
      const menuPdfUrl = serializeMenuPages({ kind: "images", urls: pages, ...(draft.display === "scroll" ? { display: "scroll" as const } : {}) });
      setPreview((p) => (p ? { ...p, menuPdfUrl } : p));
    } catch (err) {
      console.error("Preview failed", err);
      toast.error("Could not make the preview. Please try again.");
      setPreview(null);
    }
  }

  async function save(name: string, makeActive: boolean, onProgress: (text: string) => void): Promise<boolean> {
    if (!restaurant || !draft) return false;
    const finalName = name.replace(/\s+/g, " ").trim() || defaultName();
    let pictures: string[] = [];
    try {
      onProgress("Preparing the pages…");
      pictures = await exportDesignPages(draft, restaurant.id, (done, total) => onProgress(`Preparing the pages (${done}/${total})…`));
    } catch (err) {
      console.error("Page export failed", err);
      toast.error("Could not prepare the pages. Please try again.");
      return false;
    }
    onProgress("Saving…");
    const res = await fetch(`/api/restaurants/${restaurant.id}/menu-design`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: current.id, name: finalName, design: draft, pageImages: pictures, makeActive }),
    }).catch(() => null);
    const d = await res?.json().catch(() => null);
    if (!res?.ok || !d?.design) {
      for (const url of pictures) fetch(`/api/restaurants/${restaurant.id}/upload-menu?staged=${encodeURIComponent(url)}`, { method: "DELETE" }).catch(() => {});
      toast.error(d?.error ?? "Could not save the design. Please try again.");
      return false;
    }
    dropStaged(designImageUrls(d.design.design));
    setCurrent({ id: d.design.id, name: d.design.name });
    setDraft(d.design.design);
    setSavedJson(strip(d.design.design));
    await loadList(restaurant.id);
    if (makeActive) setLive({ primaryMenu: "static", isLive: true });
    toast.success(
      makeActive
        ? `"${d.design.name}" saved. Customers see it now.`
        : `"${d.design.name}" saved. Pick it on the Menu page as your menu or link it in a menu tree.`,
      { duration: 7000 },
    );
    return true;
  }

  if (!restaurant && !loadingDesign) return <div className="p-6 text-gray-500">No restaurant found.</div>;

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap lg:flex-nowrap">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Design your digital Menu</h1>
          <p className="text-gray-500 text-sm mt-1">
            Build your menu like in Canva. Saved menus show up on the{" "}
            <Link href="/dashboard/menu" className="text-blue-600 hover:text-blue-700 font-medium">Menu</Link>{" "}
            page, where you can make one your menu or link it in a menu tree.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {designs && (
            <div className="flex items-center gap-1">
              <select aria-label="Open a design" value={current.id ?? "new"} onChange={(e) => switchTo(e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white max-w-[230px]">
                {!current.id && <option value="new">{draft ? "New design (not saved)" : "New design"}</option>}
                {designs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                {current.id && <option value="new">+ New design</option>}
              </select>
              {current.id && (
                <button type="button" onClick={deleteCurrent} title="Delete this design" aria-label="Delete this design"
                  className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
          )}
          <DownloadMenu disabled={!draft} onDownload={async (kind) => {
            if (!draft) return;
            const name = current.name || defaultName();
            const id = toast.loading("Preparing the pages…");
            try {
              const progress = (done: number, total: number) => toast.loading(`Preparing page ${done} of ${total}…`, { id });
              if (kind === "pdf") await downloadDesignPdf(draft, name, progress);
              else await downloadDesignImages(draft, name, progress);
              toast.success(kind === "pdf" ? "PDF downloaded" : "Pictures downloaded (ZIP folder)", { id });
            } catch (err) {
              console.error("Download failed", err);
              toast.error("Could not make the download. Please try again.", { id });
            }
          }} />
          <button type="button" onClick={openPreview} disabled={!draft}
            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40">
            <Eye className="w-4 h-4" /> Preview
          </button>
          <button type="button" onClick={() => setSaveOpen(true)} disabled={!draft || (!dirty && !!current.id)}
            title={!dirty && current.id ? "No changes to save" : undefined}
            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg shadow-blue-500/25 disabled:opacity-40 disabled:shadow-none">
            <Save className="w-4 h-4" /> Save
          </button>
        </div>
      </div>

      {current.id && (
        <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
          <span>Editing <span className="font-semibold text-gray-700">{current.name}</span></span>
          {designs?.find((d) => d.id === current.id) && <span>· saved {formatDayTime(designs.find((d) => d.id === current.id)!.updatedAt)}</span>}
          {dirty && <span className="text-amber-700 font-medium">· unsaved changes</span>}
        </div>
      )}

      {loadingDesign || !restaurant ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : (
        <DesignEditor
          key={editorKey}
          restaurantId={restaurant.id}
          restaurantName={restaurant.name}
          value={draft}
          onChange={setDraft}
          onStaged={(url) => { staged.current.push(url); }}
        />
      )}

      {saveOpen && (
        <SaveDialog
          initialName={current.id ? current.name : ""}
          live={live}
          takenNames={(designs ?? []).filter((d) => d.id !== current.id).map((d) => d.name)}
          isUpdate={!!current.id}
          onClose={() => setSaveOpen(false)}
          onSave={save}
        />
      )}

      {preview && (
        <PreviewOverlay
          name={restaurant?.name ?? ""}
          socialLinks={socialLinks}
          menuPdfUrl={preview.menuPdfUrl}
          display={draft?.display ?? "book"}
          device={preview.device}
          onDevice={(device) => setPreview((p) => (p ? { ...p, device } : p))}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

/** "Dinner" -> "Dinner (1)" -> "Dinner (2)" ... when the name is already used (the server checks it too) */
function uniqueName(wanted: string, taken: string[]) {
  const used = new Set(taken.map((t) => t.toLowerCase()));
  let name = wanted;
  for (let n = 1; used.has(name.toLowerCase()); n++) name = `${wanted} (${n})`;
  return name;
}

/** "Download" button with PDF / pictures choices */
function DownloadMenu({ disabled, onDownload }: { disabled: boolean; onDownload: (kind: "pdf" | "images") => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const pick = async (kind: "pdf" | "images") => {
    setOpen(false);
    setBusy(true);
    await onDownload(kind);
    setBusy(false);
  };
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} disabled={disabled || busy} aria-haspopup="menu" aria-expanded={open}
        className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download <ChevronDown className="w-3.5 h-3.5 -ml-1" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1.5 z-30 w-60 bg-white rounded-xl border border-gray-100 shadow-xl p-1.5">
          <button type="button" role="menuitem" onClick={() => pick("pdf")} className="w-full flex items-start gap-2.5 text-left px-2.5 py-2 rounded-lg hover:bg-gray-50">
            <FileText className="w-4 h-4 mt-0.5 text-red-500 shrink-0" />
            <span><span className="block text-sm font-semibold text-gray-900">PDF</span><span className="block text-xs text-gray-500">One file, ready to print</span></span>
          </button>
          <button type="button" role="menuitem" onClick={() => pick("images")} className="w-full flex items-start gap-2.5 text-left px-2.5 py-2 rounded-lg hover:bg-gray-50">
            <Images className="w-4 h-4 mt-0.5 text-blue-500 shrink-0" />
            <span><span className="block text-sm font-semibold text-gray-900">Pictures (ZIP)</span><span className="block text-xs text-gray-500">A folder with one JPG per page</span></span>
          </button>
        </div>
      )}
    </div>
  );
}

function SaveDialog({ initialName, isUpdate, live, takenNames, onClose, onSave }: {
  initialName: string;
  isUpdate: boolean;
  live: { primaryMenu: string; isLive: boolean };
  takenNames: string[];
  onClose: () => void;
  onSave: (name: string, makeActive: boolean, onProgress: (text: string) => void) => Promise<boolean>;
}) {
  const [name, setName] = useState(initialName);
  const [makeActive, setMakeActive] = useState(live.isLive);
  const wanted = name.replace(/\s+/g, " ").trim() || defaultName();
  const finalName = uniqueName(wanted, takenNames);
  const activeHint = live.isLive
    ? "This is the menu customers see now. Untick it to save without changing what they see."
    : live.primaryMenu === "tree"
      ? "Customers see this menu instead of your menu tree when they scan the QR code."
      : live.primaryMenu === "static"
        ? "It replaces the menu customers see now. That one stays in your Menu history."
        : "Customers see this menu instead of your digital menu (categories and items) when they scan the QR code.";
  const [busy, setBusy] = useState<string | null>(null);
  const placeholder = defaultName();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy("Saving…");
    const ok = await onSave(name, makeActive, setBusy);
    setBusy(null);
    if (ok) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <form role="dialog" aria-modal="true" aria-label="Save menu" onSubmit={submit} onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{isUpdate ? "Save changes" : "Save your menu"}</h2>
            <p className="text-sm text-gray-500">
              {isUpdate
                ? "Saving adds a new version of this menu in your Menu history."
                : "Give your menu a name. It's saved in your Menu history."}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={!!busy} aria-label="Close" className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-600 mb-1">Menu name</span>
          <input id="design-menu-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={placeholder}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
          <span className="block text-xs text-gray-400 mt-1">
            {finalName !== wanted
              ? <>That name is already used, so it will be saved as &quot;{finalName}&quot;.</>
              : <>Leave it empty to use &quot;{placeholder}&quot;.</>}
          </span>
        </label>
        <label className="flex items-start gap-2.5 rounded-xl border border-gray-200 px-3 py-2.5 cursor-pointer hover:bg-gray-50">
          <input id="design-make-active" type="checkbox" checked={makeActive} onChange={(e) => setMakeActive(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-blue-600" />
          <span>
            <span className="block text-sm font-semibold text-gray-900">Make this the active menu</span>
            <span className="block text-xs text-gray-500">{activeHint}</span>
          </span>
        </label>
        <div className="flex items-center justify-end gap-2">
          {busy && <span className="mr-auto inline-flex items-center gap-1.5 text-xs text-gray-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {busy}</span>}
          <button type="button" onClick={onClose} disabled={!!busy} className="text-sm font-medium text-gray-600 px-4 py-2 rounded-xl hover:bg-gray-100 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={!!busy}
            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl text-white bg-gradient-to-r from-blue-500 to-indigo-500 disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
          </button>
        </div>
      </form>
    </div>
  );
}

/** Shows the menu like customers will see it (pictures of the current, unsaved design) */
function PreviewOverlay({ name, socialLinks, menuPdfUrl, display, device, onDevice, onClose }: {
  name: string;
  socialLinks: SocialLinks;
  menuPdfUrl: string | null;
  display: "book" | "scroll";
  device: "phone" | "computer";
  onDevice: (d: "phone" | "computer") => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Preview" className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 text-white">
        <div className="text-sm font-semibold">
          Preview <span className="font-normal text-white/60">· {display === "book" ? "flip book" : "scrolling menu"} · not saved yet</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex p-0.5 bg-white/10 rounded-lg">
            {([["phone", "Phone", Smartphone], ["computer", "Computer", Monitor]] as const).map(([d, label, Icon]) => (
              <button key={d} type="button" aria-pressed={device === d} onClick={() => onDevice(d)}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md ${device === d ? "bg-white text-gray-900" : "text-white/70 hover:text-white"}`}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} aria-label="Close preview" className="w-8 h-8 flex items-center justify-center rounded-lg text-white/80 hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center p-3 pt-0">
        {/* transform makes the viewer (position: fixed) stay inside this frame */}
        <div className={`relative overflow-hidden bg-[#333333] ${device === "phone" ? "w-[390px] max-w-full h-full max-h-[844px] rounded-[28px] border-[6px] border-gray-900" : "w-full h-full rounded-xl"}`}
          style={{ transform: "translateZ(0)" }}>
          {menuPdfUrl ? (
            <BookViewerPage key={`${device}-${menuPdfUrl.length}`} name={name} menuPdfUrl={menuPdfUrl} socialLinks={socialLinks} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-white/70 text-sm">
              <Loader2 className="w-6 h-6 animate-spin" /> Preparing the preview…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
