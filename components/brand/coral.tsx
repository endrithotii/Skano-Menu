"use client";

// The navy, cream and coral look shared by the landing, pricing, login and register pages.

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Utensils, Menu as MenuIcon, X } from "lucide-react";

export const NAVY = "#14213D";
export const CREAM = "#F4EDE0";
export const CORAL = "#FF6B58";

/** Soft moving light behind ribbed glass. Put it inside a relative, overflow-hidden navy box. */
export function GlowGlass({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <motion.div className="absolute w-[60vw] h-[60vw] max-w-[820px] max-h-[820px] rounded-full blur-[90px] opacity-80"
        style={{ background: `radial-gradient(circle, ${CORAL} 0%, rgba(255,107,88,0.35) 40%, transparent 70%)`, left: "38%", top: "-10%" }}
        animate={{ x: [0, 60, -30, 0], y: [0, 40, 80, 0], scale: [1, 1.1, 0.95, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }} />
      <motion.div className="absolute w-[55vw] h-[55vw] max-w-[760px] max-h-[760px] rounded-full blur-[100px] opacity-70"
        style={{ background: "radial-gradient(circle, #3D5A9E 0%, rgba(61,90,158,0.3) 45%, transparent 70%)", left: "-12%", top: "10%" }}
        animate={{ x: [0, 50, 0], y: [0, -40, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }} />
      <motion.div className="absolute w-[40vw] h-[40vw] max-w-[560px] max-h-[560px] rounded-full blur-[90px] opacity-50"
        style={{ background: `radial-gradient(circle, ${CREAM} 0%, transparent 65%)`, right: "-10%", bottom: "-20%" }}
        animate={{ x: [0, -40, 0], y: [0, -30, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }} />
      {/* Ribbed glass: thin vertical light and shade stripes */}
      <div className="absolute inset-0"
        style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0px, rgba(255,255,255,0.0) 3px, rgba(0,0,0,0.10) 9px, rgba(255,255,255,0.0) 14px)" }} />
      {/* Fine grain */}
      <div className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.7) 1px, transparent 1px)", backgroundSize: "3px 3px" }} />
    </div>
  );
}

export function BrandLogo({ light = true, size = "md" }: { light?: boolean; size?: "md" | "lg" }) {
  const box = size === "lg" ? "w-10 h-10 rounded-xl" : "w-8 h-8 rounded-lg";
  return (
    <Link href="/" className="flex items-center gap-2 shrink-0">
      <span className={`${box} flex items-center justify-center`} style={{ backgroundColor: CORAL }}>
        <Utensils className={size === "lg" ? "w-5 h-5 text-white" : "w-4 h-4 text-white"} />
      </span>
      <span className={`${size === "lg" ? "text-2xl" : "text-lg"} font-semibold tracking-tight ${light ? "text-white" : "text-[#14213D]"}`}>SkanoMenu</span>
    </Link>
  );
}

const NAV_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/restaurants", label: "Restaurants" },
];

/** Top bar for pages with a navy top: logo, glass pill of links, Log in and Get Started */
export function SiteNav({ active }: { active?: "Features" | "Pricing" | "Restaurants" }) {
  const [open, setOpen] = useState(false);
  return (
    <nav className="relative z-20 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-3">
        <BrandLogo />
        <div className="hidden md:flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] backdrop-blur-md p-1">
          {NAV_LINKS.map((l) => (
            <Link key={l.label} href={l.href} aria-current={active === l.label ? "page" : undefined}
              className={`text-sm px-4 py-1.5 rounded-full transition-colors ${active === l.label ? "bg-white/15 text-white" : "text-white/80 hover:text-white hover:bg-white/15"}`}>
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
          <Link href="/login" className="hidden sm:inline text-sm text-white/80 hover:text-white px-3 py-2">Log in</Link>
          <Link href="/register" className="text-sm font-semibold rounded-full px-4 py-2 bg-white text-[#14213D] hover:bg-[#F4EDE0] transition-colors">
            Get Started
          </Link>
          <button type="button" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}
            className="md:hidden w-9 h-9 rounded-full border border-white/20 bg-white/10 flex items-center justify-center">
            {open ? <X className="w-4 h-4" /> : <MenuIcon className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden mx-4 rounded-2xl border border-white/15 bg-[#14213D]/90 backdrop-blur-xl p-2">
          {[...NAV_LINKS, { href: "/login", label: "Log in" }].map((l) => (
            <Link key={l.label} href={l.href} onClick={() => setOpen(false)} className="block px-4 py-3 rounded-xl text-white/85 hover:bg-white/10">{l.label}</Link>
          ))}
        </div>
      )}
    </nav>
  );
}

// Form pieces for the sign-in and register pages
export const inputClass =
  "w-full px-4 py-3 rounded-xl border border-[#14213D]/15 bg-white/80 text-[#14213D] placeholder:text-[#14213D]/35 focus:outline-none focus:ring-2 focus:ring-[#FF6B58]/30 focus:border-[#FF6B58] transition-all";
export const labelClass = "block text-sm font-medium text-[#14213D]/80 mb-1.5";
export const primaryButtonClass =
  "w-full rounded-xl py-3 font-semibold text-white bg-[#FF6B58] hover:bg-[#ff5a45] shadow-[0_12px_30px_-10px_rgba(255,107,88,0.8)] transition-all disabled:opacity-60 disabled:cursor-not-allowed";

/** Two halves: navy glass on the left with a message, the form on cream on the right. On phones the navy part is a short band on top. */
export function AuthShell({ side, children }: { side: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr]" style={{ backgroundColor: CREAM, color: NAVY }}>
      <aside className="relative overflow-hidden text-white flex flex-col" style={{ backgroundColor: NAVY }}>
        <GlowGlass />
        <div className="relative z-10 px-6 sm:px-10 pt-6 lg:pt-8"><BrandLogo /></div>
        <div className="relative z-10 flex-1 flex flex-col justify-end px-6 sm:px-10 pt-8 pb-8 lg:pb-14">{side}</div>
      </aside>
      <main className="flex items-center justify-center px-4 sm:px-8 py-10 lg:py-16">
        <motion.div className="w-full max-w-md"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          {children}
        </motion.div>
      </main>
    </div>
  );
}
