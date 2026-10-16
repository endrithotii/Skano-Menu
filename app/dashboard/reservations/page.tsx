"use client";

// Reservations: requests to accept or refuse (the customer gets an email), upcoming reservations, history,
// blocked tables (can't be reserved for a time) and the settings.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarCheck, Check, X, Loader2, Phone, Mail, Users, Ban, Settings2, History, Inbox, CalendarDays, AlertTriangle, Trash2, Armchair } from "lucide-react";
import toast from "react-hot-toast";

type Status = "pending" | "accepted" | "refused" | "cancelled";
interface Reservation {
  id: string; status: Status; startAt: string; endAt: string; guests: number; tableId: string | null; tableLabel: string; areaName: string;
  name: string; email: string; phone: string; note: string; requestedAt: string; decidedAt: string | null; decidedBy: string | null; message: string; emailSent: boolean | null;
}
interface Settings { enabled: boolean; durationMin: number; stepMin: number; daysAhead: number; noticeMin: number; customerPicksTable: boolean }
interface Block { id: string; tableIds: string[] | "all"; labels: string[]; from: string; until: string; reason: string; by: string | null }
interface TableRef { id: string; label: string; seats: number; areaName: string }
type Tab = "requests" | "upcoming" | "history" | "blocks" | "settings";

const fDay = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" });
const fTime = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const fShort = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const localValue = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const inputCls = "w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";

