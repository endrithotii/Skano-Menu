"use client";

// HR tab, Contracts: upload, open and delete the contracts and documents of each staff member (private files).

import { useCallback, useEffect, useState } from "react";
import { FileText, Upload, Trash2, Loader2, Download, Lock } from "lucide-react";
import toast from "react-hot-toast";
import type { HrDoc } from "@/lib/hr";
import { btnPrimary, card, dayLabel, inputCls } from "@/components/hr/hr-ui";

const ACCEPT = "application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const size = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function DocsTab({ restaurantId, staff }: { restaurantId: string; staff: { id: string; name: string }[] }) {
  const [docs, setDocs] = useState<HrDoc[] | null>(null);
  const [userId, setUserId] = useState(staff[0]?.id ?? "");
  const [kind, setKind] = useState<"contract" | "other">("contract");
  const [name, setName] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  const load = useCallback(async () => {
    const d = await fetch(`/api/restaurants/${restaurantId}/hr/documents`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    setDocs(d?.docs ?? []);
  }, [restaurantId]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function upload() {
    if (!file || !userId) return;
    if (file.size > 4.4 * 1024 * 1024) { toast.error("This file is too big (more than 4 MB). Please make it smaller."); return; }
    setBusy(true);
    const form = new FormData();
    form.append("file", file); form.append("userId", userId); form.append("kind", kind); form.append("name", name);
    form.append("validFrom", validFrom); form.append("validUntil", validUntil); form.append("note", note);
    const res = await fetch(`/api/restaurants/${restaurantId}/hr/documents`, { method: "POST", body: form }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { toast.error(d?.error ?? "The upload didn't work. Please try again."); return; }
    toast.success("Uploaded");
    setFile(null); setName(""); setValidFrom(""); setValidUntil(""); setNote(""); setInputKey((k) => k + 1);
    void load();
  }
  async function remove(doc: HrDoc) {
    if (!confirm(`Delete "${doc.name}"? This can't be undone.`)) return;
    const res = await fetch(`/api/restaurants/${restaurantId}/hr/documents`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: doc.id }) }).catch(() => null);
    if (!res?.ok) { toast.error("Could not delete"); return; }
    toast.success("Deleted"); void load();
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
            <input id="doc-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="doc-file" className="block text-xs font-medium text-gray-700 mb-1">File</label>
            <input key={inputKey} id="doc-file" type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700" />
          </div>
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={upload} disabled={busy || !file || !userId} className={btnPrimary} data-go="upload">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload
          </button>
        </div>
      </section>

      <section className="space-y-3" aria-label="Documents">
        {docs === null ? <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p> : staff.map((s) => {
          const mine = docs.filter((d) => d.userId === s.id);
          const today = new Date().toISOString().slice(0, 10);
          return (
            <div key={s.id} className={`${card} p-4`} data-docs-of={s.name}>
              <h3 className="text-sm font-semibold text-gray-900">{s.name}</h3>
              {mine.length === 0 ? <p className="text-sm text-gray-400 mt-1">No contract yet.</p> : (
                <ul className="mt-2 space-y-2">
                  {mine.map((d) => {
                    const expired = !!d.validUntil && d.validUntil < today;
                    return (
                      <li key={d.id} className="flex flex-wrap items-center gap-2 text-sm rounded-xl bg-gray-50 px-3 py-2" data-doc={d.name}>
                        <FileText className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
                        <a href={`/api/restaurants/${restaurantId}/hr/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 hover:underline">{d.name}</a>
                        {d.kind === "contract" && <span className="text-[11px] font-semibold rounded-full border border-blue-200 bg-blue-50 text-blue-800 px-2 py-0.5">Contract</span>}
                        {expired && <span className="text-[11px] font-semibold rounded-full border border-amber-200 bg-amber-50 text-amber-800 px-2 py-0.5">Ended</span>}
                        <span className="text-xs text-gray-500 flex-1 min-w-40">
                          {d.validFrom || d.validUntil ? `${d.validFrom ? dayLabel(d.validFrom) : "…"} to ${d.validUntil ? dayLabel(d.validUntil) : "no end"} · ` : ""}{size(d.size)}{d.note ? ` · ${d.note}` : ""}
                        </span>
                        <a href={`/api/restaurants/${restaurantId}/hr/documents/${d.id}?download=1`} aria-label={`Download ${d.name}`} className="p-1.5 rounded-lg text-gray-500 hover:bg-white"><Download className="w-4 h-4" /></a>
                        <button type="button" onClick={() => remove(d)} aria-label={`Delete ${d.name}`} className="p-1.5 rounded-lg text-gray-500 hover:bg-white hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
