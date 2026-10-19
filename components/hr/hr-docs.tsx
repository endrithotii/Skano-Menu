"use client";

// HR tab, Contracts: upload, open and manage the contracts and documents of each staff member (private files).
// Older contracts are kept in a contract history: a new contract can replace the current one, which then moves there.

import { useCallback, useEffect, useState } from "react";
import { FileText, Upload, Trash2, Loader2, Download, Lock, History, ChevronDown, ChevronUp, Archive, ArchiveRestore, Pencil, Check, X } from "lucide-react";
import toast from "react-hot-toast";
import { byNewest, contractState, type HrDoc } from "@/lib/hr";
import { btnPrimary, card, inputCls } from "@/components/hr/hr-ui";

const ACCEPT = "application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const size = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
/** "1 Jan 2025" (contracts span years, so the year is always shown) */
const dayY = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const span = (d: Pick<HrDoc, "validFrom" | "validUntil">) => (d.validFrom || d.validUntil ? `${d.validFrom ? dayY(d.validFrom) : "…"} to ${d.validUntil ? dayY(d.validUntil) : "no end"}` : "No dates");
const uploaded = (d: HrDoc) => `Uploaded ${new Date(d.uploadedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}${d.uploadedByName ? ` by ${d.uploadedByName}` : ""}`;

/** Splits someone's documents: current contract(s), contracts that start later, the history, other documents */
export function groupDocs(docs: HrDoc[], today: string) {
  const contracts = docs.filter((d) => d.kind === "contract").sort(byNewest);
  return {
    current: contracts.filter((d) => contractState(d, today) === "current"),
    upcoming: contracts.filter((d) => contractState(d, today) === "upcoming"),
    history: contracts.filter((d) => contractState(d, today) === "history"),
    other: docs.filter((d) => d.kind !== "contract").sort(byNewest),
  };
}

function Pill({ tone, children }: { tone: "green" | "blue" | "gray" | "amber"; children: React.ReactNode }) {
  const cls = { green: "border-green-200 bg-green-50 text-green-800", blue: "border-blue-200 bg-blue-50 text-blue-800", gray: "border-gray-200 bg-white text-gray-600", amber: "border-amber-200 bg-amber-50 text-amber-800" }[tone];
  return <span className={`text-[11px] font-semibold rounded-full border px-2 py-0.5 ${cls}`}>{children}</span>;
}

