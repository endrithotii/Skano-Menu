"use client";

// HR tab, Hours: everyone's hours for a week or a month next to the planned hours, fixing and adding hours, CSV.

import { useState } from "react";
import { ChevronLeft, ChevronRight, Download, Plus, Pencil, Trash2, Loader2, X, Wrench, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";
import { addDays, dayKey, entryHours, fmtHours, type TimeEntry } from "@/lib/hr";
import { btnGhost, btnPrimary, card, dayIn, dayLabel, inputCls, timeIn } from "@/components/hr/hr-ui";
import { fromLocalInput, toLocalInput, type Post, type Team } from "@/components/hr/hr-types";

export type Period = "week" | "month";

/** First and last day of the week or month that contains `day` */
export function periodOf(kind: Period, day: string): { from: string; to: string } {
  if (kind === "week") { const wd = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7; const from = addDays(day, -wd); return { from, to: addDays(from, 6) }; }
  const from = `${day.slice(0, 7)}-01`;
  const next = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 1));
  return { from, to: addDays(next.toISOString().slice(0, 10), -1) };
}

function EntryDialog({ team, entry, onClose, post, onSaved }: { team: Team; entry: TimeEntry | "new"; onClose: () => void; post: Post; onSaved: () => void }) {
  const isNew = entry === "new";
  const [userId, setUserId] = useState(isNew ? team.staff[0]?.id ?? "" : entry.userId);
  const [inAt, setInAt] = useState(isNew ? "" : toLocalInput(entry.in));
  const [outAt, setOutAt] = useState(isNew ? "" : toLocalInput(entry.out));
  const [note, setNote] = useState(isNew ? "" : entry.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setBusy(true); setError(null);
    const err = await post(isNew ? { action: "add-entry", userId, in: fromLocalInput(inAt), out: fromLocalInput(outAt), note } : { action: "edit-entry", id: entry.id, in: fromLocalInput(inAt), out: fromLocalInput(outAt), note });
    setBusy(false);
    if (err) { setError(err); return; }
    toast.success(isNew ? "Hours added" : "Hours fixed"); onSaved();
  }
  const name = team.staff.find((s) => s.id === userId)?.name ?? "";
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 sm:p-4" onClick={() => !busy && onClose()} role="dialog" aria-modal="true" aria-label={isNew ? "Add hours" : "Fix hours"} data-entry-dialog>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{isNew ? "Add hours" : `Fix hours of ${name}`}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 -m-2 rounded-lg text-gray-500 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        {isNew && (
          <div>
            <label htmlFor="en-user" className="block text-xs font-medium text-gray-700 mb-1">Staff member</label>
            <select id="en-user" value={userId} onChange={(e) => setUserId(e.target.value)} className={inputCls}>
              {team.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="en-in" className="block text-xs font-medium text-gray-700 mb-1">Started</label>
            <input id="en-in" type="datetime-local" value={inAt} onChange={(e) => setInAt(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="en-out" className="block text-xs font-medium text-gray-700 mb-1">Finished <span className="font-normal text-gray-400">(empty = still working)</span></label>
            <input id="en-out" type="datetime-local" value={outAt} onChange={(e) => setOutAt(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label htmlFor="en-note" className="block text-xs font-medium text-gray-700 mb-1">Note <span className="font-normal text-gray-400">(optional)</span></label>
          <input id="en-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="For example: forgot to check out" className={inputCls} />
        </div>
        {inAt && outAt && <p className="text-sm text-gray-700">That&apos;s {fmtHours(Math.max(0, (Date.parse(fromLocalInput(outAt)!) - Date.parse(fromLocalInput(inAt)!)) / 3600000))}.</p>}
        {error && <p className="text-sm text-red-600" role="alert" data-error>{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost} disabled={busy}>Cancel</button>
          <button type="button" onClick={save} disabled={busy || !inAt || !userId} className={btnPrimary} data-go="save-entry">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Save</button>
        </div>
      </div>
    </div>
  );
}

function csv(team: Team): string {
  const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [["Name", "Email", "Day", "Started", "Finished", "Hours", "Note", "Fixed by HR"].map(q).join(",")];
  const byName = new Map(team.staff.map((s) => [s.id, s]));
  for (const e of [...team.entries].sort((a, b) => a.in.localeCompare(b.in))) {
    const s = byName.get(e.userId);
    rows.push([s?.name ?? "", s?.email ?? "", dayKey(e.in, team.timeZone), timeIn(e.in, team.timeZone), e.out ? timeIn(e.out, team.timeZone) : "", entryHours(e).toFixed(2), e.note, e.source === "manual" ? "yes" : ""].map(q).join(","));
  }
  rows.push("");
  rows.push(["Name", "Worked hours", "Planned hours", "Difference"].map(q).join(","));
  for (const s of team.staff) rows.push([s.name, s.hours.worked, s.hours.planned, s.hours.diff].map(q).join(","));
  return rows.join("\n");
}

export function HoursTab({ team, period, setPeriod, setRange, post, reload }: {
  team: Team; period: Period; setPeriod: (p: Period) => void; setRange: (from: string) => void; post: Post; reload: () => void;
}) {
  const [editing, setEditing] = useState<TimeEntry | "new" | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const label = period === "week" ? `${dayLabel(team.from)} to ${dayLabel(team.to)}` : new Date(`${team.from}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const move = (dir: number) => setRange(period === "week" ? addDays(team.from, 7 * dir) : periodOf("month", addDays(dir > 0 ? team.to : team.from, dir)).from);

  function download() {
    const blob = new Blob(["﻿" + csv(team)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `hours-${team.from}-to-${team.to}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function remove(e: TimeEntry) {
    if (!confirm("Delete these hours?")) return;
    const err = await post({ action: "delete-entry", id: e.id });
    if (err) toast.error(err); else { toast.success("Deleted"); reload(); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1" role="group" aria-label="Week or month">
          {(["week", "month"] as Period[]).map((p) => (
            <button key={p} type="button" onClick={() => setPeriod(p)} aria-pressed={period === p} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${period === p ? "bg-gray-900 text-white" : "text-gray-600"}`}>{p === "week" ? "Week" : "Month"}</button>
          ))}
        </div>
        <div className="inline-flex items-center gap-1">
          <button type="button" onClick={() => move(-1)} aria-label="Before" className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-semibold text-gray-900 min-w-40 text-center" data-period>{label}</span>
          <button type="button" onClick={() => move(1)} aria-label="Next" className="p-2 rounded-lg hover:bg-gray-100"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="flex-1" />
        <button type="button" onClick={download} className={btnGhost} data-go="csv"><Download className="w-4 h-4" /> Download CSV</button>
        <button type="button" onClick={() => setEditing("new")} disabled={!team.staff.length} className={btnPrimary} data-go="add-entry"><Plus className="w-4 h-4" /> Add hours</button>
      </div>

      <div className={`${card} overflow-hidden`}>
        {team.staff.length === 0 ? <p className="p-5 text-sm text-gray-500">No staff yet. Add staff on Staff &amp; roles.</p> : (
          <ul className="divide-y divide-gray-100">
            {team.staff.map((s) => {
              const mine = team.entries.filter((e) => e.userId === s.id);
              const isOpen = open === s.id;
              return (
                <li key={s.id} data-hours-row={s.name}>
                  <button type="button" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen} className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 text-left hover:bg-gray-50">
                    <span className="flex-1 min-w-40">
                      <span className="text-sm font-semibold text-gray-900">{s.name}</span>
                      {s.open && <span className="ml-2 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">Working now</span>}
                      <span className="block text-xs text-gray-500">{s.roles.join(", ") || "No role"}{s.person.position ? ` · ${s.person.position}` : ""}</span>
                    </span>
                    <span className="text-sm text-gray-900"><b data-worked>{fmtHours(s.hours.worked)}</b> <span className="text-gray-500">of {fmtHours(s.hours.planned)}</span></span>
                    <span className={`text-sm font-semibold w-24 text-right ${s.hours.diff > 0 ? "text-green-700" : s.hours.diff < 0 ? "text-amber-700" : "text-gray-500"}`}>{s.hours.diff > 0 ? "+" : ""}{fmtHours(s.hours.diff)}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4">
                      {mine.length === 0 ? <p className="text-sm text-gray-500">No check-ins in this time.</p> : (
                        <ul className="space-y-1.5">
                          {mine.map((e) => (
                            <li key={e.id} className="flex flex-wrap items-center gap-2 text-sm rounded-xl bg-gray-50 px-3 py-2" data-entry={e.id}>
                              <span className="w-28 text-gray-500">{dayIn(e.in, team.timeZone)}</span>
                              <span className="flex-1 min-w-32 text-gray-800">{timeIn(e.in, team.timeZone)} to {e.out ? timeIn(e.out, team.timeZone) : <span className="text-green-700 font-medium">now</span>}
                                {e.source === "manual" && <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-gray-500"><Wrench className="w-3 h-3" aria-hidden /> fixed</span>}
                                {e.note && <span className="block text-xs text-gray-500">{e.note}</span>}
                              </span>
                              <span className="font-semibold text-gray-900 w-20 text-right">{fmtHours(entryHours(e))}</span>
                              <button type="button" onClick={() => setEditing(e)} aria-label="Fix these hours" className="p-1.5 rounded-lg text-gray-500 hover:bg-white"><Pencil className="w-4 h-4" /></button>
                              <button type="button" onClick={() => remove(e)} aria-label="Delete these hours" className="p-1.5 rounded-lg text-gray-500 hover:bg-white hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="text-xs text-gray-500">Planned hours come from the work times, without approved time off. Hours count on the day someone checked in.</p>
      {editing && <EntryDialog team={team} entry={editing} post={post} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </div>
  );
}
