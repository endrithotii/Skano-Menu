"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, MapPin, Utensils, Star, QrCode, Filter, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { CUISINE_TYPES } from "@/lib/utils";
import { CORAL, CREAM, GlowGlass, NAVY, SiteNav } from "@/components/brand/coral";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  cuisine: string[] | string;
  primaryColor: string;
  status: string;
  recentScanCount?: number;
  itemsCount?: number;
  avgRating?: number;
}

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState("");

  useEffect(() => {
    const fetch_ = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedCuisine) params.set("cuisine", selectedCuisine);
      try {
        const res = await fetch(`/api/restaurants?${params}`);
        if (res.ok) {
          const data = await res.json();
          setRestaurants(Array.isArray(data) ? data : (data.restaurants ?? []));
        }
      } catch (error) {
        console.error("Error fetching restaurants:", error);
      }
      setLoading(false);
    };
    fetch_();
  }, [search, selectedCuisine]);


  const cuisines = ["All", ...CUISINE_TYPES.slice(0, 10)];

  return (
    <div className="min-h-screen" style={{ backgroundColor: CREAM, color: NAVY }}>
      {/* Header */}
      <section className="relative overflow-hidden text-white pb-16 sm:pb-20" style={{ backgroundColor: NAVY }}>
        <GlowGlass />
        <SiteNav active="Restaurants" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-14">
          <motion.span initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] backdrop-blur px-3.5 py-1.5 text-xs text-white/80 mb-6">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CORAL }} /> Live menus on SkanoMenu
          </motion.span>
          <div className="grid lg:grid-cols-[1.3fr_1fr] gap-8 items-end">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}>
              <h1 className="text-[13vw] sm:text-7xl lg:text-[88px] font-light tracking-[-0.045em] leading-[0.95]">
                Discover <span style={{ color: "#FFB3A8" }}>restaurants</span>
              </h1>
              <p className="mt-5 text-base sm:text-lg text-white/70 max-w-xl">
                Browse digital menus from restaurants registered on SkanoMenu
              </p>
            </motion.div>

            {/* Search */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="relative w-full">
              <Search aria-hidden className="pointer-events-none absolute z-10 left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
              <input
                type="text"
                aria-label="Search restaurants"
                placeholder="Search restaurants..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pr-5 py-4 rounded-full border border-white/20 bg-white/10 backdrop-blur-xl text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-[#FF6B58]/50 focus:border-[#FF6B58]/60 text-base shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)]"
                style={{ paddingLeft: "3.25rem" }}
              />
            </motion.div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Cuisine filter */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          <Filter className="w-4 h-4 text-[#14213D]/50 flex-shrink-0" />
          {cuisines.map((c) => {
            const on = (c === "All" && !selectedCuisine) || selectedCuisine === c;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => setSelectedCuisine(c === "All" ? "" : c)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 border ${
                  on
                    ? "bg-[#FF6B58] border-[#FF6B58] text-white shadow-[0_8px_20px_-8px_rgba(255,107,88,0.8)]"
                    : "bg-white/60 text-[#14213D]/75 border-[#14213D]/10 hover:bg-white hover:border-[#FF6B58]/40"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>

        {/* Results */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-3xl overflow-hidden animate-pulse bg-white/60 border border-[#14213D]/10">
                <div className="h-44 bg-[#14213D]/10" />
                <div className="p-6 space-y-3">
                  <div className="h-5 bg-[#14213D]/10 rounded w-2/3" />
                  <div className="h-4 bg-[#14213D]/10 rounded w-full" />
                  <div className="h-4 bg-[#14213D]/10 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <div className="text-center py-20">
            <span className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${CORAL}1A`, color: CORAL }}>
              <Utensils className="w-6 h-6" />
            </span>
            <h3 className="text-2xl font-light tracking-tight mb-2">No restaurants found</h3>
            <p className="text-[#14213D]/60">Try a different search or filter</p>
          </div>
        ) : (
          <>
            <div className="text-sm text-[#14213D]/55 mb-4">{restaurants.length} restaurant{restaurants.length !== 1 ? "s" : ""} found</div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {restaurants.map((r, i) => {
                const cuisineArr = Array.isArray(r.cuisine) ? r.cuisine : (() => { try { return JSON.parse(r.cuisine as string) as string[]; } catch { return []; } })();
                return (
                  <motion.div
                    key={r.id}
                    className="group rounded-3xl overflow-hidden bg-[#FBF8F2] border border-[#14213D]/10 shadow-[0_20px_40px_-28px_rgba(20,33,61,0.35)] hover:-translate-y-1 hover:shadow-[0_30px_60px_-28px_rgba(20,33,61,0.45)] transition-all duration-300 flex flex-col"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    {/* Cover: the restaurant's own colour, plain */}
                    <div className="h-44 relative flex items-center justify-center overflow-hidden"
                      style={{ background: `linear-gradient(135deg, ${r.primaryColor} 0%, ${r.primaryColor}CC 100%)` }}>
                      <div className="relative w-16 h-16 rounded-2xl border border-white/25 bg-white/15 backdrop-blur-md flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                        <Utensils className="w-7 h-7 text-white" />
                      </div>
                      <div className="absolute top-3 right-3 rounded-full border border-white/20 bg-black/20 backdrop-blur-md px-2.5 py-1 flex items-center gap-1.5">
                        <QrCode className="w-3 h-3 text-white" />
                        <span className="text-xs text-white font-medium">{r.recentScanCount ?? 0} scans</span>
                      </div>
                    </div>

                    <div className="p-6 flex-1 flex flex-col">
                      <h3 className="text-xl font-semibold tracking-tight mb-1 group-hover:text-[#FF6B58] transition-colors">
                        {r.name}
                      </h3>
                      {r.description && (
                        <p className="text-sm text-[#14213D]/65 mb-3 line-clamp-2">{r.description}</p>
                      )}

                      {cuisineArr.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {cuisineArr.slice(0, 3).map((c) => (
                            <span key={c} className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${CORAL}1A`, color: "#C2412F" }}>{c}</span>
                          ))}
                        </div>
                      )}

                      {r.address && (
                        <div className="flex items-center gap-1.5 text-xs text-[#14213D]/55 mb-4">
                          <MapPin className="w-3.5 h-3.5" />
                          {r.address}
                        </div>
                      )}

                      <div className="mt-auto flex items-center justify-between pt-2">
                        {r.avgRating && r.avgRating > 0 ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Star className="w-4 h-4" style={{ fill: CORAL, color: CORAL }} />
                            <span className="font-semibold">{r.avgRating.toFixed(1)}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-[#14213D]/45">No reviews yet</span>
                        )}
                        <Link
                          href={`/r/${r.slug}`}
                          className="inline-flex items-center gap-1.5 rounded-full text-white text-sm font-semibold px-4 py-2 transition-all group-hover:shadow-[0_10px_24px_-10px_rgba(255,107,88,0.9)]"
                          style={{ backgroundColor: NAVY }}
                        >
                          View Menu
                          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
