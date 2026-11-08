"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Minus, BellRing, Globe, UserCheck, ArrowRight, ArrowUpRight } from "lucide-react";
import { PLANS, FEATURE_GROUPS, TRIAL_DAYS, pricePerMonth, type Cell } from "@/lib/plans";
import { BillingToggle, PlanCards } from "@/components/pricing/plan-cards";
import { CORAL, CREAM, GlowGlass, NAVY, SiteNav } from "@/components/brand/coral";

function TableCell({ value }: { value: Cell }) {
  if (value === true) return <Check className="w-5 h-5 mx-auto text-[#FF6B58]" aria-label="Included" />;
  if (value === false) return <Minus className="w-4 h-4 mx-auto text-[#14213D]/25" aria-label="Not included" />;
  return <span className="text-sm font-semibold text-[#14213D]/80">{value}</span>;
}

const WHY = [
  { Icon: BellRing, title: "Fewer no-shows", text: "Guests get a reminder email with a cancel link, so a table they can't use comes back to you in time. Your team gets a note to call and confirm." },
  { Icon: Globe, title: "Guests book the table they saw", text: "360 views and photos let people pick the window seat or the terrace before they come." },
  { Icon: UserCheck, title: "Ready from day one", text: "We move your menus in and build your floor plan with you. You don't spend an evening setting it up." },
];

const FAQ = [
  { q: "What if I pick the wrong package?", a: "Switch any time. The easy way: try Premium first, then keep what you really use." },
  { q: "What happens to my data if I move down?", a: "Nothing is deleted. Reservations, floor plan, loyalty cards and staff stay saved and come back when you move up again." },
  { q: "Do my guests pay anything?", a: "No. Guests scan the QR code and use the menu, reservations and loyalty card for free, without an app." },
  { q: "Who counts as staff?", a: "Everyone with their own sign-in, like a manager, a waiter or the chef. The owner is not counted." },
];

const COLS = "grid grid-cols-[minmax(300px,2.4fr)_repeat(3,minmax(130px,1fr))]";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
});

