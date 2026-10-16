"use client";

// Customers reserve a table (QR code on the QR Code page, and More > Reserve a table on the menu).
// 1. Day, persons, time (from the opening hours)  2. A table on the plan, or "pick one for me"  3. Name, email, phone.
// When the restaurant chooses the tables itself (Reservations > Settings), step 2 is skipped.
// No free table: the customer can still send the request, the restaurant finds a place when it accepts.
// The restaurant accepts or refuses, and the customer gets an email.

import { use, useEffect, useMemo, useState } from "react";
import { CalendarDays, Users, Clock, Loader2, CheckCircle2, ChevronLeft, Sparkles, AlertTriangle } from "lucide-react";
import { Shape } from "@/components/floor/floor-shapes";
import { nextDays, type HoursData } from "@/lib/opening-hours";
import type { FloorPlan } from "@/lib/floor-plan";

interface Settings { enabled: boolean; durationMin: number; stepMin: number; daysAhead: number; noticeMin: number; customerPicksTable: boolean }
interface TableInfo { id: string; label: string; seats: number; minGuests: number; areaId: string; areaName: string; status: "free" | "taken" | "blocked" | "too-small" | "too-few" | "not-reservable" }
interface Info { restaurant: { name: string; phone: string | null; logo: string | null; color: string }; enabled: boolean; settings: Settings; plan?: FloorPlan | null; tables?: TableInfo[] }

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromYmd = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const mins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

const WHY: Record<TableInfo["status"], string> = {
  free: "Free", taken: "Reserved at this time", blocked: "Not available at this time", "too-small": "Too small for your group",
  "too-few": "For bigger groups", "not-reservable": "Not for reservations",
};

/** Times on a day, from the opening hours (last one an hour before closing) */
function slotsFor(day: Date, hours: HoursData | null, s: Settings): { closed: boolean; label: string | null; slots: Date[] } {
  let open = 12 * 60, close = 22 * 60, label: string | null = null;
  if (hours && (hours.hours || hours.exceptions.length)) {
    const d = nextDays(hours, day)[0];
    label = d.label;
    if (d.closed || !d.open || !d.close) return { closed: true, label, slots: [] };
    open = mins(d.open); close = mins(d.close);
    if (close <= open) close += 24 * 60; // closes after midnight
  }
  const earliest = Date.now() + s.noticeMin * 60_000;
  const out: Date[] = [];
  for (let t = Math.ceil(open / s.stepMin) * s.stepMin; t <= close - 60; t += s.stepMin) {
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, t);
    if (at.getTime() >= earliest) out.push(at);
  }
  return { closed: false, label, slots: out };
}

