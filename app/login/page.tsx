"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Utensils, Eye, EyeOff, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

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
        router.replace(nextPath() ?? (role === "WAITER" ? "/waiter" : role === "CHEF" ? "/kitchen" : role === "SUPER_ADMIN" ? "/admin" : "/dashboard"));
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
      // Use server-provided redirect (handles WAITER → /waiter, SUPER_ADMIN → /admin, etc.)
      router.push(nextPath() ?? data.redirect ?? "/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
              <Utensils className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
              SkanoMenu
            </span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h1>
          <p className="text-gray-600">Sign in to your restaurant dashboard</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/60 border border-gray-100 p-8">
          {error && (
            <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@restaurant.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-gray-900 placeholder:text-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-gray-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input id="remember-me" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-blue-600" />
              <span>
                <span className="block text-sm font-medium text-gray-700">Keep me signed in</span>
                <span className="block text-xs text-gray-500">
                  {remember ? "For 30 days on this device. Don't tick this on a shared computer." : "You'll be signed out when you close the browser."}
                </span>
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold py-3 rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="text-center text-sm text-gray-500 mb-4">Demo accounts</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setForm({ email: "admin@skano.menu", password: "admin123" })}
                className="text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg py-2 px-3 transition-colors text-gray-700"
              >
                <div className="font-semibold">Super Admin</div>
                <div className="text-gray-500">admin@skano.menu</div>
              </button>
              <button
                onClick={() => setForm({ email: "resto@skano.menu", password: "owner123" })}
                className="text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg py-2 px-3 transition-colors text-gray-700"
              >
                <div className="font-semibold">Restaurant Owner</div>
                <div className="text-gray-500">resto@skano.menu</div>
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-gray-600 mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-blue-600 font-semibold hover:text-blue-700">
            Register your restaurant
          </Link>
        </p>
      </div>
    </div>
  );
}
