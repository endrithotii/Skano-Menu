"use client";

// HR: who works now, everyone's hours, time off, work times, contracts and the HR rules.
// "HR: hours, time off and work times" (hr.manage) sees everything, "Contracts and staff documents" (hr.documents) the contracts.

import { useCallback, useEffect, useState } from "react";
import { Briefcase, Loader2, LogOut, AlertTriangle, CalendarClock, UserX, Users } from "lucide-react";
import toast from "react-hot-toast";
import { MIN_UNITS, entryHours, fmtHours, leaveOn, leaveWhen, shiftsOn, type HrRules, type MinUnit } from "@/lib/hr";
import { btnPrimary, card, inputCls, timeIn } from "@/components/hr/hr-ui";
import { browserZone, type Post, type Team } from "@/components/hr/hr-types";
import { HoursTab, periodOf, type Period } from "@/components/hr/hr-hours";
import { TimeOffTab } from "@/components/hr/hr-timeoff";
import { ScheduleTab } from "@/components/hr/hr-schedule";
import { DocsTab } from "@/components/hr/hr-docs";

type Tab = "today" | "hours" | "timeoff" | "schedule" | "documents" | "rules";
const TABS: { key: Tab; label: string }[] = [
  { key: "today", label: "Today" }, { key: "hours", label: "Hours" }, { key: "timeoff", label: "Time off" },
  { key: "schedule", label: "Work times" }, { key: "documents", label: "Contracts" }, { key: "rules", label: "Rules" },
];
type Limited = { manage: false; staff: { id: string; name: string }[]; timeZone: string; today: string };

