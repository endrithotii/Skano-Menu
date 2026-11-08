"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import {
  QrCode, BarChart3, Star, Utensils, Clock, Shield, Menu as MenuIcon, X,
  ArrowRight, ArrowUpRight, Smartphone, TrendingUp, Calendar, Zap,
} from "lucide-react";
import { BillingToggle, PlanCards } from "@/components/pricing/plan-cards";

// Palette: navy, cream and coral
const NAVY = "#14213D";
const CREAM = "#F4EDE0";
const CORAL = "#FF6B58";

const features = [
  { icon: QrCode, title: "QR Code Generator", description: "Generate and download beautiful QR codes for your tables instantly. Customers scan to view your full digital menu." },
  { icon: BarChart3, title: "Advanced Analytics", description: "Track menu scans, popular dishes, peak hours, and customer behavior with detailed charts and insights." },
  { icon: Star, title: "Customer Feedback", description: "Collect ratings and reviews for individual dishes. Understand what your customers love most." },
  { icon: Calendar, title: "Daily Specials", description: "Publish your daily menu specials. Automatically highlighted for customers visiting your menu." },
  { icon: Smartphone, title: "Menu Templates", description: "Choose from stunning menu templates: Modern, Elegant, Vibrant, or Classic. Customizable colors." },
  { icon: TrendingUp, title: "Real-time Updates", description: "Update prices, add dishes, or mark items as sold out. Changes reflect instantly, no reprinting." },
];

// The short strip under the hero
const strip = [
  { icon: QrCode, title: "QR menus", sub: "for every table" },
  { icon: Clock, title: "Live in minutes", sub: "no reprinting" },
  { icon: Calendar, title: "Daily specials", sub: "highlighted for guests" },
  { icon: Star, title: "Dish ratings", sub: "from real guests" },
  { icon: BarChart3, title: "Analytics", sub: "scans and peak hours" },
];

const stats = [
  { value: "500+", label: "Restaurants" },
  { value: "50K+", label: "Monthly Scans" },
  { value: "4.9★", label: "Average Rating" },
  { value: "15+", label: "Cities" },
];

const testimonials = [
  {
    name: "Arben Krasniqi",
    role: "Owner, Bella Vista Prishtina",
    text: "SkanoMenu transformed our customer experience. The analytics helped us understand which dishes to promote and our sales increased by 30%.",
    rating: 5,
  },
  {
    name: "Blerim Hoxha",
    role: "Manager, Urban Coffee Prizren",
    text: "Setting up our digital menu took less than 30 minutes. Our customers love being able to scan and see photos of our drinks instantly.",
    rating: 5,
  },
  {
    name: "Vjosa Berisha",
    role: "Chef & Owner, Trattoria Peja",
    text: "The daily specials feature is a game changer. I update our lunch menu every morning and customers always know what is fresh.",
    rating: 5,
  },
];

const steps = [
  { step: "01", title: "Register your restaurant", desc: "Create your account and add your restaurant details, logo, and contact info.", icon: Shield },
  { step: "02", title: "Build your menu", desc: "Add categories, items with photos, prices, and descriptions. Choose from beautiful templates.", icon: Utensils },
  { step: "03", title: "Share your QR code", desc: "Download your QR code, place it on tables, and watch customers scan it instantly.", icon: QrCode },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
});