export default function PricingPage() {
  const [yearly, setYearly] = useState(true);

  return (
    <div className="min-h-screen" style={{ backgroundColor: CREAM, color: NAVY }}>
      {/* Navy top with the glowing glass, the cards rise out of it */}
      <section className="relative overflow-hidden text-white pb-44 sm:pb-52" style={{ backgroundColor: NAVY }}>
        <GlowGlass />
        <SiteNav active="Pricing" />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 text-center flex flex-col items-center gap-5">
          <motion.span initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] backdrop-blur px-3.5 py-1.5 text-xs text-white/80">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CORAL }} /> Pricing · {TRIAL_DAYS} days free on every package
          </motion.span>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-[11vw] sm:text-7xl lg:text-[84px] font-light tracking-[-0.045em] leading-[0.98] max-w-4xl">
            An empty table costs <span style={{ color: "#FFB3A8" }}>more than this.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="text-base sm:text-lg leading-relaxed text-white/70 max-w-2xl">
            One forgotten reservation or one guest who never comes back is worth more than a month of SkanoMenu. Pick the package that stops both.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="mt-2">
            <BillingToggle yearly={yearly} onChange={setYearly} tone="night" />
          </motion.div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
        <section aria-label="Packages" className="relative z-10 -mt-32 sm:-mt-40">
          <PlanCards yearly={yearly} tone="coral" />
        </section>

        <section aria-label="Why Premium" className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4">
          {WHY.map(({ Icon, title, text }, i) => (
            <motion.div key={title} {...fadeUp(i * 0.08)} className="rounded-3xl bg-white/60 border border-[#14213D]/10 p-7 flex flex-col gap-2">
              <span className="w-11 h-11 rounded-2xl flex items-center justify-center mb-2" style={{ backgroundColor: `${CORAL}1A`, color: CORAL }}>
                <Icon className="w-5 h-5" aria-hidden />
              </span>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="text-[15px] leading-relaxed text-[#14213D]/65">{text}</p>
            </motion.div>
          ))}
        </section>

        <section aria-labelledby="compare" className="mt-24">
          <motion.div {...fadeUp()} className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-8">
            <h2 id="compare" className="text-4xl sm:text-5xl font-light tracking-[-0.035em] max-w-xl leading-[1.05]">
              What you can do in <span style={{ color: CORAL }}>each package</span>
            </h2>
            <p className="text-[#14213D]/65 max-w-sm">Grouped like your dashboard, so you find each action where you use it.</p>
          </motion.div>
          <div className="overflow-x-auto rounded-[24px] border border-[#14213D]/10 bg-white/70">
            <div className="min-w-[820px]" role="table" aria-label="What you can do in each package">
              <div className={`${COLS} sticky top-0`} role="row">
                <div className="px-6 py-5 text-sm font-semibold text-[#14213D]/60" role="columnheader">Action</div>
                {PLANS.map((p) => (
                  <div key={p.id} role="columnheader" className={`px-3 py-5 text-center ${p.recommended ? "text-white rounded-t-2xl" : ""}`}
                    style={p.recommended ? { backgroundColor: NAVY } : undefined}>
                    <div className="font-semibold">{p.name}</div>
                    <div className={`text-[13px] ${p.recommended ? "text-[#FFB3A8]" : "text-[#14213D]/60"}`}>€{pricePerMonth(p, yearly)} / month</div>
                  </div>
                ))}
              </div>
              {FEATURE_GROUPS.map((g) => (
                <div key={g.name} role="rowgroup">
                  <div className="px-6 pt-6 pb-2.5 text-lg font-semibold border-t border-[#14213D]/10 flex items-center gap-2" role="row">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CORAL }} />
                    <span role="cell">{g.name}</span>
                  </div>
                  {g.features.map((ft) => (
                    <div key={ft.label} className={`${COLS} border-t border-[#14213D]/[0.06] hover:bg-[#F4EDE0]/60 transition-colors`} role="row">
                      <div className="px-6 py-3.5 flex flex-col gap-0.5" role="rowheader">
                        <span className="text-[15px] font-medium">{ft.label}</span>
                        <span className="text-[13px] leading-snug text-[#14213D]/55">{ft.help}</span>
                      </div>
                      {PLANS.map((p) => (
                        <div key={p.id} role="cell" className={`px-3 py-3.5 flex items-center justify-center text-center ${p.recommended ? "bg-[#14213D]/[0.04]" : ""}`}>
                          <TableCell value={ft[p.id]} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="faq" className="mt-24 grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.h2 {...fadeUp()} id="faq" className="md:col-span-2 text-4xl sm:text-5xl font-light tracking-[-0.035em] mb-4">Questions</motion.h2>
          {FAQ.map(({ q, a }, i) => (
            <motion.div key={q} {...fadeUp(i * 0.06)} className="rounded-3xl bg-white/60 border border-[#14213D]/10 p-7 flex flex-col gap-2">
              <h3 className="text-[17px] font-semibold">{q}</h3>
              <p className="text-[15px] leading-relaxed text-[#14213D]/65">{a}</p>
            </motion.div>
          ))}
        </section>

        <motion.section {...fadeUp()} className="relative overflow-hidden mt-24 rounded-[32px] px-6 sm:px-12 py-14 sm:py-20 text-white" style={{ backgroundColor: NAVY }}>
          <GlowGlass />
          <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div>
              <h2 className="text-4xl sm:text-6xl font-light tracking-[-0.04em] leading-[1]">Try everything<br />for {TRIAL_DAYS} days</h2>
              <p className="mt-4 text-lg text-white/70 max-w-xl">Start on Premium. If you don&apos;t need it all, switch down before the trial ends and pay nothing extra.</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/register?plan=premium"
                className="inline-flex items-center gap-2 rounded-full px-7 py-4 font-semibold text-white shadow-[0_12px_30px_-8px_rgba(255,107,88,0.7)] hover:-translate-y-0.5 transition-transform"
                style={{ backgroundColor: CORAL }}>
                Try Premium free <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/restaurants" className="inline-flex items-center gap-1.5 font-semibold text-white/90 hover:text-white">
                See live menus <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
