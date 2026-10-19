"use client";

// HR tab, Time off: requests to answer, who is off, everyone's balances, adding time off for someone.

import { useState } from "react";
import { Check, X, Plus, Loader2, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { fmtDays, rulesFor, type Leave } from "@/lib/hr";
import { LeaveLine, TimeOffDialog, btnGhost, btnPrimary, card, inputCls } from "@/components/hr/hr-ui";
import type { Post, Team } from "@/components/hr/hr-types";

function Pending({ l, who, post, reload }: { l: Leave; who: string; post: Post; reload: () => void }) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);
  async function decide(approve: boolean) {
    setBusy(approve ? "yes" : "no");
    const err = await post({ action: "decide", id: l.id, approve, answer });
    setBusy(null);
    if (err) { toast.error(err); reload(); return; }
    toast.success(approve ? `Approved. ${who} gets a notification.` : `Declined. ${who} gets a notification.`);
    reload();
  }
  return (
    <div className="p-4 space-y-3" data-pending={l.id}>
      <LeaveLine l={l} who={who} />
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:pl-11">
        <label htmlFor={`ans-${l.id}`} className="sr-only">Answer</label>
        <input id={`ans-${l.id}`} value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={300} placeholder="Answer (optional, they see it)" className={`${inputCls} sm:flex-1`} />
        <div className="flex gap-2">
          <button type="button" onClick={() => decide(true)} disabled={!!busy} data-go="approve" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl px-4 py-2.5 disabled:opacity-50">
            {busy === "yes" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
          </button>
          <button type="button" onClick={() => decide(false)} disabled={!!busy} data-go="decline" className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 border border-red-200 hover:bg-red-50 rounded-xl px-4 py-2.5 disabled:opacity-50">
            {busy === "no" ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />} Decline
          </button>
        </div>
      </div>
    </div>
  );
}

export function TimeOffTab({ team, post, reload }: { team: Team; post: Post; reload: () => void }) {
  const [adding, setAdding] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const name = (id: string) => team.staff.find((s) => s.id === id)?.name ?? "Former staff member";
  const pending = team.leaves.filter((l) => l.status === "pending").sort((a, b) => a.from.localeCompare(b.from));
  const upcoming = team.leaves.filter((l) => l.status === "approved" && l.to >= team.today).sort((a, b) => a.from.localeCompare(b.from));
  const past = team.leaves.filter((l) => !pending.includes(l) && !upcoming.includes(l));
  const year = team.to.slice(0, 4);

  async function remove(l: Leave) {
    if (!confirm(`Remove ${name(l.userId)}'s time off? They get a notification.`)) return;
    const err = await post({ action: "remove-leave", id: l.id });
    if (err) toast.error(err); else { toast.success("Removed"); reload(); }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2" aria-label="Requests to answer">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-gray-900">Requests to answer {pending.length > 0 && <span className="ml-1 text-[11px] font-bold rounded-full px-1.5 bg-red-500 text-white">{pending.length}</span>}</h2>
          <button type="button" onClick={() => setAdding(true)} disabled={!team.staff.length} className={btnPrimary} data-go="add-leave"><Plus className="w-4 h-4" /> Add time off for someone</button>
        </div>
        <div className={`${card} divide-y divide-gray-100`}>
          {pending.length === 0 ? <p className="p-4 text-sm text-gray-500">Nothing to answer right now.</p> : pending.map((l) => <Pending key={l.id} l={l} who={name(l.userId)} post={post} reload={reload} />)}
        </div>
      </section>

      <section className="space-y-2" aria-label="Coming up">
        <h2 className="font-semibold text-gray-900">Off now and coming up</h2>
        <div className={`${card} divide-y divide-gray-100`}>
          {upcoming.length === 0 ? <p className="p-4 text-sm text-gray-500">Nobody has time off coming up.</p> : upcoming.map((l) => (
            <div key={l.id} className="p-4"><LeaveLine l={l} who={name(l.userId)} right={<button type="button" onClick={() => remove(l)} aria-label="Remove this time off" className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>} /></div>
          ))}
        </div>
      </section>

      <section className="space-y-2" aria-label="Balances">
        <h2 className="font-semibold text-gray-900">Days left in {year}</h2>
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full text-sm min-w-[560px]">
            <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Vacation left</th><th className="px-4 py-3 font-medium">Sick days left</th><th className="px-4 py-3 font-medium">Unpaid taken</th><th className="px-4 py-3 font-medium">Waiting</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {team.staff.map((s) => {
                const b = (k: string) => s.balances.find((x) => x.kind === k)!;
                const r = rulesFor(team.settings, s.id);
                const waiting = s.balances.reduce((n, x) => n + x.pending, 0);
                return (
                  <tr key={s.id} data-balance-row={s.name}>
                    <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3">{fmtDays(Math.max(0, b("vacation").left ?? 0))} <span className="text-gray-400">of {r.vacationDays}</span></td>
                    <td className="px-4 py-3">{fmtDays(Math.max(0, b("sick").left ?? 0))} <span className="text-gray-400">of {r.sickDays}</span></td>
                    <td className="px-4 py-3">{fmtDays(b("unpaid").used)}</td>
                    <td className="px-4 py-3">{waiting ? fmtDays(waiting) : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {past.length > 0 && (
        <section className="space-y-2" aria-label="Earlier">
          <button type="button" onClick={() => setShowAll((v) => !v)} className={btnGhost}>{showAll ? "Hide" : "Show"} earlier time off and answered requests ({past.length})</button>
          {showAll && <div className={`${card} divide-y divide-gray-100`}>{past.slice(0, 200).map((l) => <div key={l.id} className="p-4"><LeaveLine l={l} who={name(l.userId)} /></div>)}</div>}
        </section>
      )}

      {adding && (
        <TimeOffDialog title="Add time off" hrMode today={team.today} noticeDays={0}
          staff={team.staff.map((s) => ({ id: s.id, name: s.name }))}
          person={(id) => team.settings.people[id]} minUnit={() => "hour"}
          onClose={() => setAdding(false)}
          onSubmit={async (input) => {
            const err = await post({ action: "add-leave", ...input });
            if (err) return err;
            toast.success("Added. They get a notification.");
            setAdding(false); reload();
            return null;
          }} />
      )}
    </div>
  );
}