function TodayTab({ team, post, reload, goTo }: { team: Team; post: Post; reload: () => void; goTo: (t: Tab) => void }) {
  const t = team.today;
  const working = team.staff.filter((s) => s.open);
  const off = team.staff.map((s) => ({ s, l: leaveOn(team.leaves, s.id, t) })).filter((x) => x.l);
  const missing = team.staff.filter((s) => !s.open && !leaveOn(team.leaves, s.id, t) && shiftsOn(s.person, t).length);
  const pending = team.leaves.filter((l) => l.status === "pending").length;
  async function checkout(id: string, name: string) {
    if (!confirm(`Check out ${name} now?`)) return;
    const err = await post({ action: "checkout-for", userId: id });
    if (err) toast.error(err); else { toast.success(`${name} checked out`); reload(); }
  }
  return (
    <div className="space-y-4">
      {pending > 0 && (
        <button type="button" onClick={() => goTo("timeoff")} className="w-full text-left rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3" data-pending-banner>
          <CalendarClock className="w-5 h-5 text-amber-700 shrink-0" aria-hidden />
          <span className="flex-1 text-sm font-semibold text-amber-900">{pending} time off {pending === 1 ? "request waits" : "requests wait"} for an answer</span>
          <span className="text-sm font-semibold text-amber-800">Answer →</span>
        </button>
      )}
      <section className={`${card} p-5`} aria-label="Working now">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Users className="w-4 h-4 text-green-600" aria-hidden /> Working now ({working.length})</h2>
        {working.length === 0 ? <p className="text-sm text-gray-500 mt-2">Nobody is checked in.</p> : (
          <ul className="mt-3 divide-y divide-gray-100">
            {working.map((s) => {
              const h = entryHours(s.open!);
              const forgot = team.forgot.includes(s.id);
              return (
                <li key={s.id} className="py-2.5 flex flex-wrap items-center gap-3" data-working={s.name}>
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500" aria-hidden />
                  <span className="flex-1 min-w-40 text-sm"><b className="text-gray-900">{s.name}</b> <span className="text-gray-500">since {timeIn(s.open!.in, team.timeZone)} · {fmtHours(h)}</span>
                    {forgot && <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700"><AlertTriangle className="w-3.5 h-3.5" aria-hidden /> Forgot to check out?</span>}
                  </span>
                  <button type="button" onClick={() => checkout(s.id, s.name)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50"><LogOut className="w-3.5 h-3.5" /> Check out</button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <div className="grid sm:grid-cols-2 gap-4">
        <section className={`${card} p-5`} aria-label="Should work today, not checked in">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><UserX className="w-4 h-4 text-amber-600" aria-hidden /> Should work today, not checked in</h2>
          {missing.length === 0 ? <p className="text-sm text-gray-500 mt-2">Nobody.</p> : (
            <ul className="mt-2 space-y-1.5 text-sm">{missing.map((s) => <li key={s.id}><b className="text-gray-900">{s.name}</b> <span className="text-gray-500">{shiftsOn(s.person, t).map((x) => `${x.start} to ${x.end}`).join(", ")}</span></li>)}</ul>
          )}
        </section>
        <section className={`${card} p-5`} aria-label="Off today">
          <h2 className="font-semibold text-gray-900">Off today</h2>
          {off.length === 0 ? <p className="text-sm text-gray-500 mt-2">Nobody.</p> : (
            <ul className="mt-2 space-y-1.5 text-sm">{off.map(({ s, l }) => <li key={s.id}><b className="text-gray-900">{s.name}</b> <span className="text-gray-500">{l!.kind === "sick" ? "sick" : l!.kind === "vacation" ? "vacation" : "unpaid day off"}, {leaveWhen(l!)}</span></li>)}</ul>
          )}
        </section>
      </div>
    </div>
  );
}

function RulesTab({ team, post, reload }: { team: Team; post: Post; reload: () => void }) {
  const [r, setR] = useState<HrRules>(team.settings.rules);
  const [zone, setZone] = useState(team.timeZone);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const err = await post({ action: "rules", rules: r, timeZone: zone });
    setBusy(false);
    if (err) toast.error(err); else { toast.success("Saved"); reload(); }
  }
  const sw = (on: boolean, set: (v: boolean) => void, label: string, id: string) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} id={id} onClick={() => set(!on)}
      className={`relative w-12 h-7 shrink-0 rounded-full transition-colors ${on ? "bg-blue-600" : "bg-gray-300"}`}>
      <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : ""}`} />
    </button>
  );
  return (
    <section className={`${card} p-5 space-y-5 max-w-2xl`} aria-label="HR rules">
      <p className="text-sm text-gray-600">These count for everyone. You can give one person other numbers on Work times. The year runs from January to December.</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="r-vac" className="block text-xs font-medium text-gray-700 mb-1">Vacation days a year</label>
          <input id="r-vac" type="number" min={0} max={365} step={0.5} value={r.vacationDays} onChange={(e) => setR({ ...r, vacationDays: Number(e.target.value) })} className={inputCls} />
        </div>
        <div>
          <label htmlFor="r-sick" className="block text-xs font-medium text-gray-700 mb-1">Sick days a year</label>
          <input id="r-sick" type="number" min={0} max={365} step={0.5} value={r.sickDays} onChange={(e) => setR({ ...r, sickDays: Number(e.target.value) })} className={inputCls} />
        </div>
        <div>
          <label htmlFor="r-min" className="block text-xs font-medium text-gray-700 mb-1">Smallest time off staff can ask for</label>
          <select id="r-min" value={r.minUnit} onChange={(e) => setR({ ...r, minUnit: e.target.value as MinUnit })} className={inputCls}>
            {MIN_UNITS.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="r-notice" className="block text-xs font-medium text-gray-700 mb-1">Ask for vacation at least … days ahead</label>
          <input id="r-notice" type="number" min={0} max={90} value={r.noticeDays} onChange={(e) => setR({ ...r, noticeDays: Number(e.target.value) })} className={inputCls} />
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="r-sickauto" className="text-sm text-gray-800">Sick days count right away <span className="block text-xs text-gray-500">Off: HR approves sick days like vacation</span></label>
          {sw(r.sickAutoApprove, (v) => setR({ ...r, sickAutoApprove: v }), "Sick days count right away", "r-sickauto")}
        </div>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="r-docs" className="text-sm text-gray-800">Staff can open their own contract <span className="block text-xs text-gray-500">On My work</span></label>
          {sw(r.staffSeeOwnDocs, (v) => setR({ ...r, staffSeeOwnDocs: v }), "Staff can open their own contract", "r-docs")}
        </div>
      </div>
      <div>
        <label htmlFor="r-zone" className="block text-xs font-medium text-gray-700 mb-1">Time zone</label>
        <div className="flex gap-2">
          <input id="r-zone" value={zone} onChange={(e) => setZone(e.target.value)} className={inputCls} />
          {zone !== browserZone() && <button type="button" onClick={() => setZone(browserZone())} className="shrink-0 text-xs font-semibold text-blue-700 px-3 rounded-xl hover:bg-blue-50">Use {browserZone()}</button>}
        </div>
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={busy} className={btnPrimary} data-go="save-rules">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Save rules</button>
      </div>
    </section>
  );
}

export default function HrPage() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [team, setTeam] = useState<Team | Limited | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("today");
  const [period, setPeriodState] = useState<Period>("week");
  const [rangeFrom, setRangeFrom] = useState<string | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    void Promise.resolve().then(() => { if (TABS.some((x) => x.key === t)) setTab(t as Tab); });
    void fetch("/api/dashboard/access").then((r) => r.json()).then((a) => setRestaurantId(a?.restaurantId ?? null)).catch(() => setError("No connection to the server"));
  }, []);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    const q = new URLSearchParams({ scope: "team", tz: browserZone() });
    if (rangeFrom) { const p = periodOf(period, rangeFrom); q.set("from", p.from); q.set("to", p.to); }
    else if (period === "month") q.set("month", "1");
    const res = await fetch(`/api/restaurants/${restaurantId}/hr?${q}`).catch(() => null);
    const d = await res?.json().catch(() => null);
    if (!res?.ok || !d) { setError(d?.error ?? "Could not load HR"); return; }
    setError(null);
    // First load of a month: ask again for the whole month
    if (!rangeFrom && period === "month" && d.manage) { setRangeFrom(periodOf("month", d.today).from); return; }
    setTeam(d);
  }, [restaurantId, period, rangeFrom]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const post: Post = async (body) => {
    const res = await fetch(`/api/restaurants/${restaurantId}/hr`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, tz: browserZone() }) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    return res?.ok ? null : d?.error ?? "Could not save. Please try again.";
  };
  const goTo = (t: Tab) => { setTab(t); try { history.replaceState(null, "", `?tab=${t}`); } catch { /* fine */ } };
  const setPeriod = (p: Period) => { setPeriodState(p); setRangeFrom(team && "from" in team ? periodOf(p, team.today).from : null); };

  if (error) return <div className="p-4 sm:p-6"><div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</div></div>;
  if (!team || !restaurantId) return <div className="p-6 flex items-center gap-2 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>;

  const tabs = team.manage ? TABS : TABS.filter((t) => t.key === "documents");
  const shown = team.manage ? tab : "documents";
  const pending = team.manage ? (team as Team).leaves.filter((l) => l.status === "pending").length : 0;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Briefcase className="w-6 h-6 text-blue-600" aria-hidden /> HR</h1>
        <p className="text-sm text-gray-500 mt-1">Hours, time off, work times and contracts of your staff. Staff check in and ask for time off on My work.</p>
      </div>
      <nav className="flex flex-wrap gap-x-1 border-b border-gray-200" aria-label="HR sections">
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => goTo(t.key)} aria-current={shown === t.key ? "page" : undefined} data-tab={t.key}
            className={`shrink-0 px-3.5 py-2.5 text-sm font-semibold border-b-2 -mb-px ${shown === t.key ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            {t.label}{t.key === "timeoff" && pending > 0 && <span className="ml-1.5 text-[11px] font-bold rounded-full px-1.5 bg-red-500 text-white">{pending}</span>}
          </button>
        ))}
      </nav>
      {shown === "documents" && <DocsTab restaurantId={restaurantId} staff={team.staff.map((s) => ({ id: s.id, name: s.name }))} />}
      {team.manage && shown === "today" && <TodayTab team={team as Team} post={post} reload={load} goTo={goTo} />}
      {team.manage && shown === "hours" && <HoursTab team={team as Team} period={period} setPeriod={setPeriod} setRange={setRangeFrom} post={post} reload={load} />}
      {team.manage && shown === "timeoff" && <TimeOffTab team={team as Team} post={post} reload={load} />}
      {team.manage && shown === "schedule" && <ScheduleTab team={team as Team} post={post} reload={load} />}
      {team.manage && shown === "rules" && <RulesTab key={JSON.stringify((team as Team).settings.rules)} team={team as Team} post={post} reload={load} />}
    </div>
  );
}
