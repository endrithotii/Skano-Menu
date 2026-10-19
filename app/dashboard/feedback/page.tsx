"use client";
import { useEffect, useState } from "react";
import { WaiterFeedbackResults, WaiterFeedbackSettings, useWaiterFeedback } from "@/components/dashboard/waiter-feedback-panel";
import { Star, MessageSquare, TrendingUp, Filter, Reply, Trash2, Check, X, Store, UserRoundCheck } from "lucide-react";
import toast from "react-hot-toast";
import { feedbackEnabled, withFeedbackEnabled } from "@/lib/feedback-settings";

interface Feedback {
  id: string; rating: number; comment: string | null; customerName: string | null;
  menuItemId: string | null; createdAt: string; menuItem?: { name: string } | null;
}
interface Reply { feedbackId: string; reply: string; createdAt: string; }

export default function FeedbackPage() {
  const [restaurantId, setRestaurantId] = useState("");
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<number | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [saving, setSaving] = useState(false);
  // Collect feedback on the public menu (Leave feedback button). null = still loading
  const [collecting, setCollecting] = useState<boolean | null>(null);
  const [switching, setSwitching] = useState(false);
  // Two tabs: the feedback itself, and the settings. In Feedbacks: about the restaurant or about the waiters
  const [tab, setTab] = useState<"feedbacks" | "settings">("feedbacks");
  const [about, setAbout] = useState<"restaurant" | "waiters">("restaurant");
  const wf = useWaiterFeedback(restaurantId);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    void Promise.resolve().then(() => {
      if (q.get("tab") === "settings") setTab("settings");
      if (q.get("about") === "waiters") setAbout("waiters");
    });
  }, []);
  const goTab = (t: "feedbacks" | "settings") => { setTab(t); try { history.replaceState(null, "", t === "settings" ? "?tab=settings" : location.pathname); } catch { /* fine */ } };

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/dashboard/stats").then(r => r.json());
      setRestaurantId(s.restaurantId);
      fetch(`/api/restaurants/${s.restaurantId}`).then(r => r.json())
        .then(d => setCollecting(feedbackEnabled(d?.restaurant?.themeConfig)))
        .catch(() => setCollecting(true));
      const [fd, repd] = await Promise.all([
        fetch(`/api/restaurants/${s.restaurantId}/feedback`).then(r => r.json()),
        fetch(`/api/restaurants/${s.restaurantId}/feedback?includeReplies=1`).then(r => r.json()).catch(() => ({ feedbacks: [] })),
      ]);
      setFeedbacks(fd.feedbacks ?? []);
      // Build replies map from feedbacks that have replies
      const rmap: Record<string, string> = {};
      for (const f of (fd.feedbacks ?? [])) {
        if (f.reply) rmap[f.id] = f.reply;
      }
      setReplies(rmap);
      setLoading(false);
    })();
  }, []);

  async function setCollect(on: boolean) {
    if (!restaurantId || switching) return;
    setSwitching(true);
    try {
      // Read the newest settings first, so nothing else in them is lost
      const d = await fetch(`/api/restaurants/${restaurantId}`).then(r => r.json());
      const res = await fetch(`/api/restaurants/${restaurantId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeConfig: withFeedbackEnabled(d?.restaurant?.themeConfig, on) }),
      });
      if (!res.ok) throw new Error("save");
      setCollecting(on);
      toast.success(on ? "Feedback is on. Customers find Leave feedback under More." : "Feedback is off. Leave feedback is hidden from customers.");
    } catch {
      toast.error("Could not change it. Please try again.");
    }
    setSwitching(false);
  }

  async function submitReply(feedbackId: string) {
    if (!replyText.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/restaurants/${restaurantId}/feedback-reply/${feedbackId}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reply: replyText }),
    });
    setSaving(false);
    if (res.ok) {
      setReplies(r => ({ ...r, [feedbackId]: replyText }));
      setReplyingTo(null); setReplyText("");
      toast.success("Reply saved!");
    } else toast.error("Failed to save reply");
  }

  async function deleteReply(feedbackId: string) {
    await fetch(`/api/restaurants/${restaurantId}/feedback-reply/${feedbackId}`, { method: "DELETE" });
    setReplies(r => { const n = { ...r }; delete n[feedbackId]; return n; });
    toast.success("Reply removed");
  }

  const filtered = filter ? feedbacks.filter(f => f.rating === filter) : feedbacks;
  const avgRating = feedbacks.length > 0 ? feedbacks.reduce((a, f) => a + f.rating, 0) / feedbacks.length : 0;
  const ratingCounts = [5,4,3,2,1].map(r => ({ r, count: feedbacks.filter(f => f.rating === r).length }));

  if (loading) return <div className="p-6 flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customer Feedback</h1>
        <p className="text-sm text-gray-500 mt-1">{feedbacks.length} total reviews · reply publicly to show care</p>
      </div>

      <nav className="flex gap-1 border-b border-gray-200" aria-label="Feedback sections">
        {([["feedbacks", "Feedbacks"], ["settings", "Settings"]] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => goTab(k)} aria-current={tab === k ? "page" : undefined} data-tab={k}
            className={`px-3.5 py-2.5 text-sm font-semibold border-b-2 -mb-px ${tab === k ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}>{label}</button>
        ))}
      </nav>

      {tab === "settings" && (
        <div className="space-y-4" data-settings-tab>
      {/* On / off */}
      <div className={`rounded-2xl border p-4 sm:p-5 flex items-center gap-4 flex-wrap ${collecting === false ? "bg-gray-50 border-gray-200" : "bg-white border-gray-100 shadow-sm"}`}>
        <div className="flex-1 min-w-[14rem]">
          <div className="font-semibold text-gray-900">Collect feedback from customers</div>
          <p className="text-sm text-gray-500 mt-0.5">
            {collecting === false
              ? "Off. Leave feedback is hidden from the More menu on your public menu. Feedback you already got stays here."
              : "On. Customers find Leave feedback under More on your public menu, and what they send shows up here."}
          </p>
        </div>
        <button type="button" role="switch" aria-checked={collecting !== false} aria-label="Collect feedback from customers" id="feedback-switch"
          disabled={collecting === null || switching} onClick={() => setCollect(collecting === false)}
          className={`relative w-14 h-8 shrink-0 rounded-full transition-colors disabled:opacity-50 ${collecting !== false ? "bg-blue-600" : "bg-gray-300"}`}>
          <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${collecting !== false ? "translate-x-6" : ""}`} />
        </button>
      </div>
          <WaiterFeedbackSettings wf={wf} />
        </div>
      )}

      {tab === "feedbacks" && (
        <div className="space-y-6" data-feedbacks-tab>
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1" role="group" aria-label="Feedback about">
            {([["restaurant", "About the restaurant", Store, feedbacks.length], ["waiters", "About waiters", UserRoundCheck, wf.data?.feedback.length ?? 0]] as const).map(([k, label, Icon, n]) => (
              <button key={k} type="button" onClick={() => setAbout(k)} aria-pressed={about === k} data-about={k}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold ${about === k ? "bg-gray-900 text-white" : "text-gray-600"}`}>
                <Icon className="w-4 h-4" aria-hidden /> {label} <span className={`text-xs ${about === k ? "text-gray-300" : "text-gray-400"}`}>{n}</span>
              </button>
            ))}
          </div>
          {about === "waiters" ? <WaiterFeedbackResults wf={wf} onOpenSettings={() => goTab("settings")} /> : (
            <>
      {feedbacks.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center border border-gray-100 shadow-sm">
          <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="font-semibold text-gray-700">No reviews yet</p>
          <p className="text-sm text-gray-400 mt-1">Share your QR code to start collecting feedback</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="flex flex-col items-center justify-center">
                <div className="text-6xl font-bold text-gray-900 mb-1">{avgRating.toFixed(1)}</div>
                <div className="flex gap-1 mb-1">{Array.from({length:5}).map((_,i) => <Star key={i} className={`w-5 h-5 ${i < Math.round(avgRating) ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />)}</div>
                <div className="text-sm text-gray-500">Based on {feedbacks.length} reviews</div>
                {avgRating >= 4.5 && <div className="mt-2 flex items-center gap-1 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full"><TrendingUp className="w-3.5 h-3.5" /> Excellent!</div>}
              </div>
              <div className="space-y-2">{ratingCounts.map(({r,count}) => (
                <div key={r} className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 w-6 text-right">{r}</span>
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 flex-shrink-0" />
                  <div className="flex-1 bg-gray-100 rounded-full h-2"><div className="h-2 bg-amber-400 rounded-full" style={{ width: `${feedbacks.length ? (count/feedbacks.length)*100 : 0}%` }} /></div>
                  <span className="text-xs text-gray-500 w-5">{count}</span>
                </div>
              ))}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400" />
            {[null,5,4,3,2,1].map(r => (
              <button key={r ?? "all"} onClick={() => setFilter(r)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${filter === r ? "bg-blue-500 text-white" : "bg-white border border-gray-200 text-gray-700 hover:border-blue-300"}`}>
                {r === null ? "All" : `${r}★`}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filtered.map(f => (
              <div key={f.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-xs">{(f.customerName||"A").charAt(0).toUpperCase()}</div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{f.customerName || "Anonymous"}</div>
                          {f.menuItem && <div className="text-xs text-gray-400">On: {f.menuItem.name}</div>}
                        </div>
                      </div>
                      <div className="flex gap-0.5 mb-2">{Array.from({length:5}).map((_,i) => <Star key={i} className={`w-4 h-4 ${i < f.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />)}</div>
                      {f.comment && <p className="text-sm text-gray-700">{f.comment}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs text-gray-400">{new Date(f.createdAt).toLocaleDateString("en",{month:"short",day:"numeric"})}</span>
                      <button onClick={() => { setReplyingTo(f.id); setReplyText(replies[f.id] ?? ""); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors" title="Reply">
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Existing reply */}
                {replies[f.id] && replyingTo !== f.id && (
                  <div className="border-t border-gray-100 bg-blue-50/50 px-4 py-3 flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-[10px] font-bold">R</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-blue-700 mb-0.5">Your reply</p>
                      <p className="text-xs text-gray-700">{replies[f.id]}</p>
                    </div>
                    <button onClick={() => deleteReply(f.id)} className="p-1 rounded text-gray-400 hover:text-red-500">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Reply input */}
                {replyingTo === f.id && (
                  <div className="border-t border-gray-100 bg-blue-50/30 px-4 py-3 space-y-2">
                    <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={2}
                      placeholder="Write a public reply to this review…"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none bg-white" />
                    <div className="flex gap-2">
                      <button onClick={() => submitReply(f.id)} disabled={saving || !replyText.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-60 transition-colors">
                        <Check className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Post Reply"}
                      </button>
                      <button onClick={() => { setReplyingTo(null); setReplyText(""); }}
                        className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 text-xs text-gray-600 rounded-lg hover:bg-gray-50">
                        <X className="w-3 h-3" /> Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
