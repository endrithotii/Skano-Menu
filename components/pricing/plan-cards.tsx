"use client";

// The package cards and the Monthly / Yearly switch. Used on the landing page and on /pricing.

import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS, TRIAL_DAYS, pricePerDay, pricePerMonth, priceNote, type Plan } from "@/lib/plans";

/** "coral" is the navy, cream and coral look of the landing page */
export type PlanTone = "default" | "coral";

export function BillingToggle({ yearly, onChange, tone = "default" }: { yearly: boolean; onChange: (yearly: boolean) => void; tone?: PlanTone }) {
  const coral = tone === "coral";
  const btn = (on: boolean) => `px-5 py-3 rounded-[9px] text-[15px] font-semibold transition-colors ${on ? (coral ? "bg-[#14213D] text-[#F4EDE0]" : "bg-gray-900 text-white") : "text-gray-700 hover:text-gray-900"}`;
  return (
    <div className="flex flex-col items-center gap-3">
      <div role="group" aria-label="Billing period" className={`inline-flex gap-1 p-1 border rounded-xl ${coral ? "bg-white/60 border-[#14213D]/15" : "bg-white border-gray-200"}`}>
        <button type="button" onClick={() => onChange(false)} aria-pressed={!yearly} className={btn(!yearly)}>Monthly</button>
        <button type="button" onClick={() => onChange(true)} aria-pressed={yearly} className={btn(yearly)}>Yearly, 2 months free</button>
      </div>
      <p className="text-sm text-gray-600">Every package starts with {TRIAL_DAYS} days free. Cancel any time, your data stays.</p>
    </div>
  );
}

function PlanCard({ plan, yearly, upsell, tone }: { plan: Plan; yearly: boolean; upsell?: string; tone: PlanTone }) {
  const dark = !!plan.recommended;
  const coral = tone === "coral";
  return (
    <article data-plan={plan.id}
      className={`relative flex flex-col gap-5 rounded-[20px] px-7 py-8 ${dark
        ? coral ? "bg-[#14213D] text-white border-2 border-[#FF6B58] shadow-[0_24px_48px_-16px_rgba(20,33,61,0.45)]" : "bg-gray-900 text-white border-2 border-blue-700 shadow-[0_24px_48px_-16px_rgba(16,24,40,0.35)]"
        : coral ? "bg-white/70 border border-[#14213D]/10" : "bg-white border border-gray-200"}`}>
      {dark && <span className={`absolute -top-3.5 left-6 text-white text-[13px] font-bold px-3 py-1 rounded-full ${coral ? "bg-[#FF6B58]" : "bg-blue-700"}`}>Recommended</span>}
      <div className="flex flex-col gap-2">
        <h3 className="text-[28px] font-extrabold tracking-tight">{plan.name}</h3>
        <p className={`text-[15px] leading-snug min-h-11 ${dark ? "text-gray-300" : "text-gray-600"}`}>{plan.tagline}</p>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[52px] leading-none font-extrabold tracking-tight" data-price>€{pricePerMonth(plan, yearly)}</span>
          <span className={`text-[15px] ${dark ? "text-gray-300" : "text-gray-600"}`}>/ month</span>
        </div>
        <span className={`text-sm font-semibold mt-1 ${dark ? "text-white" : "text-gray-700"}`}>That&apos;s {pricePerDay(plan, yearly)} a day</span>
        <span className={`text-[13px] ${dark ? "text-gray-300" : "text-gray-600"}`}>{priceNote(plan, yearly)}</span>
      </div>
      <Link href={plan.ctaHref}
        className={`block text-center rounded-[10px] py-4 font-semibold transition-colors ${dark
          ? coral ? "bg-[#FF6B58] text-white hover:bg-[#ff5a45] text-base font-bold" : "bg-white text-gray-900 hover:bg-gray-100 text-base font-bold"
          : "border border-gray-300 text-gray-900 hover:bg-gray-50 text-[15px]"}`}>
        {plan.ctaText}
      </Link>
      {upsell && <p className={`text-sm leading-snug rounded-[10px] px-3.5 py-3 ${coral ? "text-[#7A2A1F] bg-[#FF6B58]/10" : "text-blue-900 bg-blue-50"}`} data-upsell>{upsell}</p>}
      <ul className={`flex flex-col gap-2.5 text-[15px] ${dark ? "text-gray-200" : "text-gray-700"}`}>
        {plan.includes && <li className={`font-semibold ${dark ? "text-white" : "text-gray-900"}`}>{plan.includes}</li>}
        {plan.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2">
            <Check className={`w-4 h-4 mt-0.5 shrink-0 ${coral ? "text-[#FF6B58]" : dark ? "text-blue-300" : "text-blue-700"}`} aria-hidden />
            <span>{h}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function PlanCards({ yearly, tone = "default" }: { yearly: boolean; tone?: PlanTone }) {
  const premium = PLANS.find((p) => p.id === "premium")!;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch max-w-xl mx-auto lg:max-w-none">
      {PLANS.map((plan) => (
        <PlanCard key={plan.id} plan={plan} yearly={yearly} tone={tone}
          upsell={plan.id === "pro" ? `For €${pricePerMonth(premium, yearly) - pricePerMonth(plan, yearly)} more a month, Premium adds reminders, 360 table photos, receipt photos and unlimited staff.` : undefined} />
      ))}
    </div>
  );
}
