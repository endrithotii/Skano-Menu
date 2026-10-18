"use client";

// Receipt photos to check (Loyalty Cards page and the waiter page): give the stamp or decline it.

import { useCallback, useEffect, useState } from "react";
import { Receipt as ReceiptIcon, Check, X, Loader2, Stamp, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";
import { PhotoViewer } from "@/components/photo-viewer";

interface Receipt { id: string; masked: string; photo: string; status: "waiting" | "approved" | "declined"; sentAt: string; decidedAt: string | null; decidedBy: string | null; reason: string; stampsAfter: number | null }

const fWhen = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const REASONS = ["The photo isn't clear", "This receipt was already used", "It's not a receipt from us"];

export function ReceiptQueue({ restaurantId, dark = false }: { restaurantId: string; dark?: boolean }) {
  const [data, setData] = useState<{ waiting: Receipt[]; recent: Receipt[]; total: number; enabled: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [view, setView] = useState<Receipt | null>(null);
  const [showRecent, setShowRecent] = useState(false);

  const load = useCallback(async () => {
    const d = await fetch(`/api/restaurants/${restaurantId}/loyalty-receipts?queue=1`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (d) setData(d);
  }, [restaurantId]);
  useEffect(() => {
    void Promise.resolve().then(load);
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, [load]);

  async function decide(r: Receipt, action: "approve" | "decline") {
    setBusy(r.id + action);
    const res = await fetch(`/api/restaurants/${restaurantId}/loyalty-receipts`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, action, reason }) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(null);
    if (!res?.ok) { toast.error(d?.error ?? "Could not save"); void load(); return; }
    toast.success(action === "approve" ? `Stamp given: ${d.stamps} of ${d.total}` : "Receipt declined");
    setDeclining(null); setReason(""); setView(null);
    void load();
  }

  if (!data || (!data.enabled && !data.waiting.length)) return null;
  const card = dark ? "rounded-2xl bg-gray-900 border border-white/10 p-4" : "bg-white rounded-2xl border border-gray-100 shadow-sm p-5";
  const title = dark ? "text-white" : "text-gray-900";
  const muted = dark ? "text-gray-400" : "text-gray-500";
  const row = dark ? "rounded-xl bg-gray-800 border border-white/10 p-3" : "rounded-xl border border-gray-100 bg-gray-50/60 p-3";

  return (
    <section className={card} aria-label="Receipts to check" data-receipt-queue>
      <div className="flex items-center gap-2">
        <ReceiptIcon className={`w-4 h-4 ${dark ? "text-blue-400" : "text-blue-600"}`} />
        <h2 className={`font-semibold text-sm ${title}`}>Receipts to check</h2>
        {data.waiting.length > 0 && <span className="text-[11px] font-bold rounded-full px-1.5 bg-red-500 text-white" data-count>{data.waiting.length}</span>}
      </div>
      <p className={`text-xs mt-0.5 ${muted}`}>Customers sent a photo of their receipt. Check it, then give the stamp.</p>
      {!data.waiting.length ? (
        <p className={`text-sm mt-3 ${muted}`}>Nothing to check right now.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {data.waiting.map((r) => (
            <li key={r.id} className={row} data-receipt={r.masked}>
              <div className="flex items-start gap-3">
                <button type="button" onClick={() => setView(r)} aria-label="Open the receipt big" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.photo} alt="Receipt" className="w-20 h-24 rounded-lg object-cover border border-black/10 bg-white" />
                </button>
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <div className={`text-sm font-semibold ${title}`}>{r.masked}</div>
                    <div className={`text-xs ${muted}`}>Sent {fWhen.format(new Date(r.sentAt))}</div>
                  </div>
                  {declining === r.id ? (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap gap-1">
                        {REASONS.map((x) => (
                          <button key={x} type="button" onClick={() => setReason(x)} className={`text-[11px] rounded-full px-2 py-0.5 border ${reason === x ? "border-red-400 bg-red-50 text-red-700" : dark ? "border-white/15 text-gray-300" : "border-gray-200 text-gray-600"}`}>{x}</button>
                        ))}
                      </div>
                      <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Why? (the customer sees it)" data-reason
                        className={`w-full text-sm rounded-lg px-2.5 py-1.5 border ${dark ? "bg-gray-900 border-white/15 text-white" : "bg-white border-gray-200"}`} />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => decide(r, "decline")} disabled={!!busy} data-go="decline" className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg px-3 py-1.5 disabled:opacity-50">
                          {busy === r.id + "decline" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} Decline
                        </button>
                        <button type="button" onClick={() => { setDeclining(null); setReason(""); }} className={`text-xs font-semibold ${muted}`}>Back</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      <button type="button" onClick={() => decide(r, "approve")} disabled={!!busy} data-go="approve" className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg px-3 py-1.5 disabled:opacity-50">
                        {busy === r.id + "approve" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Stamp className="w-3.5 h-3.5" />} Give the stamp
                      </button>
                      <button type="button" onClick={() => { setDeclining(r.id); setReason(""); }} disabled={!!busy} data-go="decline-start" className={`inline-flex items-center gap-1 text-xs font-semibold rounded-lg px-3 py-1.5 border ${dark ? "border-white/15 text-gray-200" : "border-gray-200 text-gray-700"}`}>
                        <X className="w-3.5 h-3.5" /> Decline
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data.recent.length > 0 && (
        <div className="mt-3">
          <button type="button" onClick={() => setShowRecent((v) => !v)} className={`inline-flex items-center gap-1 text-xs font-semibold ${muted}`}>
            {showRecent ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} Checked lately ({data.recent.length})
          </button>
          {showRecent && (
            <ul className="mt-2 space-y-1">
              {data.recent.map((r) => (
                <li key={r.id} className={`text-xs flex items-center gap-1.5 ${muted}`}>
                  {r.status === "approved" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <X className="w-3.5 h-3.5 text-red-500" />}
                  {r.masked}: {r.status === "approved" ? `stamp given${r.stampsAfter !== null ? ` (${r.stampsAfter} of ${data.total})` : ""}` : `declined${r.reason ? ` ("${r.reason}")` : ""}`}
                  {r.decidedBy ? ` by ${r.decidedBy}` : ""}{r.decidedAt ? `, ${fWhen.format(new Date(r.decidedAt))}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {view && <PhotoViewer photos={[{ url: view.photo, kind: "photo", caption: `Receipt from ${view.masked}` }]} title="Receipt" onClose={() => setView(null)} />}
    </section>
  );
}
