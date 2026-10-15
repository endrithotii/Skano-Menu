"use client";

// Staff & roles: staff accounts, what each one may do (a role, optionally from / until a date, plus rules for
// single actions), and the roles themselves (Manager, Waiter, Chef and your own).

import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, Plus, Loader2, X, Shield, Trash2, Pencil, KeyRound, ChevronDown, ChevronUp, Check, Lock, CalendarClock, Info } from "lucide-react";
import toast from "react-hot-toast";
import {
  ALL_PERMISSIONS, PERMISSION_GROUPS, effectivePermissions, emptyMember, permissionLabel, windowStatus,
  type Member, type Permission, type Role, type RoleAssignment,
} from "@/lib/permissions";

interface StaffRow { id: string; name: string; email: string; type: string; createdAt: string; member: Member; now: Permission[] }

const inputCls = "w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";
const btnPrimary = "inline-flex items-center justify-center gap-2 text-sm font-semibold text-white px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50";
const btnGhost = "inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 px-3 py-2 rounded-xl hover:bg-gray-100 disabled:opacity-50";

// ── Dates: the dashboard picks days, stored as times (start of the day / end of the day, local time) ──
const toDay = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fromDay = (day: string, end: boolean) => {
  if (!day) return null;
  const [y, m, d] = day.split("-").map(Number);
  return (end ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d, 0, 0, 0, 0)).toISOString();
};
const fmtDay = (iso: string) => new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

function windowText(from: string | null, until: string | null) {
  if (!from && !until) return "No time limit";
  if (from && until) return `${fmtDay(from)} to ${fmtDay(until)}`;
  return from ? `From ${fmtDay(from)}` : `Until ${fmtDay(until!)}`;
}

function StatusPill({ from, until }: { from: string | null; until: string | null }) {
  const s = windowStatus(from, until);
  const cls = s === "active" ? "bg-green-100 text-green-800 border-green-200" : s === "upcoming" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-gray-100 text-gray-500 border-gray-200";
  const label = s === "active" ? (until ? `Active until ${fmtDay(until)}` : "Active") : s === "upcoming" ? `Starts ${fmtDay(from!)}` : `Ended ${fmtDay(until!)}`;
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>;
}

function DateRange({ from, until, onChange, idPrefix }: { from: string | null; until: string | null; onChange: (from: string | null, until: string | null) => void; idPrefix: string }) {
  const f = toDay(from), u = toDay(until);
  return (
    <div className="flex items-end gap-2 flex-wrap">
      <label className="block">
        <span className="block text-[11px] font-semibold text-gray-500 mb-1">From</span>
        <input type="date" id={`${idPrefix}-from`} value={f} onChange={(e) => onChange(fromDay(e.target.value, false), until)} className={`${inputCls} w-40 py-2`} />
      </label>
      <label className="block">
        <span className="block text-[11px] font-semibold text-gray-500 mb-1">Until</span>
        <input type="date" id={`${idPrefix}-until`} value={u} min={f || undefined} onChange={(e) => onChange(from, fromDay(e.target.value, true))} className={`${inputCls} w-40 py-2`} />
      </label>
      {(f || u) && <button type="button" onClick={() => onChange(null, null)} className="text-xs font-medium text-gray-500 underline pb-2.5">No limit</button>}
    </div>
  );
}