export default function ReservationsPage() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("requests");
  const [list, setList] = useState<Reservation[] | null>(null);
  const [counts, setCounts] = useState({ requests: 0, upcoming: 0 });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [emailReady, setEmailReady] = useState(true);

  useEffect(() => {
    void fetch("/api/dashboard/access").then((r) => r.json()).then((a) => setRestaurantId(a?.restaurantId ?? null)).catch(() => {});
  }, []);

  const load = useCallback(async (view: Tab) => {
    if (!restaurantId) return;
    const v = view === "blocks" || view === "settings" ? "requests" : view;
    const d = await fetch(`/api/restaurants/${restaurantId}/reservations?view=${v}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!d) { toast.error("Could not load the reservations"); return; }
    if (view === v) setList(d.reservations);
    setCounts(d.counts); setSettings(d.settings); setEmailReady(!!d.emailReady);
  }, [restaurantId]);

  // Load the tab, and look for new requests every 30 seconds
  useEffect(() => {
    if (!restaurantId) return;
    void Promise.resolve().then(() => load(tab));
    const t = setInterval(() => { if (tab === "requests" || tab === "upcoming") void load(tab); }, 30_000);
    return () => clearInterval(t);
  }, [restaurantId, tab, load]);

  if (!restaurantId) return <div className="p-6 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-blue-500" /></div>;

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "requests", label: "Requests", icon: <Inbox className="w-4 h-4" />, count: counts.requests },
    { key: "upcoming", label: "Upcoming", icon: <CalendarDays className="w-4 h-4" />, count: counts.upcoming },
    { key: "history", label: "History", icon: <History className="w-4 h-4" /> },
    { key: "blocks", label: "Blocked tables", icon: <Ban className="w-4 h-4" /> },
    { key: "settings", label: "Settings", icon: <Settings2 className="w-4 h-4" /> },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-5 pb-28">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><CalendarCheck className="w-6 h-6 text-emerald-600" /> Reservations</h1>
          <p className="text-sm text-gray-500 mt-1">Customers reserve with the reservation QR code. Accept or refuse each request, the customer gets an email.</p>
        </div>
        <Link href="/dashboard/qrcode" className="text-sm font-semibold text-blue-600 hover:text-blue-700">Reservation QR code</Link>
      </div>

      {!emailReady && (
        <div className="flex items-start gap-2 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900" id="email-warning">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Sending emails isn&apos;t set up yet. Your answers are saved, but customers don&apos;t get an email until it is set up. Until then you can call or write to them, their phone and email are on each reservation.</span>
        </div>
      )}
      {settings && !settings.enabled && (
        <div className="flex items-start gap-2 rounded-2xl bg-gray-100 border border-gray-200 px-4 py-3 text-sm text-gray-700">
          <Ban className="w-4 h-4 mt-0.5 shrink-0" /> Online reservations are off. Turn them on under Settings.
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} data-tab={t.key} onClick={() => { setList(null); setTab(t.key); }}
            className={`shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-xl ${tab === t.key ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            {t.icon} {t.label}
            {!!t.count && <span className={`text-[11px] font-bold rounded-full px-1.5 ${tab === t.key ? "bg-white/20" : t.key === "requests" ? "bg-red-500 text-white" : "bg-gray-100"}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === "blocks" ? <Blocks restaurantId={restaurantId} />
        : tab === "settings" ? (settings && <SettingsForm restaurantId={restaurantId} settings={settings} onSaved={setSettings} />)
        : <ReservationList tab={tab} list={list} restaurantId={restaurantId} onChanged={() => load(tab)} />}
    </div>
  );
}

// ── Lists ────────────────────────────────────────────────────────────────────

function ReservationList({ tab, list, restaurantId, onChanged }: { tab: Tab; list: Reservation[] | null; restaurantId: string; onChanged: () => void }) {
  const groups = useMemo(() => {
    const out: { day: string; items: Reservation[] }[] = [];
    for (const r of list ?? []) {
      const day = fDay.format(new Date(r.startAt));
      const last = out[out.length - 1];
      if (last?.day === day) last.items.push(r); else out.push({ day, items: [r] });
    }
    return out;
  }, [list]);
  if (!list) return <div className="py-16 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-blue-500" /></div>;
  if (!list.length) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
        {tab === "requests" ? "No requests waiting. New ones show here, this page checks every 30 seconds." : tab === "upcoming" ? "No upcoming reservations." : "No reservations in the last 60 days."}
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.day}>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{g.day}</h2>
          <ul className="space-y-2">
            {g.items.map((r) => <ReservationCard key={r.id} r={r} tab={tab} restaurantId={restaurantId} onChanged={onChanged} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}

function StatusPill({ r }: { r: Reservation }) {
  const [now] = useState(() => Date.now());
  const past = Date.parse(r.endAt) < now;
  const [label, cls] = r.status === "pending" ? (past ? ["No answer", "bg-gray-100 text-gray-600"] : ["Waiting", "bg-amber-100 text-amber-800"])
    : r.status === "accepted" ? [past ? "Done" : "Accepted", "bg-green-100 text-green-800"]
    : r.status === "refused" ? ["Refused", "bg-red-100 text-red-700"] : ["Cancelled", "bg-gray-200 text-gray-700"];
  return <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${cls}`}>{label}</span>;
}

type Action = "accept" | "refuse" | "cancel" | "table";
interface ChoiceTable { id: string; label: string; seats: number; minGuests: number; areaName: string; status: "free" | "taken" | "blocked" | "too-small" | "too-few" | "not-reservable"; blockReason?: string }

function ReservationCard({ r, tab, restaurantId, onChanged }: { r: Reservation; tab: Tab; restaurantId: string; onChanged: () => void }) {
  const [open, setOpen] = useState<Action | null>(null);
  const start = new Date(r.startAt), end = new Date(r.endAt);
  const btn = "inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-xl px-4 py-2";
  return (
    <li className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4" data-reservation={r.name}>
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-20 shrink-0">
          <div className="text-lg font-bold text-gray-900 tabular-nums">{fTime.format(start)}</div>
          <div className="text-[11px] text-gray-500">until {fTime.format(end)}</div>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{r.name}</span>
            <StatusPill r={r} />
            <span className="inline-flex items-center gap-1 text-sm text-gray-700"><Users className="w-3.5 h-3.5" /> {r.guests}</span>
            {r.tableId ? <span className="text-sm font-semibold text-gray-800">Table {r.tableLabel}</span>
              : <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-blue-50 text-blue-700" data-no-table>No table yet</span>}
            {r.tableId && r.areaName && <span className="text-xs text-gray-500">{r.areaName}</span>}
          </div>
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 text-blue-600 hover:underline"><Phone className="w-3.5 h-3.5" /> {r.phone}</a>
            <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 text-blue-600 hover:underline break-all"><Mail className="w-3.5 h-3.5" /> {r.email}</a>
          </div>
          {r.note && <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-2.5 py-1.5">&quot;{r.note}&quot;</p>}
          <p className="text-[11px] text-gray-400">
            Asked {fShort.format(new Date(r.requestedAt))}
            {r.decidedAt && ` · ${r.status === "accepted" ? "accepted" : r.status === "refused" ? "refused" : "cancelled"} ${fShort.format(new Date(r.decidedAt))}${r.decidedBy ? ` by ${r.decidedBy}` : ""}`}
            {r.emailSent === false && " · no email was sent"}
          </p>
          {r.message && <p className="text-xs text-gray-500">Message to the customer: &quot;{r.message}&quot;</p>}
        </div>
        {(tab === "requests" || tab === "upcoming") && (
          <div className="flex gap-2 w-full sm:w-auto flex-wrap">
            {tab === "requests" ? (
              <>
                <button type="button" onClick={() => setOpen("accept")} data-action="accept" className={`${btn} flex-1 sm:flex-none text-white bg-green-600 hover:bg-green-700`}><Check className="w-4 h-4" /> Accept</button>
                <button type="button" onClick={() => setOpen("refuse")} data-action="refuse" className={`${btn} flex-1 sm:flex-none text-red-600 border border-red-200 hover:bg-red-50`}><X className="w-4 h-4" /> Refuse</button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setOpen("table")} data-action="table" className={`${btn} flex-1 sm:flex-none text-gray-700 border border-gray-200 hover:bg-gray-50`}><Armchair className="w-4 h-4" /> {r.tableId ? "Change table" : "Set a table"}</button>
                <button type="button" onClick={() => setOpen("cancel")} data-action="cancel" className={`${btn} flex-1 sm:flex-none text-red-600 border border-red-200 hover:bg-red-50`}><X className="w-4 h-4" /> Cancel</button>
              </>
            )}
          </div>
        )}
      </div>
      {open && <AnswerDialog r={r} action={open} restaurantId={restaurantId} onClose={() => setOpen(null)} onDone={() => { setOpen(null); onChanged(); }} />}
    </li>
  );
}

const STATUS_WHY: Record<ChoiceTable["status"], string> = {
  free: "", taken: "has a reservation then", blocked: "blocked then",
  "too-small": "too small", "too-few": "needs more persons", "not-reservable": "not for reservations",
};

/** The window for accept, refuse, cancel and change table: an optional message, then save and email */
function AnswerDialog({ r, action, restaurantId, onClose, onDone }: { r: Reservation; action: Action; restaurantId: string; onClose: () => void; onDone: () => void }) {
  const chooses = action === "accept" || action === "table";
  const [tables, setTables] = useState<ChoiceTable[] | null>(chooses ? null : []);
  const [tableId, setTableId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!chooses) return;
    void fetch(`/api/restaurants/${restaurantId}/reservations?tablesFor=${encodeURIComponent(r.id)}`).then((x) => (x.ok ? x.json() : null)).then((d) => {
      setTables(d?.tables ?? []);
      // Change table: start with the table it has now. Accept: the requested table if still free, else the best free one, else no table.
      setTableId(action === "table" ? r.tableId ?? "" : d?.suggested ?? "");
    }).catch(() => setTables([]));
  }, [chooses, restaurantId, r.id, r.tableId, action]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [busy, onClose]);

  const sendsEmail = action !== "table" || notify;
  async function go() {
    setBusy(true);
    const body: Record<string, unknown> = { id: r.id, action, message: sendsEmail ? message : "" };
    if (chooses) body.tableId = tableId || null;
    if (action === "table") body.notify = notify;
    const res = await fetch(`/api/restaurants/${restaurantId}/reservations`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { toast.error(d?.error ?? "Could not save"); return; }
    const verb = action === "accept" ? "Accepted" : action === "refuse" ? "Refused" : action === "cancel" ? "Cancelled" : "Table saved";
    if (d.emailSent === null) toast.success(`${verb}. No email sent`);
    else if (d.emailSent) toast.success(`${verb}. Email sent to ${r.email}`);
    else toast(`${verb}. No email was sent (${d.emailError ?? "email isn't set up"}). Let them know by phone: ${r.phone}`, { icon: "⚠️", duration: 8000 });
    onDone();
  }

  const title = action === "accept" ? `Accept ${r.name}'s reservation` : action === "refuse" ? `Refuse ${r.name}'s reservation`
    : action === "cancel" ? `Cancel ${r.name}'s reservation` : `Table for ${r.name}`;
  const intro = action === "accept" ? "They get an email that their table is confirmed."
    : action === "refuse" ? "They get an email that you can't take this reservation."
    : action === "cancel" ? "They get an email that the reservation was cancelled." : "Choose another table for this reservation.";
  const placeholder = action === "accept" ? "e.g. We saved you a table by the window." : action === "refuse" ? "e.g. We're fully booked that evening, sorry."
    : action === "cancel" ? "e.g. We have to close that evening, sorry." : "e.g. We moved you to a bigger table.";
  const goLabel = action === "accept" ? "Accept and send email" : action === "refuse" ? "Refuse and send email" : action === "cancel" ? "Cancel and send email" : notify ? "Save and send email" : "Save";
  const goCls = action === "accept" ? "bg-green-600 hover:bg-green-700" : action === "table" ? "bg-gray-900 hover:bg-gray-800" : "bg-red-600 hover:bg-red-700";
  const unchanged = action === "table" && (tableId || null) === (r.tableId || null);
  const free = (tables ?? []).filter((t) => t.status !== "taken" && t.status !== "blocked");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => !busy && onClose()} role="dialog" aria-modal="true" aria-label={title} data-dialog={action}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="font-bold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{fDay.format(new Date(r.startAt))}, {fTime.format(new Date(r.startAt))} · {r.guests} person{r.guests === 1 ? "" : "s"}</p>
            </div>
            <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"><X className="w-5 h-5" /></button>
          </div>
          <p className="text-sm text-gray-700">{intro}</p>

          {chooses && (
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-1.5">Table</div>
              {!tables ? <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div> : (
                <div className="space-y-1.5" role="radiogroup">
                  {action === "accept" && r.tableId && (
                    <p className="text-xs text-gray-500">They asked for table {r.tableLabel}{tables.find((t) => t.id === r.tableId && t.status === "free") ? "." : ", it isn't free anymore."}</p>
                  )}
                  {action === "accept" && !r.tableId && <p className="text-xs text-gray-500">They didn&apos;t pick a table. Choose one for them.</p>}
                  {!free.length && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">No table is free at that time. You can still accept and set up a table for them, or add one on the <Link href="/dashboard/floor-plan" className="font-semibold underline">Floor plan</Link>.</p>}
                  <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto">
                    {tables.map((t) => {
                      const off = t.status === "taken" || t.status === "blocked";
                      const why = t.status === "blocked" && t.blockReason ? `blocked: ${t.blockReason}` : STATUS_WHY[t.status];
                      return (
                        <button key={t.id} type="button" role="radio" aria-checked={tableId === t.id} disabled={off} onClick={() => setTableId(t.id)} data-table={t.label}
                          className={`text-left rounded-xl border px-3 py-2 text-sm ${tableId === t.id ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20" : "border-gray-200 hover:bg-gray-50"} disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white`}>
                          <div className="font-semibold text-gray-900">Table {t.label} <span className="font-normal text-gray-500">· {t.seats} seats</span></div>
                          <div className="text-[11px] text-gray-500 truncate">{t.areaName}{why ? ` · ${why}` : ""}</div>
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" role="radio" aria-checked={tableId === ""} onClick={() => setTableId("")} data-table=""
                    className={`w-full text-left rounded-xl border px-3 py-2 text-sm ${tableId === "" ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20" : "border-gray-200 hover:bg-gray-50"}`}>
                    <div className="font-semibold text-gray-900">No specific table</div>
                    <div className="text-[11px] text-gray-500">We&apos;ll set one up for them. You can choose a table later on Upcoming.</div>
                  </button>
                </div>
              )}
            </div>
          )}

          {action === "table" && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} id="dlg-notify" className="w-4 h-4 rounded" /> Send them an email about the new table
            </label>
          )}

          {sendsEmail && (
            <label className="block">
              <span className="block text-xs font-semibold text-gray-500 mb-1">Do you want to add a message to the email? (optional)</span>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={500} data-message placeholder={placeholder} className={`${inputCls} resize-none`} />
            </label>
          )}

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} disabled={busy} className="text-sm font-semibold text-gray-600 px-4 py-2.5 rounded-xl hover:bg-gray-100">{action === "cancel" ? "Keep it" : "Back"}</button>
            <button type="button" onClick={go} disabled={busy || (chooses && !tables) || unchanged} data-go
              className={`inline-flex items-center gap-2 text-sm font-semibold text-white px-4 py-2.5 rounded-xl disabled:opacity-40 ${goCls}`}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : sendsEmail ? <Mail className="w-4 h-4" /> : <Check className="w-4 h-4" />} {goLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Blocked tables ───────────────────────────────────────────────────────────

function Blocks({ restaurantId }: { restaurantId: string }) {
  const [data, setData] = useState<{ blocks: Block[]; tables: TableRef[] } | null>(null);
  const [pick, setPick] = useState<string[] | "all">([]);
  const [from, setFrom] = useState(() => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return localValue(d); });
  const [until, setUntil] = useState(() => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 4); return localValue(d); });
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const load = useCallback(async () => {
    setNow(Date.now());
    const d = await fetch(`/api/restaurants/${restaurantId}/table-blocks`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (d) setData(d);
  }, [restaurantId]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function block() {
    setBusy(true);
    const res = await fetch(`/api/restaurants/${restaurantId}/table-blocks`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableIds: pick, from: new Date(from).toISOString(), until: new Date(until).toISOString(), reason }),
    }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { toast.error(d?.error ?? "Could not block"); return; }
    toast.success("Blocked. Customers can't reserve these tables at that time.");
    setPick([]); setReason(""); void load();
  }
  async function unblock(b: Block) {
    const res = await fetch(`/api/restaurants/${restaurantId}/table-blocks?id=${encodeURIComponent(b.id)}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) { toast.error("Could not unblock"); return; }
    toast.success("Unblocked"); void load();
  }

  if (!data) return <div className="py-16 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-blue-500" /></div>;
  const toggle = (id: string) => setPick((p) => (p === "all" ? [id] : p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const chip = (on: boolean) => `text-sm font-semibold rounded-xl border px-3 py-1.5 ${on ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"}`;
  return (
    <div className="space-y-5">
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3" data-block-form>
        <h2 className="text-sm font-semibold text-gray-900">Block tables for a time</h2>
        {!data.tables.length ? (
          <p className="text-sm text-gray-500">No tables yet. Add them on <Link href="/dashboard/floor-plan" className="font-semibold text-blue-600">Floor plan &amp; tables</Link>.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setPick(pick === "all" ? [] : "all")} className={chip(pick === "all")} data-block-table="all">All tables</button>
              {data.tables.map((t) => (
                <button key={t.id} type="button" onClick={() => toggle(t.id)} className={chip(pick !== "all" && pick.includes(t.id))} data-block-table={t.label}>
                  {t.label} <span className="font-normal opacity-70">· {t.seats} · {t.areaName}</span>
                </button>
              ))}
            </div>
            <div className="flex items-end gap-3 flex-wrap">
              <label className="block"><span className="block text-xs font-semibold text-gray-500 mb-1">From</span>
                <input type="datetime-local" id="block-from" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} /></label>
              <label className="block"><span className="block text-xs font-semibold text-gray-500 mb-1">Until</span>
                <input type="datetime-local" id="block-until" value={until} min={from} onChange={(e) => setUntil(e.target.value)} className={inputCls} /></label>
              <label className="block flex-1 min-w-[12rem]"><span className="block text-xs font-semibold text-gray-500 mb-1">Reason (only you see it)</span>
                <input id="block-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={120} placeholder="e.g. private party" className={inputCls} /></label>
              <button type="button" onClick={block} disabled={busy || (pick !== "all" && !pick.length)} id="block-save"
                className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-gray-900 hover:bg-black rounded-xl px-4 py-2.5 disabled:opacity-40">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />} Block
              </button>
            </div>
          </>
        )}
      </section>
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Blocked</h2>
        {data.blocks.length ? (
          <ul className="space-y-2">
            {data.blocks.map((b) => {
              const live = Date.parse(b.from) <= now && Date.parse(b.until) > now, over = Date.parse(b.until) <= now;
              return (
                <li key={b.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 flex items-center gap-3 flex-wrap" data-block={b.labels.join(",")}>
                  <Ban className={`w-4 h-4 ${live ? "text-red-500" : "text-gray-400"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900">{b.tableIds === "all" ? "All tables" : b.labels.join(", ")}
                      <span className={`ml-2 text-[11px] font-semibold rounded-full px-2 py-0.5 ${live ? "bg-red-100 text-red-700" : over ? "bg-gray-100 text-gray-500" : "bg-amber-50 text-amber-800"}`}>{live ? "Now" : over ? "Ended" : "Coming"}</span>
                    </div>
                    <div className="text-xs text-gray-500">{fShort.format(new Date(b.from))} to {fShort.format(new Date(b.until))}{b.reason ? ` · ${b.reason}` : ""}{b.by ? ` · by ${b.by}` : ""}</div>
                  </div>
                  <button type="button" onClick={() => unblock(b)} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50"><Trash2 className="w-3.5 h-3.5" /> Unblock</button>
                </li>
              );
            })}
          </ul>
        ) : <p className="text-sm text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200 p-6 text-center">No blocked tables.</p>}
      </section>
    </div>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────

function SettingsForm({ restaurantId, settings, onSaved }: { restaurantId: string; settings: Settings; onSaved: (s: Settings) => void }) {
  const [s, setS] = useState(settings);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(s) !== JSON.stringify(settings);
  async function save() {
    setBusy(true);
    const res = await fetch(`/api/restaurants/${restaurantId}/reservations`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: s }) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { toast.error(d?.error ?? "Could not save"); return; }
    onSaved(d.settings); toast.success("Saved");
  }
  const sel = (label: string, key: "durationMin" | "stepMin" | "daysAhead" | "noticeMin", options: [number, string][]) => (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-500 mb-1">{label}</span>
      <select id={`set-${key}`} value={Number(s[key])} onChange={(e) => setS({ ...s, [key]: Number(e.target.value) })} className={inputCls}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5 max-w-2xl">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <div className="font-semibold text-gray-900 text-sm">Online reservations</div>
          <p className="text-xs text-gray-500 mt-0.5">{s.enabled ? "On. Customers can ask for a table with the reservation QR code and under More on the menu." : "Off. The reservation page says you don't take reservations online."}</p>
        </div>
        <button type="button" role="switch" aria-checked={s.enabled} id="set-enabled" onClick={() => setS({ ...s, enabled: !s.enabled })}
          className={`relative w-14 h-8 shrink-0 rounded-full transition-colors ${s.enabled ? "bg-emerald-600" : "bg-gray-300"}`}>
          <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${s.enabled ? "translate-x-6" : ""}`} />
        </button>
      </div>
      <div>
        <div className="font-semibold text-gray-900 text-sm mb-2">How customers choose a table</div>
        <div className="grid sm:grid-cols-2 gap-2" role="radiogroup">
          {([[true, "They pick it on the floor plan", "Customers see your floor plan and choose a free table. You can still change it when you accept."],
            [false, "They only fill in the form", "Customers send the time, persons and their details. You choose the table when you accept."]] as const).map(([v, l, h]) => (
            <button key={String(v)} type="button" role="radio" aria-checked={s.customerPicksTable === v} data-picks={String(v)} onClick={() => setS({ ...s, customerPicksTable: v })}
              className={`text-left rounded-xl border px-3.5 py-3 ${s.customerPicksTable === v ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20" : "border-gray-200 hover:bg-gray-50"}`}>
              <div className="text-sm font-semibold text-gray-900">{l}</div>
              <div className="text-xs text-gray-500 mt-0.5">{h}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {sel("A reservation keeps the table for", "durationMin", [[60, "1 hour"], [90, "1 hour 30 min"], [120, "2 hours"], [150, "2 hours 30 min"], [180, "3 hours"], [240, "4 hours"]])}
        {sel("Times customers can choose", "stepMin", [[15, "Every 15 minutes"], [30, "Every 30 minutes"], [60, "Every hour"]])}
        {sel("How far ahead", "daysAhead", [[7, "1 week"], [14, "2 weeks"], [30, "1 month"], [60, "2 months"], [90, "3 months"], [180, "6 months"]])}
        {sel("At least this long before", "noticeMin", [[0, "Any time"], [30, "30 minutes"], [60, "1 hour"], [120, "2 hours"], [240, "4 hours"], [1440, "1 day"]])}
      </div>
      <p className="text-xs text-gray-500">The times follow your <Link href="/dashboard/exceptions" className="font-semibold text-blue-600">open hours and holidays</Link>, the last one is an hour before closing. Which tables can be reserved, and for how many persons at least, is set per table on the <Link href="/dashboard/floor-plan" className="font-semibold text-blue-600">Floor plan</Link>.</p>
      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={busy || !dirty} id="set-save"
          className="inline-flex items-center gap-2 text-sm font-semibold text-white px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 disabled:opacity-40">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save settings
        </button>
      </div>
    </section>
  );
}