/** Soft moving light behind ribbed glass, like the hero of the reference */
function GlowGlass({ className = "" }: { className?: string }) {
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

/** A number that counts up once when it appears */
function CountUp({ to, className }: { to: number; className?: string }) {
  const v = useMotionValue(0);
  const text = useTransform(v, (n) => Math.round(n).toLocaleString("en-US"));
  useEffect(() => {
    const c = animate(v, to, { duration: 2.2, ease: [0.22, 1, 0.36, 1], delay: 0.6 });
    return () => c.stop();
  }, [to, v]);
  return <motion.span className={className}>{text}</motion.span>;
}

/** The glass card in the hero: a restaurant's menu, live */
function LiveCard() {
  const [soldOut, setSoldOut] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setSoldOut((s) => !s), 3800);
    return () => clearInterval(t);
  }, []);
  const bars = [38, 56, 44, 70, 62, 88, 76];
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotate: 2 }} animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-[360px] rounded-[22px] border border-white/15 bg-white/[0.08] backdrop-blur-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)] p-3 text-white">
      <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/25" />
      <div className="flex items-center justify-between px-2 pb-2">
        <div className="flex items-center gap-2 text-xs text-white/80">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF6B58] opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF6B58]" /></span>
          Bella Vista, live now
        </div>
        <span className="text-[11px] text-white/60">Table 7</span>
      </div>

      {/* Scans */}
      <div className="rounded-2xl bg-white/[0.07] border border-white/10 p-3.5">
        <div className="flex items-center justify-between text-[11px] text-white/60">
          <span>Scans this week</span><span className="text-[#FF9A8C] font-semibold">▲ 32%</span>
        </div>
        <CountUp to={1247} className="block text-[28px] font-semibold tracking-tight leading-tight" />
        <div className="mt-2 flex items-end gap-1.5 h-12">
          {bars.map((h, i) => (
            <motion.span key={i} className="flex-1 rounded-[4px]"
              style={{ backgroundColor: i === 5 ? CORAL : "rgba(255,255,255,0.28)" }}
              initial={{ height: 0 }} animate={{ height: `${h}%` }}
              transition={{ duration: 0.8, delay: 0.8 + i * 0.07, ease: [0.22, 1, 0.36, 1] }} />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-white/40">{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}</div>
      </div>

      {/* Two dishes, like two bookings */}
      <div className="mt-2 grid gap-2">
        <div className="rounded-2xl bg-white/[0.07] border border-white/10 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Tagliatelle al pomodoro</span>
            <span className="text-[11px] text-[#FFC9C1]">★ 4.9</span>
          </div>
          <div className="mt-2 flex items-end justify-between">
            <div><div className="text-[10px] uppercase tracking-wider text-white/50">Today&apos;s special</div><div className="text-lg font-semibold">€14</div></div>
            <span className="text-[10px] rounded-full bg-white/10 px-2 py-0.5 text-white/70">48 orders</span>
            <div className="text-right"><div className="text-[10px] uppercase tracking-wider text-white/50">Rated by</div><div className="text-lg font-semibold">126</div></div>
          </div>
        </div>
        <div className="rounded-2xl bg-white/[0.07] border border-white/10 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Sea bass, lemon &amp; capers</span>
            <motion.span key={String(soldOut)} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${soldOut ? "bg-[#FF6B58] text-white" : "bg-emerald-400/20 text-emerald-200"}`}>
              {soldOut ? "Sold out" : "Available"}
            </motion.span>
          </div>
          <div className="mt-1 text-[11px] text-white/55">{soldOut ? "Updated on every phone, just now" : "€22 · on the menu"}</div>
        </div>
      </div>
      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#FF6B58] px-3 py-1 text-[11px] font-semibold">
        <Zap className="w-3 h-3" /> Changes go live instantly
      </div>
    </motion.div>
  );
}

export default function LandingPage() {
  const [yearly, setYearly] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const navLinks = [
    { href: "#features", label: "Features" },
    { href: "/pricing", label: "Pricing" },
    { href: "/restaurants", label: "Restaurants" },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: CREAM, color: NAVY }}>
      {/* ── Hero ── */}
      <section className="relative min-h-[100svh] overflow-hidden text-white flex flex-col" style={{ backgroundColor: NAVY }}>
        <GlowGlass />

        {/* Navbar, floating over the glass */}
        <nav className="relative z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: CORAL }}>
                <Utensils className="w-4 h-4 text-white" />
              </span>
              <span className="text-lg font-semibold tracking-tight">SkanoMenu</span>
            </Link>
            <div className="hidden md:flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] backdrop-blur-md p-1">
              {navLinks.map((l) => (
                <Link key={l.label} href={l.href}
                  className="text-sm px-4 py-1.5 rounded-full transition-colors text-white/80 hover:text-white hover:bg-white/15">
                  {l.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
              <Link href="/login" className="hidden sm:inline text-sm text-white/80 hover:text-white px-3 py-2">Log in</Link>
              <Link href="/register" className="text-sm font-semibold rounded-full px-4 py-2 bg-white text-[#14213D] hover:bg-[#F4EDE0] transition-colors">
                Get Started
              </Link>
              <button type="button" aria-label="Open menu" onClick={() => setMenuOpen((o) => !o)}
                className="md:hidden w-9 h-9 rounded-full border border-white/20 bg-white/10 flex items-center justify-center">
                {menuOpen ? <X className="w-4 h-4" /> : <MenuIcon className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {menuOpen && (
            <div className="md:hidden mx-4 rounded-2xl border border-white/15 bg-[#14213D]/90 backdrop-blur-xl p-2">
              {[...navLinks, { href: "/login", label: "Log in" }].map((l) => (
                <Link key={l.label} href={l.href} onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-white/85 hover:bg-white/10">{l.label}</Link>
              ))}
            </div>
          )}
        </nav>

        <div className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1.25fr_1fr] gap-10 items-end pt-8 pb-10 lg:pb-14">
          <div className="lg:pb-6">
            <motion.span initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] backdrop-blur px-3.5 py-1.5 text-xs text-white/80 mb-6">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CORAL }} />
              The #1 Digital Menu Platform for Restaurants and Hotels
            </motion.span>
            <motion.h1
              className="text-[13vw] sm:text-7xl lg:text-[88px] xl:text-[104px] font-light tracking-[-0.045em] leading-[0.95]"
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}>
              Beautiful digital menus your guests{" "}
              <span className="relative whitespace-nowrap" style={{ color: "#FFB3A8" }}>
                will love.
                <svg viewBox="0 0 300 20" className="absolute left-0 -bottom-2 w-full h-3" preserveAspectRatio="none" aria-hidden>
                  <motion.path d="M4 14 C 80 4, 200 4, 296 12" fill="none" stroke={CORAL} strokeWidth="4" strokeLinecap="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.9 }} />
                </svg>
              </span>
            </motion.h1>
            <motion.p className="mt-6 max-w-xl text-base sm:text-lg text-white/75 leading-relaxed"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}>
              Create a stunning QR code menu in minutes. Get analytics, collect feedback,
              publish daily specials, and grow your restaurant, all in one platform.
            </motion.p>
            <motion.div className="mt-8 flex flex-wrap items-center gap-4"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}>
              <Link href="/register?plan=premium"
                className="group inline-flex items-center gap-2 rounded-full px-6 py-3.5 font-semibold text-white shadow-[0_12px_30px_-8px_rgba(255,107,88,0.7)] transition-transform hover:-translate-y-0.5"
                style={{ backgroundColor: CORAL }}>
                Try 14 days free <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="/restaurants" className="inline-flex items-center gap-1.5 font-semibold text-white/90 hover:text-white">
                Browse menus <ArrowUpRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <LiveCard />
          </div>
        </div>

        {/* Feature strip, like the bottom row of the reference */}
        <div className="relative z-10 border-t border-white/10 bg-white/[0.03] backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {strip.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.08 }}
                className={`py-5 pr-4 ${i === 0 ? "border-t-2 -mt-px" : ""} ${i === 4 ? "hidden lg:block" : ""}`}
                style={i === 0 ? { borderColor: CORAL } : undefined}>
                <f.icon className="w-4 h-4 mb-2" style={{ color: i === 0 ? CORAL : "rgba(255,255,255,0.7)" }} />
                <div className={`text-sm ${i === 0 ? "text-[#FF9A8C]" : "text-white"}`}>{f.title}</div>
                <div className="text-xs text-white/50">{f.sub}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-y-10">
          {stats.map((s, i) => (
            <motion.div key={s.label} {...fadeUp(i * 0.08)} className={`px-4 ${i ? "md:border-l" : ""} border-[#14213D]/10`}>
              <div className="text-5xl sm:text-6xl font-light tracking-[-0.04em]">
                {s.value.replace(/[+★]/g, "")}<span style={{ color: CORAL }}>{s.value.match(/[+★]/)?.[0]}</span>
              </div>
              <div className="mt-1 text-sm text-[#14213D]/60">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features: a bento grid ── */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div {...fadeUp()} className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
            <h2 className="text-4xl sm:text-5xl font-light tracking-[-0.035em] max-w-xl leading-[1.05]">
              Everything you need <span style={{ color: CORAL }}>to succeed</span>
            </h2>
            <p className="text-[#14213D]/65 max-w-sm">A complete platform built for modern restaurants.</p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => {
              const big = i === 0;
              const wide = i === features.length - 1;
              if (wide) return (
                <motion.div key={f.title} {...fadeUp(i * 0.06)}
                  className="md:col-span-2 lg:col-span-3 relative overflow-hidden rounded-3xl p-7 sm:p-9 text-white flex flex-col sm:flex-row sm:items-center gap-5 justify-between"
                  style={{ backgroundColor: CORAL }}>
                  <div className="flex items-start gap-5">
                    <span className="w-11 h-11 shrink-0 rounded-2xl bg-white/20 flex items-center justify-center"><f.icon className="w-5 h-5" /></span>
                    <div>
                      <h3 className="text-2xl font-semibold mb-1">{f.title}</h3>
                      <p className="text-white/85 max-w-xl">{f.description}</p>
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/30 px-4 py-2 text-sm font-semibold">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> Live on every phone
                  </span>
                </motion.div>
              );
              return (
                <motion.div key={f.title} {...fadeUp(i * 0.06)}
                  className={`group relative overflow-hidden rounded-3xl p-7 transition-transform duration-300 hover:-translate-y-1 ${big
                    ? "lg:row-span-2 text-white min-h-[260px] flex flex-col justify-end"
                    : "bg-white/60 border border-[#14213D]/10 hover:bg-white"}`}
                  style={big ? { backgroundColor: NAVY } : undefined}>
                  {big && <GlowGlass className="opacity-90" />}
                  <div className={`relative w-11 h-11 rounded-2xl flex items-center justify-center mb-5 ${big ? "bg-white/15 backdrop-blur" : ""}`}
                    style={big ? undefined : { backgroundColor: `${CORAL}1A`, color: CORAL }}>
                    <f.icon className="w-5 h-5" />
                  </div>
                  <h3 className={`relative font-semibold mb-2 ${big ? "text-2xl" : "text-lg"}`}>{f.title}</h3>
                  <p className={`relative text-sm leading-relaxed ${big ? "text-white/75 max-w-sm" : "text-[#14213D]/65"}`}>{f.description}</p>
                  {big && (
                    <Link href="/register?plan=premium" className="relative mt-6 inline-flex w-fit items-center gap-1.5 rounded-full bg-white text-[#14213D] px-4 py-2 text-sm font-semibold">
                      Make your QR menu <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="relative overflow-hidden py-24 px-4 sm:px-6 lg:px-8 text-white" style={{ backgroundColor: NAVY }}>
        <GlowGlass className="opacity-60" />
        <div className="relative max-w-7xl mx-auto">
          <motion.div {...fadeUp()} className="mb-14">
            <h2 className="text-4xl sm:text-5xl font-light tracking-[-0.035em]">Get started in minutes</h2>
            <p className="mt-3 text-white/65 text-lg">Three simple steps to your digital menu</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-4">
            {steps.map((s, i) => (
              <motion.div key={s.step} {...fadeUp(i * 0.12)}
                className="rounded-3xl border border-white/12 bg-white/[0.06] backdrop-blur-md p-7">
                <div className="flex items-start justify-between mb-10">
                  <span className="text-6xl font-light tracking-tighter text-transparent" style={{ WebkitTextStroke: `1px ${CORAL}` }}>{s.step}</span>
                  <span className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center"><s.icon className="w-5 h-5" /></span>
                </div>
                <h3 className="text-xl font-semibold mb-2">{s.title}</h3>
                <p className="text-white/65 leading-relaxed text-sm">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-10 flex flex-col items-center gap-3">
            <h2 className="text-4xl sm:text-5xl font-light tracking-[-0.035em]">An empty table costs <span style={{ color: CORAL }}>more than this.</span></h2>
            <p className="text-lg text-[#14213D]/65 max-w-2xl">One forgotten reservation or one guest who never comes back is worth more than a month of SkanoMenu.</p>
            <div className="mt-3"><BillingToggle yearly={yearly} onChange={setYearly} tone="coral" /></div>
          </motion.div>
          <PlanCards yearly={yearly} tone="coral" />
          <div className="text-center mt-8">
            <Link href="/pricing" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:opacity-80" style={{ color: CORAL }}>
              See every action in each package <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.h2 {...fadeUp()} className="text-4xl sm:text-5xl font-light tracking-[-0.035em] mb-12">Loved by restaurant owners</motion.h2>
          <div className="grid md:grid-cols-3 gap-4">
            {testimonials.map((t, i) => (
              <motion.figure key={t.name} {...fadeUp(i * 0.08)}
                className={`rounded-3xl p-7 flex flex-col ${i === 1 ? "text-white" : "bg-white/60 border border-[#14213D]/10"}`}
                style={i === 1 ? { backgroundColor: CORAL } : undefined}>
                <div className="flex gap-1 mb-5">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4" style={{ fill: i === 1 ? "#fff" : CORAL, color: i === 1 ? "#fff" : CORAL }} />
                  ))}
                </div>
                <blockquote className={`flex-1 text-lg leading-relaxed ${i === 1 ? "" : "text-[#14213D]/85"}`}>&ldquo;{t.text}&rdquo;</blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${i === 1 ? "bg-white text-[#FF6B58]" : "text-white"}`}
                    style={i === 1 ? undefined : { backgroundColor: NAVY }}>{t.name.charAt(0)}</span>
                  <span>
                    <span className="block font-semibold text-sm">{t.name}</span>
                    <span className={`block text-xs ${i === 1 ? "text-white/80" : "text-[#14213D]/55"}`}>{t.role}</span>
                  </span>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-4 sm:px-6 lg:px-8 pb-24">
        <motion.div {...fadeUp()} className="relative overflow-hidden max-w-7xl mx-auto rounded-[32px] px-6 sm:px-12 py-16 sm:py-20 text-white" style={{ backgroundColor: NAVY }}>
          <GlowGlass />
          <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div>
              <h2 className="text-4xl sm:text-6xl font-light tracking-[-0.04em] leading-[1]">Ready to modernize<br />your restaurant?</h2>
              <p className="mt-4 text-lg text-white/70">Try every feature free for 14 days, then pick your package.</p>
            </div>
            <div className="flex flex-col items-start lg:items-end gap-3">
              <Link href="/register?plan=premium"
                className="inline-flex items-center gap-2 rounded-full px-7 py-4 font-semibold text-white shadow-[0_12px_30px_-8px_rgba(255,107,88,0.7)] hover:-translate-y-0.5 transition-transform"
                style={{ backgroundColor: CORAL }}>
                Try Premium free <ArrowRight className="w-5 h-5" />
              </Link>
              <p className="text-white/50 text-sm">Cancel any time, your data stays</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 text-white" style={{ backgroundColor: NAVY }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <Link href="/" className="flex items-center gap-2 mb-3">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: CORAL }}>
                  <Utensils className="w-3.5 h-3.5 text-white" />
                </span>
                <span className="font-semibold">SkanoMenu</span>
              </Link>
              <p className="text-white/50 text-sm">Digital menu platform for restaurants and hotels.</p>
            </div>
            {[
              { heading: "Product", links: ["Features", "Pricing", "Templates", "Analytics"] },
              { heading: "Company", links: ["About", "Blog", "Careers", "Contact"] },
              { heading: "Support", links: ["Help Center", "Docs", "API", "Status"] },
            ].map((col) => (
              <div key={col.heading}>
                <div className="text-white/60 text-xs font-semibold uppercase tracking-[0.18em] mb-3">{col.heading}</div>
                <ul className="space-y-2">
                  {col.links.map((l) => (
                    <li key={l}><a href="#" className="text-white/50 hover:text-white text-sm transition-colors">{l}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/40 text-sm">© 2026 SkanoMenu. All rights reserved.</p>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" style={{ color: CORAL }} />
              <span className="text-white/40 text-sm">Built for restaurants and hotels</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