function DocRow({ d, restaurantId, label, all, onAction }: {
  d: HrDoc; restaurantId: string; label?: React.ReactNode; all: HrDoc[];
  onAction?: (d: HrDoc, action: "archive" | "restore" | "delete" | "dates", dates?: { validFrom: string; validUntil: string }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [from, setFrom] = useState(d.validFrom ?? "");
  const [until, setUntil] = useState(d.validUntil ?? "");
  const newer = d.replacedBy ? all.find((x) => x.id === d.replacedBy) : null;
  return (
    <li className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm" data-doc={d.name}>
      <div className="flex flex-wrap items-center gap-2">
        <FileText className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
        <a href={`/api/restaurants/${restaurantId}/hr/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 hover:underline">{d.name}</a>
        {label}
        <span className="flex-1" />
        <a href={`/api/restaurants/${restaurantId}/hr/documents/${d.id}?download=1`} aria-label={`Download ${d.name}`} className="p-1.5 rounded-lg text-gray-500 hover:bg-white"><Download className="w-4 h-4" /></a>
        {onAction && d.kind === "contract" && (
          <button type="button" onClick={() => setEditing((v) => !v)} aria-label={`Change the dates of ${d.name}`} className="p-1.5 rounded-lg text-gray-500 hover:bg-white"><Pencil className="w-4 h-4" /></button>
        )}
        {onAction && d.kind === "contract" && (d.archived
          ? <button type="button" onClick={() => onAction(d, "restore")} aria-label={`Bring ${d.name} back from the history`} title="Bring back from the history" className="p-1.5 rounded-lg text-gray-500 hover:bg-white"><ArchiveRestore className="w-4 h-4" /></button>
          : <button type="button" onClick={() => onAction(d, "archive")} aria-label={`Move ${d.name} to the history`} title="Move to the history" className="p-1.5 rounded-lg text-gray-500 hover:bg-white" data-go="archive"><Archive className="w-4 h-4" /></button>)}
        {onAction && <button type="button" onClick={() => onAction(d, "delete")} aria-label={`Delete ${d.name}`} className="p-1.5 rounded-lg text-gray-500 hover:bg-white hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
      </div>
      <p className="text-xs text-gray-500 mt-1 pl-6">
        {d.kind === "contract" ? `${span(d)} · ` : ""}{uploaded(d)} · {size(d.size)}
        {newer ? ` · Replaced by "${newer.name}"` : ""}{d.note ? ` · ${d.note}` : ""}
      </p>
      {editing && onAction && (
        <div className="mt-2 pl-6 flex flex-wrap items-end gap-2">
          <div><label htmlFor={`f-${d.id}`} className="block text-[11px] text-gray-600 mb-0.5">Valid from</label><input id={`f-${d.id}`} type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white" /></div>
          <div><label htmlFor={`u-${d.id}`} className="block text-[11px] text-gray-600 mb-0.5">Valid until</label><input id={`u-${d.id}`} type="date" value={until} min={from || undefined} onChange={(e) => setUntil(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white" /></div>
          <button type="button" onClick={async () => { await onAction(d, "dates", { validFrom: from, validUntil: until }); setEditing(false); }} className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-blue-600 rounded-lg px-3 py-2"><Check className="w-3.5 h-3.5" /> Save</button>
          <button type="button" onClick={() => setEditing(false)} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 rounded-lg px-2 py-2"><X className="w-3.5 h-3.5" /> Cancel</button>
        </div>
      )}
    </li>
  );
}

/** One person's contracts: current, starting later, history, other documents. onAction: HR can manage them */
export function PersonDocs({ docs, restaurantId, today, onAction, startOpen = false }: {
  docs: HrDoc[]; restaurantId: string; today: string; startOpen?: boolean;
  onAction?: (d: HrDoc, action: "archive" | "restore" | "delete" | "dates", dates?: { validFrom: string; validUntil: string }) => Promise<void>;
}) {
  const [open, setOpen] = useState(startOpen);
  const g = groupDocs(docs, today);
  const row = (d: HrDoc, label?: React.ReactNode) => <DocRow key={d.id} d={d} restaurantId={restaurantId} label={label} all={docs} onAction={onAction} />;
  return (
    <div className="space-y-3">
      {g.current.length === 0 && g.upcoming.length === 0 ? <p className="text-sm text-gray-400">No current contract.</p> : (
        <ul className="space-y-2">
          {g.current.map((d) => row(d, <><Pill tone="green">Current contract</Pill>{d.replacedBy && d.validUntil && <Pill tone="amber">Ends {dayY(d.validUntil)}</Pill>}</>))}
          {g.upcoming.map((d) => row(d, <Pill tone="blue">Starts {d.validFrom ? dayY(d.validFrom) : "later"}</Pill>))}
        </ul>
      )}
      {g.history.length > 0 && (
        <div data-contract-history>
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900">
            <History className="w-3.5 h-3.5" aria-hidden /> Contract history ({g.history.length}) {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {open && (
            <ol className="mt-2 space-y-2 border-l-2 border-gray-200 pl-3 ml-1.5">
              {g.history.map((d) => row(d, <Pill tone="gray">{d.replacedBy ? "Replaced" : d.archived ? "In history" : "Ended"}</Pill>))}
            </ol>
          )}
        </div>
      )}
      {g.other.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-1.5">Other documents</p>
          <ul className="space-y-2">{g.other.map((d) => row(d))}</ul>
        </div>
      )}
    </div>
  );
}

export function DocsTab({ restaurantId, staff }: { restaurantId: string; staff: { id: string; name: string }[] }) {
  const [docs, setDocs] = useState<HrDoc[] | null>(null);
  const [userId, setUserId] = useState(staff[0]?.id ?? "");
  const [kind, setKind] = useState<"contract" | "other">("contract");
  const [name, setName] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [replaces, setReplaces] = useState(true);
  const [busy, setBusy] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const today = localToday();

  const load = useCallback(async () => {
    const d = await fetch(`/api/restaurants/${restaurantId}/hr/documents`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    setDocs(d?.docs ?? []);
  }, [restaurantId]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  // The contract(s) a new one would replace
  const active = docs ? groupDocs(docs.filter((d) => d.userId === userId), today) : null;
  const toReplace = active ? [...active.current, ...active.upcoming] : [];

  async function upload() {
    if (!file || !userId) return;
    if (file.size > 4.4 * 1024 * 1024) { toast.error("This file is too big (more than 4 MB). Please make it smaller."); return; }
    setBusy(true);
    const form = new FormData();
    form.append("file", file); form.append("userId", userId); form.append("kind", kind); form.append("name", name);
    form.append("validFrom", validFrom); form.append("validUntil", validUntil); form.append("note", note);
    if (kind === "contract" && toReplace.length && replaces) form.append("replaces", "1");
    const res = await fetch(`/api/restaurants/${restaurantId}/hr/documents`, { method: "POST", body: form }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { toast.error(d?.error ?? "The upload didn't work. Please try again."); return; }
    toast.success(kind === "contract" && toReplace.length && replaces ? "Uploaded. The old contract is now in the contract history." : "Uploaded");
    setFile(null); setName(""); setValidFrom(""); setValidUntil(""); setNote(""); setInputKey((k) => k + 1);
    void load();
  }

  async function act(doc: HrDoc, action: "archive" | "restore" | "delete" | "dates", dates?: { validFrom: string; validUntil: string }) {
    if (action === "delete") {
      if (!confirm(`Delete "${doc.name}" for good? It won't be in the contract history anymore. This can't be undone.`)) return;
      const res = await fetch(`/api/restaurants/${restaurantId}/hr/documents`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: doc.id }) }).catch(() => null);
      if (!res?.ok) { toast.error("Could not delete"); return; }
      toast.success("Deleted"); void load(); return;
    }
    const res = await fetch(`/api/restaurants/${restaurantId}/hr/documents`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: doc.id, action, ...dates }) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    if (!res?.ok) { toast.error(d?.error ?? "Could not save"); return; }
    toast.success(action === "archive" ? "Moved to the contract history" : action === "restore" ? "Brought back from the history" : "Dates saved");
    void load();
  }

  if (!staff.length) return <p className={`${card} p-5 text-sm text-gray-500`}>No staff yet. Add staff on Staff &amp; roles.</p>;
  return (
    <div className="space-y-6">
      <section className={`${card} p-5 space-y-4`} aria-label="Upload a contract">
        <div>
          <h2 className="font-semibold text-gray-900">Upload a contract or document</h2>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><Lock className="w-3.5 h-3.5" aria-hidden /> Private. Only HR, the owner and the person it belongs to can open it. PDF, photo or Word, up to 4 MB.</p>
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
            <select id="doc-kind" value={kind} onChange={(e) => setKind(e.target.value as "contract" | "other")} className={inputCls}>
              <option value="contract">Contract</option>
              <option value="other">Other document</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="doc-name" className="block text-xs font-medium text-gray-700 mb-1">Name <span className="font-normal text-gray-400">(optional)</span></label>
            <input id="doc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={kind === "contract" ? "For example: Work contract 2026" : "For example: Health certificate"} className={inputCls} />
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
        <div className="flex justify-end">
          <button type="button" onClick={upload} disabled={busy || !file || !userId} className={btnPrimary} data-go="upload">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload
          </button>
        </div>
      </section>

      <section className="space-y-3" aria-label="Documents">
        {docs === null ? <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p> : staff.map((s) => (
          <div key={s.id} className={`${card} p-4 space-y-3`} data-docs-of={s.name}>
            <h3 className="text-sm font-semibold text-gray-900">{s.name}</h3>
            <PersonDocs docs={docs.filter((d) => d.userId === s.id)} restaurantId={restaurantId} today={today} onAction={act} />
          </div>
        ))}
      </section>
    </div>
  );
}