export default function ReservePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const api = `/api/restaurants/${encodeURIComponent(slug)}/reserve`;
  const [info, setInfo] = useState<Info | null>(null);
  const [hours, setHours] = useState<HoursData | null>(null);
  const [failed, setFailed] = useState(false);
  const [day, setDay] = useState(() => ymd(new Date()));
  const [guests, setGuests] = useState(2);
  const [time, setTime] = useState<string | null>(null); // ISO
  const [avail, setAvail] = useState<{ key: string; plan: FloorPlan | null; tables: TableInfo[] } | null>(null);
  const [tableId, setTableId] = useState<string | null>(null); // null = pick one for me
  const [areaId, setAreaId] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState({ name: "", email: "", phone: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ when: string; table: string; area: string; guests: number } | null>(null);
  // Load the tables again (after a table was just taken by someone else)
  const [reload, setReload] = useState(0);
  const picks = info?.settings.customerPicksTable !== false;

  useEffect(() => {
    void Promise.all([
      fetch(api).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/restaurants/${encodeURIComponent(slug)}/hours`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([i, h]) => { if (!i) setFailed(true); else { setInfo(i); setHours(h); } }).catch(() => setFailed(true));
  }, [api, slug]);

  const days = useMemo(() => {
    if (!info) return [];
    return Array.from({ length: Math.min(info.settings.daysAhead + 1, 60) }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d; });
  }, [info]);
  const daySlots = useMemo(() => (info ? slotsFor(fromYmd(day), hours, info.settings) : { closed: false, label: null, slots: [] }), [info, hours, day]);

  // Tables for the chosen time and group
  const key = time ? `${time}|${guests}` : null;
  useEffect(() => {
    if (!key || !time || !picks) return;
    let cancelled = false;
    void fetch(`${api}?start=${encodeURIComponent(time)}&guests=${guests}`).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (cancelled || !d) return;
      setAvail({ key, plan: d.plan ?? null, tables: d.tables ?? [] });
    });
    return () => { cancelled = true; };
  }, [api, key, time, guests, reload, picks]);
  const tables = avail?.key === key ? avail.tables : null;
  const free = tables?.filter((t) => t.status === "free") ?? [];
  const chosen = tables?.find((t) => t.id === tableId) ?? null;
  const oneArea = new Set((tables ?? []).map((t) => t.areaName)).size <= 1;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!time) return;
    setBusy(true); setError(null);
    const res = await fetch(api, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startAt: time, guests, tableId, ...form, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok || !d?.reservation) {
      setError(d?.error ?? "Could not send your request. Please try again.");
      // The table may have just been taken: show the tables again
      if (picks) { setAvail(null); setReload((n) => n + 1); }
      return;
    }
    setDone(d.reservation);
  }

  const color = info?.restaurant.color || "#2563eb";
  const btn = "w-full inline-flex items-center justify-center gap-2 text-base font-semibold text-white rounded-2xl py-3.5 disabled:opacity-40";

  if (failed) return <Shell><p className="text-center text-gray-600 py-16">This restaurant was not found.</p></Shell>;
  if (!info) return <Shell><div className="py-24 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div></Shell>;

  const header = (
    <div className="text-center pt-2 pb-1">
      {info.restaurant.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={info.restaurant.logo} alt="" className="w-14 h-14 rounded-2xl object-cover mx-auto mb-2" />
      )}
      <h1 className="text-2xl font-bold text-gray-900">{info.restaurant.name}</h1>
      <p className="text-sm text-gray-500">Reserve a table</p>
    </div>
  );

  if (!info.enabled) {
    return <Shell>{header}<div className="mt-6 rounded-2xl bg-white border border-gray-100 p-6 text-center text-gray-600">This restaurant doesn&apos;t take reservations online right now.{info.restaurant.phone && <> Please call <a href={`tel:${info.restaurant.phone}`} className="font-semibold underline">{info.restaurant.phone}</a>.</>}</div></Shell>;
  }

  if (done) {
    return (
      <Shell>{header}
        <div className="mt-6 rounded-3xl bg-white border border-gray-100 shadow-sm p-6 text-center" data-done>
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
          <h2 className="mt-3 text-xl font-bold text-gray-900">Request sent</h2>
          <p className="mt-1 text-gray-600">{done.when}, {done.guests} person{done.guests === 1 ? "" : "s"}, {done.table ? `table ${done.table}${done.area ? ` (${done.area})` : ""}` : "the restaurant chooses your table"}.</p>
          <p className="mt-3 text-sm text-gray-500">The restaurant will accept or refuse it. You&apos;ll get an email with the answer at <span className="font-semibold text-gray-700">{form.email.trim().toLowerCase()}</span>.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {header}
      <ol className="flex items-center justify-center gap-2 text-xs font-semibold mt-3" aria-label="Steps">
        {(picks ? ([[1, "When"], [2, "Table"], [3, "Your details"]] as const) : ([[1, "When"], [3, "Your details"]] as const)).map(([n, l], i) => (
          <li key={l} className={`px-2.5 py-1 rounded-full ${step === n ? "text-white" : step > n ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`} style={step === n ? { background: color } : undefined}>{i + 1}. {l}</li>
        ))}
      </ol>

      {step === 1 && (
        <div className="mt-4 space-y-4">
          <section className="rounded-3xl bg-white border border-gray-100 shadow-sm p-4 space-y-2">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Users className="w-4 h-4" /> How many persons?</h2>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setGuests((g) => Math.max(1, g - 1))} className="w-12 h-12 rounded-2xl border border-gray-200 text-2xl font-bold text-gray-700" aria-label="One person less">−</button>
              <span className="text-2xl font-bold text-gray-900 w-12 text-center" id="guests">{guests}</span>
              <button type="button" onClick={() => setGuests((g) => Math.min(30, g + 1))} className="w-12 h-12 rounded-2xl border border-gray-200 text-2xl font-bold text-gray-700" aria-label="One person more">+</button>
            </div>
          </section>

          <section className="rounded-3xl bg-white border border-gray-100 shadow-sm p-4 space-y-2">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Which day?</h2>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" data-days>
              {days.map((d, i) => {
                const on = ymd(d) === day;
                return (
                  <button key={i} type="button" onClick={() => { setDay(ymd(d)); setTime(null); }} data-day={ymd(d)}
                    className={`shrink-0 w-16 rounded-2xl border py-2 text-center ${on ? "text-white border-transparent" : "border-gray-200 text-gray-700"}`} style={on ? { background: color } : undefined}>
                    <div className="text-[11px] font-semibold uppercase">{i === 0 ? "Today" : i === 1 ? "Tmrw" : new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(d)}</div>
                    <div className="text-lg font-bold leading-tight">{d.getDate()}</div>
                    <div className="text-[11px]">{new Intl.DateTimeFormat(undefined, { month: "short" }).format(d)}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl bg-white border border-gray-100 shadow-sm p-4 space-y-2">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Clock className="w-4 h-4" /> What time?</h2>
            {daySlots.label && <p className="text-xs font-medium text-amber-700">{daySlots.label}</p>}
            {daySlots.closed ? (
              <p className="text-sm text-gray-500">The restaurant is closed on this day. Please pick another day.</p>
            ) : daySlots.slots.length ? (
              <div className="grid grid-cols-4 gap-2" data-times>
                {daySlots.slots.map((s) => {
                  const iso = s.toISOString(), on = iso === time;
                  return (
                    <button key={iso} type="button" onClick={() => setTime(iso)} data-time={hhmm(s)}
                      className={`rounded-xl border py-2 text-sm font-semibold ${on ? "text-white border-transparent" : "border-gray-200 text-gray-700"}`} style={on ? { background: color } : undefined}>{hhmm(s)}</button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No more times on this day. Please pick another day.</p>
            )}
          </section>

          <button type="button" disabled={!time} onClick={() => { setStep(picks ? 2 : 3); setTableId(null); setError(null); }} className={btn} style={{ background: color }} id="to-tables">{picks ? "Next: choose a table" : "Next: your details"}</button>
        </div>
      )}

      {step === 2 && (
        <div className="mt-4 space-y-4">
          <Summary time={time} guests={guests} onBack={() => setStep(1)} />
          {!tables ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : !free.length ? (
            <div className="rounded-3xl bg-white border border-gray-100 p-6 text-center space-y-4" data-no-free>
              <p className="text-gray-600">No table is free for {guests} person{guests === 1 ? "" : "s"} at this time. You can still send the request, the restaurant will try to find a place for you. Or pick another time.</p>
              <button type="button" onClick={() => { setTableId(null); setStep(3); }} className={btn} style={{ background: color }} id="send-anyway">Send the request anyway</button>
              <button type="button" onClick={() => setStep(1)} className="w-full text-sm font-semibold text-gray-600 underline">Pick another time</button>
            </div>
          ) : (
            <>
              <button type="button" onClick={() => setTableId(null)} aria-pressed={tableId === null} id="pick-for-me"
                className={`w-full rounded-2xl border-2 p-3 text-left flex items-center gap-3 ${tableId === null ? "bg-white" : "border-gray-200 bg-white"}`} style={tableId === null ? { borderColor: color } : undefined}>
                <Sparkles className="w-5 h-5" style={{ color }} />
                <span><span className="block font-semibold text-gray-900">Pick a table for me</span><span className="block text-xs text-gray-500">The best free table for {guests} person{guests === 1 ? "" : "s"}</span></span>
              </button>
              {avail?.plan && <PlanPicker plan={avail.plan} tables={tables} chosen={tableId} areaId={areaId} setAreaId={setAreaId} onPick={setTableId} color={color} />}
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-1.5">Free tables</div>
                <div className="flex flex-wrap gap-2" data-free-tables>
                  {free.map((t) => (
                    <button key={t.id} type="button" onClick={() => setTableId(t.id)} aria-pressed={tableId === t.id} data-table={t.label}
                      className={`rounded-lg border px-2.5 py-1.5 text-[13px] ${tableId === t.id ? "text-white border-transparent font-semibold" : "border-gray-200 text-gray-700 bg-white"}`} style={tableId === t.id ? { background: color } : undefined}>
                      Table {t.label}, {t.seats} seats{oneArea ? "" : `, ${t.areaName}`}
                    </button>
                  ))}
                </div>
              </div>
              {chosen && <p className="text-sm text-gray-700">You picked table <span className="font-semibold">{chosen.label}</span> ({chosen.seats} seats, {chosen.areaName}).</p>}
              <button type="button" onClick={() => setStep(3)} className={btn} style={{ background: color }} id="to-details">Next: your details</button>
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <form onSubmit={send} className="mt-4 space-y-4">
          <Summary time={time} guests={guests} table={!picks ? undefined : chosen ? `table ${chosen.label} (${chosen.areaName})` : free.length ? "table picked for you" : "the restaurant finds a place"} onBack={() => setStep(picks ? 2 : 1)} />
          <section className="rounded-3xl bg-white border border-gray-100 shadow-sm p-4 space-y-3">
            {([["name", "Name", "text", "name"], ["email", "Email (the answer is sent here)", "email", "email"], ["phone", "Phone number", "tel", "tel"]] as const).map(([k, label, type, auto]) => (
              <label key={k} className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
                <input id={`res-${k}`} required type={type} autoComplete={auto} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  className="w-full text-base border border-gray-200 rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </label>
            ))}
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Anything we should know? <span className="text-gray-400 font-normal">(optional)</span></span>
              <textarea id="res-note" rows={2} maxLength={300} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. a birthday, a high chair"
                className="w-full text-base border border-gray-200 rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
            </label>
          </section>
          {error && <p className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</p>}
          <button type="submit" disabled={busy} className={btn} style={{ background: color }} id="send-reservation">{busy && <Loader2 className="w-5 h-5 animate-spin" />} Send the request</button>
          <p className="text-xs text-center text-gray-500">The restaurant accepts or refuses it, and you get an email.</p>
          {error && picks && <button type="button" onClick={() => setStep(2)} className="w-full text-sm font-semibold text-gray-600 underline">Choose another table</button>}
        </form>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-gray-50"><div className="max-w-lg mx-auto px-4 py-6">{children}</div></main>;
}

function Summary({ time, guests, table, onBack }: { time: string | null; guests: number; table?: string; onBack: () => void }) {
  const d = time ? new Date(time) : null;
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white border border-gray-100 px-3 py-2.5 text-sm text-gray-700" data-summary>
      <button type="button" onClick={onBack} aria-label="Back" className="p-1 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100"><ChevronLeft className="w-5 h-5" /></button>
      <span className="font-semibold">{d ? new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(d) : ""} · {d ? hhmm(d) : ""}</span>
      <span>· {guests} person{guests === 1 ? "" : "s"}</span>
      {table && <span className="truncate">· {table}</span>}
    </div>
  );
}

/** The plan with the tables: free ones can be picked */
function PlanPicker({ plan, tables, chosen, areaId, setAreaId, onPick, color }: {
  plan: FloorPlan; tables: TableInfo[]; chosen: string | null; areaId: string | null; setAreaId: (id: string) => void; onPick: (id: string) => void; color: string;
}) {
  const areas = plan.areas.filter((a) => a.objects.some((o) => o.type === "table"));
  const area = areas.find((a) => a.id === areaId) ?? areas[0];
  const [tip, setTip] = useState<string | null>(null);
  if (!area) return null;
  const byId = new Map(tables.map((t) => [t.id, t]));
  return (
    <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-3 space-y-3" data-plan-picker>
      {areas.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto">
          {areas.map((a) => (
            <button key={a.id} type="button" onClick={() => setAreaId(a.id)} className={`shrink-0 text-sm px-3 py-1.5 border-b-2 ${a.id === area.id ? "font-semibold text-gray-900" : "border-transparent text-gray-500"}`} style={a.id === area.id ? { borderColor: color } : undefined}>{a.name}</button>
          ))}
        </div>
      )}
      <svg viewBox={`-0.6 -0.6 ${area.width + 1.2} ${area.height + 1.2}`} className="w-full h-auto rounded-2xl bg-white" role="img" aria-label={`Plan of ${area.name}`}>
        {[...area.objects.filter((o) => o.type === "room"), ...area.objects.filter((o) => o.type !== "room")].map((o) => {
          const t = o.type === "table" ? byId.get(o.id) : undefined;
          const ok = t?.status === "free", picked = o.id === chosen;
          return (
            <g key={o.id} transform={`translate(${o.x} ${o.y}) rotate(${o.rotation})`}
              onClick={o.type === "table" ? () => { if (ok) { onPick(o.id); setTip(null); } else if (t) setTip(`Table ${t.label}: ${WHY[t.status].toLowerCase()}`); } : undefined}
              className={o.type === "table" ? (ok ? "cursor-pointer" : "cursor-not-allowed") : undefined} data-map-table={o.type === "table" ? o.label : undefined} data-status={t?.status}>
              <Shape o={o} clean state={picked && ok ? "picked" : ok ? "free" : "off"} accent={color} />
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-4 px-1 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px] bg-white border-[1.5px]" style={{ borderColor: color }} /> Free</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px]" style={{ background: color }} /> Your table</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px] bg-zinc-100 border border-zinc-300" /> Not available</span>
      </div>
      {tip && <p className="text-xs text-gray-500 px-1">{tip}</p>}
    </div>
  );
}
