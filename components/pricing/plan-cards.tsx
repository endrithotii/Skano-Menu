"use client";

// The package cards and the Monthly / Yearly switch. Used on the landing page and on /pricing.

import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS, TRIAL_DAYS, pricePerDay, pricePerMonth, priceNote, type Plan } from "@/lib/plans";

export function BillingToggle({ yearly, onChange }: { yearly: boolean; onChange: (yearly: boolean) => void }) {
  const btn = (on: boolean) => `px-5 py-3 rounded-[9px] text-[15px] font-semibold transition-colors ${on ? "bg-gray-900 text-white" : "text-gray-700 hover:text-gray-900"}`;
  return (
    <div className="flex flex-col items-center gap-3">
      <div role="group" aria-label="Billing period" className="inline-flex gap-1 p-1 bg-white border border-gray-200 rounded-xl">
        <button type="button" onClick={() => onChange(false)} aria-pressed={!yearly} className={btn(!yearly)}>Monthly</button>
        <button type="button" onClick={() => onChange(true)} aria-pressed={yearly} className={btn(yearly)}>Yearly, 2 months free</button>
      </div>
      <p className="text-sm text-gray-600">Every package starts with {TRIAL_DAYS} days free. Cancel any time, your data stays.</p>
    </div>
  );
}

function PlanCard({ plan, yearly, upsell }: { plan: Plan; yearly: boolean; upsell?: string }) {
  const dark = !!plan.recommended;
  return (
    <article data-plan={plan.id}
      className={`relative flex flex-col gap-5 rounded-[20px] px-7 py-8 ${dark ? "bg-gray-900 text-white border-2 border-blue-700 shadow-[0_24px_48px_-16px_rgba(16,24,40,0.35)]" : "bg-white border border-gray-200"}`}>
      {dark && <span className="absolute -top-3.5 left-6 bg-blue-700 text-white text-[13px] font-bold px-3 py-1 rounded-full">Recommended</span>}
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
        className={`block text-center rounded-[10px] py-4 font-semibold transition-colors ${dark ? "bg-white text-gray-900 hover:bg-gray-100 text-base font-bold" : "border border-gray-300 text-gray-900 hover:bg-gray-50 text-[15px]"}`}>
        {plan.ctaText}
      </Link>
      {upsell && <p className="text-sm leading-snug text-blue-900 bg-blue-50 rounded-[10px] px-3.5 py-3" data-upsell>{upsell}</p>}
      <ul className={`flex flex-col gap-2.5 text-[15px] ${dark ? "text-gray-200" : "text-gray-700"}`}>
        {plan.includes && <li className={`font-semibold ${dark ? "text-white" : "text-gray-900"}`}>{plan.includes}</li>}
        {plan.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2">
            <Check className={`w-4 h-4 mt-0.5 shrink-0 ${dark ? "text-blue-300" : "text-blue-700"}`} aria-hidden />
            <span>{h}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function PlanCards({ yearly }: { yearly: boolean }) {
  const premium = PLANS.find((p) => p.id === "premium")!;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
      {PLANS.map((plan) => (
        <PlanCard key={plan.id} plan={plan} yearly={yearly}
          upsell={plan.id === "pro" ? `For €${pricePerMonth(premium, yearly) - pricePerMonth(plan, yearly)} more a month, Premium adds reminders, 360 table photos, receipt photos and unlimited staff.` : undefined} />
      ))}
    </div>
  );
}
