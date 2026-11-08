"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { AuthShell, CORAL, inputClass, labelClass, primaryButtonClass } from "@/components/brand/coral";

/** Where to go after signing in: ?next=/stamp/ABC123 (only pages of this site) */
function nextPath(): string | null {
  if (typeof window === "undefined") return null;
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  // Keep me signed in (on by default). Off: signed out when the browser is closed
  const [remember, setRemember] = useState(true);

  // Already signed in: go straight to the right place
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const role = d?.user?.role;
        if (cancelled || !role) return;
        router.replace(nextPath() ?? (role === "SUPER_ADMIN" ? "/admin" : role === "MANAGER" || role === "RESTAURANT_OWNER" ? "/dashboard" : "/dashboard/check-in"));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [router]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, remember }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      toast.success(`Welcome back, ${data.user.name}!`);
      // Use server-provided redirect (SUPER_ADMIN → /admin, staff → Check in / out, owners → /dashboard)
      router.push(nextPath() ?? data.redirect ?? "/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell side={<LoginSide />}>
      <h1 className="text-4xl sm:text-5xl font-light tracking-[-0.04em] mb-2">Welcome back</h1>
      <p className="text-[#14213D]/65 mb-8">Sign in to your restaurant dashboard</p>

      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm bg-[#FF6B58]/10 border border-[#FF6B58]/30 text-[#9A2E20]">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="login-email" className={labelClass}>Email address</label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@restaurant.com"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="login-password" className={labelClass}>Password</label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              className={`${inputClass} pr-12`}
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#14213D]/40 hover:text-[#14213D]/70"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <input id="remember-me" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded accent-[#FF6B58]" />
          <span>
            <span className="block text-sm font-medium text-[#14213D]/80">Keep me signed in</span>
            <span className="block text-xs text-[#14213D]/55">
              {remember ? "For 30 days on this device. Don't tick this on a shared computer." : "You'll be signed out when you close the browser."}
            </span>
          </span>
        </label>

        <button type="submit" disabled={loading} className={primaryButtonClass}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-[#14213D]/10">
        <div className="text-center text-xs uppercase tracking-[0.18em] text-[#14213D]/45 mb-4">Demo accounts</div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setForm({ email: "admin@skano.menu", password: "admin123" })}
            className="text-xs text-left rounded-xl py-2.5 px-3 border border-[#14213D]/10 bg-white/60 hover:bg-white hover:border-[#FF6B58]/40 transition-colors"
          >
            <div className="font-semibold">Super Admin</div>
            <div className="text-[#14213D]/55 break-all">admin@skano.menu</div>
          </button>
          <button
            type="button"
            onClick={() => setForm({ email: "resto@skano.menu", password: "owner123" })}
            className="text-xs text-left rounded-xl py-2.5 px-3 border border-[#14213D]/10 bg-white/60 hover:bg-white hover:border-[#FF6B58]/40 transition-colors"
          >
            <div className="font-semibold">Restaurant Owner</div>
            <div className="text-[#14213D]/55 break-all">resto@skano.menu</div>
          </button>
        </div>
      </div>

      <p className="text-center text-sm text-[#14213D]/65 mt-8">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-semibold text-[#FF6B58] hover:text-[#e5503d]">
          Register your restaurant
        </Link>
      </p>
    </AuthShell>
  );
}

/** Left side of the sign-in page: a big line and a glimpse of the dashboard */
function LoginSide() {
  const bars = [38, 56, 44, 70, 62, 88, 76];
  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <h2 className="hidden sm:block text-5xl lg:text-6xl xl:text-7xl font-light tracking-[-0.045em] leading-[0.98]">
        Your tables<br />are <span style={{ color: "#FFB3A8" }}>waiting.</span>
      </h2>
      <p className="sm:hidden text-2xl font-light tracking-tight">Your tables are <span style={{ color: "#FFB3A8" }}>waiting.</span></p>
      <div className="hidden sm:block w-full max-w-sm rounded-[22px] border border-white/15 bg-white/[0.08] backdrop-blur-xl p-4 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between text-[11px] text-white/60">
          <span>Scans this week</span><span className="font-semibold text-[#FF9A8C]">▲ 32%</span>
        </div>
        <div className="text-[28px] font-semibold tracking-tight">1,247</div>
        <div className="mt-2 flex items-end gap-1.5 h-12">
          {bars.map((h, i) => (
            <span key={i} className="flex-1 rounded-[4px]" style={{ height: `${h}%`, backgroundColor: i === 5 ? CORAL : "rgba(255,255,255,0.28)" }} />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-white/70">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CORAL }} />
          3 new dish ratings since your last visit
        </div>
      </div>
    </div>
  );
}