/** Pick one or more roles, each with its own dates */
function RolesPicker({ value, roles, onChange, idPrefix }: { value: RoleAssignment[]; roles: Role[]; onChange: (v: RoleAssignment[]) => void; idPrefix: string }) {
  const has = (id: string) => value.some((a) => a.roleId === id);
  const toggle = (id: string) => onChange(has(id) ? value.filter((a) => a.roleId !== id) : [...value, { roleId: id, from: null, until: null }]);
  const setDates = (id: string, from: string | null, until: string | null) => onChange(value.map((a) => (a.roleId === id ? { ...a, from, until } : a)));
  return (
    <div className="space-y-2" data-roles-picker>
      <div className="flex flex-wrap gap-2">
        {roles.map((r) => {
          const on = has(r.id);
          return (
            <button key={r.id} type="button" onClick={() => toggle(r.id)} aria-pressed={on} data-pick-role={r.name}
              className={`inline-flex items-center gap-1.5 text-sm font-semibold rounded-full border-2 px-3 py-1.5 transition-colors ${on ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
              {on ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {r.name}
            </button>
          );
        })}
      </div>
      {value.length === 0 ? (
        <p className="text-xs text-gray-500">No role. Pick one or more, or give single actions below.</p>
      ) : (
        <ul className="space-y-2">
          {value.map((a) => {
            const r = roles.find((x) => x.id === a.roleId);
            if (!r) return null;
            return (
              <li key={a.roleId} className="rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5 flex items-end gap-3 flex-wrap" data-assigned={r.name}>
                <div className="min-w-[8rem] pb-2">
                  <div className="text-sm font-semibold text-gray-900">{r.name}</div>
                  <div className="text-[11px] text-gray-500">{windowText(a.from, a.until)}</div>
                </div>
                <DateRange idPrefix={`${idPrefix}-${r.id}`} from={a.from} until={a.until} onChange={(f, u) => setDates(a.roleId, f, u)} />
                <button type="button" onClick={() => toggle(a.roleId)} aria-label={`Remove the role ${r.name}`} className="ml-auto mb-1 p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><X className="w-4 h-4" /></button>
              </li>
            );
          })}
        </ul>
      )}
      {value.length > 1 && <p className="text-xs text-gray-500">They can do everything any of these roles allows, while that role&apos;s dates count.</p>}
    </div>
  );
}

export default function StaffPage() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [you, setYou] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const apply = useCallback((d: { roles: Role[]; staff: StaffRow[]; you?: string }) => {
    setRoles(d.roles);
    setStaff(d.staff);
    if (d.you) setYou(d.you);
  }, []);

  const load = useCallback(async (rid: string) => {
    const res = await fetch(`/api/restaurants/${rid}/staff-access`).catch(() => null);
    const d = await res?.json().catch(() => null);
    if (!res?.ok || !d) { setError(d?.error ?? "Could not load your staff."); return; }
    apply(d);
  }, [apply]);

  useEffect(() => {
    void (async () => {
      const a = await fetch("/api/dashboard/access").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!a?.restaurantId) { setError("No restaurant found."); return; }
      setRestaurantId(a.restaurantId);
      await load(a.restaurantId);
    })();
  }, [load]);

  if (error) return <div className="p-6 text-sm text-gray-600">{error}</div>;
  if (!staff || !restaurantId) return <div className="p-6 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-blue-500" /></div>;

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-28">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Staff &amp; roles</h1>
          <p className="text-sm text-gray-500 mt-1">Give your staff their own sign-in and choose what each person can do. Access can start and end on a date you pick.</p>
        </div>
        <button type="button" onClick={() => setAdding(true)} className={btnPrimary} id="add-staff">
          <Plus className="w-4 h-4" /> Add staff member
        </button>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Users className="w-4 h-4 text-blue-500" /> Staff ({staff.length})</h2>
        {staff.length ? (
          <ul className="space-y-2">
            {staff.map((s) => (
              <StaffCard key={s.id} row={s} roles={roles} restaurantId={restaurantId} isYou={s.id === you}
                open={openId === s.id} onToggle={() => setOpenId(openId === s.id ? null : s.id)}
                onSaved={(d) => { apply(d); }} onRemoved={() => { setOpenId(null); void load(restaurantId); }} />
            ))}
          </ul>
        ) : (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
            No staff yet. Add a waiter, a chef or another manager with &quot;Add staff member&quot;.
          </div>
        )}
      </section>

      <RolesSection roles={roles} restaurantId={restaurantId} onSaved={apply} staff={staff} />

      {adding && <AddStaffDialog roles={roles} restaurantId={restaurantId} onClose={() => setAdding(false)} onAdded={(d) => { apply(d); setAdding(false); }} />}
    </div>
  );
}

// ── One staff member ─────────────────────────────────────────────────────────

function StaffCard({ row, roles, restaurantId, isYou, open, onToggle, onSaved, onRemoved }: {
  row: StaffRow; roles: Role[]; restaurantId: string; isYou: boolean; open: boolean;
  onToggle: () => void; onSaved: (d: { roles: Role[]; staff: StaffRow[] }) => void; onRemoved: () => void;
}) {
  const assigned = row.member.roles.map((a) => ({ a, r: roles.find((x) => x.id === a.roleId) })).filter((x) => !!x.r);
  const rules = row.member.rules;
  return (
    <li className="bg-white rounded-2xl border border-gray-100 shadow-sm" data-staff={row.email}>
      <button type="button" onClick={onToggle} disabled={isYou} className="w-full text-left p-4 flex items-start gap-3 disabled:cursor-default">
        <div className="w-10 h-10 shrink-0 rounded-full bg-blue-50 text-blue-700 font-bold flex items-center justify-center">{(row.name || row.email).charAt(0).toUpperCase()}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{row.name || row.email}</span>
            {isYou && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">This is you</span>}
            {assigned.length ? assigned.map(({ a, r }) => (
              <span key={a.roleId} className="inline-flex items-center gap-1">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-100">{r!.name}</span>
                <StatusPill from={a.from} until={a.until} />
              </span>
            )) : (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">No role</span>
            )}
            {rules.length > 0 && <span className="text-[11px] font-medium text-gray-500">+ {rules.length} single action{rules.length === 1 ? "" : "s"}</span>}
          </div>
          <div className="text-xs text-gray-500 mt-0.5 truncate">{row.email}</div>
          <div className="text-xs text-gray-600 mt-1.5">
            {row.now.length === ALL_PERMISSIONS.length ? "Can do everything right now"
              : row.now.length ? `Can now: ${row.now.map(permissionLabel).join(", ")}`
              : "Can't do anything right now"}
          </div>
        </div>
        {!isYou && (open ? <ChevronUp className="w-4 h-4 text-gray-400 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 mt-1" />)}
      </button>
      {open && !isYou && <AccessEditor row={row} roles={roles} restaurantId={restaurantId} onSaved={onSaved} onRemoved={onRemoved} onClose={onToggle} />}
    </li>
  );
}

type RuleMode = "role" | "allow" | "deny";

function AccessEditor({ row, roles, restaurantId, onSaved, onRemoved, onClose }: {
  row: StaffRow; roles: Role[]; restaurantId: string;
  onSaved: (d: { roles: Role[]; staff: StaffRow[] }) => void; onRemoved: () => void; onClose: () => void;
}) {
  const [member, setMember] = useState<Member>(() => structuredClone(row.member));
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState<string | null>(null);
  const myRoles = member.roles.map((a) => roles.find((r) => r.id === a.roleId)).filter((r): r is Role => !!r);
  const fromRole = (p: Permission) => myRoles.some((r) => r.all || r.permissions.includes(p));
  const ruleOf = (p: Permission) => member.rules.find((r) => r.permission === p);
  const preview = useMemo(() => effectivePermissions({ roles, members: {} }, member), [roles, member]);

  function setRule(p: Permission, mode: RuleMode) {
    setMember((m) => {
      const rest = m.rules.filter((r) => r.permission !== p);
      if (mode === "role") return { ...m, rules: rest };
      const old = m.rules.find((r) => r.permission === p);
      return { ...m, rules: [...rest, { permission: p, allow: mode === "allow", from: old?.from ?? null, until: old?.until ?? null }] };
    });
  }
  function setRuleDates(p: Permission, from: string | null, until: string | null) {
    setMember((m) => ({ ...m, rules: m.rules.map((r) => (r.permission === p ? { ...r, from, until } : r)) }));
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/restaurants/${restaurantId}/staff-access`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: row.id, member }),
    }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setSaving(false);
    if (!res?.ok || !d) { toast.error(d?.error ?? "Could not save"); return; }
    toast.success(`Access for ${row.name || row.email} saved`);
    onSaved(d);
    onClose();
  }

  async function remove() {
    if (!window.confirm(`Remove ${row.name || row.email}? Their account is deleted and they can't sign in anymore.`)) return;
    const res = await fetch(`/api/restaurants/${restaurantId}/staff/${row.id}`, { method: "DELETE" }).catch(() => null);
    const d = await res?.json().catch(() => null);
    if (!res?.ok) { toast.error(d?.error ?? "Could not remove"); return; }
    toast.success("Staff member removed");
    onRemoved();
  }

  async function newPassword() {
    if (!pw || pw.length < 6) { toast.error("The password needs at least 6 characters."); return; }
    const res = await fetch(`/api/restaurants/${restaurantId}/staff/${row.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }),
    }).catch(() => null);
    if (!res?.ok) { toast.error("Could not change the password"); return; }
    toast.success("New password saved. Give it to them.");
    setPw(null);
  }

  return (
    <div className="border-t border-gray-100 p-4 space-y-5">
      {/* Roles */}
      <div className="space-y-2">
        <div>
          <div className="text-sm font-semibold text-gray-900">Roles</div>
          <p className="text-xs text-gray-500 flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" /> Give one or more roles. Each role can have its own dates, leave them empty for no limit.</p>
        </div>
        <RolesPicker idPrefix={`role-${row.id}`} value={member.roles} roles={roles} onChange={(v) => setMember((m) => ({ ...m, roles: v }))} />
      </div>

      {/* Single actions */}
      <div className="space-y-2">
        <div>
          <div className="text-sm font-semibold text-gray-900">Actions</div>
          <p className="text-xs text-gray-500">Each action follows the roles, unless you allow it or take it away here, with its own dates if you like.</p>
        </div>
        <div className="rounded-2xl border border-gray-100 divide-y divide-gray-50" data-actions>
          {PERMISSION_GROUPS.map((g) => (
            <div key={g.name} className="p-3 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{g.name}</div>
              {g.items.map((it) => {
                const p = it.key as Permission;
                const rule = ruleOf(p);
                const mode: RuleMode = !rule ? "role" : rule.allow ? "allow" : "deny";
                const on = preview.has(p);
                return (
                  <div key={p} className="rounded-xl px-2 py-1.5 hover:bg-gray-50" data-action={p}>
                    <div className="flex items-start gap-3 flex-wrap">
                      <span className={`mt-0.5 w-5 h-5 shrink-0 rounded-full flex items-center justify-center ${on ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400"}`} title={on ? "Allowed right now" : "Not allowed right now"}>
                        {on ? <Check className="w-3 h-3" strokeWidth={3} /> : <X className="w-3 h-3" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900">{it.label}</div>
                        <div className="text-xs text-gray-500">{it.help}</div>
                      </div>
                      <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 text-xs font-semibold shrink-0" role="radiogroup" aria-label={it.label}>
                        {([["role", fromRole(p) ? "Roles: yes" : "Roles: no"], ["allow", "Allow"], ["deny", "Don't allow"]] as [RuleMode, string][]).map(([m, label]) => (
                          <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setRule(p, m)}
                            className={`px-2.5 py-1.5 rounded-md ${mode === m ? (m === "deny" ? "bg-red-600 text-white" : m === "allow" ? "bg-green-600 text-white" : "bg-gray-900 text-white") : "text-gray-600 hover:bg-gray-100"}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {rule && (
                      <div className="mt-2 ml-8 flex items-end gap-3 flex-wrap">
                        <DateRange idPrefix={`rule-${row.id}-${p}`} from={rule.from} until={rule.until} onChange={(f, u) => setRuleDates(p, f, u)} />
                        <span className="text-xs text-gray-500 pb-2.5">{rule.allow ? "Allowed" : "Not allowed"}: {windowText(rule.from, rule.until).toLowerCase()}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {pw === null ? (
            <button type="button" onClick={() => setPw("")} className={btnGhost}><KeyRound className="w-4 h-4" /> New password</button>
          ) : (
            <span className="flex items-center gap-2">
              <input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (6+ characters)" className={`${inputCls} w-56 py-2`} autoFocus />
              <button type="button" onClick={newPassword} className={btnGhost}>Save</button>
              <button type="button" onClick={() => setPw(null)} className={btnGhost}>Cancel</button>
            </span>
          )}
          <button type="button" onClick={remove} className={`${btnGhost} text-red-600 hover:bg-red-50`}><Trash2 className="w-4 h-4" /> Remove</button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="button" onClick={save} disabled={saving} className={btnPrimary} id={`save-access-${row.id}`}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save access
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add a staff member ───────────────────────────────────────────────────────

function AddStaffDialog({ roles, restaurantId, onClose, onAdded }: {
  roles: Role[]; restaurantId: string; onClose: () => void; onAdded: (d: { roles: Role[]; staff: StaffRow[] }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [member, setMember] = useState<Member>(() => ({ ...emptyMember(), roles: [{ roleId: "waiter", from: null, until: null }] }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/restaurants/${restaurantId}/staff-access`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password, member }),
    }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok || !d) { setError(d?.error ?? "Could not add them. Please try again."); return; }
    toast.success(`${name} can sign in now with ${email.trim().toLowerCase()}`);
    onAdded(d);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => !busy && onClose()}>
      <div className="fixed inset-0 bg-black/40" />
      <form role="dialog" aria-modal="true" aria-label="Add staff member" onClick={(e) => e.stopPropagation()} onSubmit={submit}
        className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Add staff member</h2>
          <p className="text-sm text-gray-500">They sign in on the normal login page with this email and password.</p>
        </div>
        <label className="block"><span className="block text-sm font-medium text-gray-700 mb-1">Name</span>
          <input required id="staff-name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Arta" /></label>
        <label className="block"><span className="block text-sm font-medium text-gray-700 mb-1">Email</span>
          <input required id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="arta@example.com" /></label>
        <label className="block"><span className="block text-sm font-medium text-gray-700 mb-1">Password</span>
          <input required id="staff-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} className={inputCls} placeholder="At least 6 characters" /></label>
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-gray-700">Roles</span>
          <RolesPicker idPrefix="new-staff" value={member.roles} roles={roles} onChange={(v) => setMember((m) => ({ ...m, roles: v }))} />
          <p className="text-xs text-gray-500">For example, pick tomorrow under From to start a role tomorrow.</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="submit" disabled={busy} className={btnPrimary} id="staff-submit">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add</button>
        </div>
      </form>
    </div>
  );
}

// ── Roles ────────────────────────────────────────────────────────────────────

function RolesSection({ roles, restaurantId, staff, onSaved }: {
  roles: Role[]; restaurantId: string; staff: StaffRow[]; onSaved: (d: { roles: Role[]; staff: StaffRow[] }) => void;
}) {
  const [editing, setEditing] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);

  async function saveRoles(next: Role[], message: string) {
    setSaving(true);
    const res = await fetch(`/api/restaurants/${restaurantId}/staff-access`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roles: next }),
    }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setSaving(false);
    if (!res?.ok || !d) { toast.error(d?.error ?? "Could not save"); return false; }
    toast.success(message);
    onSaved(d);
    return true;
  }

  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Shield className="w-4 h-4 text-blue-500" /> Roles</h2>
          <p className="text-xs text-gray-500">A role is a set of actions. Change a role and everyone with it gets the change.</p>
        </div>
        <button type="button" id="add-role" onClick={() => setEditing({ id: `role_${Date.now().toString(36)}`, name: "", permissions: [] })}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border-2 border-blue-500 text-blue-700 bg-blue-50 hover:bg-blue-100">
          <Plus className="w-4 h-4" /> Add a custom role
        </button>
      </div>
      <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((r) => {
          const people = staff.filter((s) => s.member.roles.some((a) => a.roleId === r.id)).length;
          return (
            <li key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2" data-role={r.name}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 flex items-center gap-1.5">{r.name} {r.builtin && <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">built-in</span>}</div>
                  <div className="text-xs text-gray-500">{people} {people === 1 ? "person" : "people"} · {r.all ? "everything" : `${r.permissions.length} action${r.permissions.length === 1 ? "" : "s"}`}</div>
                </div>
                {r.all ? (
                  <span className="text-gray-400" title="A manager can always do everything"><Lock className="w-4 h-4" /></span>
                ) : (
                  <div className="flex items-center gap-0.5">
                    <button type="button" onClick={() => setEditing(structuredClone(r))} aria-label={`Edit ${r.name}`} className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-4 h-4" /></button>
                    {!r.builtin && (
                      <button type="button" aria-label={`Delete ${r.name}`} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => {
                          if (!window.confirm(`Delete the role "${r.name}"?${people ? ` ${people} ${people === 1 ? "person has" : "people have"} it. They keep their other roles.` : ""}`)) return;
                          void saveRoles(roles.filter((x) => x.id !== r.id), `"${r.name}" deleted`);
                        }}><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {r.all ? <span className="text-[11px] rounded-full bg-blue-50 text-blue-800 px-2 py-0.5">Can do everything, including Staff and roles</span>
                  : r.permissions.length ? r.permissions.map((p) => <span key={p} className="text-[11px] rounded-full bg-gray-100 text-gray-700 px-2 py-0.5">{permissionLabel(p)}</span>)
                  : <span className="text-[11px] text-gray-400">No actions yet</span>}
              </div>
            </li>
          );
        })}
      </ul>
      {editing && (
        <RoleEditor role={editing} saving={saving} isNew={!roles.some((r) => r.id === editing.id)} onClose={() => setEditing(null)}
          onSave={async (r) => {
            const exists = roles.some((x) => x.id === r.id);
            const next = exists ? roles.map((x) => (x.id === r.id ? r : x)) : [...roles, r];
            if (await saveRoles(next, `"${r.name}" saved`)) setEditing(null);
          }} />
      )}
    </section>
  );
}

function RoleEditor({ role, isNew, saving, onClose, onSave }: { role: Role; isNew: boolean; saving: boolean; onClose: () => void; onSave: (r: Role) => void }) {
  const [name, setName] = useState(role.name);
  const [perms, setPerms] = useState<Permission[]>(role.permissions);
  const toggle = (p: Permission) => setPerms((list) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p]));
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => !saving && onClose()}>
      <div className="fixed inset-0 bg-black/40" />
      <div role="dialog" aria-modal="true" aria-label={isNew ? "New role" : `Edit ${role.name}`} onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        <h2 className="text-lg font-bold text-gray-900">{isNew ? "New role" : `Edit "${role.name}"`}</h2>
        <label className="block"><span className="block text-sm font-medium text-gray-700 mb-1">Name of the role</span>
          <input id="role-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Head waiter, Shift lead, Host" className={inputCls} autoFocus /></label>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-700">What this role can do</span>
            <span className="flex gap-2 text-xs">
              <button type="button" onClick={() => setPerms([...ALL_PERMISSIONS])} className="font-medium text-blue-600 hover:underline">Select all</button>
              <button type="button" onClick={() => setPerms([])} className="font-medium text-gray-500 hover:underline">Clear</button>
            </span>
          </div>
          <div className="rounded-2xl border border-gray-100 divide-y divide-gray-50" data-role-actions>
            {PERMISSION_GROUPS.map((g) => (
              <div key={g.name} className="p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">{g.name}</div>
                {g.items.map((it) => {
                  const p = it.key as Permission;
                  const on = perms.includes(p);
                  return (
                    <label key={p} className="flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={on} onChange={() => toggle(p)} className="mt-0.5 w-4 h-4 accent-blue-600" aria-label={it.label} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-900">{it.label}</span>
                        <span className="block text-xs text-gray-500">{it.help}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
          {perms.includes("staff.manage") && (
            <p className="flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <Info className="w-3.5 h-3.5 mt-px shrink-0" /> With &quot;Staff and roles&quot; this role can give anyone any access, also itself through another person. Give it only to people you trust like a manager.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="button" disabled={saving || !name.trim()} id="role-save" className={btnPrimary}
            onClick={() => onSave({ ...role, name: name.trim(), permissions: perms })}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save role
          </button>
        </div>
      </div>
    </div>
  );
}

