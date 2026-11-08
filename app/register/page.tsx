"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, AlertCircle, CheckCircle2, Check } from "lucide-react";
import toast from "react-hot-toast";
import { CUISINE_TYPES } from "@/lib/utils";
import { AuthShell, CORAL, inputClass, labelClass, primaryButtonClass } from "@/components/brand/coral";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    restaurantName: "",
    address: "",
    phone: "",
    cuisine: [] as string[],
  });

  function toggleCuisine(c: string) {
    setForm((f) => ({
      ...f,
      cuisine: f.cuisine.includes(c) ? f.cuisine.filter((x) => x !== c) : [...f.cuisine, c],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      toast.success("Restaurant registered! Welcome to SkanoMenu.");
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell side={<RegisterSide />}>
      <h1 className="text-4xl sm:text-5xl font-light tracking-[-0.04em] mb-2">Register your restaurant</h1>
      <p className="text-[#14213D]/65 mb-7">Try every feature free for 14 days</p>

      {/* Steps indicator */}
      <div className="flex items-center gap-3 mb-7">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
              step > s ? "bg-[#14213D] text-white" : step === s ? "bg-[#FF6B58] text-white" : "bg-[#14213D]/10 text-[#14213D]/50"
            }`}>
              {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
            </div>
            <span className={`text-sm font-medium ${step >= s ? "text-[#14213D]" : "text-[#14213D]/40"}`}>
              {s === 1 ? "Account" : "Restaurant"}
            </span>
            {s < 2 && <div className={`w-12 h-0.5 ${step > s ? "bg-[#14213D]" : "bg-[#14213D]/15"}`} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm bg-[#FF6B58]/10 border border-[#FF6B58]/30 text-[#9A2E20]">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={step === 1 ? (e) => { e.preventDefault(); setStep(2); } : handleSubmit} className="space-y-5">
        {step === 1 && (
          <>
            <div>
              <label htmlFor="reg-name" className={labelClass}>Your full name</label>
              <input
                id="reg-name" type="text" required autoComplete="name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Arben Krasniqi"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="reg-email" className={labelClass}>Email address</label>
              <input
                id="reg-email" type="email" required autoComplete="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@restaurant.com"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="reg-password" className={labelClass}>Password</label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? "text" : "password"} required minLength={6} autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min. 6 characters"
                  className={`${inputClass} pr-12`}
                />
                <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#14213D]/40 hover:text-[#14213D]/70">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <button type="submit" className={primaryButtonClass}>Continue</button>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <label htmlFor="reg-restaurant" className={labelClass}>Restaurant name</label>
              <input
                id="reg-restaurant" type="text" required value={form.restaurantName}
                onChange={(e) => setForm({ ...form, restaurantName: e.target.value })}
                placeholder="Bella Vista"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="reg-address" className={labelClass}>Address</label>
              <input
                id="reg-address" type="text" autoComplete="street-address" value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Rr. Nëna Terezë 15, Prishtina"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="reg-phone" className={labelClass}>Phone</label>
              <input
                id="reg-phone" type="tel" autoComplete="tel" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+383 44 123 456"
                className={inputClass}
              />
            </div>
            <div>
              <span className={labelClass}>Cuisine types (select all that apply)</span>
              <div className="flex flex-wrap gap-2">
                {CUISINE_TYPES.slice(0, 12).map((c) => (
                  <button
                    key={c} type="button"
                    aria-pressed={form.cuisine.includes(c)}
                    onClick={() => toggleCuisine(c)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                      form.cuisine.includes(c)
                        ? "bg-[#FF6B58] border-[#FF6B58] text-white"
                        : "bg-white/60 border-[#14213D]/10 text-[#14213D]/75 hover:bg-white"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)}
                className="flex-1 rounded-xl py-3 font-semibold border border-[#14213D]/15 text-[#14213D]/80 hover:bg-white/70 transition-all">
                Back
              </button>
              <button type="submit" disabled={loading} className={`${primaryButtonClass} flex-1`}>
                {loading ? "Creating..." : "Create Restaurant"}
              </button>
            </div>
          </>
        )}
      </form>

      <p className="text-center text-sm text-[#14213D]/65 mt-8">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[#FF6B58] hover:text-[#e5503d]">Sign in</Link>
      </p>
    </AuthShell>
  );
}

/** Left side of the register page: what the trial includes */
function RegisterSide() {
  const items = [
    "A QR menu for every table, live in minutes",
    "Daily specials, dish ratings and analytics",
    "Every Premium feature, free for 14 days",
    "Cancel any time, your data stays",
  ];
  return (
    <div className="flex flex-col gap-8">
      <h2 className="hidden sm:block text-5xl lg:text-6xl xl:text-7xl font-light tracking-[-0.045em] leading-[0.98]">
        Open your<br />menu to <span style={{ color: "#FFB3A8" }}>everyone.</span>
      </h2>
      <p className="sm:hidden text-2xl font-light tracking-tight">Open your menu to <span style={{ color: "#FFB3A8" }}>everyone.</span></p>
      <ul className="hidden sm:flex flex-col gap-3 max-w-sm">
        {items.map((t) => (
          <li key={t} className="flex items-start gap-3 rounded-2xl border border-white/12 bg-white/[0.07] backdrop-blur-md px-4 py-3 text-sm text-white/85">
            <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full flex items-center justify-center" style={{ backgroundColor: CORAL }}>
              <Check className="w-3 h-3 text-white" />
            </span>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
