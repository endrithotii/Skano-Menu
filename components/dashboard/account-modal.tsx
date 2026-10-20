"use client";

// "My account": the person who is signed in changes their name, email or password.
// A new email or password needs proof it's you: the current password, or a code we email you (works 5 minutes).
// A new email also needs a code sent to that new email, so a typo can't lock you out.

import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, X, UserRound, Mail, Check } from "lucide-react";
import toast from "react-hot-toast";

type User = { name: string; email: string; role: string };
type Ticket = { ticket: string; sentTo: string; expiresAt: string };
const inputCls = "w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";
const bad = " border-red-300 ring-2 ring-red-500/20";
const until = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function Password({ id, label, value, onChange, show, setShow, autoComplete, hint, error }: {
  id: string; label: string; value: string; onChange: (v: string) => void; show: boolean; setShow: (v: boolean) => void; autoComplete: string; hint?: string; error?: boolean;
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="block text-xs font-semibold text-gray-600 mb-1">{label}</span>
      <span className="relative block">
        <input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete}
          className={`${inputCls} pr-10 ${error ? bad : ""}`} />
        <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide the password" : "Show the password"} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-700">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </span>
      {hint && <span className="block text-[11px] text-gray-500 mt-1">{hint}</span>}
    </label>
  );
}

