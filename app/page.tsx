"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  QrCode, BarChart3, Star, Utensils, Clock, Shield,
  ArrowRight, Smartphone,
  TrendingUp, Calendar, Zap
} from "lucide-react";
import { BillingToggle, PlanCards } from "@/components/pricing/plan-cards";
import { LayersStory } from "@/components/landing/layers-story";

const features = [
  {
    icon: <QrCode className="w-6 h-6" />,
    title: "QR Code Generator",
    description: "Generate and download beautiful QR codes for your tables instantly. Customers scan to view your full digital menu.",
    color: "from-blue-500 to-indigo-500",
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: "Advanced Analytics",
    description: "Track menu scans, popular dishes, peak hours, and customer behavior with detailed charts and insights.",
    color: "from-teal-500 to-cyan-500",
  },
  {
    icon: <Star className="w-6 h-6" />,
    title: "Customer Feedback",
    description: "Collect ratings and reviews for individual dishes. Understand what your customers love most.",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: <Calendar className="w-6 h-6" />,
    title: "Daily Specials",
    description: "Publish your daily menu specials. Automatically highlighted for customers visiting your menu.",
    color: "from-green-500 to-emerald-500",
  },
  {
    icon: <Smartphone className="w-6 h-6" />,
    title: "Menu Templates",
    description: "Choose from stunning menu templates — Modern, Elegant, Vibrant, or Classic. Customizable colors.",
    color: "from-rose-500 to-red-500",
  },
  {
    icon: <TrendingUp className="w-6 h-6" />,
    title: "Real-time Updates",
    description: "Update prices, add dishes, or mark items as sold out. Changes reflect instantly — no reprinting.",
    color: "from-indigo-500 to-violet-500",
  },
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

export default function LandingPage() {
  const [yearly, setYearly] = useState(true);
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/55 backdrop-blur-md border-b border-black/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 h-16">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                <Utensils className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
                SkanoMenu
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">Features</a>
              <Link href="/pricing" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">Pricing</Link>
              <Link href="/restaurants" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">Restaurants</Link>
            </div>

            <div className="flex items-center gap-3 shrink-0 whitespace-nowrap">
              <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
                Log in
              </Link>
              <Link
                href="/register"
                className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all shadow-lg shadow-blue-500/25"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero: scroll story in layers */}
      <LayersStory />

      {/* Stats */}
      <section className="py-16 bg-gradient-to-r from-blue-500 to-indigo-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <motion.div key={stat.label} className="text-center text-white"
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} viewport={{ once: true }}>
                <div className="text-4xl font-bold mb-1">{stat.value}</div>
                <div className="text-blue-100 text-sm">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Everything you need to succeed</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">A complete platform built for modern restaurants.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <motion.div key={feature.title} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow border border-gray-100"
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} viewport={{ once: true }}>
                <div className={`w-12 h-12 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center text-white mb-4`}>{feature.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Get started in minutes</h2>
            <p className="text-xl text-gray-600">Three simple steps to your digital menu</p>
          </div>
          <div className="grid md:grid-cols-3 gap-12">
            {[
              { step: "1", title: "Register your restaurant", desc: "Create your account and add your restaurant details, logo, and contact info.", icon: <Shield className="w-8 h-8" /> },
              { step: "2", title: "Build your menu", desc: "Add categories, items with photos, prices, and descriptions. Choose from beautiful templates.", icon: <Utensils className="w-8 h-8" /> },
              { step: "3", title: "Share your QR code", desc: "Download your QR code, place it on tables, and watch customers scan it instantly.", icon: <QrCode className="w-8 h-8" /> },
            ].map((item, i) => (
              <motion.div key={item.step} className="text-center"
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.15 }} viewport={{ once: true }}>
                <div className="relative inline-flex items-center justify-center w-20 h-20 mb-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl rotate-3" />
                  <div className="relative w-full h-full bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center text-white">{item.icon}</div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 bg-gray-900 rounded-full flex items-center justify-center text-white text-xs font-bold">{item.step}</div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#f6f7fb]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 flex flex-col items-center gap-3">
            <h2 className="text-4xl font-bold text-gray-900">An empty table costs more than this.</h2>
            <p className="text-lg text-gray-600 max-w-2xl">One forgotten reservation or one guest who never comes back is worth more than a month of SkanoMenu.</p>
            <div className="mt-3"><BillingToggle yearly={yearly} onChange={setYearly} /></div>
          </div>
          <PlanCards yearly={yearly} />
          <div className="text-center mt-8">
            <Link href="/pricing" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-800 transition-colors">
              See every action in each package <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Loved by restaurant owners</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <motion.div key={t.name} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} viewport={{ once: true }}>
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4 leading-relaxed">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{t.name}</div>
                    <div className="text-gray-500 text-xs">{t.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-4xl font-bold text-white mb-4">Ready to modernize your restaurant?</h2>
            <p className="text-xl text-gray-400 mb-8">Try every feature free for 14 days, then pick your package.</p>
            <Link href="/register?plan=premium" className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold px-10 py-4 rounded-2xl hover:from-blue-600 hover:to-indigo-600 transition-all shadow-xl shadow-blue-500/30 text-lg">
              Try Premium free <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="text-gray-500 text-sm mt-4">Cancel any time, your data stays</p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <Link href="/" className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                  <Utensils className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-bold text-white">SkanoMenu</span>
              </Link>
              <p className="text-gray-500 text-sm">Digital menu platform for restaurants and hotels.</p>
            </div>
            {[
              { heading: "Product", links: ["Features", "Pricing", "Templates", "Analytics"] },
              { heading: "Company", links: ["About", "Blog", "Careers", "Contact"] },
              { heading: "Support", links: ["Help Center", "Docs", "API", "Status"] },
            ].map((col) => (
              <div key={col.heading}>
                <div className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-3">{col.heading}</div>
                <ul className="space-y-2">
                  {col.links.map((l) => (
                    <li key={l}><a href="#" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">{l}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-600 text-sm">© 2026 SkanoMenu. All rights reserved.</p>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-gray-600 text-sm">Built for restaurants and hotels</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
