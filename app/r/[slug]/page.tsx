"use client";

import { useEffect, useState, use } from "react";
import { MapPin, Phone, Globe, Star, MessageSquare, ChevronRight, ArrowLeft, FileText, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ModernMenu } from "@/components/menu-templates/modern";
import { ElegantMenu } from "@/components/menu-templates/elegant";
import { ClassicMenu } from "@/components/menu-templates/classic";
import { VibrantMenu } from "@/components/menu-templates/vibrant";
import { MinimalMenu } from "@/components/menu-templates/minimal";
import { GridMenu } from "@/components/menu-templates/grid";
import { DarkMenu } from "@/components/menu-templates/dark";
import { FlipbookMenu } from "@/components/menu-templates/flipbook";
import { MagazineMenu } from "@/components/menu-templates/magazine";
import { NeonMenu } from "@/components/menu-templates/neon";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  allergens: string;
  tags: string;
  prepTime: number | null;
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
  menuPdfUrl: string | null;
  menuPdfName: string | null;
  primaryMenu: string;
  categories: Category[];
  feedbacks: { rating: number; comment: string | null; customerName: string | null; createdAt: string }[];
  dailyMenu: DailyMenu | null;
}

function parseJson<T>(str: string, fallback: T): T {
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

/* ─── Feedback Form ─────────────────────────────────────────────────────── */
function FeedbackForm({ restaurantId, menuItems, primaryColor }: {
  restaurantId: string;
  menuItems: { id: string; name: string }[];
  primaryColor: string;
}) {
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
          placeholder="Tell us about your experience..." rows={3}
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

/* ─── Menu Tab Bar ──────────────────────────────────────────────────────── */
function MenuTabBar({ active, onSwitch, color }: {
  active: "dynamic" | "static";
  onSwitch: (v: "dynamic" | "static") => void;
  color: string;
}) {
  return (
    <div className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-2xl mx-auto px-4 flex">
        <button
          onClick={() => onSwitch("dynamic")}
          className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${active === "dynamic" ? "border-b-2 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-700"}`}
          style={active === "dynamic" ? { borderBottomColor: color } : {}}>
          <UtensilsCrossed className="w-4 h-4" /> Digital Menu
        </button>
        <button
          onClick={() => onSwitch("static")}
          className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${active === "static" ? "text-gray-900" : "border-transparent text-gray-400 hover:text-gray-700"}`}
          style={active === "static" ? { borderBottomColor: color } : {}}>
          <FileText className="w-4 h-4" /> Scanned Menu
        </button>
      </div>
    </div>
  );
}

/* ─── Static Menu View ──────────────────────────────────────────────────── */
function StaticMenuView({ restaurant, showFeedback, setShowFeedback }: {
  restaurant: Restaurant;
  showFeedback: boolean;
  setShowFeedback: (v: boolean) => void;
}) {
  const isPdf = restaurant.menuPdfUrl?.toLowerCase().endsWith(".pdf");
  const color = restaurant.primaryColor;
  const allItems = restaurant.categories.flatMap((c) => c.items);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Restaurant info bar */}
      <div className="bg-white px-4 py-3 flex flex-wrap gap-4 text-xs text-gray-600 border-b border-gray-100 justify-between items-center">
        <div className="flex flex-wrap gap-4">
          {restaurant.address && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{restaurant.address}</span>}
          {restaurant.phone && <a href={`tel:${restaurant.phone}`} className="flex items-center gap-1 hover:text-orange-600"><Phone className="w-3.5 h-3.5" />{restaurant.phone}</a>}
          {restaurant.website && <a href={restaurant.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-orange-600"><Globe className="w-3.5 h-3.5" />Website</a>}
        </div>
        <button onClick={() => setShowFeedback(!showFeedback)}
          className="flex items-center gap-1 text-xs font-medium" style={{ color }}>
          <MessageSquare className="w-3.5 h-3.5" /> Leave a review
        </button>
      </div>

      {/* PDF / Image */}
      <div className="p-4 pb-20">
        {isPdf ? (
          <iframe
            src={restaurant.menuPdfUrl!}
            title="Scanned menu"
            className="w-full rounded-2xl border border-gray-200 shadow-sm"
            style={{ minHeight: "75vh" }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={restaurant.menuPdfUrl!}
            alt="Scanned menu"
            className="max-w-full mx-auto rounded-2xl shadow-sm border border-gray-100"
          />
        )}
      </div>

      {/* Feedback drawer */}
      {showFeedback && (
        <div className="fixed inset-0 z-40 flex items-end" onClick={() => setShowFeedback(false)}>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
            className="relative w-full bg-white rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto"
            initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", damping: 25 }}
            onClick={(e) => e.stopPropagation()}>
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
  );
}

/* ─── Digital Menu View — routes to the selected template ───────────────── */
function DigitalMenuView({ restaurant, dailyMenu, showFeedback, setShowFeedback }: {
  restaurant: Restaurant;
  dailyMenu: DailyMenu | null;
  showFeedback: boolean;
  setShowFeedback: (v: boolean) => void;
}) {
  const color = restaurant.primaryColor;
  const allItems = restaurant.categories.flatMap((c) => c.items);

  // Transform dailyMenu to the shape templates expect
  const templateDailyMenu = dailyMenu
    ? {
        id: dailyMenu.id,
        notes: dailyMenu.description ?? undefined,
        specials: parseJson<{ name: string; price: number; description?: string }[]>(dailyMenu.items, []).map(
          (s, i) => ({ id: String(i), name: s.name, price: s.price, description: s.description })
        ),
      }
    : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tp = { restaurant: restaurant as any, dailyMenu: templateDailyMenu };

  function renderTemplate() {
    switch (restaurant.templateId) {
      case "elegant":  return <ElegantMenu {...tp} />;
      case "classic":  return <ClassicMenu {...tp} />;
      case "vibrant":  return <VibrantMenu {...tp} />;
      case "minimal":  return <MinimalMenu {...tp} />;
      case "grid":     return <GridMenu {...tp} />;
      case "dark":     return <DarkMenu {...tp} />;
      case "flipbook": return <FlipbookMenu {...tp} />;
      case "magazine": return <MagazineMenu {...tp} />;
      case "neon":     return <NeonMenu {...tp} />;
      default:         return <ModernMenu {...tp} />;
    }
  }

  return (
    <div className="relative">
      {renderTemplate()}

      {/* Floating review button */}
      {!showFeedback && (
        <button onClick={() => setShowFeedback(true)}
          className="fixed bottom-10 right-4 z-30 flex items-center gap-1.5 px-4 py-2.5 rounded-full text-white text-sm font-semibold shadow-lg"
          style={{ background: color, boxShadow: `0 4px 16px ${color}66` }}>
          <MessageSquare className="w-4 h-4" /> Review
        </button>
      )}

      {/* Feedback drawer */}
      {showFeedback && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowFeedback(false)}>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
            className="relative w-full bg-white rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto"
            initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", damping: 25 }}
            onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-4">Leave a Review</h3>
            <FeedbackForm restaurantId={restaurant.id} menuItems={allItems} primaryColor={color} />
          </motion.div>
        </div>
      )}

      {/* Powered by */}
      <div className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur border-t border-gray-100 py-2 text-center z-20">
        <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          Powered by <span className="font-semibold text-orange-500">SkanoMenu</span> <ChevronRight className="w-3 h-3 inline" />
        </Link>
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default function MenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeMenu, setActiveMenu] = useState<"dynamic" | "static">("dynamic");
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/restaurants/${slug}`);
      if (res.ok) {
        const data = await res.json();
        const r: Restaurant = data.restaurant;
        setRestaurant(r);
        // Set primary menu, with fallback if the chosen type isn't available
        const primary = r.primaryMenu || "dynamic";
        const hasDynamic = r.categories.length > 0;
        const hasStatic = !!r.menuPdfUrl;
        if (primary === "static" && !hasStatic && hasDynamic) setActiveMenu("dynamic");
        else if (primary === "dynamic" && !hasDynamic && hasStatic) setActiveMenu("static");
        else setActiveMenu(primary as "dynamic" | "static");
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

  const hasDynamic = restaurant.categories.length > 0;
  const hasStatic = !!restaurant.menuPdfUrl;
  const showTabs = hasDynamic && hasStatic;
  const color = restaurant.primaryColor;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/restaurants" className="flex items-center gap-1 text-gray-600 hover:text-gray-900 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="font-bold text-gray-900 text-sm">{restaurant.name}</div>
          <div className="w-16" /> {/* spacer */}
        </div>

        {/* Tab switcher — only shown when both menu types exist */}
        {showTabs && (
          <div className="max-w-2xl mx-auto px-4 flex border-t border-gray-100">
            <button
              onClick={() => setActiveMenu("dynamic")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeMenu === "dynamic" ? "text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"}`}
              style={activeMenu === "dynamic" ? { borderBottomColor: color } : {}}>
              <UtensilsCrossed className="w-3.5 h-3.5" /> Digital Menu
            </button>
            <button
              onClick={() => setActiveMenu("static")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeMenu === "static" ? "text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"}`}
              style={activeMenu === "static" ? { borderBottomColor: color } : {}}>
              <FileText className="w-3.5 h-3.5" /> Scanned Menu
            </button>
          </div>
        )}
      </div>

      {activeMenu === "static" && hasStatic ? (
        <StaticMenuView
          restaurant={restaurant}
          showFeedback={showFeedback}
          setShowFeedback={setShowFeedback}
        />
      ) : (
        <DigitalMenuView
          restaurant={restaurant}
          dailyMenu={restaurant.dailyMenu}
          showFeedback={showFeedback}
          setShowFeedback={setShowFeedback}
        />
      )}
    </div>
  );
}