function CodeInput({ id, label, value, onChange, error, t, onResend, sending }: {
  id: string; label: string; value: string; onChange: (v: string) => void; error?: boolean; t: Ticket; onResend: () => void; sending: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="block" htmlFor={id}>
        <span className="block text-xs font-semibold text-gray-600 mb-1">{label}</span>
        <input id={id} value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6 digits"
          className={`${inputCls} tracking-[0.3em] font-semibold ${error ? bad : ""}`} />
      </label>
      <p className="text-[11px] text-gray-500 flex flex-wrap gap-x-2">
        <span>Sent to {t.sentTo}. It works until {until(t.expiresAt)}.</span>
        <button type="button" onClick={onResend} disabled={sending} className="font-semibold text-blue-700 hover:underline disabled:opacity-50">{sending ? "Sending..." : "Send a new code"}</button>
      </p>
    </div>
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
  // "Don't know it?": a code to your email, instead of the current password
  const [meTicket, setMeTicket] = useState<Ticket | null>(null);
  const [meCode, setMeCode] = useState("");
  // A new email: the code sent to it
  const [emailTicket, setEmailTicket] = useState<Ticket | null>(null);
  const [emailCode, setEmailCode] = useState("");
  const [sending, setSending] = useState<"me" | "email" | null>(null);

  const newEmail = email.trim();
  const emailChanged = newEmail !== user.email;
  const needsMe = emailChanged || !!next;
  const dirty = name.trim() !== user.name || emailChanged || !!next;
  const edit = <T,>(set: (v: T) => void) => (v: T) => { set(v); setError(null); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  async function sendCode(purpose: "me" | "email") {
    setError(null); setSending(purpose);
    const res = await fetch("/api/auth/me/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(purpose === "email" ? { purpose, email: newEmail } : { purpose }) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setSending(null);
    if (!res?.ok) { setError({ text: d?.error || "Could not send the code. Please try again.", field: purpose === "email" ? (d?.field ?? "emailCode") : "meCode" }); return; }
    if (purpose === "me") { setMeTicket(d); setMeCode(""); } else { setEmailTicket(d); setEmailCode(""); }
    toast.success(`Code sent to ${d.sentTo}`);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError({ text: "Write your name", field: "name" }); return; }
    if (next && next.length < 8) { setError({ text: "The new password needs at least 8 characters", field: "next" }); return; }
    if (next && next !== again) { setError({ text: "The two new passwords are not the same", field: "again" }); return; }
    if (needsMe && !meTicket && !current) { setError({ text: "Write your current password, or ask for a code by email", field: "currentPassword" }); return; }
    if (needsMe && meTicket && meCode.length !== 6) { setError({ text: "Write the 6-digit code from your email", field: "meCode" }); return; }
    if (emailChanged && !emailTicket) { setError({ text: "Send a code to the new email to confirm it", field: "emailCode" }); return; }
    if (emailChanged && emailCode.length !== 6) { setError({ text: "Write the 6-digit code we sent to the new email", field: "emailCode" }); return; }
    setSaving(true);
    const res = await fetch("/api/auth/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      name: name.trim(), email: newEmail, newPassword: next || undefined,
      currentPassword: !meTicket && current ? current : undefined,
      meCode: meTicket ? { ticket: meTicket.ticket, code: meCode } : undefined,
      emailCode: emailChanged && emailTicket ? { ticket: emailTicket.ticket, code: emailCode } : undefined,
    }) }).catch(() => null);
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
            <p className="text-xs text-gray-500 truncate">{roleLabel} · {user.email}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        <label className="block" htmlFor="acc-name">
          <span className="block text-xs font-semibold text-gray-600 mb-1">Name</span>
          <input id="acc-name" value={name} onChange={(e) => edit(setName)(e.target.value)} maxLength={80} autoComplete="name" className={`${inputCls} ${error?.field === "name" ? bad : ""}`} />
        </label>

        <div className="space-y-2">
          <label className="block" htmlFor="acc-email">
            <span className="block text-xs font-semibold text-gray-600 mb-1">Email</span>
            <input id="acc-email" type="email" value={email} onChange={(e) => { edit(setEmail)(e.target.value); setEmailTicket(null); setEmailCode(""); }} maxLength={120} autoComplete="email"
              className={`${inputCls} ${error?.field === "email" ? bad : ""}`} />
          </label>
          {emailChanged && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 space-y-2" data-email-confirm>
              <p className="text-sm font-semibold text-gray-800">Confirm the new email</p>
              <p className="text-[11px] text-gray-600">We send a code to {newEmail || "the new email"}, so you know it&apos;s right. You sign in with it from then on.</p>
              {emailTicket ? (
                <CodeInput id="acc-email-code" label="Code from the new email" value={emailCode} onChange={edit(setEmailCode)} error={error?.field === "emailCode"} t={emailTicket} onResend={() => sendCode("email")} sending={sending === "email"} />
              ) : (
                <button type="button" onClick={() => sendCode("email")} disabled={sending === "email"} data-go="send-email-code"
                  className={`inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-gray-900 rounded-lg px-3 py-2 disabled:opacity-50 ${error?.field === "emailCode" ? "ring-2 ring-red-400" : ""}`}>
                  {sending === "email" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Send a code to the new email
                </button>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 space-y-3" data-password-box>
          <div>
            <p className="text-sm font-semibold text-gray-800">Change the password</p>
            {emailChanged && !next && <p className="text-[11px] text-gray-500">Your current password (or a code) is also needed to change the email.</p>}
          </div>
          {meTicket ? (
            <div className="space-y-1" data-me-code>
              <CodeInput id="acc-me-code" label="Code from your email" value={meCode} onChange={edit(setMeCode)} error={error?.field === "meCode"} t={meTicket} onResend={() => sendCode("me")} sending={sending === "me"} />
              <button type="button" onClick={() => { setMeTicket(null); setMeCode(""); setError(null); }} className="text-[11px] font-semibold text-gray-600 hover:underline">Use my current password instead</button>
            </div>
          ) : (
            <div className="space-y-1">
              <Password id="acc-current" label="Current password" value={current} onChange={edit(setCurrent)} show={show} setShow={setShow} autoComplete="current-password" error={error?.field === "currentPassword"} />
              <button type="button" onClick={() => sendCode("me")} disabled={sending === "me"} data-go="send-me-code" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline disabled:opacity-50">
                {sending === "me" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />} Don&apos;t know it? Email me a code to {user.email}
              </button>
            </div>
          )}
          <Password id="acc-new" label="New password" value={next} onChange={edit(setNext)} show={show} setShow={setShow} autoComplete="new-password" hint="At least 8 characters. Leave it empty to keep your password." error={error?.field === "next"} />
          {next && <Password id="acc-again" label="New password again" value={again} onChange={edit(setAgain)} show={show} setShow={setShow} autoComplete="new-password" error={error?.field === "again"} />}
          {next && again && next === again && next.length >= 8 && <p className="text-[11px] text-green-700 inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> The two passwords are the same</p>}
        </div>

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
