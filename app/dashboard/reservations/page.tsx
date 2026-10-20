"use client";

// Reservations: requests to accept or refuse (the customer gets an email), upcoming reservations, history,
// blocked tables (can't be reserved for a time) and the settings.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarCheck, Check, X, Loader2, Phone, Mail, Users, Ban, Settings2, History, Inbox, CalendarDays, AlertTriangle, Trash2, Armchair, BellRing, Plus, PhoneCall, PhoneOff } from "lucide-react";
import toast from "react-hot-toast";
import { BEFORE_OPTIONS, DEFAULT_CUSTOMER_TEXT, DEFAULT_STAFF_TEXT, beforeLabel, type Recipients, type ReminderSpec } from "@/lib/reminder-specs";

type Status = "pending" | "accepted" | "refused" | "cancelled";
interface Reservation {
  id: string; status: Status; startAt: string; endAt: string; guests: number; tableId: string | null; tableLabel: string; areaName: string;
  name: string; email: string; phone: string; note: string; requestedAt: string; decidedAt: string | null; decidedBy: string | null; message: string; emailSent: boolean | null;
  timeZone: string; call?: { result: "confirmed" | "no-answer"; at: string; by: string | null; note: string } | null; cancelledBy?: "customer" | null; madeBy?: "staff" | null;
  reminders?: ReminderRow[];
}
interface ReminderRow {
  id: string; kind: "staff" | "customer"; beforeMin: number | null; at: string; text: string; to: Recipients;
  status: "scheduled" | "sent" | "done" | "skipped"; firedAt: string | null; result: string | null; emailSent: boolean | null; emailError: string | null; doneBy: string | null;
}
interface Team { me: string; roles: { id: string; name: string }[]; people: { id: string; name: string; owner: boolean }[] }
interface Settings { enabled: boolean; durationMin: number; stepMin: number; daysAhead: number; noticeMin: number; customerPicksTable: boolean; reminders: ReminderSpec[] }
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
  const [team, setTeam] = useState<Team | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void fetch("/api/dashboard/access").then((r) => r.json()).then((a) => setRestaurantId(a?.restaurantId ?? null)).catch(() => {});
  }, []);

  const load = useCallback(async (view: Tab) => {
    if (!restaurantId) return;
    const v = view === "blocks" || view === "settings" ? "requests" : view;
    const d = await fetch(`/api/restaurants/${restaurantId}/reservations?view=${v}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!d) { toast.error("Could not load the reservations"); return; }
    if (view === v) setList(d.reservations);
    setCounts(d.counts); setSettings(d.settings); setEmailReady(!!d.emailReady); if (d.team) setTeam(d.team);
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
        <div className="flex items-center gap-3">
          <Link href="/dashboard/qrcode" className="text-sm font-semibold text-blue-600 hover:text-blue-700">Reservation QR code</Link>
          <button type="button" onClick={() => setCreating(true)} id="new-reservation"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl px-4 py-2.5 shadow-sm">
            <Plus className="w-4 h-4" /> New reservation
          </button>
        </div>
      </div>
      {creating && settings && (
        <NewReservationDialog restaurantId={restaurantId} settings={settings} ctx={{ team, defaults: settings.reminders, emailReady }}
          onClose={() => setCreating(false)} onDone={() => { setCreating(false); setList(null); if (tab === "upcoming") void load("upcoming"); else setTab("upcoming"); }} />
      )}

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
        : tab === "settings" ? (settings && <SettingsForm restaurantId={restaurantId} settings={settings} team={team} onSaved={setSettings} />)
        : <ReservationList tab={tab} list={list} restaurantId={restaurantId} ctx={{ team, defaults: settings?.reminders ?? [], emailReady }} onChanged={() => load(tab)} />}
    </div>
  );
}

// ── Lists ────────────────────────────────────────────────────────────────────

interface Ctx { team: Team | null; defaults: ReminderSpec[]; emailReady: boolean }

function ReservationList({ tab, list, restaurantId, ctx, onChanged }: { tab: Tab; list: Reservation[] | null; restaurantId: string; ctx: Ctx; onChanged: () => void }) {
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
            {g.items.map((r) => <ReservationCard key={r.id} r={r} tab={tab} restaurantId={restaurantId} ctx={ctx} onChanged={onChanged} />)}
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

type Action = "accept" | "refuse" | "cancel" | "table" | "reminders";
interface ChoiceTable { id: string; label: string; seats: number; minGuests: number; areaName: string; status: "free" | "taken" | "blocked" | "too-small" | "too-few" | "not-reservable"; blockReason?: string }

function ReservationCard({ r, tab, restaurantId, ctx, onChanged }: { r: Reservation; tab: Tab; restaurantId: string; ctx: Ctx; onChanged: () => void }) {
  const [open, setOpen] = useState<Action | null>(null);
  const waiting = (r.reminders ?? []).filter((m) => m.status === "scheduled");
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
            {r.madeBy === "staff"
              ? <>Made for the customer {fShort.format(new Date(r.requestedAt))}{r.decidedBy ? ` by ${r.decidedBy}` : ""}{r.status === "cancelled" && r.decidedAt ? ` · cancelled ${fShort.format(new Date(r.decidedAt))}` : ""}</>
              : <>Asked {fShort.format(new Date(r.requestedAt))}
                {r.decidedAt && ` · ${r.status === "accepted" ? "accepted" : r.status === "refused" ? "refused" : "cancelled"} ${fShort.format(new Date(r.decidedAt))}${r.decidedBy ? ` by ${r.decidedBy}` : ""}`}</>}
            {r.emailSent === false && " · no email was sent"}
          </p>
          {r.message && <p className="text-xs text-gray-500">Message to the customer: &quot;{r.message}&quot;</p>}
          {r.cancelledBy === "customer" && <p className="text-xs font-medium text-gray-600">Cancelled by the customer with the link in the reminder email</p>}
          {r.call && (
            <p className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 ${r.call.result === "confirmed" ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`} data-call={r.call.result}>
              {r.call.result === "confirmed" ? <PhoneCall className="w-3 h-3" /> : <PhoneOff className="w-3 h-3" />}
              {r.call.result === "confirmed" ? "Confirmed by phone" : "Called, no answer"} {fShort.format(new Date(r.call.at))}{r.call.by ? ` by ${r.call.by}` : ""}{r.call.note ? `: "${r.call.note}"` : ""}
            </p>
          )}
          {tab === "upcoming" && (
            <p className="text-xs text-gray-500 flex items-center gap-1" data-reminder-summary>
              <BellRing className="w-3 h-3" />
              {waiting.length ? waiting.map((m) => reminderText(m, ctx.team)).join(" · ") : "No reminders"}
            </p>
          )}
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
                <button type="button" onClick={() => setOpen("reminders")} data-action="reminders" className={`${btn} flex-1 sm:flex-none text-gray-700 border border-gray-200 hover:bg-gray-50`}><BellRing className="w-4 h-4" /> Reminders{waiting.length ? ` (${waiting.length})` : ""}</button>
                <button type="button" onClick={() => setOpen("table")} data-action="table" className={`${btn} flex-1 sm:flex-none text-gray-700 border border-gray-200 hover:bg-gray-50`}><Armchair className="w-4 h-4" /> {r.tableId ? "Change table" : "Set a table"}</button>
                <button type="button" onClick={() => setOpen("cancel")} data-action="cancel" className={`${btn} flex-1 sm:flex-none text-red-600 border border-red-200 hover:bg-red-50`}><X className="w-4 h-4" /> Cancel</button>
              </>
            )}
          </div>
        )}
      </div>
      {open === "reminders" ? <RemindersDialog r={r} restaurantId={restaurantId} ctx={ctx} onClose={() => setOpen(null)} onDone={() => { setOpen(null); onChanged(); }} />
        : open && <AnswerDialog r={r} action={open} restaurantId={restaurantId} ctx={ctx} onClose={() => setOpen(null)} onDone={() => { setOpen(null); onChanged(); }} />}
    </li>
  );
}

