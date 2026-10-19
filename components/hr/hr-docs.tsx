"use client";

// HR tab, Documents: contracts and any other staff documents, in categories HR makes (like "Birth certificate").
// Search by name, filter by staff member, category and upload date. Older contracts are kept in a contract history:
// a new contract can replace the current one, which then ends and moves there.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText, Upload, Trash2, Loader2, Download, Lock, History, ChevronDown, ChevronUp, Archive, ArchiveRestore, Pencil, Check, X,
  Search, Tags, Plus, SlidersHorizontal,
} from "lucide-react";
import toast from "react-hot-toast";
import { BUILTIN_DOC_CATEGORIES, byNewest, contractState, type DocCategory, type HrDoc } from "@/lib/hr";
import { btnGhost, btnPrimary, card, inputCls } from "@/components/hr/hr-ui";

const ACCEPT = "application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const NEW_CATEGORY = "__new";
const size = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** "1 Jan 2025" (documents span years, so the year is always shown) */
const dayY = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const span = (d: Pick<HrDoc, "validFrom" | "validUntil">) => (d.validFrom || d.validUntil ? `${d.validFrom ? dayY(d.validFrom) : "…"} to ${d.validUntil ? dayY(d.validUntil) : "no end"}` : "");
const uploaded = (d: HrDoc) => `Uploaded ${new Date(d.uploadedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}${d.uploadedByName ? ` by ${d.uploadedByName}` : ""}`;
const catName = (id: string, cats: DocCategory[]) => cats.find((c) => c.id === id)?.name ?? "Other";

type Action = "archive" | "restore" | "delete" | "edit";
type Edit = { name: string; kind: string; validFrom: string; validUntil: string; note: string };
type OnAction = (d: HrDoc, action: Action, edit?: Edit) => Promise<boolean>;

/** Splits someone's documents: current contract(s), contracts that start later, the contract history, the rest */
export function groupDocs(docs: HrDoc[], today: string) {
  const contracts = docs.filter((d) => d.kind === "contract").sort(byNewest);
  return {
    current: contracts.filter((d) => contractState(d, today) === "current"),
    upcoming: contracts.filter((d) => contractState(d, today) === "upcoming"),
    history: contracts.filter((d) => contractState(d, today) === "history"),
    other: docs.filter((d) => d.kind !== "contract").sort(byNewest),
  };
}

function Pill({ tone, children }: { tone: "green" | "blue" | "gray" | "amber" | "violet"; children: React.ReactNode }) {
  const cls = { green: "border-green-200 bg-green-50 text-green-800", blue: "border-blue-200 bg-blue-50 text-blue-800", gray: "border-gray-200 bg-white text-gray-600", amber: "border-amber-200 bg-amber-50 text-amber-800", violet: "border-violet-200 bg-violet-50 text-violet-800" }[tone];
  return <span className={`text-[11px] font-semibold rounded-full border px-2 py-0.5 ${cls}`}>{children}</span>;
}

