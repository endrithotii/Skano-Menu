"use client";

// "My account": the person who is signed in changes their name, email or password.
// A new email or password needs the current password.

import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, X, UserRound } from "lucide-react";
import toast from "react-hot-toast";

type User = { name: string; email: string; role: string };
const inputCls = "w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";

function Password({ id, label, value, onChange, show, setShow, autoComplete, hint, error }: {
  id: string; label: string; value: string; onChange: (v: string) => void; show: boolean; setShow: (v: boolean) => void; autoComplete: string; hint?: string; error?: boolean;
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="block text-xs font-semibold text-gray-600 mb-1">{label}</span>
      <span className="relative block">
        <input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete}
          className={`${inputCls} pr-10 ${error ? "border-red-300 ring-2 ring-red-500/20" : ""}`} />
        <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide the password" : "Show the password"} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-700">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </span>
      {hint && <span className="block text-[11px] text-gray-500 mt-1">{hint}</span>}
    </label>
  );
}

export function AccountModal({ user, roleLabel, onClose, onSaved }: { user: User; roleLabel: string; onClose: () => void; onSaved: (u: User) => void }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);

  const emailChanged = email.trim() !== user.email;
  const needsCurrent = emailChanged || !!next;
  const dirty = name.trim() !== user.name || emailChanged || !!next;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError({ text: "Write your name", field: "name" }); return; }
    if (next && next.length < 8) { setError({ text: "The new password needs at least 8 characters", field: "next" }); return; }
    if (next && next !== again) { setError({ text: "The two new passwords are not the same", field: "again" }); return; }
    if (needsCurrent && !current) { setError({ text: emailChanged ? "Write your current password to change the email" : "Write your current password to change it", field: "currentPassword" }); return; }
    setSaving(true);
    const res = await fetch("/api/auth/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), email: email.trim(), newPassword: next || undefined, currentPassword: current || undefined }) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setSaving(false);
    if (!res?.ok) { setError({ text: d?.error || "Could not save. Please try again.", field: d?.field }); return; }
    toast.success(next ? "Saved. Use your new password next time you sign in." : "Saved");
    onSaved(d.user);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4" data-account-modal>
      <div className="absolute inset-0 bg-black/40" onClick={() => !saving && onClose()} />
      <form onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="account-title"
        className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><UserRound className="w-5 h-5" aria-hidden /></span>
          <div className="flex-1 min-w-0">
            <h2 id="account-title" className="text-lg font-bold text-gray-900">My account</h2>
            <p className="text-xs text-gray-500">{roleLabel} · {user.email}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        <label className="block" htmlFor="acc-name">
          <span className="block text-xs font-semibold text-gray-600 mb-1">Name</span>
          <input id="acc-name" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} maxLength={80} autoComplete="name" className={`${inputCls} ${error?.field === "name" ? "border-red-300" : ""}`} />
        </label>
        <label className="block" htmlFor="acc-email">
          <span className="block text-xs font-semibold text-gray-600 mb-1">Email</span>
          <input id="acc-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} maxLength={120} autoComplete="email" className={`${inputCls} ${error?.field === "email" ? "border-red-300 ring-2 ring-red-500/20" : ""}`} />
          {emailChanged && <span className="block text-[11px] text-gray-500 mt-1">You sign in with the new email from now on.</span>}
        </label>

        <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 space-y-3">
          <p className="text-sm font-semibold text-gray-800">Change the password</p>
          <Password id="acc-new" label="New password" value={next} onChange={(v) => { setNext(v); setError(null); }} show={show} setShow={setShow} autoComplete="new-password" hint="At least 8 characters. Leave it empty to keep your password." error={error?.field === "next"} />
          {next && <Password id="acc-again" label="New password again" value={again} onChange={(v) => { setAgain(v); setError(null); }} show={show} setShow={setShow} autoComplete="new-password" error={error?.field === "again"} />}
        </div>

        {needsCurrent && (
          <Password id="acc-current" label="Your current password" value={current} onChange={(v) => { setCurrent(v); setError(null); }} show={show} setShow={setShow} autoComplete="current-password"
            hint={emailChanged && next ? "Needed to change the email and the password." : emailChanged ? "Needed to change the email." : "Needed to change the password."} error={error?.field === "currentPassword"} />
        )}

        {error && <p className="text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2" role="alert">{error.text}</p>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={saving} className="text-sm font-semibold text-gray-600 hover:text-gray-900 px-3 py-2.5">Cancel</button>
          <button type="submit" disabled={!dirty || saving} data-go="account-save"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl px-5 py-2.5 disabled:opacity-40">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
          </button>
        </div>
      </form>
    </div>
  );
}
