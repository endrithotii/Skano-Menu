"use client";

// My work (every staff member): check in and out, my hours, my work times, my time off and my contract.

import { useCallback, useEffect, useState } from "react";
import { Timer, LogIn, LogOut, Loader2, Plus, FileText, CalendarDays, Clock, Wrench } from "lucide-react";
import toast from "react-hot-toast";
import { entryHours, fmtHours, shiftsOn, type Balance, type HrDoc, type Leave, type MinUnit, type PersonHr, type TimeEntry } from "@/lib/hr";
import { BalanceCards, LeaveLine, TimeOffDialog, WeekView, btnGhost, card, dayIn, dayLabel, inputCls, timeIn } from "@/components/hr/hr-ui";

interface Me {
  staff: boolean; timeZone: string; today: string; open: TimeEntry | null; entries: TimeEntry[]; leaves: Leave[]; balances: Balance[];
  person: PersonHr; rules: { vacationDays: number; sickDays: number; minUnit: MinUnit; noticeDays: number; sickAutoApprove: boolean };
  week: { from: string; to: string; worked: number; planned: number; diff: number };
  month: { from: string; to: string; worked: number; planned: number; diff: number };
  canSeeDocs: boolean;
}

const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; } };

function Ticker({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(t); }, []);
  const m = Math.floor(entryHours({ in: since, out: null }, now) * 60);
  return <>{Math.floor(m / 60)} h {m % 60} min</>;
}

