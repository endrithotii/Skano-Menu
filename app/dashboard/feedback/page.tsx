"use client";

import { useEffect, useState } from "react";
import { Star, MessageSquare, TrendingUp, Filter } from "lucide-react";

interface Feedback {
  id: string;
  rating: number;
  comment: string | null;
  customerName: string | null;
  menuItemId: string | null;
  createdAt: string;
  menuItem?: { name: string } | null;
}

export default function FeedbackPage() {
  const [restaurantId, setRestaurantId] = useState("");
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const statsRes = await fetch("/api/dashboard/stats");
      const stats = await statsRes.json();
      setRestaurantId(stats.restaurantId);
      const res = await fetch(`/api/restaurants/${stats.restaurantId}/feedback`);
      if (res.ok) { const d = await res.json(); setFeedbacks(d.feedbacks ?? []); }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = filter ? feedbacks.filter((f) => f.rating === filter) : feedbacks;
  const avgRating = feedbacks.length > 0 ? feedbacks.reduce((a, f) => a + f.rating, 0) / feedbacks.length : 0;
  const ratingCounts = [5, 4, 3, 2, 1].map((r) => ({ r, count: feedbacks.filter((f) => f.rating === r).length }));

  if (loading) return <div className="p-6 flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customer Feedback</h1>
        <p className="text-sm text-gray-500 mt-1">{feedbacks.length} total reviews</p>
      </div>

      {feedbacks.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center border border-gray-100 shadow-sm">
          <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No reviews yet</h3>
          <p className="text-gray-500 text-sm">Share your QR code to start collecting customer feedback</p>
        </div>
      ) : (
        <>
          {/* Rating summary */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="flex flex-col items-center justify-center">
                <div className="text-6xl font-bold text-gray-900 mb-1">{avgRating.toFixed(1)}</div>
                <div className="flex gap-1 mb-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`w-5 h-5 ${i < Math.round(avgRating) ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />
                  ))}
                </div>
                <div className="text-sm text-gray-500">Based on {feedbacks.length} reviews</div>
                {avgRating >= 4.5 && (
                  <div className="mt-2 flex items-center gap-1 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                    <TrendingUp className="w-3.5 h-3.5" /> Excellent rating!
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {ratingCounts.map(({ r, count }) => (
                  <div key={r} className="flex items-center gap-2">
                    <span className="text-sm text-gray-700 w-6 text-right">{r}</span>
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 flex-shrink-0" />
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="h-2 bg-amber-400 rounded-full transition-all"
                        style={{ width: `${feedbacks.length ? (count / feedbacks.length) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-5">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600 mr-1">Filter:</span>
            {[null, 5, 4, 3, 2, 1].map((r) => (
              <button key={r ?? "all"}
                onClick={() => setFilter(r)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  filter === r ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-700 hover:border-orange-300"
                }`}>
                {r === null ? "All" : `${r}★`}
              </button>
            ))}
          </div>

          {/* Feedback list */}
          <div className="space-y-3">
            {filtered.map((f) => (
              <div key={f.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white font-bold text-xs">
                        {(f.customerName || "A").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{f.customerName || "Anonymous"}</div>
                        {f.menuItem && <div className="text-xs text-gray-500">On: {f.menuItem.name}</div>}
                      </div>
                    </div>
                    <div className="flex gap-0.5 mb-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < f.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />
                      ))}
                    </div>
                    {f.comment && <p className="text-sm text-gray-700 leading-relaxed">{f.comment}</p>}
                  </div>
                  <div className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(f.createdAt).toLocaleDateString("en", { month: "short", day: "numeric" })}
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">No reviews with this rating</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
