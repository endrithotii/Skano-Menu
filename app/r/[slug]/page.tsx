"use client";

import { useEffect, useState, use } from "react";
import {
  MapPin, Phone, Globe, Star, MessageSquare, ChevronRight, ArrowLeft,
  Wifi, Copy, Check, X, Search, Clock, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image?: string | null;
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

interface SocialLinks {
  instagram?: string;
  facebook?: string;
  whatsapp?: string;
  tripadvisor?: string;
}

interface DaySchedule {
  open: string;
  close: string;
  closed: boolean;
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
  openingHours: string;
  announcement: string | null;
  socialLinks: string;
  wifiPassword: string | null;
  categories: Category[];
  feedbacks: { rating: number; comment: string | null; customerName: string | null; createdAt: string }[];
  dailyMenu: DailyMenu | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

function getOpenStatus(openingHoursJson: string): { isOpen: boolean; text: string } | null {
  try {
    const hours = parseJson<Record<string, DaySchedule>>(openingHoursJson, {});
    if (!hours || Object.keys(hours).length === 0) return null;
    const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const now = new Date();
    const today = DAYS[now.getDay()];
    const schedule = hours[today];
    if (!schedule) return null;
    if (schedule.closed) {
      // Look ahead for next open day
      for (let d = 1; d <= 7; d++) {
        const nextDay = DAYS[(now.getDay() + d) % 7];
        const next = hours[nextDay];
        if (next && !next.closed) {
          const label = d === 1 ? "Tomorrow" : nextDay.charAt(0).toUpperCase() + nextDay.slice(1);
          return { isOpen: false, text: `Closed · Opens ${label} ${next.open}` };
        }
      }
      return { isOpen: false, text: "Closed today" };
    }
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const [oh, om] = schedule.open.split(":").map(Number);
    const [ch, cm] = schedule.close.split(":").map(Number);
    const openMin = oh * 60 + om;
    const closeMin = ch * 60 + cm;
    if (nowMin >= openMin && nowMin < closeMin) {
      return { isOpen: true, text: `Open · Closes ${schedule.close}` };
    } else if (nowMin < openMin) {
      return { isOpen: false, text: `Closed · Opens at ${schedule.open}` };
    } else {
      // Look ahead for next open day
      for (let d = 1; d <= 7; d++) {
        const nextDay = DAYS[(now.getDay() + d) % 7];
        const next = hours[nextDay];
        if (next && !next.closed) {
          const label = d === 1 ? "Tomorrow" : nextDay.charAt(0).toUpperCase() + nextDay.slice(1);
          return { isOpen: false, text: `Closed · Opens ${label} ${next.open}` };
        }
      }
      return { isOpen: false, text: "Closed" };
    }
  } catch {
    return null;
  }
}

function makeSocialUrl(platform: "instagram" | "facebook" | "tripadvisor", value: string): string {
  if (!value) return "#";
  if (value.startsWith("http")) return value;
  const bases: Record<string, string> = {
    instagram: "https://instagram.com/",
    facebook: "https://facebook.com/",
    tripadvisor: "https://tripadvisor.com/",
  };
  return (bases[platform] ?? "https://") + value;
}

// ─── Social Icons (inline SVG) ────────────────────────────────────────────────

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

const TripAdvisorIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12.006 4.295c-2.67 0-5.338.784-7.645 2.353H0l1.963 2.135a5.587 5.587 0 0 0-.946 3.137 5.618 5.618 0 0 0 5.618 5.618 5.594 5.594 0 0 0 3.768-1.456l1.6 1.742 1.6-1.742a5.594 5.594 0 0 0 3.769 1.456 5.618 5.618 0 0 0 5.617-5.618 5.587 5.587 0 0 0-.946-3.137L24 6.648h-4.35a13.826 13.826 0 0 0-7.644-2.353zm0 1.723a12.068 12.068 0 0 1 5.736 1.44 5.616 5.616 0 0 0-5.736 5.462 5.616 5.616 0 0 0-5.735-5.461 12.068 12.068 0 0 1 5.735-1.441zm-5.371 3.51a3.895 3.895 0 1 1 0 7.789 3.895 3.895 0 0 1 0-7.79zm10.742 0a3.895 3.895 0 1 1 0 7.789 3.895 3.895 0 0 1 0-7.79zm-10.742 1.51a2.385 2.385 0 1 0 0 4.769 2.385 2.385 0 0 0 0-4.77zm10.742 0a2.385 2.385 0 1 0 0 4.769 2.385 2.385 0 0 0 0-4.77zm-10.742 1.078a1.307 1.307 0 1 1 0 2.614 1.307 1.307 0 0 1 0-2.614zm10.742 0a1.307 1.307 0 1 1 0 2.614 1.307 1.307 0 0 1 0-2.614z"/>
  </svg>
);

// ─── Announcement Banner ──────────────────────────────────────────────────────

function AnnouncementBanner({ text, color, onDismiss }: {
  text: string;
  color: string;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
      style={{ background: `${color}18`, borderBottom: `1px solid ${color}35` }}>
      <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-start gap-3">
        <span className="text-sm" role="img" aria-label="announcement">📢</span>
        <p className="flex-1 text-xs text-gray-800 font-medium leading-relaxed">{text}</p>
        <button
          onClick={onDismiss}
          aria-label="Dismiss announcement"
          className="flex-shrink-0 p-0.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── WiFi Chip ────────────────────────────────────────────────────────────────

function WifiChip({ password }: { password: string }) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  }

  const masked = "•".repeat(Math.min(password.length, 10));

  return (
    <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1 text-xs select-none">
      <Wifi className="w-3 h-3 text-gray-400 flex-shrink-0" />
      <span className="text-gray-500 font-medium">WiFi</span>
      <span className="text-gray-700 font-mono">{revealed ? password : masked}</span>
      <button
        onClick={() => setRevealed((v) => !v)}
        className="text-[10px] text-gray-400 hover:text-gray-600 underline transition-colors">
        {revealed ? "hide" : "show"}
      </button>
      <button
        onClick={handleCopy}
        title="Copy password"
        className="ml-0.5 flex-shrink-0 transition-colors"
        style={{ color: copied ? "#22c55e" : "#9ca3af" }}>
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

// ─── Open / Closed Badge ──────────────────────────────────────────────────────

function OpenBadge({ status }: { status: { isOpen: boolean; text: string } }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
      status.isOpen
        ? "bg-green-50 text-green-700 border border-green-200"
        : "bg-red-50 text-red-600 border border-red-200"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
        status.isOpen ? "bg-green-500 animate-pulse" : "bg-red-400"
      }`} />
      {status.isOpen ? "Open" : "Closed"}
    </div>
  );
}

// ─── Feedback Form ────────────────────────────────────────────────────────────

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
      <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <Star className="w-7 h-7 text-green-600 fill-green-600" />
      </div>
      <p className="font-bold text-gray-900">Thank you!</p>
      <p className="text-sm text-gray-500 mt-1">Your feedback helps us improve.</p>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Your rating *</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} type="button" onClick={() => setForm({ ...form, rating: s })}
              className={`text-2xl transition-transform hover:scale-110 ${s <= form.rating ? "text-amber-400" : "text-gray-200"}`}>
              ★
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Which dish? (optional)</label>
        <select value={form.menuItemId} onChange={(e) => setForm({ ...form, menuItemId: e.target.value })}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400">
          <option value="">Overall experience</option>
          {menuItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Comment (optional)</label>
        <textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })}
          placeholder="Tell us about your experience..." rows={3}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 resize-none" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Your name (optional)</label>
        <input type="text" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })}
          placeholder="Anonymous"
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400" />
      </div>
      <button type="submit" disabled={form.rating === 0 || loading}
        style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}
        className="w-full text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-40 transition-opacity shadow-sm">
        {loading ? "Submitting…" : "Submit Review"}
      </button>
    </form>
  );
}

// ─── Search Results ───────────────────────────────────────────────────────────

type SearchItem = MenuItem & { categoryName: string };

function SearchResults({ results, color }: { results: SearchItem[]; color: string }) {
  if (results.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Search className="w-9 h-9 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-400 text-sm font-medium">No items found</p>
        <p className="text-gray-300 text-xs mt-1">Try a different word or check for typos.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-24 space-y-2">
      <p className="text-xs text-gray-400 font-medium mb-3">
        {results.length} {results.length === 1 ? "result" : "results"}
      </p>
      {results.map((item) => {
        const tags = parseJson<string[]>(item.tags, []);
        const allergens = parseJson<string[]>(item.allergens, []);
        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-100 p-3.5 flex gap-3 shadow-sm">
            {item.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image} alt={item.name}
                className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-0.5">
                <div>
                  <p className="font-semibold text-sm text-gray-900 leading-tight">{item.name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{item.categoryName}</p>
                </div>
                <span className="font-bold text-sm flex-shrink-0" style={{ color }}>
                  €{item.price.toFixed(2)}
                </span>
              </div>
              {item.description && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
              )}
              <div className="flex flex-wrap gap-1 mt-2">
                {item.isFeatured && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: `${color}20`, color }}>
                    ⭐ Featured
                  </span>
                )}
                {!!item.prepTime && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />{item.prepTime}m
                  </span>
                )}
                {tags.slice(0, 3).map((t) => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">{t}</span>
                ))}
                {allergens.slice(0, 2).map((a) => (
                  <span key={a} className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">{a}</span>
                ))}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Digital Menu View ────────────────────────────────────────────────────────

function DigitalMenuView({ restaurant, dailyMenu, showFeedback, setShowFeedback }: {
  restaurant: Restaurant;
  dailyMenu: DailyMenu | null;
  showFeedback: boolean;
  setShowFeedback: (v: boolean) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
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

  // Filter items for search
  const searchResults: SearchItem[] = searchQuery.trim()
    ? restaurant.categories.flatMap((cat) =>
        cat.items
          .filter((item) =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.description?.toLowerCase() ?? "").includes(searchQuery.toLowerCase())
          )
          .map((item) => ({ ...item, categoryName: cat.name }))
      )
    : [];

  return (
    <div className="relative">
      {/* Sticky search bar */}
      <div className="sticky top-[57px] z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
            <input
              type="search"
              placeholder="Search across the menu…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 placeholder-gray-300"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Search results or template */}
      {searchQuery.trim() ? (
        <SearchResults results={searchResults} color={color} />
      ) : (
        renderTemplate()
      )}

      {/* Floating review button */}
      {!showFeedback && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
          onClick={() => setShowFeedback(true)}
          className="fixed bottom-10 right-4 z-30 flex items-center gap-1.5 px-4 py-2.5 rounded-full text-white text-sm font-semibold shadow-lg"
          style={{ background: color, boxShadow: `0 4px 20px ${color}55` }}>
          <MessageSquare className="w-4 h-4" /> Review
        </motion.button>
      )}

      {/* Feedback drawer */}
      {showFeedback && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowFeedback(false)}>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
            className="relative w-full bg-white rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto"
            initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", damping: 25 }}
            onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h3 className="text-xl font-bold text-gray-900 mb-5">Leave a Review</h3>
            <FeedbackForm restaurantId={restaurant.id} menuItems={allItems} primaryColor={color} />
          </motion.div>
        </div>
      )}

      {/* Powered by */}
      <div className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur border-t border-gray-100 py-2 text-center z-20">
        <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          Powered by <span className="font-semibold text-orange-500">SkanoMenu</span>
          <ChevronRight className="w-3 h-3 inline" />
        </Link>
      </div>
    </div>
  );
}

// ─── Static Menu View ─────────────────────────────────────────────────────────

function StaticMenuView({ restaurant, showFeedback, setShowFeedback }: {
  restaurant: Restaurant;
  showFeedback: boolean;
  setShowFeedback: (v: boolean) => void;
}) {
  const color = restaurant.primaryColor;
  const allItems = restaurant.categories.flatMap((c) => c.items);
  const isPdf = restaurant.menuPdfUrl?.toLowerCase().endsWith(".pdf");

  if (!restaurant.menuPdfUrl) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">📋</span>
        </div>
        <p className="text-gray-500 font-medium">Menu not uploaded yet</p>
        <p className="text-gray-400 text-sm mt-1">The restaurant hasn&apos;t added their menu scan yet.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-20">
      <div className="p-4">
        {isPdf ? (
          <iframe
            src={restaurant.menuPdfUrl}
            title="Scanned menu"
            className="w-full rounded-2xl border border-gray-200 shadow-sm"
            style={{ minHeight: "78vh" }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={restaurant.menuPdfUrl}
            alt="Scanned menu"
            className="max-w-full mx-auto rounded-2xl shadow-sm border border-gray-100"
          />
        )}
      </div>

      {/* Floating review button */}
      {!showFeedback && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
          onClick={() => setShowFeedback(true)}
          className="fixed bottom-10 right-4 z-30 flex items-center gap-1.5 px-4 py-2.5 rounded-full text-white text-sm font-semibold shadow-lg"
          style={{ background: color, boxShadow: `0 4px 20px ${color}55` }}>
          <MessageSquare className="w-4 h-4" /> Review
        </motion.button>
      )}

      {/* Feedback drawer */}
      {showFeedback && (
        <div className="fixed inset-0 z-40 flex items-end" onClick={() => setShowFeedback(false)}>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
            className="relative w-full bg-white rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto"
            initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", damping: 25 }}
            onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h3 className="text-xl font-bold text-gray-900 mb-5">Leave a Review</h3>
            <FeedbackForm restaurantId={restaurant.id} menuItems={allItems} primaryColor={color} />
          </motion.div>
        </div>
      )}

      {/* Powered by */}
      <div className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur border-t border-gray-100 py-2 text-center z-20">
        <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          Powered by <span className="font-semibold text-orange-500">SkanoMenu</span>
          <ChevronRight className="w-3 h-3 inline" />
        </Link>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);

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
        <div className="text-5xl mb-4">🍽️</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Restaurant not found</h2>
        <p className="text-gray-500 mb-5">This restaurant may not be active yet.</p>
        <Link href="/restaurants"
          className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 font-semibold text-sm">
          Browse all restaurants <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );

  const color = restaurant.primaryColor;
  const primaryMenu = restaurant.primaryMenu || "dynamic";
  const showStatic = primaryMenu === "static";

  const openStatus = getOpenStatus(restaurant.openingHours ?? "{}");
  const socialLinks = parseJson<SocialLinks>(restaurant.socialLinks ?? "{}", {});
  const hasSocial = !!(socialLinks.instagram || socialLinks.facebook || socialLinks.whatsapp || socialLinks.tripadvisor);
  const showAnnouncement = !!restaurant.announcement && !announcementDismissed;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Announcement banner */}
      <AnimatePresence>
        {showAnnouncement && (
          <AnnouncementBanner
            text={restaurant.announcement!}
            color={color}
            onDismiss={() => setAnnouncementDismissed(true)}
          />
        )}
      </AnimatePresence>

      {/* Sticky top nav */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <Link href="/restaurants"
            className="flex items-center gap-1 text-gray-500 hover:text-gray-900 text-sm transition-colors shrink-0">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="font-bold text-gray-900 text-sm truncate text-center flex-1">{restaurant.name}</div>
          {openStatus ? (
            <OpenBadge status={openStatus} />
          ) : (
            <div className="w-16 shrink-0" />
          )}
        </div>
      </div>

      {/* Info strip */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-2.5 space-y-2">
          {/* Contact row */}
          {(restaurant.address || restaurant.phone || restaurant.website || openStatus) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
              {restaurant.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  {restaurant.address}
                </span>
              )}
              {restaurant.phone && (
                <a href={`tel:${restaurant.phone}`}
                  className="flex items-center gap-1 hover:text-gray-800 transition-colors">
                  <span>📞</span>{restaurant.phone}
                </a>
              )}
              {restaurant.website && (
                <a href={restaurant.website} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-gray-800 transition-colors">
                  <Globe className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  Website
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
              {openStatus && (
                <span className={`text-xs font-medium ${openStatus.isOpen ? "text-green-600" : "text-red-500"}`}>
                  {openStatus.text}
                </span>
              )}
            </div>
          )}

          {/* Social + WiFi row */}
          {(hasSocial || restaurant.wifiPassword) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {socialLinks.instagram && (
                <a href={makeSocialUrl("instagram", socialLinks.instagram)}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-opacity hover:opacity-75"
                  style={{ background: "linear-gradient(135deg, #fdf2f8, #fce7f3)", color: "#be185d", borderColor: "#fbcfe8" }}>
                  <InstagramIcon className="w-3 h-3" /> Instagram
                </a>
              )}
              {socialLinks.facebook && (
                <a href={makeSocialUrl("facebook", socialLinks.facebook)}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100 transition-opacity hover:opacity-75">
                  <FacebookIcon className="w-3 h-3" /> Facebook
                </a>
              )}
              {socialLinks.whatsapp && (
                <a href={`https://wa.me/${socialLinks.whatsapp.replace(/\D/g, "")}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-600 border border-green-100 transition-opacity hover:opacity-75">
                  <WhatsAppIcon className="w-3 h-3" /> WhatsApp
                </a>
              )}
              {socialLinks.tripadvisor && (
                <a href={makeSocialUrl("tripadvisor", socialLinks.tripadvisor)}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 transition-opacity hover:opacity-75">
                  <TripAdvisorIcon className="w-3 h-3" /> TripAdvisor
                </a>
              )}
              {restaurant.wifiPassword && <WifiChip password={restaurant.wifiPassword} />}
            </div>
          )}
        </div>
      </div>

      {/* Menu content — primary type only, no switching */}
      {showStatic ? (
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