export default function MyWorkPage() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [docs, setDocs] = useState<HrDoc[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/dashboard/access").then((r) => r.json()).then((a) => setRestaurantId(a?.restaurantId ?? null)).catch(() => setError("No connection to the server"));
  }, []);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    const res = await fetch(`/api/restaurants/${restaurantId}/hr?scope=me&tz=${encodeURIComponent(tz())}`).catch(() => null);
    const d = await res?.json().catch(() => null);
    if (!res?.ok || !d) { setError(d?.error ?? "Could not load your work"); return; }
    setMe(d); setError(null);
    if (d.canSeeDocs) {
      const dd = await fetch(`/api/restaurants/${restaurantId}/hr/documents`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      setDocs(dd?.docs ?? []);
    }
  }, [restaurantId]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function post(body: Record<string, unknown>): Promise<string | null> {
    const res = await fetch(`/api/restaurants/${restaurantId}/hr`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, tz: tz() }) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    if (!res?.ok) return d?.error ?? "Could not save. Please try again.";
    return null;
  }

  async function check(action: "checkin" | "checkout") {
    setBusy(true);
    const err = await post({ action, note });
    setBusy(false);
    if (err) { toast.error(err); void load(); return; }
    toast.success(action === "checkin" ? "Checked in. Have a good shift!" : "Checked out. See you next time!");
    setNote("");
    void load();
  }

  async function cancel(l: Leave) {
    if (!confirm(l.status === "approved" ? "Cancel this approved time off? HR gets a notification." : "Cancel this request?")) return;
    const err = await post({ action: "cancel", id: l.id });
    if (err) toast.error(err); else toast.success("Cancelled");
    void load();
  }

  if (error) return <div className="p-4 sm:p-6"><div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</div></div>;
  if (!me) return <div className="p-6 flex items-center gap-2 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>;
  if (!me.staff) return (
    <div className="p-4 sm:p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">My work</h1>
      <p className="text-sm text-gray-600 mt-2">This page is for staff accounts: they check in and out and ask for time off here. You see everyone&apos;s hours on the HR page.</p>
    </div>
  );

  const today = me.today;
  const shifts = shiftsOn(me.person, today);
  const offToday = me.leaves.find((l) => l.status === "approved" && l.from <= today && l.to >= today);
  const forgot = me.open && entryHours(me.open) > 14;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Timer className="w-6 h-6 text-blue-600" aria-hidden /> My work</h1>
        <p className="text-sm text-gray-500 mt-1">Check in when you start and check out when you finish. Ask for time off here too.</p>
      </div>

      {/* Check in / out */}
      <section className={`${card} p-5`} aria-label="Check in and out" data-checkin-card>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            {me.open ? (
              <>
                <p className="text-sm font-semibold text-green-700 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" aria-hidden /> Checked in since {timeIn(me.open.in, me.timeZone)}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1" data-running><Ticker since={me.open.in} /></p>
                {forgot && <p className="text-sm text-amber-700 mt-1">That&apos;s a long shift. Did you forget to check out? Check out now, then ask HR to fix the time.</p>}
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-gray-600">You&apos;re not checked in</p>
                <p className="text-sm text-gray-500 mt-1">
                  {offToday ? "You have time off today." : shifts.length ? `Today: ${shifts.map((s) => `${s.start} to ${s.end}`).join(", ")}` : "Today is a day off for you."}
                </p>
              </>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:w-64">
            <label htmlFor="check-note" className="sr-only">Note</label>
            <input id="check-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Note (optional)" className={inputCls} />
            {me.open ? (
              <button type="button" onClick={() => check("checkout")} disabled={busy} data-go="checkout"
                className="inline-flex items-center justify-center gap-2 text-base font-semibold text-white px-4 py-3.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50">
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />} Check out
              </button>
            ) : (
              <button type="button" onClick={() => check("checkin")} disabled={busy} data-go="checkin"
                className="inline-flex items-center justify-center gap-2 text-base font-semibold text-white px-4 py-3.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50">
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />} Check in
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Hours */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3" aria-label="My hours">
        {[{ label: "This week", v: me.week }, { label: "This month", v: me.month }].map(({ label, v }) => (
          <div key={label} className={`${card} p-4`} data-hours={label}>
            <p className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-600" aria-hidden /> {label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{fmtHours(v.worked)}<span className="text-sm font-medium text-gray-500"> of {fmtHours(v.planned)} planned</span></p>
            <p className={`text-xs mt-0.5 ${v.diff >= 0 ? "text-green-700" : "text-gray-500"}`}>{v.diff >= 0 ? `${fmtHours(v.diff)} more than planned` : `${fmtHours(-v.diff)} still to go`}</p>
          </div>
        ))}
      </section>

      {/* Work times */}
      <section className={`${card} p-5`} aria-label="My work times">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-3"><CalendarDays className="w-4 h-4 text-blue-600" aria-hidden /> My work times</h2>
        <WeekView schedule={me.person.schedule} weeklyHours={me.person.weeklyHours} />
      </section>

      {/* Time off */}
      <section className="space-y-3" aria-label="My time off">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-gray-900">Time off {today.slice(0, 4)}</h2>
          <button type="button" onClick={() => setAsking(true)} data-go="ask" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600">
            <Plus className="w-4 h-4" /> Ask for time off
          </button>
        </div>
        <BalanceCards balances={me.balances} />
        <div className={`${card} divide-y divide-gray-100`}>
          {me.leaves.length === 0 ? <p className="p-4 text-sm text-gray-500">No time off yet.</p> : me.leaves.slice(0, 30).map((l) => (
            <div key={l.id} className="p-4">
              <LeaveLine l={l} right={(l.status === "pending" || (l.status === "approved" && l.to >= today)) ? (
                <button type="button" onClick={() => cancel(l)} className={btnGhost} data-go="cancel">Cancel</button>
              ) : undefined} />
            </div>
          ))}
        </div>
      </section>

      {/* Hours list */}
      <section className={`${card}`} aria-label="My check-ins">
        <h2 className="font-semibold text-gray-900 px-5 pt-5">My check-ins</h2>
        {me.entries.length === 0 ? <p className="px-5 py-4 text-sm text-gray-500">No check-ins yet.</p> : (
          <ul className="divide-y divide-gray-100 mt-2">
            {me.entries.slice(0, 40).map((e) => (
              <li key={e.id} className="px-5 py-3 flex items-center gap-3 text-sm" data-entry={e.id}>
                <span className="w-28 shrink-0 text-gray-500">{dayIn(e.in, me.timeZone)}</span>
                <span className="flex-1 text-gray-800">{timeIn(e.in, me.timeZone)} to {e.out ? timeIn(e.out, me.timeZone) : <span className="text-green-700 font-medium">now</span>}
                  {e.source === "manual" && <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-gray-500"><Wrench className="w-3 h-3" aria-hidden /> fixed by HR</span>}
                  {e.note && <span className="block text-xs text-gray-500">{e.note}</span>}
                </span>
                <span className="font-semibold text-gray-900">{fmtHours(entryHours(e))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Contract */}
      {me.canSeeDocs && (
        <section className={`${card} p-5`} aria-label="My contract and documents">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-600" aria-hidden /> My contract and documents</h2>
          {docs.length === 0 ? <p className="text-sm text-gray-500 mt-2">HR hasn&apos;t uploaded anything for you yet.</p> : (
            <ul className="mt-3 space-y-2">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-3 text-sm">
                  <FileText className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
                  <a href={`/api/restaurants/${restaurantId}/hr/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 hover:underline">{d.name}</a>
                  <span className="text-xs text-gray-500">{d.validFrom || d.validUntil ? `${d.validFrom ? dayLabel(d.validFrom) : ""} to ${d.validUntil ? dayLabel(d.validUntil) : "no end"}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {asking && (
        <TimeOffDialog title="Ask for time off" person={me.person} minUnit={me.rules.minUnit} noticeDays={me.rules.noticeDays} today={today}
          onClose={() => setAsking(false)}
          onSubmit={async (input) => {
            const err = await post({ action: "request", ...input });
            if (err) return err;
            toast.success(input.kind === "sick" && me.rules.sickAutoApprove ? "Get well soon! HR knows." : "Sent. You get a notification when HR answers.");
            setAsking(false); void load();
            return null;
          }} />
      )}
    </div>
  );
}
