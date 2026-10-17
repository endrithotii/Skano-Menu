"use client";

// The customer cancels a reservation with the link in the reminder email

import { use, useEffect, useState } from "react";
import { CalendarX, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";

interface Info { restaurant: { name: string; phone: string | null; slug: string | null }; name: string; when: string; guests: number; table: string | null; status: string; past: boolean }

export default function CancelReservationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [info, setInfo] = useState<Info | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/reservations/cancel?token=${encodeURIComponent(token)}`).then(async (r) => {
      const d = await r.json().catch(() => null);
      if (!r.ok || !d) setFailed(d?.error ?? "This link isn't valid."); else setInfo(d);
    }).catch(() => setFailed("Could not load the reservation. Please try again."));
  }, [token]);

  async function cancel() {
    setBusy(true); setError(null);
    const r = await fetch("/api/reservations/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setBusy(false);
    if (!r?.ok || !d) { setError(d?.error ?? "Could not cancel. Please try again or call the restaurant."); return; }
    setInfo(d);
  }

  const body = failed ? (
    <p className="text-center text-gray-600">{failed}</p>
  ) : !info ? (
    <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  ) : (
    <>
      <h1 className="text-xl font-bold text-gray-900 text-center">{info.restaurant.name}</h1>
      <div className="mt-4 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-700 text-center" data-reservation>
        <div className="font-semibold text-gray-900">{info.when}</div>
        <div>{info.guests} person{info.guests === 1 ? "" : "s"}{info.table ? `, ${info.table}` : ""}</div>
        <div className="text-gray-500">Reserved by {info.name}</div>
      </div>
      {info.status === "cancelled" ? (
        <div className="mt-5 text-center" data-cancelled>
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
          <p className="mt-2 font-semibold text-gray-900">Your reservation is cancelled</p>
          <p className="text-sm text-gray-500 mt-1">Thank you for letting us know. The restaurant got a message.</p>
          {info.restaurant.slug && <a href={`/reserve/${info.restaurant.slug}`} className="inline-block mt-4 text-sm font-semibold text-blue-600 underline">Reserve another time</a>}
        </div>
      ) : info.status !== "accepted" || info.past ? (
        <p className="mt-5 text-center text-sm text-gray-600">This reservation can&apos;t be cancelled here anymore.{info.restaurant.phone && <> Please call <a href={`tel:${info.restaurant.phone}`} className="font-semibold underline">{info.restaurant.phone}</a>.</>}</p>
      ) : (
        <>
          <p className="mt-5 text-center text-sm text-gray-600">Can&apos;t come? Cancel here, so someone else can have the table.</p>
          {error && <p className="mt-3 flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</p>}
          <button type="button" onClick={cancel} disabled={busy} id="cancel-reservation"
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-semibold py-3.5 disabled:opacity-50">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarX className="w-5 h-5" />} Cancel my reservation
          </button>
          <p className="mt-3 text-center text-xs text-gray-500">Still coming? Then you don&apos;t need to do anything.</p>
        </>
      )}
    </>
  );

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-gray-100 shadow-sm p-6">{body}</div>
    </main>
  );
}
