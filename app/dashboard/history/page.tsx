"use client";

// Action history: everything everyone did on the platform, newest first.
// Filters: roles (the roles the person had at that moment), people, actions, and a from / until date and time.
// Inside one filter any choice matches (chef OR waiter), the filters together all have to match.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { History, Loader2, X, Filter, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { ACTION_GROUPS, actionLabel, type ActionEntry } from "@/lib/action-log-types";

interface Option { id: string; name: string; email?: string; owner?: boolean }
interface Filters { roles: string[]; users: string[]; actions: string[]; from: string; until: string }

const EMPTY: Filters = { roles: [], users: [], actions: [], from: "", until: "" };

// datetime-local values ("2026-10-13T12:00") are the viewer's own time
const localValue = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const toIso = (v: string, endOfMinute: boolean) => {
  if (!v) return "";
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return "";
  if (endOfMinute) d.setSeconds(59, 999);
  return d.toISOString();
};
const fmtTime = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const fmtDay = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtDateTime = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtDate = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

/** Times in the saved text ({{t:ISO}}, {{d:ISO}}) shown in the viewer's time */
const showText = (s: string) => s
  .replace(/\{\{t:([^}]+)\}\}/g, (_, iso) => (Number.isFinite(Date.parse(iso)) ? fmtDateTime.format(new Date(iso)) : iso))
  .replace(/\{\{d:([^}]+)\}\}/g, (_, iso) => (Number.isFinite(Date.parse(iso)) ? fmtDate.format(new Date(iso)) : iso));

