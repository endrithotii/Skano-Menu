"use client";

// Waiter confirms a loyalty stamp. The customer's QR code opens this page (or the waiter types the code
// on their waiter page). Not signed in: goes to the login page and comes back here after.

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Stamp, Gift, Check, Loader2, AlertCircle, ArrowLeft } from "lucide-react";

interface Info {
  restaurantName: string;
  customer: string;
  kind: "stamp" | "reward";
  status: "pending" | "approved" | "expired";
  stamps: number;
  total: number;
  reward: string;
  allowed: boolean;
}

export default function StampPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ stamps: number; total: number } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/stamp/${encodeURIComponent(code)}`).catch(() => null);
    if (res?.status === 401) {
      router.replace(`/login?next=${encodeURIComponent(`/stamp/${code}`)}`);
      return;
    }
    const d = await res?.json().catch(() => null);
    if (!res?.ok) { setError(d?.error ?? "Could not load this code."); return; }
    setInfo(d);
  }, [code, router]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/stamp/${encodeURIComponent(code)}`, { method: "POST" }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { setError(d?.error ?? "Could not confirm. Please try again."); return; }
    setDone({ stamps: d.stamps, total: d.total });
  }

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {children}
        <Link href="/waiter" className="mt-6 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"><ArrowLeft className="w-4 h-4" /> Waiter page</Link>
      </div>
    </div>
  );

  if (error && !info) {
    return shell(
      <div className="rounded-3xl bg-gray-900 border border-white/10 p-6 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="font-semibold">{error}</p>
      </div>,
    );
  }
  if (!info) return shell(<div className="flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>);

  const isReward = info.kind === "reward";
  if (done) {
    return shell(
      <div className="rounded-3xl bg-green-600 p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-white text-green-600 flex items-center justify-center mx-auto mb-3"><Check className="w-8 h-8" strokeWidth={3} /></div>
        <p className="text-xl font-bold">{isReward ? "Reward given" : "Stamp added"}</p>
        <p className="text-white/85 mt-1">{isReward ? `The card of ${info.customer} starts again.` : `${info.customer} now has ${done.stamps} of ${done.total} stamps.`}</p>
      </div>,
    );
  }

  return shell(
    <div className="rounded-3xl bg-gray-900 border border-white/10 p-6">
      <div className="text-xs text-gray-400">{info.restaurantName} · code {code.toUpperCase()}</div>
      <div className="mt-3 flex items-center gap-3">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isReward ? "bg-green-500/20 text-green-300" : "bg-blue-500/20 text-blue-300"}`}>
          {isReward ? <Gift className="w-6 h-6" /> : <Stamp className="w-6 h-6" />}
        </div>
        <div>
          <div className="text-lg font-bold">{isReward ? `Give the reward: ${info.reward}` : "Add 1 stamp"}</div>
          <div className="text-sm text-gray-400">for {info.customer} · {info.stamps} of {info.total} stamps now</div>
        </div>
      </div>

      {info.status !== "pending" ? (
        <p className="mt-5 text-sm text-amber-300">{info.status === "approved" ? "This code was already used." : "This code ran out. Ask the customer to make a new one."}</p>
      ) : !info.allowed ? (
        <p className="mt-5 text-sm text-amber-300">You are not allowed to give stamps. Ask the manager to allow it on the Loyalty Cards page.</p>
      ) : (
        <>
          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
          <button type="button" onClick={confirm} disabled={busy}
            className={`mt-5 w-full inline-flex items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold disabled:opacity-50 ${isReward ? "bg-green-500 hover:bg-green-600" : "bg-blue-500 hover:bg-blue-600"}`}>
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} {isReward ? "Confirm reward" : "Confirm stamp"}
          </button>
        </>
      )}
    </div>,
  );
}
