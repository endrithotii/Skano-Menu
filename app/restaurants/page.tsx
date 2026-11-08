"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, MapPin, Utensils, Star, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
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

  useEffect(() => {
    const fetch_ = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
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
  }, [search]);


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
        {/* Results */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-3xl animate-pulse bg-white/60 border border-[#14213D]/10 p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#14213D]/10" />
                  <div className="flex-1 space-y-2"><div className="h-4 bg-[#14213D]/10 rounded w-1/2" /><div className="h-3 bg-[#14213D]/10 rounded w-1/3" /></div>
                </div>
                <div className="h-4 bg-[#14213D]/10 rounded w-full" />
                <div className="h-4 bg-[#14213D]/10 rounded w-2/3" />
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
                    className="group rounded-3xl bg-[#FBF8F2] border border-[#14213D]/10 p-6 flex flex-col hover:-translate-y-1 hover:shadow-[0_24px_48px_-28px_rgba(20,33,61,0.4)] transition-all duration-300"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      {/* A small mark in the restaurant's colour, just a hint of it */}
                      <span className="w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center text-lg font-semibold"
                        style={{ backgroundColor: `${r.primaryColor}1F`, color: r.primaryColor }}>
                        {r.name.trim().charAt(0).toUpperCase() || <Utensils className="w-5 h-5" />}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold tracking-tight truncate group-hover:text-[#FF6B58] transition-colors">{r.name}</h3>
                        {r.address && (
                          <div className="flex items-center gap-1 text-xs text-[#14213D]/55 truncate">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{r.address}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {r.description && (
                      <p className="text-sm text-[#14213D]/65 mb-4 line-clamp-2">{r.description}</p>
                    )}

                    {cuisineArr.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {cuisineArr.slice(0, 3).map((c) => (
                          <span key={c} className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-[#14213D]/[0.06] text-[#14213D]/70">{c}</span>
                        ))}
                      </div>
                    )}

                    <div className="mt-auto flex items-center justify-between pt-4 border-t border-[#14213D]/[0.07]">
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
                        className="inline-flex items-center gap-1.5 rounded-full text-sm font-semibold px-4 py-2 border border-[#14213D]/15 hover:bg-[#14213D] hover:text-white hover:border-[#14213D] transition-colors"
                      >
                        View Menu
                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                      </Link>
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