function Chip({ on, children, onClick, title }: { on: boolean; children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} title={title}
      className={`text-xs font-semibold rounded-full border px-2.5 py-1 transition-colors ${on ? "border-blue-500 bg-blue-600 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}>
      {children}
    </button>
  );
}

export default function HistoryPage() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [entries, setEntries] = useState<ActionEntry[] | null>(null);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<Option[]>([]);
  const [people, setPeople] = useState<Option[]>([]);
  const [showActions, setShowActions] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const req = useRef(0);

  useEffect(() => {
    void fetch("/api/dashboard/access").then((r) => r.json()).then((a) => setRestaurantId(a?.restaurantId ?? null)).catch(() => setError("Could not load."));
  }, []);

  const query = useCallback((f: Filters, before?: string) => {
    const q = new URLSearchParams();
    if (f.roles.length) q.set("roles", f.roles.join(","));
    if (f.users.length) q.set("users", f.users.join(","));
    if (f.actions.length) q.set("actions", f.actions.join(","));
    const from = toIso(f.from, false), until = toIso(f.until, true);
    if (from) q.set("from", from);
    if (until) q.set("until", until);
    if (before) q.set("before", before);
    return q.toString();
  }, []);

  const load = useCallback(async (f: Filters, append: boolean, before?: string) => {
    if (!restaurantId) return;
    const n = ++req.current;
    setLoading(true);
    const res = await fetch(`/api/restaurants/${restaurantId}/history?${query(f, before)}`).catch(() => null);
    const d = await res?.json().catch(() => null);
    if (n !== req.current) return; // a newer filter is loading
    setLoading(false);
    if (!res?.ok || !d) { setError(d?.error ?? "Could not load the history."); return; }
    setError(null);
    setRoles(d.roles ?? []);
    setPeople(d.people ?? []);
    setEntries((old) => (append && old ? [...old, ...d.entries] : d.entries));
    setMore(!!d.more);
  }, [restaurantId, query]);

  // Load again when a filter changes (a short wait while typing a date)
  useEffect(() => {
    if (!restaurantId) return;
    const t = setTimeout(() => { void load(filters, false); }, 250);
    return () => clearTimeout(t);
  }, [restaurantId, filters, load]);

  const toggle = (key: "roles" | "users" | "actions", id: string) =>
    setFilters((f) => ({ ...f, [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id] }));

  // A whole group of actions on or off
  const setGroup = (keys: string[], on: boolean) =>
    setFilters((f) => ({ ...f, actions: on ? [...new Set([...f.actions, ...keys])] : f.actions.filter((a) => !keys.includes(a)) }));

  function quick(kind: "today" | "yesterday" | "week") {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (kind === "today") setFilters((f) => ({ ...f, from: localValue(start), until: "" }));
    if (kind === "yesterday") {
      const y = new Date(start); y.setDate(y.getDate() - 1);
      const end = new Date(start); end.setMinutes(-1);
      setFilters((f) => ({ ...f, from: localValue(y), until: localValue(end) }));
    }
    if (kind === "week") { const w = new Date(start); w.setDate(w.getDate() - 6); setFilters((f) => ({ ...f, from: localValue(w), until: "" })); }
  }

  const active = filters.roles.length + filters.users.length + filters.actions.length + (filters.from ? 1 : 0) + (filters.until ? 1 : 0);
  const byDay = useMemo(() => {
    const out: { day: string; items: ActionEntry[] }[] = [];
    for (const e of entries ?? []) {
      const day = fmtDay.format(new Date(e.at));
      const last = out[out.length - 1];
      if (last?.day === day) last.items.push(e); else out.push({ day, items: [e] });
    }
    return out;
  }, [entries]);

  if (error && !entries) return <div className="p-6 text-sm text-gray-600">{error}</div>;

  return (
    <div className="p-4 lg:p-6 space-y-5 pb-28">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><History className="w-6 h-6 text-blue-500" /> Action history</h1>
        <p className="text-sm text-gray-500 mt-1">Everything everyone did on the platform, newest first. Who can see this page is set on Staff &amp; roles.</p>
      </div>

      {/* Filters */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4" aria-label="Filters">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Filter className="w-4 h-4 text-blue-500" /> Filters {active > 0 && <span className="text-xs font-semibold text-blue-700 bg-blue-50 rounded-full px-2 py-0.5">{active} on</span>}</h2>
          {active > 0 && (
            <button type="button" onClick={() => setFilters(EMPTY)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900" id="clear-filters">
              <RotateCcw className="w-3.5 h-3.5" /> Clear all
            </button>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1.5">Role (at the time of the action)</div>
            <div className="flex flex-wrap gap-1.5" data-filter="roles">
              {roles.map((r) => <Chip key={r.id} on={filters.roles.includes(r.id)} onClick={() => toggle("roles", r.id)}>{r.name}</Chip>)}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1.5">Person</div>
            <div className="flex flex-wrap gap-1.5" data-filter="people">
              {people.map((p) => <Chip key={p.id} on={filters.users.includes(p.id)} onClick={() => toggle("users", p.id)} title={p.email}>{p.name}{p.owner ? " (owner)" : ""}</Chip>)}
            </div>
          </div>
        </div>

        <div>
          <button type="button" onClick={() => setShowActions((v) => !v)} id="toggle-actions"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 rounded-lg border border-gray-200 px-3 py-1.5 hover:border-gray-300">
            Actions {filters.actions.length ? `(${filters.actions.length})` : "(all)"} {showActions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {filters.actions.length > 0 && !showActions && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ACTION_GROUPS.flatMap((g) => {
                const keys = g.items.map((i) => i.key);
                const chip = (k: string, text: string, remove: () => void) => (
                  <span key={k} className="inline-flex items-center gap-1 text-xs font-medium rounded-full bg-blue-50 text-blue-800 border border-blue-100 pl-2.5 pr-1 py-0.5">
                    {text}
                    <button type="button" onClick={remove} aria-label={`Remove ${text}`} className="p-0.5 rounded-full hover:bg-blue-100"><X className="w-3 h-3" /></button>
                  </span>
                );
                if (keys.every((k) => filters.actions.includes(k))) return [chip(g.name, `All ${g.name.toLowerCase()} actions`, () => setGroup(keys, false))];
                return keys.filter((k) => filters.actions.includes(k)).map((a) => chip(a, actionLabel(a), () => toggle("actions", a)));
              })}
            </div>
          )}
          {showActions && (
            <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-5 rounded-xl border border-gray-100 p-3" data-filter="actions">
              {ACTION_GROUPS.map((g) => {
                const keys = g.items.map((i) => i.key);
                const on = keys.filter((k) => filters.actions.includes(k)).length;
                return (
                  <div key={g.name} data-action-group={g.name}>
                    <label className="flex items-center gap-2 py-1 text-sm font-semibold text-gray-900 cursor-pointer">
                      <GroupCheckbox all={on === keys.length} some={on > 0 && on < keys.length} onChange={() => setGroup(keys, on < keys.length)} label={`All ${g.name.toLowerCase()} actions`} />
                      {g.name}
                      <span className="text-[11px] font-normal text-gray-400">{on ? `${on} of ${keys.length}` : keys.length}</span>
                    </label>
                    <div className="ml-[7px] pl-3.5 border-l border-gray-200">
                      {g.items.map((it) => (
                        <label key={it.key} className="flex items-start gap-2 py-1 text-xs text-gray-700 cursor-pointer">
                          <input type="checkbox" checked={filters.actions.includes(it.key)} onChange={() => toggle("actions", it.key)} className="mt-0.5 accent-blue-600" aria-label={it.label} />
                          {it.label}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-end gap-3 flex-wrap">
          <label className="block">
            <span className="block text-xs font-semibold text-gray-500 mb-1">From</span>
            <input type="datetime-local" id="filter-from" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-gray-500 mb-1">Until</span>
            <input type="datetime-local" id="filter-until" value={filters.until} min={filters.from || undefined} onChange={(e) => setFilters((f) => ({ ...f, until: e.target.value }))}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
          </label>
          <div className="flex gap-1.5 pb-1">
            <Chip on={false} onClick={() => quick("today")}>Today</Chip>
            <Chip on={false} onClick={() => quick("yesterday")}>Yesterday</Chip>
            <Chip on={false} onClick={() => quick("week")}>Last 7 days</Chip>
            {(filters.from || filters.until) && <Chip on={false} onClick={() => setFilters((f) => ({ ...f, from: "", until: "" }))}>Any time</Chip>}
          </div>
        </div>
      </section>

      {/* Results */}
      <section aria-label="Actions" className="space-y-4" data-results>
        {!entries ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-blue-500" /></div>
        ) : entries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
            {active ? "Nothing matches these filters." : "Nothing yet. Actions show here as soon as someone changes something."}
          </div>
        ) : (
          byDay.map((g) => (
            <div key={g.day}>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{g.day}</div>
              <ul className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                {g.items.map((e) => {
                  const isOpen = open.has(e.id);
                  return (
                    <li key={e.id} className="px-4 py-3 flex items-start gap-3" data-entry={e.action}>
                      <span className="w-16 shrink-0 whitespace-nowrap text-xs font-semibold text-gray-500 tabular-nums pt-0.5">{fmtTime.format(new Date(e.at))}</span>
                      <div className="w-8 h-8 shrink-0 rounded-full bg-blue-50 text-blue-700 text-sm font-bold flex items-center justify-center">{(e.userName || e.userEmail || "?").charAt(0).toUpperCase()}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{e.userName || e.userEmail || "Someone"}</span>
                          {e.roles.map((r) => <span key={r.id} className="text-[10px] font-semibold rounded-full bg-gray-100 text-gray-600 px-1.5 py-0.5">{r.name}</span>)}
                          <span className="text-[11px] font-medium rounded-full bg-blue-50 text-blue-800 border border-blue-100 px-2 py-0.5">{actionLabel(e.action)}</span>
                        </div>
                        <p className="text-sm text-gray-700 mt-0.5 break-words">{showText(e.summary)}</p>
                        {e.details.length > 0 && (
                          <>
                            <ul className={`mt-1 space-y-0.5 text-xs text-gray-500 ${isOpen ? "" : "line-clamp-2"}`}>
                              {(isOpen ? e.details : e.details.slice(0, 2)).map((d, i) => <li key={i} className="break-words">{showText(d)}</li>)}
                            </ul>
                            {e.details.length > 2 && (
                              <button type="button" className="mt-0.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
                                onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); return n; })}>
                                {isOpen ? "Show less" : `Show all ${e.details.length}`}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
        {more && entries && (
          <div className="flex justify-center">
            <button type="button" id="load-more" disabled={loading} onClick={() => load(filters, true, entries[entries.length - 1]?.at)}
              className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Show older actions
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

/** The checkbox of a group: checked = all its actions, a dash = some of them */
function GroupCheckbox({ all, some, onChange, label }: { all: boolean; some: boolean; onChange: () => void; label: string }) {
  return (
    <input type="checkbox" checked={all} onChange={onChange} aria-label={label} aria-checked={some ? "mixed" : all}
      ref={(el) => { if (el) el.indeterminate = some; }} className="w-4 h-4 accent-blue-600" />
  );
}
