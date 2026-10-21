"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Minus, BellRing, Globe, UserCheck } from "lucide-react";
import { PLANS, FEATURE_GROUPS, TRIAL_DAYS, pricePerMonth, type Cell } from "@/lib/plans";
import { BillingToggle, PlanCards } from "@/components/pricing/plan-cards";

function TableCell({ value }: { value: Cell }) {
  if (value === true) return <Check className="w-5 h-5 mx-auto text-blue-700" aria-label="Included" />;
  if (value === false) return <Minus className="w-4 h-4 mx-auto text-gray-400" aria-label="Not included" />;
  return <span className="text-sm font-semibold text-gray-700">{value}</span>;
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

export default function PricingPage() {
  const [yearly, setYearly] = useState(true);

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-gray-900">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap gap-4 items-center justify-between">
          <Link href="/" className="text-[22px] font-extrabold text-gray-900">Skano<span className="text-blue-700">Menu</span></Link>
          <nav className="flex flex-wrap items-center gap-2">
            <Link href="/restaurants" className="hidden sm:inline-block text-[15px] text-gray-700 hover:text-gray-900 px-3 py-3">Restaurants</Link>
            <Link href="/login" className="text-[15px] text-gray-700 hover:text-gray-900 px-3 py-3">Log in</Link>
            <Link href="/register?plan=premium" className="text-[15px] font-semibold text-white bg-blue-700 hover:bg-blue-800 px-4 py-3 rounded-[10px]">Try Premium free</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-24">
        <section className="text-center flex flex-col items-center gap-4">
          <p className="text-sm font-semibold tracking-[0.08em] uppercase text-blue-700">Pricing</p>
          <h1 className="text-4xl sm:text-[56px] font-extrabold leading-[1.05] tracking-tight max-w-3xl">An empty table costs more than this.</h1>
          <p className="text-lg sm:text-[19px] leading-relaxed text-gray-600 max-w-2xl">
            One forgotten reservation or one guest who never comes back is worth more than a month of SkanoMenu. Pick the package that stops both.
          </p>
          <div className="mt-4"><BillingToggle yearly={yearly} onChange={setYearly} /></div>
        </section>

        <section aria-label="Packages" className="mt-14"><PlanCards yearly={yearly} /></section>

        <section aria-label="Why Premium" className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-5">
          {WHY.map(({ Icon, title, text }) => (
            <div key={title} className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col gap-2">
              <Icon className="w-7 h-7 text-blue-700" aria-hidden />
              <h3 className="text-lg font-bold">{title}</h3>
              <p className="text-[15px] leading-relaxed text-gray-600">{text}</p>
            </div>
          ))}
        </section>

        <section aria-labelledby="compare" className="mt-24">
          <h2 id="compare" className="text-center text-3xl sm:text-[40px] font-extrabold tracking-tight">What you can do in each package</h2>
          <p className="text-center text-[17px] text-gray-600 mt-3 mb-8">Grouped like your dashboard, so you find each action where you use it.</p>
          <div className="overflow-x-auto bg-white border border-gray-200 rounded-[18px]">
            <div className="min-w-[820px]" role="table" aria-label="What you can do in each package">
              <div className={`${COLS} border-b border-gray-200 bg-gray-50`} role="row">
                <div className="px-6 py-4 text-sm font-semibold text-gray-600" role="columnheader">Action</div>
                {PLANS.map((p) => (
                  <div key={p.id} role="columnheader" className={`px-3 py-4 text-center ${p.recommended ? "bg-gray-900 text-white" : ""}`}>
                    <div className="font-bold">{p.name}</div>
                    <div className={`text-[13px] ${p.recommended ? "text-gray-300" : "text-gray-600"}`}>€{pricePerMonth(p, yearly)} / month</div>
                  </div>
                ))}
              </div>
              {FEATURE_GROUPS.map((g) => (
                <div key={g.name} role="rowgroup">
                  <div className="px-6 pt-5 pb-2.5 text-lg font-bold border-t border-gray-200 bg-gray-50" role="row"><span role="cell">{g.name}</span></div>
                  {g.features.map((ft) => (
                    <div key={ft.label} className={`${COLS} border-t border-gray-100`} role="row">
                      <div className="px-6 py-3.5 flex flex-col gap-0.5" role="rowheader">
                        <span className="text-[15px] font-medium">{ft.label}</span>
                        <span className="text-[13px] leading-snug text-gray-600">{ft.help}</span>
                      </div>
                      {PLANS.map((p) => (
                        <div key={p.id} role="cell" className="px-3 py-3.5 flex items-center justify-center text-center"><TableCell value={ft[p.id]} /></div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="faq" className="mt-24 grid grid-cols-1 md:grid-cols-2 gap-5">
          <h2 id="faq" className="md:col-span-2 text-3xl font-extrabold mb-2">Questions</h2>
          {FAQ.map(({ q, a }) => (
            <div key={q} className="bg-white border border-gray-200 rounded-[14px] p-6 flex flex-col gap-1.5">
              <h3 className="text-[17px] font-bold">{q}</h3>
              <p className="text-[15px] leading-relaxed text-gray-600">{a}</p>
            </div>
          ))}
        </section>

        <section className="mt-24 bg-gray-900 text-white rounded-[22px] px-8 py-14 flex flex-col items-center gap-4 text-center">
          <h2 className="text-3xl sm:text-[40px] font-extrabold max-w-2xl">Try everything for {TRIAL_DAYS} days</h2>
          <p className="text-[17px] text-gray-300 max-w-xl">Start on Premium. If you don&apos;t need it all, switch down before the trial ends and pay nothing extra.</p>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            <Link href="/register?plan=premium" className="font-bold px-6 py-4 rounded-[10px] bg-white text-gray-900 hover:bg-gray-100">Try Premium free</Link>
            <Link href="/restaurants" className="font-semibold px-6 py-4 rounded-[10px] border border-gray-600 hover:bg-white/10">See live menus</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