const STATUS_WHY: Record<ChoiceTable["status"], string> = {
  free: "", taken: "has a reservation then", blocked: "blocked then",
  "too-small": "too small", "too-few": "needs more persons", "not-reservable": "not for reservations",
};

/** The window for accept, refuse, cancel and change table: an optional message, then save and email */
function AnswerDialog({ r, action, restaurantId, ctx, onClose, onDone }: { r: Reservation; action: Action; restaurantId: string; ctx: Ctx; onClose: () => void; onDone: () => void }) {
  // Accept: the reminders from Settings, changeable here
  const [reminders, setReminders] = useState<ReminderSpec[]>(() => ctx.defaults.map((m) => forMe(m, ctx.team)));
  const [editRem, setEditRem] = useState(false);
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
    if (action === "accept") body.reminders = reminders;
    const res = await fetch(`/api/restaurants/${restaurantId}/reservations`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { toast.error(d?.error ?? "Could not save"); return; }
    const verb = action === "accept" ? "Accepted" : action === "refuse" ? "Refused" : action === "cancel" ? "Cancelled" : "Table saved";
    if (d.tooLate) toast(`${d.tooLate} reminder${d.tooLate === 1 ? " was" : "s were"} not set: ${d.tooLate === 1 ? "its" : "their"} time has already passed`, { icon: "ℹ️", duration: 6000 });
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
      <div className={`bg-white w-full ${action === "accept" ? "sm:max-w-lg" : "sm:max-w-md"} rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
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

          {action === "accept" && (
            <div data-accept-reminders>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-semibold text-gray-500">Reminders</span>
                {!editRem && <button type="button" onClick={() => setEditRem(true)} data-change-reminders className="text-xs font-semibold text-blue-600 hover:text-blue-700">Change</button>}
              </div>
              {editRem ? <ReminderEditor value={reminders} onChange={setReminders} team={ctx.team} r={r} emailReady={ctx.emailReady} /> : (
                <ul className="space-y-0.5">
                  {!reminders.length && <li className="text-xs text-gray-500">No reminders</li>}
                  {reminders.map((m, i) => <li key={i} className="text-xs text-gray-600 flex items-center gap-1.5"><BellRing className="w-3 h-3 text-gray-400" /> {reminderText({ ...m, at: m.at ?? "", to: m.to ?? { owner: false, roles: [], users: [] } }, ctx.team)}</li>)}
                </ul>
              )}
            </div>
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

// ── Reminders ────────────────────────────────────────────────────────────────

/** A reminder from Settings for "the person who accepts": that's you now */
function forMe(m: ReminderSpec, team: Team | null): ReminderSpec {
  if (!m.me || !team) return { ...m };
  const { me: _m, ...rest } = m; void _m;
  return { ...rest, to: withMe(m.to ?? { owner: false, roles: [], users: [] }, team) };
}
/** Adds you: the owner chip when you're the owner, else your name */
function withMe(to: Recipients, team: Team | null): Recipients {
  if (!team) return to;
  return team.people.some((p) => p.owner && p.id === team.me) ? { ...to, owner: true } : { ...to, users: [...new Set([...to.users, team.me])] };
}

function whoText(to: Recipients | undefined, team: Team | null, me?: boolean): string {
  if (!to) return "";
  const names = [
    ...(me ? ["who accepts"] : []),
    ...(to.owner ? ["Owner"] : []),
    ...to.roles.map((id) => team?.roles.find((r) => r.id === id)?.name ?? "a role"),
    ...to.users.map((id) => (id === team?.me ? "you" : team?.people.find((p) => p.id === id)?.name ?? "someone")),
  ];
  return names.join(", ");
}

function reminderText(m: Pick<ReminderRow, "kind" | "beforeMin" | "at" | "to">, team: Team | null): string {
  const when = m.beforeMin !== null ? `${beforeLabel(m.beforeMin)} before` : `on ${fShort.format(new Date(m.at))}`;
  if (m.kind === "customer") return `Email to the customer ${when}`;
  const who = whoText(m.to, team);
  return `Notification ${when}${who ? ` for ${who}` : ""}`;
}

const PLACEHOLDERS = "{name}, {day}, {time}, {guests}, {table}, {phone}";

/** Reminders of one reservation (r) or the suggested ones in Settings (no r) */
function ReminderEditor({ value, onChange, team, r, emailReady }: { value: ReminderSpec[]; onChange: (v: ReminderSpec[]) => void; team: Team | null; r?: Reservation; emailReady: boolean }) {
  const [now] = useState(() => Date.now());
  const set = (i: number, patch: Partial<ReminderSpec>) => onChange(value.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const none: Recipients = { owner: false, roles: [], users: [] };
  const add = () => onChange([...value, { kind: "staff", beforeMin: 1440, text: DEFAULT_STAFF_TEXT, to: r ? withMe(none, team) : none, ...(r ? {} : { me: true }) }]);
  const chip = (on: boolean, label: string, toggle: () => void, key: string) => (
    <button key={key} type="button" onClick={toggle} aria-pressed={on} data-who={label}
      className={`text-xs font-medium rounded-full px-2.5 py-1 border ${on ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"}`}>{label}</button>
  );
  const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <div className="space-y-2" data-reminder-editor>
      {!value.length && <p className="text-xs text-gray-500">No reminders.</p>}
      {value.map((m, i) => {
        const to = m.to ?? { owner: false, roles: [], users: [] };
        const at = r ? (m.beforeMin !== null ? new Date(Date.parse(r.startAt) - m.beforeMin * 60_000) : m.at ? new Date(m.at) : null) : null;
        const late = !!at && at.getTime() <= now;
        const nobody = m.kind === "staff" && !m.me && !to.owner && !to.roles.length && !to.users.length;
        return (
          <div key={i} className="rounded-xl border border-gray-200 p-3 space-y-2.5 bg-white" data-reminder={i}>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex rounded-lg bg-gray-100 p-0.5" role="radiogroup">
                {([["staff", "Notification for us"], ["customer", "Email to the customer"]] as const).map(([k, l]) => (
                  <button key={k} type="button" role="radio" aria-checked={m.kind === k} data-kind={k}
                    onClick={() => k !== m.kind && set(i, k === "staff"
                      ? { kind: "staff", text: m.text === DEFAULT_CUSTOMER_TEXT ? DEFAULT_STAFF_TEXT : m.text, to: r ? withMe(none, team) : none, ...(r ? {} : { me: true }) }
                      : { kind: "customer", text: m.text === DEFAULT_STAFF_TEXT ? DEFAULT_CUSTOMER_TEXT : m.text, to: undefined, me: undefined })}
                    className={`text-xs font-semibold rounded-md px-2.5 py-1 ${m.kind === k ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>{l}</button>
                ))}
              </div>
              <select value={m.beforeMin ?? "date"} data-when
                onChange={(e) => set(i, e.target.value === "date"
                  ? { beforeMin: null, at: (r ? new Date(Date.parse(r.startAt) - 86_400_000) : new Date()).toISOString() }
                  : { beforeMin: Number(e.target.value), at: null })}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700">
                {BEFORE_OPTIONS.map((b) => <option key={b} value={b}>{beforeLabel(b)} before</option>)}
                {r && <option value="date">On a date I choose</option>}
              </select>
              {m.beforeMin === null && m.at && (
                <input type="datetime-local" value={localValue(new Date(m.at))} data-at
                  onChange={(e) => e.target.value && set(i, { at: new Date(e.target.value).toISOString() })}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700" />
              )}
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove this reminder" data-remove
                className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
            </div>
            <textarea value={m.text} onChange={(e) => set(i, { text: e.target.value })} rows={2} maxLength={500} data-text
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            <p className="text-[11px] text-gray-400 -mt-1">You can use {PLACEHOLDERS}. {"{day}"} becomes &quot;today&quot;, &quot;tomorrow&quot; or the date.{m.kind === "customer" ? " A link to cancel the reservation is added at the end." : ""}</p>
            {m.kind === "staff" && (
              <div>
                <div className="text-[11px] font-semibold text-gray-500 mb-1">Who gets it</div>
                <div className="flex flex-wrap gap-1.5">
                  {!r && chip(!!m.me, "Who accepts", () => set(i, { me: !m.me }), "me")}
                  {chip(to.owner, team?.people.some((p) => p.owner && p.id === team.me) ? "Owner (you)" : "Owner", () => set(i, { to: { ...to, owner: !to.owner } }), "owner")}
                  {(team?.roles ?? []).map((ro) => chip(to.roles.includes(ro.id), ro.name, () => set(i, { to: { ...to, roles: toggleIn(to.roles, ro.id) } }), `r-${ro.id}`))}
                  {(team?.people ?? []).filter((p) => !p.owner).map((p) => chip(to.users.includes(p.id), p.id === team?.me ? `${p.name} (you)` : p.name, () => set(i, { to: { ...to, users: toggleIn(to.users, p.id) } }), `u-${p.id}`))}
                </div>
                {nobody && <p className="text-[11px] text-amber-700 mt-1">Nobody chosen: you get it.</p>}
              </div>
            )}
            {m.kind === "customer" && !emailReady && <p className="text-[11px] text-amber-700">Sending emails isn&apos;t set up yet, so this email can&apos;t go out.</p>}
            {at && (late
              ? <p className="text-[11px] font-medium text-amber-700" data-late>Too late: that time has already passed, this reminder won&apos;t be set.</p>
              : <p className="text-[11px] text-gray-500" data-goes>Goes off {fShort.format(at)}</p>)}
          </div>
        );
      })}
      <button type="button" onClick={add} data-add-reminder className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"><Plus className="w-3.5 h-3.5" /> Add a reminder</button>
    </div>
  );
}

/** The reminders of an accepted reservation: the ones already sent, and the waiting ones to change */
function RemindersDialog({ r, restaurantId, ctx, onClose, onDone }: { r: Reservation; restaurantId: string; ctx: Ctx; onClose: () => void; onDone: () => void }) {
  const rows = r.reminders ?? [];
  const done = rows.filter((m) => m.status !== "scheduled");
  const [value, setValue] = useState<ReminderSpec[]>(() => rows.filter((m) => m.status === "scheduled").map((m) => ({ id: m.id, kind: m.kind, beforeMin: m.beforeMin, at: m.beforeMin === null ? m.at : null, text: m.text, ...(m.kind === "staff" ? { to: m.to } : {}) })));
  const [start] = useState(() => JSON.stringify(value));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [busy, onClose]);

  async function save() {
    setBusy(true);
    const res = await fetch(`/api/restaurants/${restaurantId}/reservations`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, action: "reminders", reminders: value }) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { toast.error(d?.error ?? "Could not save"); return; }
    toast.success("Reminders saved");
    if (d.tooLate) toast(`${d.tooLate} reminder${d.tooLate === 1 ? " was" : "s were"} not set: the time has already passed`, { icon: "ℹ️" });
    onDone();
  }

  const doneText = (m: ReminderRow) => {
    const what = reminderText(m, ctx.team);
    if (m.status === "skipped") return `${what}: not sent (${m.result ?? "skipped"})`;
    if (m.kind === "customer") return `${what}: ${m.emailSent ? "sent" : `not sent (${m.emailError ?? "email isn't set up"})`}${m.firedAt ? ` ${fShort.format(new Date(m.firedAt))}` : ""}`;
    return `${what}: ${m.firedAt ? `went off ${fShort.format(new Date(m.firedAt))}` : "went off"}${m.result ? `, ${m.result}${m.doneBy ? ` (${m.doneBy})` : ""}` : ", not answered yet"}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4" onClick={() => !busy && onClose()} role="dialog" aria-modal="true" aria-label="Reminders" data-dialog="reminders">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="font-bold text-gray-900">Reminders for {r.name}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{fDay.format(new Date(r.startAt))}, {fTime.format(new Date(r.startAt))} · {r.guests} person{r.guests === 1 ? "" : "s"}</p>
            </div>
            <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"><X className="w-5 h-5" /></button>
          </div>
          <p className="text-sm text-gray-600">A notification shows up here in the platform with the reservation, so you can call and confirm. An email reminds the customer and has a link to cancel.</p>
          {done.length > 0 && (
            <ul className="space-y-1" data-done-reminders>
              {done.map((m) => <li key={m.id} className="text-xs text-gray-500 flex items-start gap-1.5"><Check className="w-3.5 h-3.5 mt-px shrink-0" /> {doneText(m)}</li>)}
            </ul>
          )}
          <ReminderEditor value={value} onChange={setValue} team={ctx.team} r={r} emailReady={ctx.emailReady} />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} disabled={busy} className="text-sm font-semibold text-gray-600 px-4 py-2.5 rounded-xl hover:bg-gray-100">Back</button>
            <button type="button" onClick={save} disabled={busy || JSON.stringify(value) === start} data-go
              className="inline-flex items-center gap-2 text-sm font-semibold text-white px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 disabled:opacity-40">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save reminders
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

/** A reservation the restaurant makes for a customer (on the phone, at the door): accepted right away */
function NewReservationDialog({ restaurantId, settings, ctx, onClose, onDone }: { restaurantId: string; settings: Settings; ctx: Ctx; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState(() => {
    const d = new Date(); d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
    return { name: "", phone: "", email: "", note: "", guests: 2, when: localValue(d), durationMin: settings.durationMin };
  });
  const [tables, setTables] = useState<ChoiceTable[] | null>(null);
  const [tableId, setTableId] = useState("");
  const [notify, setNotify] = useState(true);
  const [reminders, setReminders] = useState<ReminderSpec[]>(() => ctx.defaults.map((m) => forMe(m, ctx.team)));
  const [editRem, setEditRem] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startIso = form.when && Number.isFinite(Date.parse(form.when)) ? new Date(form.when).toISOString() : null;

  // The tables at that time, for that many persons
  useEffect(() => {
    if (!startIso) return;
    let stop = false;
    void fetch(`/api/restaurants/${restaurantId}/reservations?tablesAt=${encodeURIComponent(startIso)}&guests=${form.guests}&durationMin=${form.durationMin}`)
      .then((x) => (x.ok ? x.json() : null)).then((d) => {
        if (stop || !d) return;
        setTables(d.tables ?? []);
        setTableId((cur) => (cur && (d.tables ?? []).some((t: ChoiceTable) => t.id === cur && t.status !== "taken" && t.status !== "blocked") ? cur : d.suggested ?? ""));
      }).catch(() => {});
    return () => { stop = true; };
  }, [restaurantId, startIso, form.guests, form.durationMin]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [busy, onClose]);

  const set = (patch: Partial<typeof form>) => { setForm((f) => ({ ...f, ...patch })); setError(null); };
  const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim());
  const pseudo: Reservation | null = startIso ? { id: "new", status: "accepted", startAt: startIso, endAt: startIso, guests: form.guests, tableId: tableId || null, tableLabel: "", areaName: "", name: form.name, email: form.email, phone: form.phone, note: "", requestedAt: "", decidedAt: null, decidedBy: null, message: "", emailSent: null, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } : null;

  async function save() {
    if (!startIso) { setError("Please choose a day and a time."); return; }
    setBusy(true); setError(null);
    const res = await fetch(`/api/restaurants/${restaurantId}/reservations`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, startAt: startIso, tableId: tableId || null, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, notify: notify && hasEmail, reminders: reminders.filter((m) => m.kind === "staff" || hasEmail) }),
    }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { setError(d?.error ?? "Could not save"); return; }
    if (d.emailSent === false) toast(`Reservation saved. No email was sent (${d.emailError ?? "email isn't set up"})`, { icon: "⚠️", duration: 7000 });
    else toast.success(d.emailSent ? `Reservation saved. Confirmation sent to ${form.email.trim()}` : "Reservation saved");
    if (d.tooLate) toast(`${d.tooLate} reminder${d.tooLate === 1 ? " was" : "s were"} not set: the time has already passed`, { icon: "ℹ️" });
    onDone();
  }

  const field = (label: string, key: "name" | "phone" | "email", type: string, placeholder: string, hint?: string) => (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-500 mb-1">{label}</span>
      <input id={`new-${key}`} type={type} value={form[key]} onChange={(e) => set({ [key]: e.target.value })} placeholder={placeholder} className={inputCls} />
      {hint && <span className="block text-[11px] text-gray-400 mt-0.5">{hint}</span>}
    </label>
  );
  const usable = (tables ?? []).filter((t) => t.status !== "taken" && t.status !== "blocked");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4" onClick={() => !busy && onClose()} role="dialog" aria-modal="true" aria-label="New reservation" data-dialog="new">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="font-bold text-gray-900">New reservation</h3>
              <p className="text-sm text-gray-500 mt-0.5">For a customer who called or came by. It&apos;s accepted right away.</p>
            </div>
            <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"><X className="w-5 h-5" /></button>
          </div>

          {field("Name", "name", "text", "e.g. Ardiana Krasniqi")}
          <div className="grid sm:grid-cols-2 gap-3">
            {field("Phone", "phone", "tel", "+355 69 …")}
            {field("Email (optional)", "email", "email", "name@example.com", "For the confirmation and the reminder emails")}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="block text-xs font-semibold text-gray-500 mb-1">Persons</span>
              <input id="new-guests" type="number" min={1} max={60} value={form.guests} onChange={(e) => { const n = Math.round(Number(e.target.value)); if (n >= 1 && n <= 60) set({ guests: n }); }} className={inputCls} />
            </label>
            <label className="block col-span-2 sm:col-span-1">
              <span className="block text-xs font-semibold text-gray-500 mb-1">Day and time</span>
              <input id="new-when" type="datetime-local" value={form.when} onChange={(e) => set({ when: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-gray-500 mb-1">Keep the table for</span>
              <select id="new-duration" value={form.durationMin} onChange={(e) => set({ durationMin: Number(e.target.value) })} className={inputCls}>
                {[60, 90, 120, 150, 180, 240, 300, 360].map((m) => <option key={m} value={m}>{m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} hour${m === 60 ? "" : "s"}`}</option>)}
              </select>
            </label>
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1.5">Table</div>
            {!tables ? <div className="py-3 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div> : (
              <div className="space-y-1.5" role="radiogroup">
                {!tables.length && <p className="text-xs text-gray-500">There is no floor plan yet. You can still save it with no specific table.</p>}
                {tables.length > 0 && !usable.length && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">No table is free at that time.</p>}
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                  {tables.map((t) => {
                    const off = t.status === "taken" || t.status === "blocked";
                    const why = t.status === "blocked" && t.blockReason ? `blocked: ${t.blockReason}` : STATUS_WHY[t.status];
                    return (
                      <button key={t.id} type="button" role="radio" aria-checked={tableId === t.id} disabled={off} onClick={() => setTableId(t.id)} data-table={t.label}
                        className={`text-left rounded-xl border px-3 py-2 text-sm ${tableId === t.id ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20" : "border-gray-200 hover:bg-gray-50"} disabled:opacity-40 disabled:cursor-not-allowed`}>
                        <div className="font-semibold text-gray-900">Table {t.label} <span className="font-normal text-gray-500">· {t.seats} seats</span></div>
                        <div className="text-[11px] text-gray-500 truncate">{t.areaName}{why ? ` · ${why}` : ""}</div>
                      </button>
                    );
                  })}
                </div>
                <button type="button" role="radio" aria-checked={tableId === ""} onClick={() => setTableId("")} data-table=""
                  className={`w-full text-left rounded-xl border px-3 py-2 text-sm ${tableId === "" ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20" : "border-gray-200 hover:bg-gray-50"}`}>
                  <div className="font-semibold text-gray-900">No specific table</div>
                  <div className="text-[11px] text-gray-500">Choose one later on Upcoming.</div>
                </button>
              </div>
            )}
          </div>

          <label className="block">
            <span className="block text-xs font-semibold text-gray-500 mb-1">Note (optional)</span>
            <input id="new-note" value={form.note} onChange={(e) => set({ note: e.target.value })} maxLength={300} placeholder="e.g. Birthday, needs a high chair" className={inputCls} />
          </label>

          <label className={`flex items-center gap-2 text-sm ${hasEmail ? "text-gray-700" : "text-gray-400"}`}>
            <input type="checkbox" checked={notify && hasEmail} disabled={!hasEmail} onChange={(e) => setNotify(e.target.checked)} id="new-notify" className="w-4 h-4" />
            Send them a confirmation email{!hasEmail ? " (add an email first)" : ""}
          </label>

          <div data-new-reminders>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold text-gray-500">Reminders</span>
              {!editRem && <button type="button" onClick={() => setEditRem(true)} className="text-xs font-semibold text-blue-600 hover:text-blue-700">Change</button>}
            </div>
            {editRem && pseudo ? <ReminderEditor value={reminders} onChange={setReminders} team={ctx.team} r={pseudo} emailReady={ctx.emailReady} /> : (
              <ul className="space-y-0.5">
                {!reminders.length && <li className="text-xs text-gray-500">No reminders</li>}
                {reminders.map((m, i) => (
                  <li key={i} className={`text-xs flex items-center gap-1.5 ${m.kind === "customer" && !hasEmail ? "text-gray-400 line-through" : "text-gray-600"}`}>
                    <BellRing className="w-3 h-3 text-gray-400" /> {reminderText({ ...m, at: m.at ?? "", to: m.to ?? { owner: false, roles: [], users: [] } }, ctx.team)}
                  </li>
                ))}
              </ul>
            )}
            {!hasEmail && reminders.some((m) => m.kind === "customer") && <p className="text-[11px] text-gray-400 mt-1">Emails to the customer need an email address.</p>}
          </div>

          {error && <p className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2" data-error><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} disabled={busy} className="text-sm font-semibold text-gray-600 px-4 py-2.5 rounded-xl hover:bg-gray-100">Back</button>
            <button type="button" onClick={save} disabled={busy || !tables} data-go
              className="inline-flex items-center gap-2 text-sm font-semibold text-white px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save reservation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsForm({ restaurantId, settings, team, onSaved }: { restaurantId: string; settings: Settings; team: Team | null; onSaved: (s: Settings) => void }) {
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
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
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
      <div>
        <div className="font-semibold text-gray-900 text-sm">Reminders when you accept</div>
        <p className="text-xs text-gray-500 mt-0.5 mb-2">These are suggested in the Accept window, you can change them there for each reservation. A notification shows up in the platform so you can call the customer, an email reminds the customer and has a link to cancel.</p>
        <ReminderEditor value={s.reminders} onChange={(v) => setS({ ...s, reminders: v })} team={team} emailReady />
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
