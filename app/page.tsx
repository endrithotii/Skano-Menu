"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  QrCode, BarChart3, Star, Utensils, Clock, Shield,
  ChevronRight, CheckCircle2, ArrowRight, Smartphone,
  TrendingUp, MessageSquare, Calendar, Zap
} from "lucide-react";

const features = [
  {
    icon: <QrCode className="w-6 h-6" />,
    title: "QR Code Generator",
    description: "Generate and download beautiful QR codes for your tables instantly. Customers scan to view your full digital menu.",
    color: "from-orange-500 to-amber-500",
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: "Advanced Analytics",
    description: "Track menu scans, popular dishes, peak hours, and customer behavior with detailed charts and insights.",
    color: "from-blue-500 to-cyan-500",
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

const plans = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    description: "Perfect for small cafes getting started",
    features: ["1 Restaurant", "Up to 50 menu items", "QR code generation", "Basic analytics", "Customer feedback"],
    cta: "Get Started Free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "€19",
    period: "/month",
    description: "For growing restaurants with more needs",
    features: ["1 Restaurant", "Unlimited menu items", "All menu templates", "Advanced analytics", "Daily specials", "Priority support", "Custom branding"],
    cta: "Start Free Trial",
    highlighted: true,
  },
  {
    name: "Business",
    price: "€49",
    period: "/month",
    description: "For restaurant chains and franchises",
    features: ["Up to 10 Restaurants", "Everything in Pro", "Multi-location dashboard", "Team management", "API access", "Dedicated support"],
    cta: "Contact Sales",
    highlighted: false,
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
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center">
                <Utensils className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-orange-500 to-amber-600 bg-clip-text text-transparent">
                SkanoMenu
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">Features</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">Pricing</a>
              <Link href="/restaurants" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">Restaurants</Link>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
                Log in
              </Link>
              <Link
                href="/register"
                className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/25"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-24 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <span className="inline-flex items-center gap-2 bg-orange-50 text-orange-600 text-sm font-medium px-4 py-1.5 rounded-full mb-6 border border-orange-100">
                <Zap className="w-3.5 h-3.5" />
                The #1 Digital Menu Platform in Kosovo
              </span>
            </motion.div>

            <motion.h1
              className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 tracking-tight mb-6"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
            >
              Beautiful digital menus{" "}
              <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                your guests will love
              </span>
            </motion.h1>

            <motion.p
              className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
            >
              Create a stunning QR code menu in minutes. Get analytics, collect feedback,
              publish daily specials, and grow your restaurant — all in one platform.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold px-8 py-4 rounded-2xl hover:from-orange-600 hover:to-amber-600 transition-all shadow-xl shadow-orange-500/30 text-lg">
                Start for free <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/restaurants" className="inline-flex items-center justify-center gap-2 bg-white text-gray-900 font-semibold px-8 py-4 rounded-2xl border-2 border-gray-200 hover:border-gray-300 transition-all text-lg">
                Browse menus <ChevronRight className="w-5 h-5" />
              </Link>
            </motion.div>
          </div>

          {/* Mock dashboard preview */}
          <motion.div
            className="mt-16 relative max-w-5xl mx-auto"
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }}
          >
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-2 shadow-2xl">
              <div className="bg-white rounded-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm opacity-80 mb-1">Bella Vista Restaurant</div>
                      <div className="text-2xl font-bold">Dashboard Overview</div>
                    </div>
                    <div className="bg-white/20 rounded-xl p-3"><BarChart3 className="w-6 h-6" /></div>
                  </div>
                </div>
                <div className="p-6 grid grid-cols-4 gap-4">
                  {[
                    { label: "Total Scans", value: "1,247", icon: <QrCode className="w-4 h-4" />, color: "text-orange-500" },
                    { label: "Avg Rating", value: "4.8★", icon: <Star className="w-4 h-4" />, color: "text-yellow-500" },
                    { label: "Menu Items", value: "48", icon: <Utensils className="w-4 h-4" />, color: "text-blue-500" },
                    { label: "Reviews", value: "124", icon: <MessageSquare className="w-4 h-4" />, color: "text-purple-500" },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-gray-50 rounded-xl p-4">
                      <div className={`${stat.color} mb-2`}>{stat.icon}</div>
                      <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                      <div className="text-xs text-gray-500">{stat.label}</div>
                    </div>
                  ))}
                </div>
                <div className="px-6 pb-6">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-sm font-semibold text-gray-700 mb-3">Weekly Scans</div>
                    <div className="flex items-end gap-2 h-16">
                      {[40, 65, 45, 80, 60, 90, 75].map((h, i) => (
                        <div key={i} className="flex-1 bg-gradient-to-t from-orange-500 to-amber-400 rounded-t-lg opacity-80" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-2">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -inset-4 bg-gradient-to-r from-orange-500/20 to-amber-500/20 rounded-3xl blur-3xl -z-10" />
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-gradient-to-r from-orange-500 to-amber-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <motion.div key={stat.label} className="text-center text-white"
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} viewport={{ once: true }}>
                <div className="text-4xl font-bold mb-1">{stat.value}</div>
                <div className="text-orange-100 text-sm">{stat.label}</div>
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
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl rotate-3" />
                  <div className="relative w-full h-full bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center text-white">{item.icon}</div>
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
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-xl text-gray-600">Start free, scale as you grow</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <motion.div key={plan.name}
                className={`rounded-2xl p-8 ${plan.highlighted ? "bg-gradient-to-b from-orange-500 to-amber-500 text-white shadow-2xl shadow-orange-500/30 scale-105" : "bg-white border border-gray-200"}`}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} viewport={{ once: true }}>
                <div className="mb-6">
                  <div className={`text-sm font-semibold mb-1 ${plan.highlighted ? "text-orange-100" : "text-orange-500"}`}>{plan.name}</div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-4xl font-bold ${plan.highlighted ? "text-white" : "text-gray-900"}`}>{plan.price}</span>
                    <span className={`text-sm ${plan.highlighted ? "text-orange-100" : "text-gray-500"}`}>{plan.period}</span>
                  </div>
                  <p className={`text-sm mt-2 ${plan.highlighted ? "text-orange-100" : "text-gray-600"}`}>{plan.description}</p>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${plan.highlighted ? "text-white" : "text-green-500"}`} />
                      <span className={plan.highlighted ? "text-orange-50" : "text-gray-700"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/register"
                  className={`block text-center font-semibold py-3 rounded-xl transition-all ${plan.highlighted ? "bg-white text-orange-600 hover:bg-orange-50" : "bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600"}`}>
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
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
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white font-bold text-sm">
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
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-4xl font-bold text-white mb-4">Ready to modernize your restaurant?</h2>
            <p className="text-xl text-gray-400 mb-8">Join 500+ restaurants already using SkanoMenu. Start free today.</p>
            <Link href="/register" className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold px-10 py-4 rounded-2xl hover:from-orange-600 hover:to-amber-600 transition-all shadow-xl shadow-orange-500/30 text-lg">
              Create your free menu <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="text-gray-500 text-sm mt-4">No credit card required</p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <Link href="/" className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center">
                  <Utensils className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-bold text-white">SkanoMenu</span>
              </Link>
              <p className="text-gray-500 text-sm">Digital menu platform for restaurants in Kosovo and beyond.</p>
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
              <Clock className="w-4 h-4 text-orange-500" />
              <span className="text-gray-600 text-sm">Built for Kosovo&apos;s restaurant industry</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