function DocRow({ d, restaurantId, label, all, cats, owner, onAction }: {
  d: HrDoc; restaurantId: string; label?: React.ReactNode; all: HrDoc[]; cats: DocCategory[]; owner?: string; onAction?: OnAction;
}) {
  const [editing, setEditing] = useState(false);
  const [e, setE] = useState<Edit>({ name: d.name, kind: d.kind, validFrom: d.validFrom ?? "", validUntil: d.validUntil ?? "", note: d.note });
  const newer = d.replacedBy ? all.find((x) => x.id === d.replacedBy) : null;
  const dates = span(d);
  return (
    <li className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm" data-doc={d.name}>
      <div className="flex flex-wrap items-center gap-2">
        <FileText className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
        {owner && <span className="font-semibold text-gray-900">{owner}:</span>}
        <a href={`/api/restaurants/${restaurantId}/hr/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 hover:underline">{d.name}</a>
        {label ?? <Pill tone={d.kind === "contract" ? "blue" : "violet"}>{catName(d.kind, cats)}</Pill>}
        <span className="flex-1" />
        <a href={`/api/restaurants/${restaurantId}/hr/documents/${d.id}?download=1`} aria-label={`Download ${d.name}`} className="p-1.5 rounded-lg text-gray-500 hover:bg-white"><Download className="w-4 h-4" /></a>
        {onAction && <button type="button" onClick={() => setEditing((v) => !v)} aria-label={`Change ${d.name}`} className="p-1.5 rounded-lg text-gray-500 hover:bg-white" data-go="edit"><Pencil className="w-4 h-4" /></button>}
        {onAction && d.kind === "contract" && (d.archived
          ? <button type="button" onClick={() => onAction(d, "restore")} aria-label={`Bring ${d.name} back from the history`} title="Bring back from the history" className="p-1.5 rounded-lg text-gray-500 hover:bg-white"><ArchiveRestore className="w-4 h-4" /></button>
          : <button type="button" onClick={() => onAction(d, "archive")} aria-label={`Move ${d.name} to the history`} title="Move to the history" className="p-1.5 rounded-lg text-gray-500 hover:bg-white" data-go="archive"><Archive className="w-4 h-4" /></button>)}
        {onAction && <button type="button" onClick={() => onAction(d, "delete")} aria-label={`Delete ${d.name}`} className="p-1.5 rounded-lg text-gray-500 hover:bg-white hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
      </div>
      <p className="text-xs text-gray-500 mt-1 pl-6">
        {dates ? `${dates} · ` : ""}{uploaded(d)} · {size(d.size)}{newer ? ` · Replaced by "${newer.name}"` : ""}{d.note ? ` · ${d.note}` : ""}
      </p>
      {editing && onAction && (
        <div className="mt-2 pl-6 grid sm:grid-cols-2 gap-2" data-edit-doc>
          <div><label htmlFor={`n-${d.id}`} className="block text-[11px] text-gray-600 mb-0.5">Name</label><input id={`n-${d.id}`} value={e.name} maxLength={80} onChange={(x) => setE({ ...e, name: x.target.value })} className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white" /></div>
          <div><label htmlFor={`k-${d.id}`} className="block text-[11px] text-gray-600 mb-0.5">Category</label>
            <select id={`k-${d.id}`} value={e.kind} onChange={(x) => setE({ ...e, kind: x.target.value })} className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div><label htmlFor={`f-${d.id}`} className="block text-[11px] text-gray-600 mb-0.5">Valid from</label><input id={`f-${d.id}`} type="date" value={e.validFrom} onChange={(x) => setE({ ...e, validFrom: x.target.value })} className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white" /></div>
          <div><label htmlFor={`u-${d.id}`} className="block text-[11px] text-gray-600 mb-0.5">Valid until</label><input id={`u-${d.id}`} type="date" value={e.validUntil} min={e.validFrom || undefined} onChange={(x) => setE({ ...e, validUntil: x.target.value })} className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white" /></div>
          <div className="sm:col-span-2"><label htmlFor={`o-${d.id}`} className="block text-[11px] text-gray-600 mb-0.5">Note</label><input id={`o-${d.id}`} value={e.note} maxLength={300} onChange={(x) => setE({ ...e, note: x.target.value })} className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white" /></div>
          <div className="sm:col-span-2 flex gap-2">
            <button type="button" onClick={async () => { if (await onAction(d, "edit", e)) setEditing(false); }} className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-blue-600 rounded-lg px-3 py-2" data-go="save-doc"><Check className="w-3.5 h-3.5" /> Save</button>
            <button type="button" onClick={() => setEditing(false)} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 rounded-lg px-2 py-2"><X className="w-3.5 h-3.5" /> Cancel</button>
          </div>
        </div>
      )}
    </li>
  );
}

/** One person's documents: current contract, starting later, contract history, the other documents by category */
export function PersonDocs({ docs, restaurantId, today, cats = BUILTIN_DOC_CATEGORIES, onAction, startOpen = false }: {
  docs: HrDoc[]; restaurantId: string; today: string; cats?: DocCategory[]; onAction?: OnAction; startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const g = groupDocs(docs, today);
  const row = (d: HrDoc, label?: React.ReactNode) => <DocRow key={d.id} d={d} restaurantId={restaurantId} label={label} all={docs} cats={cats} onAction={onAction} />;
  return (
    <div className="space-y-3">
      {g.current.length === 0 && g.upcoming.length === 0 ? <p className="text-sm text-gray-400">No current contract.</p> : (
        <ul className="space-y-2">
          {g.current.map((d) => row(d, <><Pill tone="green">Current contract</Pill>{d.replacedBy && d.validUntil && <Pill tone="amber">Ends {dayY(d.validUntil)}</Pill>}</>))}
          {g.upcoming.map((d) => row(d, <Pill tone="blue">Contract, starts {d.validFrom ? dayY(d.validFrom) : "later"}</Pill>))}
        </ul>
      )}
      {g.history.length > 0 && (
        <div data-contract-history>
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900">
            <History className="w-3.5 h-3.5" aria-hidden /> Contract history ({g.history.length}) {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {open && (
            <ol className="mt-2 space-y-2 border-l-2 border-gray-200 pl-3 ml-1.5">
              {g.history.map((d) => row(d, <Pill tone="gray">{d.replacedBy ? "Replaced contract" : d.archived ? "Contract in history" : "Ended contract"}</Pill>))}
            </ol>
          )}
        </div>
      )}
      {g.other.length > 0 && <ul className="space-y-2">{g.other.map((d) => row(d))}</ul>}
    </div>
  );
}

function CategoryManager({ cats, restaurantId, onChange }: { cats: DocCategory[]; restaurantId: string; onChange: (c: DocCategory[]) => void }) {
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const custom = cats.filter((c) => c.id.startsWith("c-"));
  async function send(body: Record<string, unknown>, ok: string) {
    const res = await fetch(`/api/restaurants/${restaurantId}/hr/documents`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    if (!res?.ok) { toast.error(d?.error ?? "Could not save"); return false; }
    toast.success(ok); onChange(d.categories); return true;
  }
  return (
    <div className="space-y-3" data-categories>
      <p className="text-xs text-gray-500">Contract and Other are always there. Make your own, like Birth certificate, ID card or Health certificate, then find everyone&apos;s with the filter.</p>
      <ul className="flex flex-wrap gap-2">
        {cats.filter((c) => !c.id.startsWith("c-")).map((c) => <li key={c.id}><Pill tone="gray">{c.name}</Pill></li>)}
        {custom.map((c) => (
          <li key={c.id} className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 pl-2.5 pr-1 py-0.5 text-xs font-semibold text-violet-800" data-category={c.name}>
            {renaming?.id === c.id ? (
              <>
                <label htmlFor={`rn-${c.id}`} className="sr-only">New name</label>
                <input id={`rn-${c.id}`} value={renaming.name} maxLength={40} autoFocus onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                  onKeyDown={async (e) => { if (e.key === "Enter" && await send({ action: "category-rename", categoryId: c.id, name: renaming.name }, "Renamed")) setRenaming(null); }}
                  className="w-32 bg-white border border-violet-200 rounded px-1.5 py-0.5 text-xs" />
                <button type="button" aria-label="Save the name" onClick={async () => { if (await send({ action: "category-rename", categoryId: c.id, name: renaming.name }, "Renamed")) setRenaming(null); }} className="p-1"><Check className="w-3.5 h-3.5" /></button>
                <button type="button" aria-label="Cancel" onClick={() => setRenaming(null)} className="p-1"><X className="w-3.5 h-3.5" /></button>
              </>
            ) : (
              <>
                {c.name}
                <button type="button" aria-label={`Rename ${c.name}`} onClick={() => setRenaming({ id: c.id, name: c.name })} className="p-1 rounded-full hover:bg-violet-100"><Pencil className="w-3 h-3" /></button>
                <button type="button" aria-label={`Delete ${c.name}`} onClick={() => confirm(`Delete the category "${c.name}"?`) && send({ action: "category-delete", categoryId: c.id }, "Category deleted")} className="p-1 rounded-full hover:bg-violet-100"><Trash2 className="w-3 h-3" /></button>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-2 max-w-md">
        <label htmlFor="cat-new" className="sr-only">New category</label>
        <input id="cat-new" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="New category, e.g. Birth certificate" className={inputCls}
          onKeyDown={async (e) => { if (e.key === "Enter" && name.trim() && await send({ action: "category-add", name }, `Category "${name.trim()}" made`)) setName(""); }} />
        <button type="button" onClick={async () => { if (name.trim() && await send({ action: "category-add", name }, `Category "${name.trim()}" made`)) setName(""); }} disabled={!name.trim()} className={btnPrimary} data-go="add-category"><Plus className="w-4 h-4" /> Add</button>
      </div>
    </div>
  );
}

type When = "" | "7" | "30" | "year" | "range";

export function DocsTab({ restaurantId, staff }: { restaurantId: string; staff: { id: string; name: string }[] }) {
  const [docs, setDocs] = useState<HrDoc[] | null>(null);
  const [cats, setCats] = useState<DocCategory[]>(BUILTIN_DOC_CATEGORIES);
  // Upload
  const [userId, setUserId] = useState(staff[0]?.id ?? "");
  const [kind, setKind] = useState("contract");
  const [newCat, setNewCat] = useState("");
  const [name, setName] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [replaces, setReplaces] = useState(true);
  const [busy, setBusy] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const [showCats, setShowCats] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  // Search and filters
  const [q, setQ] = useState("");
  const [fStaff, setFStaff] = useState("");
  const [fCat, setFCat] = useState("");
  const [fWhen, setFWhen] = useState<When>("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [sort, setSort] = useState<"new" | "old" | "name" | "staff">("new");
  const today = localDay();
  // The clock, read once (for "last 7 days")
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    const d = await fetch(`/api/restaurants/${restaurantId}/hr/documents`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    setDocs(d?.docs ?? []);
    if (d?.categories) setCats(d.categories);
  }, [restaurantId]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const staffName = useCallback((id: string) => staff.find((s) => s.id === id)?.name ?? "Former staff member", [staff]);
  const filtering = !!(q.trim() || fStaff || fCat || fWhen);
  const results = useMemo(() => {
    if (!docs) return [];
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const since = fWhen === "7" ? now - 7 * 86400000 : fWhen === "30" ? now - 30 * 86400000 : fWhen === "year" ? new Date(new Date(now).getFullYear(), 0, 1).getTime() : null;
    const list = docs.filter((d) => {
      if (fStaff && d.userId !== fStaff) return false;
      if (fCat && d.kind !== fCat) return false;
      const at = Date.parse(d.uploadedAt);
      if (since !== null && at < since) return false;
      if (fWhen === "range") {
        const day = localDay(new Date(at));
        if (fFrom && day < fFrom) return false;
        if (fTo && day > fTo) return false;
      }
      if (words.length) {
        const text = `${d.name} ${d.fileName} ${d.note} ${staffName(d.userId)} ${catName(d.kind, cats)}`.toLowerCase();
        if (!words.every((w) => text.includes(w))) return false;
      }
      return true;
    });
    return list.sort((a, b) =>
      sort === "old" ? a.uploadedAt.localeCompare(b.uploadedAt)
        : sort === "name" ? a.name.localeCompare(b.name)
          : sort === "staff" ? staffName(a.userId).localeCompare(staffName(b.userId)) || b.uploadedAt.localeCompare(a.uploadedAt)
            : b.uploadedAt.localeCompare(a.uploadedAt));
  }, [docs, q, fStaff, fCat, fWhen, fFrom, fTo, sort, cats, staffName, now]);

  // The contract(s) a new one would replace
  const active = docs ? groupDocs(docs.filter((d) => d.userId === userId), today) : null;
  const toReplace = active ? [...active.current, ...active.upcoming] : [];

  async function addCategoryInline() {
    const res = await fetch(`/api/restaurants/${restaurantId}/hr/documents`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "category-add", name: newCat }) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    if (!res?.ok) { toast.error(d?.error ?? "Could not make the category"); return; }
    const made = (d.categories as DocCategory[]).find((c) => c.name.toLowerCase() === newCat.trim().toLowerCase());
    setCats(d.categories); setKind(made?.id ?? "other"); setNewCat("");
    toast.success(`Category "${made?.name ?? newCat}" made`);
  }

  async function upload() {
    if (!file || !userId || kind === NEW_CATEGORY) return;
    if (file.size > 4.4 * 1024 * 1024) { toast.error("This file is too big (more than 4 MB). Please make it smaller."); return; }
    setBusy(true);
    const form = new FormData();
    form.append("file", file); form.append("userId", userId); form.append("kind", kind); form.append("name", name);
    form.append("validFrom", validFrom); form.append("validUntil", validUntil); form.append("note", note);
    const replacing = kind === "contract" && toReplace.length > 0 && replaces;
    if (replacing) form.append("replaces", "1");
    const res = await fetch(`/api/restaurants/${restaurantId}/hr/documents`, { method: "POST", body: form }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { toast.error(d?.error ?? "The upload didn't work. Please try again."); return; }
    toast.success(replacing ? "Uploaded. The old contract goes to the contract history." : "Uploaded");
    setShowUpload(false);
    setFile(null); setName(""); setValidFrom(""); setValidUntil(""); setNote(""); setInputKey((k) => k + 1);
    void load();
  }

  const act: OnAction = async (doc, action, edit) => {
    if (action === "delete") {
      if (!confirm(`Delete "${doc.name}" for good?${doc.kind === "contract" ? " It won't be in the contract history anymore." : ""} This can't be undone.`)) return false;
      const res = await fetch(`/api/restaurants/${restaurantId}/hr/documents`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: doc.id }) }).catch(() => null);
      if (!res?.ok) { toast.error("Could not delete"); return false; }
      toast.success("Deleted"); void load(); return true;
    }
    const res = await fetch(`/api/restaurants/${restaurantId}/hr/documents`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: doc.id, action, ...edit }) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    if (!res?.ok) { toast.error(d?.error ?? "Could not save"); return false; }
    toast.success(action === "archive" ? "Moved to the contract history" : action === "restore" ? "Brought back from the history" : "Saved");
    void load(); return true;
  };

  function clearFilters() { setQ(""); setFStaff(""); setFCat(""); setFWhen(""); setFFrom(""); setFTo(""); }

  if (!staff.length) return <p className={`${card} p-5 text-sm text-gray-500`}>No staff yet. Add staff on Staff &amp; roles.</p>;
  const sel = "text-sm border border-gray-200 rounded-xl px-2.5 py-2 bg-white";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={() => setShowCats((v) => !v)} aria-expanded={showCats} className={btnGhost} data-go="manage-categories-top"><Tags className="w-4 h-4" /> Categories</button>
        <button type="button" onClick={() => setShowUpload((v) => !v)} aria-expanded={showUpload} className={btnPrimary} data-go="open-upload"><Upload className="w-4 h-4" /> Upload a document</button>
      </div>
      {showCats && !showUpload && <section className={`${card} p-5`} aria-label="Document categories"><CategoryManager cats={cats} restaurantId={restaurantId} onChange={setCats} /></section>}
      {showUpload && <section className={`${card} p-5 space-y-4`} aria-label="Upload a document">
        <div className="flex items-start justify-between gap-2">
          <div>
          <h2 className="font-semibold text-gray-900">Upload a document</h2>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><Lock className="w-3.5 h-3.5" aria-hidden /> Private. Only HR, the owner and the person it belongs to can open it. PDF, photo or Word, up to 4 MB.</p>
          </div>
          <button type="button" onClick={() => setShowUpload(false)} aria-label="Close" className="p-2 -m-2 rounded-lg text-gray-500 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="doc-user" className="block text-xs font-medium text-gray-700 mb-1">Staff member</label>
            <select id="doc-user" value={userId} onChange={(e) => setUserId(e.target.value)} className={inputCls}>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="doc-kind" className="block text-xs font-medium text-gray-700 mb-1">What is it</label>
            <select id="doc-kind" value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value={NEW_CATEGORY}>+ New category…</option>
            </select>
          </div>
          {kind === NEW_CATEGORY && (
            <div className="sm:col-span-2 flex gap-2" data-new-category>
              <label htmlFor="doc-newcat" className="sr-only">Name of the new category</label>
              <input id="doc-newcat" value={newCat} onChange={(e) => setNewCat(e.target.value)} maxLength={40} autoFocus placeholder="Name of the new category, e.g. Birth certificate" className={inputCls}
                onKeyDown={(e) => { if (e.key === "Enter" && newCat.trim()) void addCategoryInline(); }} />
              <button type="button" onClick={addCategoryInline} disabled={!newCat.trim()} className={btnPrimary} data-go="make-category"><Plus className="w-4 h-4" /> Make</button>
            </div>
          )}
          <div className="sm:col-span-2">
            <label htmlFor="doc-name" className="block text-xs font-medium text-gray-700 mb-1">Name <span className="font-normal text-gray-400">(optional)</span></label>
            <input id="doc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={kind === "contract" ? "For example: Work contract 2026" : `For example: ${kind === "other" || kind === NEW_CATEGORY ? "Health certificate" : catName(kind, cats)}`} className={inputCls} />
          </div>
          <div>
            <label htmlFor="doc-from" className="block text-xs font-medium text-gray-700 mb-1">Valid from <span className="font-normal text-gray-400">(optional)</span></label>
            <input id="doc-from" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="doc-until" className="block text-xs font-medium text-gray-700 mb-1">Valid until <span className="font-normal text-gray-400">(optional)</span></label>
            <input id="doc-until" type="date" value={validUntil} min={validFrom || undefined} onChange={(e) => setValidUntil(e.target.value)} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="doc-note" className="block text-xs font-medium text-gray-700 mb-1">Note <span className="font-normal text-gray-400">(optional)</span></label>
            <input id="doc-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={kind === "contract" ? "For example: new salary, 40 hours instead of 30" : ""} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="doc-file" className="block text-xs font-medium text-gray-700 mb-1">File</label>
            <input key={inputKey} id="doc-file" type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700" />
          </div>
          {kind === "contract" && toReplace.length > 0 && (
            <label className="sm:col-span-2 flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-sm text-gray-800 cursor-pointer" data-replaces>
              <input type="checkbox" checked={replaces} onChange={(e) => setReplaces(e.target.checked)} className="mt-0.5 w-4 h-4 accent-blue-600" />
              <span>
                This replaces {toReplace.length === 1 ? `"${toReplace[0].name}"` : `the ${toReplace.length} current contracts`}
                <span className="block text-xs text-gray-500">It ends {validFrom ? "the day before the new one starts" : "yesterday"} and then moves to the contract history. Nothing is deleted.</span>
              </span>
            </label>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => setShowCats((v) => !v)} aria-expanded={showCats} className={btnGhost} data-go="manage-categories"><Tags className="w-4 h-4" /> Manage categories</button>
          <button type="button" onClick={upload} disabled={busy || !file || !userId || kind === NEW_CATEGORY} className={btnPrimary} data-go="upload">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload
          </button>
        </div>
        {showCats && <CategoryManager cats={cats} restaurantId={restaurantId} onChange={setCats} />}
      </section>}

      <section className={`${card} p-4 space-y-3`} aria-label="Search documents">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
          <label htmlFor="doc-q" className="sr-only">Search documents</label>
          <input id="doc-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, file, note or staff member" className={`${inputCls} pl-9`} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-gray-400" aria-hidden />
          <label htmlFor="doc-fstaff" className="sr-only">Staff member</label>
          <select id="doc-fstaff" value={fStaff} onChange={(e) => setFStaff(e.target.value)} className={sel}>
            <option value="">All staff</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label htmlFor="doc-fcat" className="sr-only">Category</label>
          <select id="doc-fcat" value={fCat} onChange={(e) => setFCat(e.target.value)} className={sel}>
            <option value="">All categories</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label htmlFor="doc-fwhen" className="sr-only">Uploaded</label>
          <select id="doc-fwhen" value={fWhen} onChange={(e) => setFWhen(e.target.value as When)} className={sel}>
            <option value="">Uploaded any time</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="year">This year</option>
            <option value="range">Between two dates…</option>
          </select>
          {fWhen === "range" && (
            <>
              <label htmlFor="doc-ffrom" className="sr-only">Uploaded from</label>
              <input id="doc-ffrom" type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} className={sel} />
              <span className="text-sm text-gray-500">to</span>
              <label htmlFor="doc-fto" className="sr-only">Uploaded until</label>
              <input id="doc-fto" type="date" value={fTo} min={fFrom || undefined} onChange={(e) => setFTo(e.target.value)} className={sel} />
            </>
          )}
          {filtering && (
            <>
              <label htmlFor="doc-sort" className="sr-only">Sort</label>
              <select id="doc-sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={sel}>
                <option value="new">Newest first</option>
                <option value="old">Oldest first</option>
                <option value="name">Name (A to Z)</option>
                <option value="staff">Staff member</option>
              </select>
              <button type="button" onClick={clearFilters} className="text-sm font-semibold text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50" data-go="clear">Clear</button>
            </>
          )}
        </div>
      </section>

      {docs === null ? <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p> : filtering ? (
        <section className="space-y-2" aria-label="Search results">
          <p className="text-sm text-gray-600" data-results>{results.length} {results.length === 1 ? "document" : "documents"} found</p>
          {results.length > 0 && (
            <ul className={`${card} p-3 space-y-2`}>
              {results.map((d) => <DocRow key={d.id} d={d} restaurantId={restaurantId} all={docs} cats={cats} owner={staffName(d.userId)} onAction={act} />)}
            </ul>
          )}
        </section>
      ) : (
        <section className="space-y-3" aria-label="Documents by staff member">
          {staff.map((s) => (
            <div key={s.id} className={`${card} p-4 space-y-3`} data-docs-of={s.name}>
              <h3 className="text-sm font-semibold text-gray-900">{s.name}</h3>
              <PersonDocs docs={docs.filter((d) => d.userId === s.id)} restaurantId={restaurantId} today={today} cats={cats} onAction={act} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
