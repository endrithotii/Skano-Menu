"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X, Minus, Zap, ArrowRight, HelpCircle } from "lucide-react";
import { PLANS, FEATURE_GROUPS, formatPrice, annualSavings, type PlanId } from "@/lib/plans";

// ─── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({ plan, annual }: { plan: typeof PLANS[0]; annual: boolean }) {
  const price = formatPrice(plan, annual);
  const savings = annualSavings(plan);
  const isFree = plan.monthlyPrice === null;

  return (
    <div className={`relative flex flex-col rounded-2xl p-6 sm:p-8 transition-all ${
      plan.highlight
        ? "bg-gradient-to-b from-orange-500 to-amber-500 text-white shadow-2xl shadow-orange-500/25 ring-2 ring-orange-400 scale-[1.03]"
        : "bg-white border border-gray-200 shadow-sm hover:shadow-md"
    }`}>
      {plan.badge && (
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
          plan.highlight ? "bg-white text-orange-600" : "bg-orange-500 text-white"
        }`}>
          {plan.badge === "Most Popular" ? "⭐ Most Popular" : `🏢 ${plan.badge}`}
        </div>
      )}

      <div className="mb-6">
        <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${plan.highlight ? "text-orange-100" : "text-gray-400"}`}>
          {plan.name}
        </p>
        <div className="flex items-end gap-2 mb-2">
          <span className={`text-4xl font-black ${plan.highlight ? "text-white" : "text-gray-900"}`}>
            {price}
          </span>
          {!isFree && (
            <span className={`text-sm mb-1 ${plan.highlight ? "text-orange-100" : "text-gray-400"}`}>
              /mo{annual ? " · billed annually" : ""}
            </span>
          )}
        </div>
        {annual && !isFree && savings && (
          <p className={`text-xs font-semibold ${plan.highlight ? "text-orange-100" : "text-green-600"}`}>
            Save €{savings}/year
          </p>
        )}
        {!annual && !isFree && (
          <p className={`text-xs ${plan.highlight ? "text-orange-100" : "text-gray-400"}`}>
            or €{plan.annualPrice}/mo billed annually
          </p>
        )}
        <p className={`text-sm mt-3 leading-relaxed ${plan.highlight ? "text-orange-50" : "text-gray-500"}`}>
          {plan.tagline}
        </p>
      </div>

      <Link href={plan.ctaHref}
        className={`block text-center font-bold py-3 px-6 rounded-xl transition-all text-sm mb-6 ${
          plan.highlight
            ? "bg-white text-orange-600 hover:bg-orange-50 shadow-lg"
            : "bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 shadow-sm"
        }`}>
        {plan.ctaText} <ArrowRight className="inline w-4 h-4 ml-1" />
      </Link>

      {/* Key highlights for each plan */}
      <div className="space-y-2.5 text-sm">
        {plan.id === "free" && [
          "1 restaurant",
          "Up to 30 menu items",
          "QR code generation",
          "7-day scan analytics",
          "SkanoMenu branding",
        ].map(f => (
          <div key={f} className="flex items-center gap-2">
            <Check className="w-4 h-4 flex-shrink-0 text-green-500" />
            <span className="text-gray-600">{f}</span>
          </div>
        ))}
        {plan.id === "grow" && [
          "Unlimited menu items & photos",
          "All 15 premium templates",
          "Full visual customizer",
          "Remove SkanoMenu branding",
          "Customer feedback & ratings",
          "30-day analytics",
          "Daily specials",
          "1 waiter account",
        ].map(f => (
          <div key={f} className="flex items-center gap-2">
            <Check className="w-4 h-4 flex-shrink-0 text-cyan-500" />
            <span className="text-gray-600">{f}</span>
          </div>
        ))}
        {plan.id === "pro" && [
          "Everything in Grow",
          "Flash sales with countdown timer",
          "Loyalty stamp card program",
          "5 waiter accounts + push alerts",
          "Table map editor",
          "Menu engineering matrix",
          "90-day analytics + peak hours",
          "AI menu assistant for guests",
          "Reply to customer reviews",
          "Multi-language menu",
        ].map(f => (
          <div key={f} className="flex items-center gap-2">
            <Check className={`w-4 h-4 flex-shrink-0 ${plan.highlight ? "text-orange-100" : "text-orange-500"}`} />
            <span className={plan.highlight ? "text-orange-50" : "text-gray-700"}>{f}</span>
          </div>
        ))}
        {plan.id === "scale" && [
          "Everything in Pro",
          "Up to 5 restaurant locations",
          "Multi-location dashboard",
          "Unlimited waiter accounts",
          "365-day analytics + export",
          "Copy menu between locations",
          "API access",
          "White label option",
          "Dedicated account manager",
        ].map(f => (
          <div key={f} className="flex items-center gap-2">
            <Check className="w-4 h-4 flex-shrink-0 text-violet-500" />
            <span className="text-gray-600">{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Feature cell ─────────────────────────────────────────────────────────────

function Cell({ value, highlight }: { value: string | boolean; highlight?: boolean }) {
  if (value === true) return <Check className={`w-5 h-5 mx-auto ${highlight ? "text-orange-500" : "text-green-500"}`} />;
  if (value === false) return <Minus className="w-4 h-4 mx-auto text-gray-200" />;
  return <span className={`text-xs font-medium text-center ${highlight ? "text-orange-600 font-bold" : "text-gray-600"}`}>{value}</span>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [annual, setAnnual] = useState(true);

  const planOrder: PlanId[] = ["free", "grow", "pro", "scale"];

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header nav */}
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-lg font-black bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
            SkanoMenu
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/restaurants" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Browse menus</Link>
            <Link href="/login" className="text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors">Log in</Link>
            <Link href="/register" className="text-sm font-semibold px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors">
              Start free
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-12 sm:py-20">

        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-600 text-xs font-bold px-4 py-1.5 rounded-full mb-4">
            <Zap className="w-3 h-3" /> No credit card required · Cancel any time
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 mb-4 leading-tight">
            Start free. Grow with purpose.
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Every plan starts with a 14-day free trial. No commitments, no surprises.
            <br className="hidden sm:block" /> Upgrade when your restaurant is ready.
          </p>

          {/* Annual/monthly toggle */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <span className={`text-sm font-medium transition-colors ${!annual ? "text-gray-900" : "text-gray-400"}`}>
              Monthly
            </span>
            <button
              onClick={() => setAnnual(v => !v)}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${annual ? "bg-orange-500" : "bg-gray-200"}`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${annual ? "translate-x-5" : "translate-x-0"}`} />
            </button>
            <div className="flex flex-col items-start gap-0.5">
              <span className={`text-sm font-medium transition-colors leading-none ${annual ? "text-gray-900" : "text-gray-400"}`}>
                Annual
              </span>
              {annual && (
                <span className="bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  Save up to 20%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-20 items-start">
          {PLANS.map(plan => (
            <PlanCard key={plan.id} plan={plan} annual={annual} />
          ))}
        </div>

        {/* Feature comparison table */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Full feature comparison</h2>
          <p className="text-gray-500 text-center mb-10">Every detail, side by side.</p>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-5 bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
              <div className="p-4 text-sm font-semibold text-gray-500">Feature</div>
              {planOrder.map(pid => {
                const plan = PLANS.find(p => p.id === pid)!;
                return (
                  <div key={pid} className={`p-4 text-center ${plan.highlight ? "bg-orange-50" : ""}`}>
                    <p className={`text-sm font-bold ${plan.highlight ? "text-orange-600" : "text-gray-800"}`}>{plan.name}</p>
                    <p className={`text-xs mt-0.5 ${plan.highlight ? "text-orange-400" : "text-gray-400"}`}>
                      {formatPrice(plan, annual)}{plan.monthlyPrice ? "/mo" : ""}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Feature groups */}
            {FEATURE_GROUPS.map(group => (
              <div key={group.name}>
                {/* Group header */}
                <div className="grid grid-cols-5 bg-gray-50 border-y border-gray-100">
                  <div className="col-span-5 px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <span>{group.emoji}</span> {group.name}
                  </div>
                </div>
                {/* Features */}
                {group.features.map((feat, i) => (
                  <div key={i} className={`grid grid-cols-5 border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${i % 2 === 0 ? "" : ""}`}>
                    <div className="px-4 py-3 flex items-center gap-1.5">
                      <span className="text-xs text-gray-700">{feat.label}</span>
                      {feat.detail && (
                        <div className="group relative">
                          <HelpCircle className="w-3 h-3 text-gray-300 cursor-help flex-shrink-0" />
                          <div className="absolute bottom-5 left-0 z-20 w-48 bg-gray-900 text-white text-[10px] p-2 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none leading-relaxed">
                            {feat.detail}
                          </div>
                        </div>
                      )}
                    </div>
                    {planOrder.map(pid => {
                      const plan = PLANS.find(p => p.id === pid)!;
                      return (
                        <div key={pid} className={`px-4 py-3 flex items-center justify-center ${plan.highlight ? "bg-orange-50/30" : ""}`}>
                          <Cell value={feat[pid]} highlight={plan.highlight} />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Social proof / FAQ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">

          {/* Testimonial */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex gap-0.5 mb-3">
              {Array(5).fill(0).map((_, i) => <span key={i} className="text-amber-400 text-sm">★</span>)}
            </div>
            <p className="text-gray-700 text-sm leading-relaxed mb-4">
              "The Pro plan paid for itself in the first week. The flash sale feature alone drove €800 in extra revenue on a slow Tuesday night. I cannot imagine going back to a paper menu."
            </p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-600 text-sm">A</div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Arben Krasniqi</p>
                <p className="text-xs text-gray-400">Owner · Bella Vista, Prishtina</p>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Common questions</h3>
            <div className="space-y-4">
              {[
                { q: "Can I change plans later?", a: "Yes, upgrade or downgrade any time. Billing adjusts immediately." },
                { q: "What happens after the free trial?", a: "You choose a plan or stay on the free tier — no charges without your action." },
                { q: "Do I need a credit card to start?", a: "No. Start for free without any payment details." },
                { q: "Can I use my own domain?", a: "Coming soon on the Scale plan. Emails us if you need it sooner." },
              ].map(({ q, a }) => (
                <div key={q}>
                  <p className="text-sm font-semibold text-gray-800">{q}</p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-8 sm:p-12 text-center text-white shadow-xl shadow-orange-500/20">
          <h2 className="text-2xl sm:text-3xl font-black mb-3">Ready to get your menu online?</h2>
          <p className="text-orange-100 mb-8 max-w-md mx-auto">Join 500+ restaurants across Kosovo and the region. Start free, upgrade when you're ready.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register" className="bg-white text-orange-600 font-bold py-3 px-8 rounded-xl hover:bg-orange-50 transition-colors shadow-sm">
              Start for free →
            </Link>
            <Link href="/restaurants" className="border-2 border-white/40 text-white font-semibold py-3 px-8 rounded-xl hover:bg-white/10 transition-colors">
              Browse live menus
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
