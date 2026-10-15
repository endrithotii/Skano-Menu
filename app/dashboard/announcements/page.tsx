"use client";

// Announcement Banner: messages customers see as a notification at the top when they open the menu.
// Show one now or schedule it, and optionally choose when it stops.

import { useCallback, useEffect, useState } from "react";
import { Megaphone, Plus, Pencil, Trash2, Loader2, Square, CalendarClock, X, Check } from "lucide-react";
import toast from "react-hot-toast";
import { formatDayTime } from "@/lib/format-date";
import { useUnsavedChanges } from "@/lib/navigation-guard";

type Display = "close" | "auto" | "fixed";
interface Item { id: string; message: string; startAt: string; endAt: string | null; display: Display; seconds: number; status: "active" | "upcoming" | "ended" }

const DISPLAYS: { value: Display; title: string; hint: string }[] = [
  { value: "close", title: "Customer closes it", hint: "Stays on screen until they tap X. Also under More." },
  { value: "auto", title: "Disappears by itself", hint: "Fades out after the seconds you choose. Also under More." },
  { value: "fixed", title: "Always visible", hint: "Stays at the top of the menu and can't be closed." },
];
const displayLabel = (a: Pick<Item, "display" | "seconds">) =>
  a.display === "fixed" ? "Always visible" : a.display === "auto" ? `Disappears after ${a.seconds}s` : "Customer closes it";

const MAX = 280;
const inputCls = "w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";

/** Value for <input type="datetime-local"> in the manager's own time zone */
function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
/** End time for "Stop now" (a moment after the start, for ones that only just started) */
const stopTime = (startAt: string) => new Date(Math.max(Date.now(), Date.parse(startAt) + 1000)).toISOString();
const inHours = (h: number) => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + h); return d; };

interface Form { message: string; when: "now" | "later"; start: string; hasEnd: boolean; end: string; display: Display; seconds: number }
const emptyForm = (): Form => ({ message: "", when: "now", start: toLocalInput(inHours(1)), hasEnd: false, end: toLocalInput(inHours(24)), display: "close", seconds: 10 });

