"use client";

import { useEffect, useState, use } from "react";
import { MapPin, Phone, Globe, Star, MessageSquare, Calendar, ChevronRight, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  allergens: string;
  tags: string;
  isAvailable: boolean;
  isFeatured: boolean;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
  items: MenuItem[];
}

interface DailyMenu {
  id: string;
  title: string | null;
  description: string | null;
  items: string;
}

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  cuisine: string;
  primaryColor: string;
  templateId: string;
  categories: Category[];
  feedbacks: { rating: number; comment: string | null; customerName: string | null; createdAt: string }[];
  dailyMenu: DailyMenu | null;
}

function parseJson<T>(str: string, fallback: T): T {
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

function FeedbackForm({ restaurantId, menuItems, primaryColor }: { restaurantId: string; menuItems: { id: string; name: string }[]; primaryColor: string }) {
  const [form, setForm] = useState({ rating: 0, comment: "", customerName: "", menuItemId: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.rating === 0) return;
    setLoading(true);
    await fetch(`/api/restaurants/${restaurantId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    setSubmitted(true);
  }

  if (submitted) return (
    <div className="text-center py-8">
      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <Star className="w-6 h-6 text-green-600" />
      </div>
      <p className="font-semibold text-gray-900">Thank you for your feedback!</p>
      <p className="text-sm text-gray-500 mt-1">Your review helps improve the restaurant.</p>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Your rating *</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} type="button" onClick={() => setForm({ ...form, rating: s })}
              className={`text-2xl transition-transform hover:scale-110 ${s <= form.rating ? "text-amber-400" : "text-gray-300"}`}>
              ★
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Which dish? (optional)</label>
        <select value={form.menuItemId} onChange={(e) => setForm({ ...form, menuItemId: e.target.value })}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500">
          <option value="">Overall experience</option>
          {menuItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Comment (optional)</label>
        <textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })}
          placeholder="Tell us about your experience..."
          rows={3}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 resize-none" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Your name (optional)</label>
        <input type="text" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })}
          placeholder="Anonymous"
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500" />
      </div>
      <button type="submit" disabled={form.rating === 0 || loading}
        style={{ background: `linear-gradient(to right, ${primaryColor}, ${primaryColor}cc)` }}
        className="w-full text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50 transition-opacity">
        {loading ? "Submitting..." : "Submit Review"}
      </button>
    </form>
  );
}

function ModernTemplate({ restaurant, dailyMenu }: { restaurant: Restaurant; dailyMenu: DailyMenu | null }) {
  const [activeCategory, setActiveCategory] = useState(restaurant.categories[0]?.id || "");
  const [showFeedback, setShowFeedback] = useState(false);
  const color = restaurant.primaryColor;
  const allItems = restaurant.categories.flatMap((c) => c.items);
  const avgRating = restaurant.feedbacks.length > 0
    ? restaurant.feedbacks.reduce((a, f) => a + f.rating, 0) / restaurant.feedbacks.length : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/restaurants" className="flex items-center gap-1 text-gray-600 hover:text-gray-900 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="font-bold text-gray-900 text-sm">{restaurant.name}</div>
          <button onClick={() => setShowFeedback(!showFeedback)}
            className="text-sm font-medium flex items-center gap-1" style={{ color }}>
            <MessageSquare className="w-4 h-4" /> Review
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-2xl mx-auto">
        <div className="h-48 relative flex items-end p-6"
          style={{ background: `linear-gradient(135deg, ${color}ff, ${color}88)` }}>
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">{restaurant.name}</h1>
            {restaurant.description && <p className="text-white/80 text-sm line-clamp-2">{restaurant.description}</p>}
          </div>
          {avgRating > 0 && (
            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="text-sm font-bold text-gray-900">{avgRating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Info bar */}
        <div className="bg-white px-4 py-3 flex flex-wrap gap-4 text-xs text-gray-600 border-b border-gray-100">
          {restaurant.address && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{restaurant.address}</span>}
          {restaurant.phone && <a href={`tel:${restaurant.phone}`} className="flex items-center gap-1 hover:text-orange-600"><Phone className="w-3.5 h-3.5" />{restaurant.phone}</a>}
          {restaurant.website && <a href={restaurant.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-orange-600"><Globe className="w-3.5 h-3.5" />Website</a>}
        </div>

        {/* Daily specials */}
        {dailyMenu && (
          <div className="mx-4 mt-4 rounded-2xl p-4 text-white" style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)` }}>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4" />
              <span className="font-semibold text-sm">{dailyMenu.title || "Today&apos;s Specials"}</span>
            </div>
            {dailyMenu.description && <p className="text-white/80 text-xs mb-3">{dailyMenu.description}</p>}
            <div className="space-y-2">
              {parseJson<{ name: string; price: number; description?: string }[]>(dailyMenu.items, []).map((item, i) => (
                <div key={i} className="flex justify-between items-center bg-white/20 rounded-xl px-3 py-2">
                  <div>
                    <div className="text-sm font-medium">{item.name}</div>
                    {item.description && <div className="text-xs text-white/70">{item.description}</div>}
                  </div>
                  <span className="font-bold text-sm">€{item.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category tabs */}
        <div className="sticky top-[57px] z-20 bg-white border-b border-gray-100">
          <div className="flex overflow-x-auto scrollbar-hide px-4 py-3 gap-2">
            {restaurant.categories.map((cat) => (
              <button key={cat.id} onClick={() => {
                setActiveCategory(cat.id);
                document.getElementById(`cat-${cat.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                  activeCategory === cat.id ? "text-white shadow-md" : "bg-gray-100 text-gray-700"
                }`}
                style={activeCategory === cat.id ? { background: color } : {}}>
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Menu items */}
        <div className="p-4 space-y-8 pb-32">
          {restaurant.categories.map((cat) => (
            <div key={cat.id} id={`cat-${cat.id}`}>
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                {cat.icon} {cat.name}
              </h2>
              <div className="space-y-3">
                {cat.items.filter((i) => i.isAvailable).map((item, idx) => {
                  const tags = parseJson<string[]>(item.tags, []);
                  const allergens = parseJson<string[]>(item.allergens, []);
                  return (
                    <motion.div key={item.id}
                      className={`bg-white rounded-2xl p-4 shadow-sm border ${item.isFeatured ? "border-orange-200" : "border-gray-100"}`}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900">{item.name}</span>
                                {item.isFeatured && (
                                  <span className="text-xs px-1.5 py-0.5 rounded-full text-white font-medium" style={{ background: color }}>★ Featured</span>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{item.description}</p>
                              )}
                            </div>
                            <span className="font-bold text-gray-900 text-sm whitespace-nowrap">€{item.price.toFixed(2)}</span>
                          </div>
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {tags.map((t) => (
                                <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{t}</span>
                              ))}
                            </div>
                          )}
                          {allergens.length > 0 && (
                            <div className="text-xs text-gray-400 mt-1.5">
                              Contains: {allergens.join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Reviews section */}
          {restaurant.feedbacks.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Star className="w-5 h-5" style={{ color }} /> Reviews
              </h2>
              <div className="space-y-3">
                {restaurant.feedbacks.slice(0, 5).map((f, i) => (
                  <div key={i} className="bg-white rounded-xl p-4 border border-gray-100">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, s) => (
                          <Star key={s} className={`w-3.5 h-3.5 ${s < f.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />
                        ))}
                      </div>
                      <span className="text-xs text-gray-400">{f.customerName || "Anonymous"}</span>
                    </div>
                    {f.comment && <p className="text-sm text-gray-700">{f.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Feedback drawer */}
        {showFeedback && (
          <div className="fixed inset-0 z-40 flex items-end" onClick={() => setShowFeedback(false)}>
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div
              className="relative w-full bg-white rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto"
              initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-4">Leave a Review</h3>
              <FeedbackForm restaurantId={restaurant.id} menuItems={allItems} primaryColor={color} />
            </motion.div>
          </div>
        )}

        {/* Powered by */}
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 py-2 text-center">
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Powered by <span className="font-semibold text-orange-500">SkanoMenu</span> <ChevronRight className="w-3 h-3 inline" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function MenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/restaurants/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setRestaurant(data.restaurant);
      } else {
        setError("Restaurant not found");
      }
      setLoading(false);
    }
    load();
  }, [slug]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
    </div>
  );

  if (error || !restaurant) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-center p-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Restaurant not found</h2>
        <p className="text-gray-500 mb-4">This restaurant may not be active yet.</p>
        <Link href="/restaurants" className="text-orange-600 hover:underline font-semibold">Browse all restaurants</Link>
      </div>
    </div>
  );

  return <ModernTemplate restaurant={restaurant} dailyMenu={restaurant.dailyMenu} />;
}
