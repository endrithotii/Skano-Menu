"use client";

// "Social medias": link the restaurant's social media and choose which ones are shown above the menu.
// Saved in Restaurant.socialLinks: { instagram, facebook, whatsapp, tripadvisor, hidden: [...] }

import { useEffect, useState } from "react";
import { Share2, Save, Loader2, Eye, EyeOff, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { SOCIAL_META, SOCIAL_PLATFORMS, makeSocialUrl, opensApp, parseSocialLinks, phoneMissingCountryCode, socialLinkItems, type SocialLinks, type SocialPlatform } from "@/components/book-viewer-page";
import { useUnsavedChanges } from "@/lib/navigation-guard";

type Form = { links: Record<SocialPlatform, string>; shown: Record<SocialPlatform, boolean> };

function toForm(raw: SocialLinks): Form {
  const hidden = Array.isArray(raw.hidden) ? raw.hidden : [];
  const links = {} as Form["links"];
  const shown = {} as Form["shown"];
  for (const k of SOCIAL_PLATFORMS) {
    links[k] = typeof raw[k] === "string" ? raw[k]! : "";
    shown[k] = !hidden.includes(k);
  }
  return { links, shown };
}

function toLinks(f: Form): SocialLinks {
  const out: SocialLinks = {};
  const hidden: string[] = [];
  for (const k of SOCIAL_PLATFORMS) {
    const v = f.links[k].trim();
    if (!v) continue;
    out[k] = v;
    if (!f.shown[k]) hidden.push(k);
  }
  if (hidden.length) out.hidden = hidden;
  return out;
}

export default function SocialMediaPage() {
  const [restaurant, setRestaurant] = useState<{ id: string; slug: string | null } | null>(null);
  const [saved, setSaved] = useState<Form | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stats = await fetch("/api/dashboard/stats").then((r) => r.json());
        const d = await fetch(`/api/restaurants/${stats.restaurantId}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))));
        if (cancelled) return;
        const f = toForm(parseSocialLinks(d.restaurant?.socialLinks));
        setRestaurant({ id: d.restaurant.id, slug: d.restaurant.slug ?? null });
        setSaved(f);
        setForm(f);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const dirty = !!form && !!saved && JSON.stringify(toLinks(form)) !== JSON.stringify(toLinks(saved));
  useUnsavedChanges(dirty, "Your social media changes aren't saved yet. Leave without saving?");

  async function save() {
    if (!restaurant || !form || saving) return;
    setSaving(true);
    const res = await fetch(`/api/restaurants/${restaurant.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ socialLinks: JSON.stringify(toLinks(form)) }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) { toast.error("Could not save. Please try again."); return; }
    setSaved(form);
    toast.success("Saved. Customers see the change now.");
  }

  if (failed) return <div className="p-6 text-sm text-gray-500">Could not load your social media. Please refresh the page.</div>;
  if (!form) {
    return <div className="p-6 flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" /></div>;
  }

  const preview = socialLinkItems(toLinks(form));
  const set = (k: SocialPlatform, patch: Partial<{ link: string; shown: boolean }>) =>
    setForm((f) => f && ({
      links: patch.link !== undefined ? { ...f.links, [k]: patch.link } : f.links,
      shown: patch.shown !== undefined ? { ...f.shown, [k]: patch.shown } : f.shown,
    }));

  return (
    <div className={`p-4 lg:p-6 space-y-6 ${dirty ? "pb-28" : ""}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Share2 className="w-6 h-6 text-blue-600" /> Social medias</h1>
          <p className="text-gray-500 text-sm mt-1">Link your social media and choose which ones customers see above the menu</p>
        </div>
        {restaurant?.slug && (
          <a href={`/r/${restaurant.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700">
            <ExternalLink className="w-3.5 h-3.5" /> Open public menu
          </a>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
        {SOCIAL_PLATFORMS.map((k) => {
          const meta = SOCIAL_META[k];
          const linked = !!form.links[k].trim();
          const shown = linked && form.shown[k];
          return (
            <div key={k} className="p-4 sm:p-5 flex items-start gap-3 flex-wrap sm:flex-nowrap">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center">
                <meta.Icon className="w-4.5 h-4.5" />
              </div>
              <div className="flex-1 min-w-[12rem]">
                <label htmlFor={`social-${k}`} className="text-sm font-semibold text-gray-900">{meta.label}</label>
                <input id={`social-${k}`} value={form.links[k]} onChange={(e) => set(k, { link: e.target.value })} placeholder={meta.placeholder}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
                {linked && ["whatsapp", "viber", "telegram"].includes(k) && phoneMissingCountryCode(form.links[k]) ? (
                  <p className="text-xs font-medium text-amber-700 mt-1">Add the country code, for example +383 44 123 456. Without it the app can&apos;t find the number.</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">
                    {meta.hint}
                    {linked && (
                      <>
                        {" · "}
                        <a href={makeSocialUrl(k, form.links[k])} {...(opensApp(makeSocialUrl(k, form.links[k])) ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                          className="font-medium text-blue-600 hover:text-blue-700">Test the link</a>
                      </>
                    )}
                  </p>
                )}
              </div>
              <label className={`shrink-0 sm:mt-6 inline-flex items-center gap-2 text-sm rounded-xl border px-3 py-2 select-none ${linked ? "cursor-pointer" : "opacity-50 cursor-not-allowed"} ${shown ? "border-blue-200 bg-blue-50 text-blue-800" : "border-gray-200 text-gray-600"}`}
                title={linked ? undefined : "Add the link first"}>
                <input id={`social-show-${k}`} type="checkbox" checked={shown} disabled={!linked}
                  onChange={(e) => set(k, { shown: e.target.checked })} className="w-4 h-4 accent-blue-600" />
                {shown ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                Show above the menu
              </label>
            </div>
          );
        })}
      </div>

      {/* Preview of the row above the menu */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="text-sm font-semibold text-gray-900">Preview</div>
        <p className="text-xs text-gray-500 mb-3">This is what customers see above your menu.</p>
        <div className="rounded-xl bg-[#333333] px-3 py-3 min-h-12 flex items-center justify-center">
          {preview.length ? (
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {preview.map((l) => (
                <span key={l.key} className="inline-flex items-center gap-1.5 text-xs font-medium text-white/85 bg-white/10 rounded-full px-3 py-1">{l.icon}{l.label}</span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-white/60">Nothing is shown above the menu</span>
          )}
        </div>
      </div>

      {dirty && (
        <div className="sticky bottom-4 z-30">
          <div className="mx-auto max-w-2xl flex items-center gap-3 rounded-2xl bg-gray-900 text-white px-4 py-3 shadow-2xl">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span className="text-sm font-medium flex-1">Unsaved changes</span>
            <button onClick={() => setForm(saved)} disabled={saving} className="text-sm font-medium text-gray-300 hover:text-white px-3 py-2 rounded-xl hover:bg-white/10 disabled:opacity-50">Discard</button>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 text-sm font-semibold bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 px-4 py-2 rounded-xl disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