export default function AnnouncementsPage() {
  const [restaurantId, setRestaurantId] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // Checked when the form opens, for "is the start in the past" hints
  const [openedAt, setOpenedAt] = useState(0);

  useUnsavedChanges(!!form && (!!form.message.trim() || !!editing), "Your announcement isn't saved yet. Leave without saving?");

  const load = useCallback(async (rid: string) => {
    const d = await fetch(`/api/restaurants/${rid}/announcements`).then((r) => r.json()).catch(() => null);
    setItems(d?.announcements ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/dashboard/stats").then((r) => r.json());
      setRestaurantId(s.restaurantId);
      await load(s.restaurantId);
    })();
  }, [load]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm());
    setOpenedAt(Date.now());
  }

  function openEdit(a: Item) {
    setEditing(a);
    const started = Date.parse(a.startAt) <= Date.now();
    setForm({
      message: a.message,
      when: started ? "now" : "later",
      start: toLocalInput(new Date(a.startAt)),
      hasEnd: !!a.endAt,
      end: toLocalInput(a.endAt ? new Date(a.endAt) : inHours(24)),
      display: a.display ?? "close",
      seconds: a.seconds ?? 10,
    });
    setOpenedAt(Date.now());
  }

  const problem = (() => {
    if (!form) return null;
    if (!form.message.trim()) return "Write the announcement.";
    if (form.message.length > MAX) return `At most ${MAX} characters.`;
    if (form.display === "auto" && (!Number.isFinite(form.seconds) || form.seconds < 3 || form.seconds > 60)) return "Choose between 3 and 60 seconds.";
    const start = form.when === "now" ? openedAt : Date.parse(form.start);
    if (!Number.isFinite(start)) return "Choose when it starts.";
    if (form.hasEnd) {
      const end = Date.parse(form.end);
      if (!Number.isFinite(end)) return "Choose when it ends, or untick Ends.";
      if (end <= start) return "The end must be after the start.";
      if (end <= openedAt) return "The end time is already over.";
    }
    return null;
  })();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form || problem || saving) return;
    setSaving(true);
    // "Now" keeps the original start when editing one that already shows
    const startAt = form.when === "now"
      ? (editing && Date.parse(editing.startAt) <= Date.now() ? editing.startAt : new Date().toISOString())
      : new Date(form.start).toISOString();
    const body = {
      message: form.message.trim(), startAt, endAt: form.hasEnd ? new Date(form.end).toISOString() : null,
      display: form.display, seconds: form.seconds, ...(editing ? { id: editing.id } : {}),
    };
    const res = await fetch(`/api/restaurants/${restaurantId}/announcements`, {
      method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) { const d = await res?.json().catch(() => null); toast.error(d?.error ?? "Could not save"); return; }
    toast.success(form.when === "now" ? "Saved. Customers see it when they open your menu." : "Saved. It shows at the time you chose.");
    setForm(null);
    setEditing(null);
    await load(restaurantId);
  }

  async function stopNow(a: Item) {
    if (!confirm("Stop showing this announcement now?")) return;
    setBusy(a.id);
    const res = await fetch(`/api/restaurants/${restaurantId}/announcements`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: a.id, message: a.message, startAt: a.startAt, endAt: stopTime(a.startAt), display: a.display, seconds: a.seconds }),
    }).catch(() => null);
    setBusy(null);
    if (!res?.ok) { toast.error("Could not stop it"); return; }
    toast.success("Stopped. Customers don't see it anymore.");
    await load(restaurantId);
  }

  async function remove(a: Item) {
    if (!confirm("Delete this announcement?")) return;
    setBusy(a.id);
    const res = await fetch(`/api/restaurants/${restaurantId}/announcements?id=${encodeURIComponent(a.id)}`, { method: "DELETE" }).catch(() => null);
    setBusy(null);
    if (!res?.ok) { toast.error("Could not delete it"); return; }
    toast.success("Deleted");
    await load(restaurantId);
  }

  if (!items) return <div className="p-6 flex justify-center h-64 items-center"><div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" /></div>;

  const groups: { key: Item["status"]; title: string; hint: string }[] = [
    { key: "active", title: "Showing now", hint: "Customers see these when they open your menu" },
    { key: "upcoming", title: "Scheduled", hint: "These start at the time you chose" },
    { key: "ended", title: "Ended", hint: "Kept for 6 months" },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Megaphone className="w-6 h-6 text-blue-500" /> Announcement Banner</h1>
          <p className="text-sm text-gray-500 mt-1">A message customers see at the top when they scan your QR code</p>
        </div>
        {!form && (
          <button type="button" onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl shadow-sm">
            <Plus className="w-4 h-4" /> New announcement
          </button>
        )}
      </div>

      {form && (
        <form onSubmit={save} className="bg-white rounded-2xl border border-blue-100 ring-2 ring-blue-50 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{editing ? "Edit announcement" : "New announcement"}</h2>
            <button type="button" onClick={() => { setForm(null); setEditing(null); }} aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
          </div>
          <div>
            <label htmlFor="ann-message" className="block text-xs font-semibold text-gray-600 mb-1">Message</label>
            <textarea id="ann-message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={MAX} rows={3}
              placeholder={`e.g. "Happy hour 17:00 to 19:00, all cocktails 20% off" or "We are closed this Sunday"`}
              className={`${inputCls} resize-none`} />
            <p className="text-xs text-gray-400 text-right">{form.message.length}/{MAX}</p>
          </div>

          <div>
            <div className="block text-xs font-semibold text-gray-600 mb-1.5">When should it show?</div>
            <div role="radiogroup" aria-label="When" className="inline-flex p-1 bg-gray-100 rounded-xl gap-1">
              {([{ v: "now", label: "Now" }, { v: "later", label: "Schedule" }] as const).map((o) => (
                <button key={o.v} type="button" role="radio" aria-checked={form.when === o.v} id={`ann-when-${o.v}`} onClick={() => setForm({ ...form, when: o.v })}
                  className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg ${form.when === o.v ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}>
                  {o.v === "later" && <CalendarClock className="w-4 h-4" />}{o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {form.when === "later" && (
              <label className="block">
                <span className="block text-xs font-semibold text-gray-600 mb-1">Starts</span>
                <input id="ann-start" type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className={inputCls} />
              </label>
            )}
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-1">
                <input id="ann-has-end" type="checkbox" checked={form.hasEnd} onChange={(e) => setForm({ ...form, hasEnd: e.target.checked })} className="w-3.5 h-3.5 accent-blue-600" />
                Ends <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input id="ann-end" type="datetime-local" value={form.end} disabled={!form.hasEnd} onChange={(e) => setForm({ ...form, end: e.target.value })} className={`${inputCls} disabled:opacity-40`} />
            </div>
          </div>

          <div>
            <div className="block text-xs font-semibold text-gray-600 mb-1.5">How should it show?</div>
            <div role="radiogroup" aria-label="How it shows" className="grid sm:grid-cols-3 gap-2">
              {DISPLAYS.map((o) => {
                const on = form.display === o.value;
                return (
                  <button key={o.value} type="button" role="radio" aria-checked={on} id={`ann-display-${o.value}`} onClick={() => setForm({ ...form, display: o.value })}
                    className={`text-left rounded-xl border p-3 transition-colors ${on ? "border-blue-400 bg-blue-50 ring-2 ring-blue-100" : "border-gray-200 hover:border-gray-300"}`}>
                    <div className={`text-sm font-semibold ${on ? "text-blue-800" : "text-gray-900"}`}>{o.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{o.hint}</div>
                  </button>
                );
              })}
            </div>
            {form.display === "auto" && (
              <label className="mt-2 inline-flex items-center gap-2 text-sm text-gray-700">
                Disappears after
                <input id="ann-seconds" type="number" min={3} max={60} value={form.seconds} onChange={(e) => setForm({ ...form, seconds: Number(e.target.value) })}
                  className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
                seconds
              </label>
            )}
          </div>

          {problem && form.message.trim() ? <p className="text-xs font-medium text-red-600">{problem}</p> : (
            <p className="text-xs text-gray-500">
              {form.when === "now" ? "Shows from now" : Number.isFinite(Date.parse(form.start)) ? `Shows from ${formatDayTime(new Date(form.start))}` : "Shows from the start time"}
              {form.hasEnd && Number.isFinite(Date.parse(form.end)) ? ` until ${formatDayTime(new Date(form.end))}.` : " until you stop it."}
            </p>
          )}

          {/* Preview */}
          {form.message.trim() && (
            <div className="rounded-2xl bg-[#333333] p-3">
              <div className="text-[11px] text-white/60 mb-2">
                What customers see at the top of the menu{form.display === "auto" ? `, for ${form.seconds} seconds` : form.display === "fixed" ? ", all the time" : ", until they close it"}
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-white text-gray-900 px-4 py-3 shadow-lg">
                <span className="w-8 h-8 shrink-0 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center"><Megaphone className="w-4 h-4" /></span>
                <p className="flex-1 text-sm leading-snug pt-1.5 whitespace-pre-line break-words">{form.message}</p>
                {form.display === "close" && <X className="w-4 h-4 mt-2 text-gray-400 shrink-0" />}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => { setForm(null); setEditing(null); }} className="text-sm font-medium text-gray-600 px-4 py-2 rounded-xl hover:bg-gray-100">Cancel</button>
            <button type="submit" disabled={!!problem || saving} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {form.when === "now" ? "Save and show now" : "Save schedule"}
            </button>
          </div>
        </form>
      )}

      {items.length === 0 && !form ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
          <Megaphone className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="font-medium text-gray-500">No announcements yet</p>
          <p className="text-sm text-gray-400 mt-1">Tell customers about offers, events or a closed day</p>
        </div>
      ) : (
        groups.map((g) => {
          const list = items.filter((a) => a.status === g.key);
          if (!list.length) return null;
          return (
            <section key={g.key}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{g.title}</p>
              <p className="text-xs text-gray-400 mb-2">{g.hint}</p>
              <ul className="space-y-2">
                {list.map((a) => (
                  <li key={a.id} className={`bg-white rounded-2xl border shadow-sm p-4 flex items-start gap-3 ${g.key === "active" ? "border-green-200" : "border-gray-100"} ${g.key === "ended" ? "opacity-60" : ""}`}>
                    <span className={`mt-0.5 w-2 h-2 shrink-0 rounded-full ${g.key === "active" ? "bg-green-500" : g.key === "upcoming" ? "bg-amber-400" : "bg-gray-300"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 whitespace-pre-line break-words">{a.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {g.key === "upcoming" ? `From ${formatDayTime(a.startAt)}` : `Since ${formatDayTime(a.startAt)}`}
                        {a.endAt ? ` until ${formatDayTime(a.endAt)}` : ", until you stop it"}
                        <span className="text-gray-400"> · {displayLabel(a)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {busy === a.id ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : (
                        <>
                          {g.key === "active" && (
                            <button type="button" onClick={() => stopNow(a)} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:border-amber-300 hover:text-amber-700">
                              <Square className="w-3 h-3" /> Stop now
                            </button>
                          )}
                          {g.key !== "ended" && (
                            <button type="button" onClick={() => openEdit(a)} aria-label="Edit" className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-4 h-4" /></button>
                          )}
                          <button type="button" onClick={() => remove(a)} aria-label="Delete" className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
