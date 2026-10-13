"use client";

import React, { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, GripVertical, Tag, AlertCircle, X, Clock, Sparkles, Loader2, ImagePlus, Trash, Search, Flame, Zap, DollarSign, EyeOff, Copy, Settings2 } from "lucide-react";
import toast from "react-hot-toast";
import { BookOpen, LayoutList, ExternalLink, Save, Undo2 } from "lucide-react";
import { MenuBookEditor } from "@/components/dashboard/menu-book-editor";
import { MenuHistory, useMenuHistory, type MenuGroup, type MenuVersion } from "@/components/dashboard/menu-history";
import type { MenuState as BookDraft } from "@/components/dashboard/menu-book-editor";
import { defaultMenuName } from "@/lib/format-date";
import { allMenuFileUrls, parseMenuPages } from "@/lib/menu-pages";
import { useUnsavedChanges } from "@/lib/navigation-guard";
import { ALLERGENS, ITEM_TAGS } from "@/lib/utils";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  allergens: string;
  tags: string;
  prepTime: number | null;
  isAvailable: boolean;
  isFeatured: boolean;
  isHidden?: boolean;
  order: number;
  spiceLevel?: number | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  costPrice?: number | null;
  chefNote?: string | null;
  variants?: string;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  order: number;
  schedule?: string | null;
  items: MenuItem[];
}

interface Restaurant {
  id: string;
  name: string;
  slug: string | null;
  /** "dynamic" = digital menu with categories, "static" = PDF / photos book */
  primaryMenu: "dynamic" | "static";
  menuPdfUrl: string | null;
  menuPdfName: string | null;
}

function parseArr(s: string): string[] { try { return JSON.parse(s); } catch { return []; } }

// Simple input for adding custom allergens not in the predefined list
function AllergenCustomInput({ onAdd }: { onAdd: (a: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex items-center gap-1 mt-1.5">
      <input value={val} onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (val.trim()) { onAdd(val.trim()); setVal(""); } } }}
        placeholder="Add custom allergen…"
        className="flex-1 px-2.5 py-1 rounded-xl border border-dashed border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 bg-white" />
      <button type="button" onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(""); } }} disabled={!val.trim()}
        className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200 transition-all disabled:opacity-40">
        + Add
      </button>
    </div>
  );
}

// ── Unified tag input with search, autocomplete, and custom tag creation ──
function TagInput({
  selected,
  predefined,
  custom,
  onChange,
  onAddCustom,
  onRemoveCustom,
}: {
  selected: string[];
  predefined: string[];
  custom: string[];
  onChange: (v: string[]) => void;
  onAddCustom: (tag: string) => void;
  onRemoveCustom: (tag: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const allAvailable = [...predefined, ...custom];
  const q = query.trim().toLowerCase();

  const suggestions = q
    ? allAvailable.filter((t) => t.toLowerCase().includes(q) && !selected.includes(t))
    : allAvailable.filter((t) => !selected.includes(t)).slice(0, 12);

  const canCreate = q.length >= 1 && !allAvailable.includes(q) && !selected.includes(q);

  function addTag(tag: string) {
    const norm = tag.trim().toLowerCase();
    if (!norm || selected.includes(norm)) return;
    onChange([...selected, norm]);
    if (!predefined.includes(norm) && !custom.includes(norm)) {
      onAddCustom(norm);
    }
    setQuery("");
    inputRef.current?.focus();
  }

  function removeTag(tag: string) {
    onChange(selected.filter((t) => t !== tag));
  }

  const unselectedPredefined = predefined.filter((t) => !selected.includes(t));
  const unselectedCustom = custom.filter((t) => !selected.includes(t));

  return (
    <div>
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500 text-white capitalize">
              {t}
              <button type="button" onClick={() => removeTag(t)} className="hover:opacity-75 ml-0.5">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search / add input */}
      <div className="relative">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border bg-white transition-all ${open ? "border-blue-400 ring-2 ring-blue-500/20" : "border-gray-200"}`}>
          <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); if (suggestions[0]) addTag(suggestions[0]); else if (canCreate) addTag(query); }
              if (e.key === "Escape") { setQuery(""); setOpen(false); }
              if (e.key === "Backspace" && !query && selected.length) removeTag(selected[selected.length - 1]);
            }}
            placeholder={selected.length ? "Add another tag…" : "Search or type a new tag…"}
            className="flex-1 text-sm bg-transparent outline-none text-gray-800 placeholder:text-gray-400"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="text-gray-300 hover:text-gray-500">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {open && (suggestions.length > 0 || canCreate) && (
          <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-xl border border-gray-100 shadow-lg overflow-hidden max-h-52 overflow-y-auto">
            {suggestions.map((t) => (
              <button key={t} type="button" onMouseDown={() => addTag(t)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2.5 transition-colors">
                <span className={`w-2 h-2 rounded-full shrink-0 ${custom.includes(t) ? "bg-blue-400" : "bg-gray-300"}`} />
                <span className="capitalize flex-1 text-gray-700">{t}</span>
                {custom.includes(t) && <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide">Saved</span>}
              </button>
            ))}
            {canCreate && (
              <button type="button" onMouseDown={() => addTag(query)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2.5 text-blue-600 font-semibold border-t border-gray-50 transition-colors">
                <Plus className="w-3.5 h-3.5 shrink-0" />
                Create &ldquo;{query.trim()}&rdquo;
                <span className="text-[10px] text-blue-400 font-normal ml-auto">saves to your library</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick-pick row — common predefined tags */}
      {unselectedPredefined.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {unselectedPredefined.map((t) => (
            <button key={t} type="button" onClick={() => addTag(t)}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-all capitalize">
              + {t}
            </button>
          ))}
        </div>
      )}

      {/* "Your tags" saved library row */}
      {unselectedCustom.length > 0 && (
        <div className="mt-2">
          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Your saved tags</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {unselectedCustom.map((t) => (
              <span key={t} className="inline-flex items-center">
                <button type="button" onClick={() => addTag(t)}
                  className="px-2.5 py-1 rounded-l-full text-xs font-medium bg-blue-50 border border-blue-200 border-r-0 text-blue-600 hover:bg-blue-100 transition-all capitalize">
                  + {t}
                </button>
                <button type="button" title="Remove from library" onClick={() => onRemoveCustom(t)}
                  className="px-1.5 py-1 rounded-r-full text-xs bg-blue-50 border border-blue-200 text-blue-300 hover:text-red-400 hover:bg-red-50 hover:border-red-200 transition-all">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemForm({ restaurantId, categoryId, item, onSave, onCancel, restaurantTags, onAddCustomTag, onRemoveCustomTag }: {
  restaurantId: string; categoryId: string; item?: MenuItem;
  onSave: () => void; onCancel: () => void;
  restaurantTags: string[];
  onAddCustomTag: (tag: string) => void;
  onRemoveCustomTag: (tag: string) => void;
}) {
  const [form, setForm] = useState({
    name: item?.name ?? "",
    description: item?.description ?? "",
    price: item?.price?.toString() ?? "",
    prepTime: item?.prepTime?.toString() ?? "",
    allergens: parseArr(item?.allergens ?? "[]"),
    tags: parseArr(item?.tags ?? "[]"),
    isAvailable: item?.isAvailable ?? true,
    isFeatured: item?.isFeatured ?? false,
    isHidden: item?.isHidden ?? false,
    image: item?.image ?? null as string | null,
    spiceLevel: item?.spiceLevel?.toString() ?? "",
    calories: item?.calories?.toString() ?? "",
    protein: item?.protein?.toString() ?? "",
    carbs: item?.carbs?.toString() ?? "",
    fat: item?.fat?.toString() ?? "",
    costPrice: item?.costPrice?.toString() ?? "",
    chefNote: item?.chefNote ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState<"desc" | "tags" | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/item-image", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        setForm((f) => ({ ...f, image: data.url }));
        toast.success("Photo uploaded!");
      } else {
        toast.error(data.error || "Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    }
    setImageUploading(false);
  }

  async function generateDescription() {
    if (!form.name.trim()) { toast.error("Enter an item name first"); return; }
    setAiLoading("desc");
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "description", payload: {
          name: form.name, price: parseFloat(form.price) || 0,
          tags: form.tags, allergens: form.allergens, category: categoryId,
        }}),
      });
      const data = await res.json();
      if (res.ok && data.result) { setForm((f) => ({ ...f, description: data.result })); toast.success("Description generated!"); }
      else toast.error(data.error || "AI unavailable");
    } catch { toast.error("AI unavailable"); }
    setAiLoading(null);
  }

  async function suggestTags() {
    if (!form.name.trim()) { toast.error("Enter an item name first"); return; }
    setAiLoading("tags");
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "tags", payload: {
          name: form.name, description: form.description, category: categoryId,
        }}),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.result)) {
        const newTags = data.result.filter((t: string) => !form.tags.includes(t));
        if (newTags.length) { setForm((f) => ({ ...f, tags: [...f.tags, ...newTags] })); toast.success(`Added ${newTags.length} tag${newTags.length > 1 ? "s" : ""}!`); }
        else toast("Tags already up to date", { icon: "✓" });
      } else toast.error(data.error || "AI unavailable");
    } catch { toast.error("AI unavailable"); }
    setAiLoading(null);
  }

  function toggleArr(arr: string[], val: string) {
    return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
  }

  // Custom allergens = items not in the predefined allergen list
  const customAllergens = form.allergens.filter((a) => !ALLERGENS.includes(a));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const body = {
      ...form,
      price: parseFloat(form.price),
      prepTime: form.prepTime !== "" ? parseInt(form.prepTime, 10) : null,
      allergens: JSON.stringify(form.allergens),
      tags: JSON.stringify(form.tags),
      image: form.image || null,
      categoryId,
      spiceLevel: form.spiceLevel !== "" ? parseInt(form.spiceLevel, 10) : null,
      calories: form.calories !== "" ? parseInt(form.calories, 10) : null,
      protein: form.protein !== "" ? parseFloat(form.protein) : null,
      carbs: form.carbs !== "" ? parseFloat(form.carbs) : null,
      fat: form.fat !== "" ? parseFloat(form.fat) : null,
      costPrice: form.costPrice !== "" ? parseFloat(form.costPrice) : null,
      chefNote: form.chefNote || null,
    };
    const url = item ? `/api/restaurants/${restaurantId}/items/${item.id}` : `/api/restaurants/${restaurantId}/items`;
    const method = item ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setLoading(false);
    if (res.ok) { toast.success(item ? "Item updated" : "Item added"); onSave(); }
    else { const d = await res.json(); toast.error(d.error || "Failed"); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
      {/* Photo upload */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          <ImagePlus className="w-3 h-3 inline mr-1 text-gray-400" />Photo
        </label>
        {form.image ? (
          <div className="relative w-24 h-24 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={form.image} alt="Item" className="w-24 h-24 rounded-xl object-cover border border-gray-200" />
            <button type="button" onClick={() => setForm((f) => ({ ...f, image: null }))}
              className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
              <Trash className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <label className={`flex items-center gap-2 w-fit cursor-pointer px-3 py-2 rounded-xl border-2 border-dashed transition-colors text-sm ${imageUploading ? "border-blue-300 text-blue-400" : "border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-500"}`}>
            {imageUploading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
              : <><ImagePlus className="w-4 h-4" /> Add photo</>}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageUpload} disabled={imageUploading} />
          </label>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Item name *</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Grilled Salmon" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Price (€) *</label>
          <input required type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
            placeholder="0.00" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            <Clock className="w-3 h-3 inline mr-1 text-gray-400" />Prep time (min)
          </label>
          <input type="number" min="1" max="180" value={form.prepTime} onChange={(e) => setForm({ ...form, prepTime: e.target.value })}
            placeholder="e.g. 15" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white" />
        </div>
        <div className="flex flex-col gap-2 justify-end">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} className="rounded accent-blue-500" />
            <span className="text-gray-700">Available</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} className="rounded accent-blue-500" />
            <span className="text-gray-700">Featured</span>
          </label>
        </div>
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-gray-700">Description</label>
            <button type="button" onClick={generateDescription} disabled={!!aiLoading}
              className="flex items-center gap-1 text-[11px] font-semibold text-purple-600 hover:text-purple-700 disabled:opacity-50 transition-colors">
              {aiLoading === "desc" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {aiLoading === "desc" ? "Writing…" : "✨ Write with AI"}
            </button>
          </div>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe the dish, or click ✨ to generate automatically…" rows={2}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white resize-none" />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-medium text-gray-700">Tags</label>
          <button type="button" onClick={suggestTags} disabled={!!aiLoading}
            className="flex items-center gap-1 text-[11px] font-semibold text-purple-600 hover:text-purple-700 disabled:opacity-50 transition-colors">
            {aiLoading === "tags" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {aiLoading === "tags" ? "Thinking…" : "✨ Suggest tags"}
          </button>
        </div>
        <TagInput
          selected={form.tags}
          predefined={ITEM_TAGS}
          custom={restaurantTags}
          onChange={(v) => setForm({ ...form, tags: v })}
          onAddCustom={onAddCustomTag}
          onRemoveCustom={onRemoveCustomTag}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">Allergens</label>
        {/* Selected allergens */}
        {form.allergens.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {form.allergens.map((a) => (
              <span key={a} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500 text-white">
                {a}
                <button type="button" onClick={() => setForm({ ...form, allergens: form.allergens.filter((x) => x !== a) })} className="hover:opacity-75 ml-0.5">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        {/* Quick-pick predefined allergens */}
        <div className="flex flex-wrap gap-1.5">
          {ALLERGENS.filter((a) => !form.allergens.includes(a)).map((a) => (
            <button key={a} type="button" onClick={() => setForm({ ...form, allergens: [...form.allergens, a] })}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-600 transition-all">
              + {a}
            </button>
          ))}
        </div>
        {/* Custom allergen input — always shown so users can add any allergen */}
        <AllergenCustomInput
          onAdd={(a) => { if (!form.allergens.includes(a)) setForm({ ...form, allergens: [...form.allergens, a] }); }}
        />
      </div>

      {/* Advanced section */}
      <div>
        <button type="button" onClick={() => setShowAdvanced(v => !v)}
          className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors w-full">
          <Settings2 className="w-3.5 h-3.5" />
          Advanced options
          {showAdvanced ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
        </button>
        {showAdvanced && (
          <div className="mt-3 space-y-3 bg-gray-50/80 rounded-xl p-3 border border-gray-100">
            {/* Spice level + cost price */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1"><Flame className="w-3 h-3 text-red-400" /> Spice level (0–5)</label>
                <input type="number" min="0" max="5" value={form.spiceLevel} onChange={e => setForm({...form, spiceLevel: e.target.value})}
                  placeholder="0 = not spicy" className="w-full px-2.5 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3 text-green-500" /> Cost price (€)</label>
                <input type="number" step="0.01" min="0" value={form.costPrice} onChange={e => setForm({...form, costPrice: e.target.value})}
                  placeholder="Your food cost" className="w-full px-2.5 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white" />
              </div>
            </div>

            {/* Nutrition */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-500" /> Nutrition per serving</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: "calories", label: "Calories", suffix: "kcal" },
                  { key: "protein", label: "Protein", suffix: "g" },
                  { key: "carbs", label: "Carbs", suffix: "g" },
                  { key: "fat", label: "Fat", suffix: "g" },
                ].map(({ key, label, suffix }) => (
                  <div key={key}>
                    <label className="block text-[10px] text-gray-500 mb-1">{label}</label>
                    <div className="relative">
                      <input type="number" min="0" step="0.1"
                        value={(form as any)[key]} onChange={e => setForm({...form, [key]: e.target.value})}
                        placeholder="0" className="w-full px-2 py-1.5 pr-6 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white" />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-400">{suffix}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chef note */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Chef's note / story</label>
              <textarea value={form.chefNote} onChange={e => setForm({...form, chefNote: e.target.value})} rows={2}
                placeholder="A brief personal note about this dish…"
                className="w-full px-2.5 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none bg-white" />
            </div>

            {/* Hidden toggle */}
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={form.isHidden} onChange={e => setForm({...form, isHidden: e.target.checked})} className="rounded accent-blue-500" />
              <EyeOff className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-700">Hidden from customers (visible only in admin)</span>
            </label>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={loading}
          className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-semibold py-2 rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all disabled:opacity-60">
          {loading ? "Saving..." : item ? "Update Item" : "Add Item"}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-xl hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
}

const SCHED_DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const SCHED_DAYS_FULL = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];

function parseCatSchedule(s?: string | null): { enabled: boolean; days: string[]; startTime: string; endTime: string } {
  if (!s) return { enabled: false, days: [], startTime: "08:00", endTime: "22:00" };
  try { return JSON.parse(s); } catch { return { enabled: false, days: [], startTime: "08:00", endTime: "22:00" }; }
}

function CategoryForm({ restaurantId, cat, onSave, onCancel }: {
  restaurantId: string; cat?: Category; onSave: () => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({ name: cat?.name ?? "", description: cat?.description ?? "", icon: cat?.icon ?? "" });
  const [sched, setSched] = useState(() => parseCatSchedule(cat?.schedule));
  const [showSched, setShowSched] = useState(false);
  const [loading, setLoading] = useState(false);

  function toggleSchedDay(day: string) {
    setSched((s) => ({
      ...s,
      days: s.days.includes(day) ? s.days.filter((d) => d !== day) : [...s.days, day],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const url = cat ? `/api/restaurants/${restaurantId}/categories/${cat.id}` : `/api/restaurants/${restaurantId}/categories`;
    const method = cat ? "PUT" : "POST";
    const body = { ...form, schedule: sched.enabled ? sched : null };
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setLoading(false);
    if (res.ok) { toast.success(cat ? "Category updated" : "Category added"); onSave(); }
    else { const d = await res.json(); toast.error(d.error || "Failed"); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2 items-end">
        <input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="🍕" maxLength={4}
          className="w-16 px-2 py-2 rounded-xl border border-gray-200 text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">Category name *</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Starters"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
        </div>
        <button type="submit" disabled={loading}
          className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all whitespace-nowrap">
          {loading ? "..." : cat ? "Update" : "Add"}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-2 border border-gray-200 text-gray-700 text-sm rounded-xl hover:bg-gray-50">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Schedule toggle */}
      {cat && (
        <div className="ml-1">
          <button type="button" onClick={() => setShowSched((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
            <Clock className="w-3 h-3" />
            {sched.enabled ? `⏰ Scheduled: ${sched.startTime}–${sched.endTime}` : "Set time schedule (optional)"}
          </button>
          {showSched && (
            <div className="mt-2 p-3 bg-blue-50 rounded-xl border border-blue-100 space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={sched.enabled} onChange={(e) => setSched((s) => ({ ...s, enabled: e.target.checked }))}
                  className="accent-blue-500" />
                <span className="font-medium text-gray-700">Enable time-based visibility</span>
              </label>
              {sched.enabled && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-0.5">Show from</label>
                      <input type="time" value={sched.startTime}
                        onChange={(e) => setSched((s) => ({ ...s, startTime: e.target.value }))}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-0.5">Hide after</label>
                      <input type="time" value={sched.endTime}
                        onChange={(e) => setSched((s) => ({ ...s, endTime: e.target.value }))}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm" />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Active days <span className="text-gray-400">(empty = every day)</span></p>
                    <div className="flex gap-1 flex-wrap">
                      {SCHED_DAYS.map((d, i) => {
                        const full = SCHED_DAYS_FULL[i];
                        const active = sched.days.includes(full);
                        return (
                          <button key={d} type="button" onClick={() => toggleSchedDay(full)}
                            className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${active ? "bg-blue-500 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-blue-300"}`}>
                            {d[0]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-xs text-blue-600">
                    This category will be hidden outside the set hours/days on the public menu.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </form>
  );
}

export default function MenuManagementPage() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [addingItem, setAddingItem] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<{ catId: string; item: MenuItem } | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  // Restaurant-level custom tag library
  const [restaurantTags, setRestaurantTags] = useState<string[]>([]);
  const restaurantIdRef = useRef<string>("");
  // ── Unsaved changes ────────────────────────────────────────────────────────
  // Nothing below goes live until the user presses Save.
  const [draftMode, setDraftMode] = useState<"dynamic" | "static" | null>(null);
  const [draftBook, setDraftBook] = useState<BookDraft | null>(null);
  const [pendingCatDeletes, setPendingCatDeletes] = useState<Set<string>>(new Set());
  const [pendingItemDeletes, setPendingItemDeletes] = useState<Set<string>>(new Set());
  const [pendingAvailability, setPendingAvailability] = useState<Map<string, boolean>>(new Map());
  const [saving, setSaving] = useState(false);
  // Files uploaded for the book but not saved yet (deleted again on Discard)
  const stagedUploadsRef = useRef<string[]>([]);

  const savedMode = restaurant?.primaryMenu ?? "dynamic";
  const effectiveMode = draftMode ?? savedMode;
  // Named menus with their versions (PDF / photo books)
  const history = useMenuHistory(restaurant?.id, [restaurant?.menuPdfUrl ?? null, savedMode]);
  const menuOf = (url: string | null | undefined): MenuGroup | undefined =>
    url ? history.data?.menus.find((m) => m.versions.some((v) => v.menuPdfUrl === url)) : undefined;
  const normTitle = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim();
  const savedUrl = restaurant?.menuPdfUrl ?? null;
  const savedBook: BookDraft = {
    menuPdfUrl: savedUrl,
    name: restaurant?.menuPdfName ?? null,
    title: menuOf(savedUrl)?.title ?? "",
    basedOn: savedUrl,
  };
  const bookValue = draftBook ?? savedBook;
  const defaultTitle = defaultMenuName(restaurant?.name);
  const modeChanged = draftMode !== null && draftMode !== savedMode;
  const titleChanged = (d: BookDraft) => normTitle(d.title) !== "" && normTitle(d.title) !== normTitle(savedBook.title);
  const bookChanged = draftBook !== null && (draftBook.menuPdfUrl !== savedBook.menuPdfUrl || titleChanged(draftBook));
  const changeCount =
    (modeChanged ? 1 : 0) + (bookChanged ? 1 : 0) +
    pendingCatDeletes.size + pendingItemDeletes.size + pendingAvailability.size;
  const formOpen = addingCategory || !!editingCategory || !!addingItem || !!editingItem;
  // The "edit a saved version" pop-up in the history has unsaved changes
  const [historyEditDirty, setHistoryEditDirty] = useState(false);
  const hasUnsaved = changeCount > 0 || formOpen || historyEditDirty;

  useUnsavedChanges(
    hasUnsaved,
    changeCount > 0
      ? `You have ${changeCount} unsaved change${changeCount === 1 ? "" : "s"} in your menu. Leave without saving?`
      : historyEditDirty
        ? "You are editing a menu version that isn't saved yet. Leave without saving?"
        : "You have an open form that isn't saved yet. Leave without saving?",
  );

  // Remounts the book editor when a version from the history is loaded into it
  const [editorKey, setEditorKey] = useState(0);

  function loadHistoryVersion(menu: MenuGroup, v: MenuVersion) {
    setDraftBook(v.menuPdfUrl === savedBook.menuPdfUrl
      ? null
      : { menuPdfUrl: v.menuPdfUrl, name: v.menuPdfName ?? v.files, title: menu.title, basedOn: v.menuPdfUrl });
    if (savedMode !== "static") setDraftMode("static");
    setEditorKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
    const which = menu.versions.length > 1 ? ` (version ${v.number})` : "";
    toast(`"${menu.title}"${which} loaded. Press Save changes to make it active.`, { icon: "💾" });
  }

  function setMenuMode(mode: "dynamic" | "static") {
    setDraftMode(mode === savedMode ? null : mode);
  }

  function toggleSet(set: Set<string>, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  function discardChanges() {
    if (!restaurant) return;
    const keep = allMenuFileUrls(parseMenuPages(restaurant.menuPdfUrl));
    for (const url of stagedUploadsRef.current) {
      if (keep.includes(url)) continue;
      fetch(`/api/restaurants/${restaurant.id}/upload-menu?staged=${encodeURIComponent(url)}`, { method: "DELETE" }).catch(() => {});
    }
    stagedUploadsRef.current = [];
    setDraftMode(null);
    setDraftBook(null);
    setPendingCatDeletes(new Set());
    setPendingItemDeletes(new Set());
    setPendingAvailability(new Map());
  }

  async function saveChanges() {
    if (!restaurant || saving || changeCount === 0) return;
    setSaving(true);
    const rid = restaurant.id;
    const failed: string[] = [];
    const json = { "Content-Type": "application/json" };

    // 1. Uploaded menu (PDF / photos)
    if (bookChanged && draftBook) {
      const res = await fetch(`/api/restaurants/${rid}/upload-menu`, {
        method: "PUT", headers: json,
        body: JSON.stringify({
          menuPdfUrl: draftBook.menuPdfUrl,
          menuPdfName: draftBook.name,
          // New menu without a name gets "<Restaurant>'s menu - <today>" (in the user's own time zone)
          title: normTitle(draftBook.title) || (draftBook.basedOn ? "" : defaultTitle),
          basedOn: draftBook.basedOn ?? null,
        }),
      }).catch(() => null);
      if (res?.ok) {
        const saved = allMenuFileUrls(parseMenuPages(draftBook.menuPdfUrl));
        // Uploads that were removed again before saving are no longer needed
        for (const url of stagedUploadsRef.current) {
          if (!saved.includes(url)) {
            fetch(`/api/restaurants/${rid}/upload-menu?staged=${encodeURIComponent(url)}`, { method: "DELETE" }).catch(() => {});
          }
        }
        stagedUploadsRef.current = [];
        setDraftBook(null);
        history.reload();
      } else failed.push("menu file");
    }

    // 2. Menu type (what the QR code shows)
    if (modeChanged && draftMode) {
      const res = await fetch(`/api/restaurants/${rid}`, {
        method: "PUT", headers: json, body: JSON.stringify({ primaryMenu: draftMode }),
      }).catch(() => null);
      if (res?.ok) setDraftMode(null);
      else failed.push("menu type");
    }

    // 3. Deleted categories and items
    const catsLeft = new Set(pendingCatDeletes);
    for (const catId of pendingCatDeletes) {
      const res = await fetch(`/api/restaurants/${rid}/categories/${catId}`, { method: "DELETE" }).catch(() => null);
      if (res?.ok) catsLeft.delete(catId);
      else failed.push("category");
    }
    const itemsInDeletedCats = new Set(
      categories.filter((c) => pendingCatDeletes.has(c.id)).flatMap((c) => c.items.map((i) => i.id)),
    );
    const itemsLeft = new Set(pendingItemDeletes);
    for (const itemId of pendingItemDeletes) {
      if (itemsInDeletedCats.has(itemId)) { itemsLeft.delete(itemId); continue; }
      const res = await fetch(`/api/restaurants/${rid}/items/${itemId}`, { method: "DELETE" }).catch(() => null);
      if (res?.ok) itemsLeft.delete(itemId);
      else failed.push("item");
    }

    // 4. Availability switches
    const availLeft = new Map(pendingAvailability);
    for (const [itemId, isAvailable] of pendingAvailability) {
      if (itemsInDeletedCats.has(itemId) || pendingItemDeletes.has(itemId)) { availLeft.delete(itemId); continue; }
      const res = await fetch(`/api/restaurants/${rid}/items/${itemId}`, {
        method: "PUT", headers: json, body: JSON.stringify({ isAvailable }),
      }).catch(() => null);
      if (res?.ok) availLeft.delete(itemId);
      else failed.push("availability");
    }

    setPendingCatDeletes(catsLeft);
    setPendingItemDeletes(itemsLeft);
    setPendingAvailability(availLeft);
    await load();
    setSaving(false);

    if (failed.length) toast.error(`Some changes could not be saved (${[...new Set(failed)].join(", ")}). Please try again.`);
    else toast.success("Changes saved. Customers see them now.");
  }

  async function load() {
    const statsRes = await fetch("/api/dashboard/stats");
    const stats = await statsRes.json();
    const rid: string = stats.restaurantId;
    restaurantIdRef.current = rid;
    setRestaurant({
      id: rid,
      name: stats.restaurant.name,
      slug: stats.restaurant.slug ?? null,
      primaryMenu: stats.restaurant.primaryMenu === "static" ? "static" : "dynamic",
      menuPdfUrl: stats.restaurant.menuPdfUrl ?? null,
      menuPdfName: stats.restaurant.menuPdfName ?? null,
    });

    const [catRes, tagsRes] = await Promise.all([
      fetch(`/api/restaurants/${rid}/categories`),
      fetch(`/api/restaurants/${rid}/custom-tags`),
    ]);

    const catJson = await catRes.json();
    const catData: Category[] = Array.isArray(catJson) ? catJson : (catJson.categories ?? []);
    setCategories(catData);
    setExpandedCats(new Set(catData.map((c: Category) => c.id)));

    if (tagsRes.ok) {
      const tagsJson = await tagsRes.json();
      setRestaurantTags(tagsJson.tags ?? []);
    }

    setLoading(false);
  }

  async function addCustomTag(tag: string) {
    const rid = restaurantIdRef.current;
    if (!rid) return;
    const res = await fetch(`/api/restaurants/${rid}/custom-tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag }),
    });
    if (res.ok) {
      const data = await res.json();
      setRestaurantTags(data.tags ?? []);
    }
  }

  async function removeCustomTag(tag: string) {
    const rid = restaurantIdRef.current;
    if (!rid) return;
    const res = await fetch(`/api/restaurants/${rid}/custom-tags`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag }),
    });
    if (res.ok) {
      const data = await res.json();
      setRestaurantTags(data.tags ?? []);
    }
  }

  useEffect(() => { load(); }, []);

  function deleteCategory(catId: string) {
    setPendingCatDeletes((prev) => toggleSet(prev, catId));
  }

  function deleteItem(itemId: string) {
    setPendingItemDeletes((prev) => toggleSet(prev, itemId));
  }

  function isItemAvailable(item: MenuItem) {
    return pendingAvailability.get(item.id) ?? item.isAvailable;
  }

  function toggleAvailability(item: MenuItem) {
    setPendingAvailability((prev) => {
      const next = new Map(prev);
      const target = !(prev.get(item.id) ?? item.isAvailable);
      if (target === item.isAvailable) next.delete(item.id);
      else next.set(item.id, target);
      return next;
    });
  }

  if (loading) return <div className="p-6 flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" /></div>;
  if (!restaurant) return null;

  const isBook = effectiveMode === "static";
  const hasBook = !!parseMenuPages(bookValue.menuPdfUrl);

  return (
    <div className={`p-4 lg:p-6 space-y-6 ${changeCount > 0 ? "pb-28" : ""}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu Management</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isBook
              ? "Your menu is a PDF or photos that customers flip through like a book"
              : `${categories.length} categories · ${categories.reduce((a, c) => a + c.items.length, 0)} items total`}
          </p>
        </div>
        {!isBook && (
          <button onClick={() => setAddingCategory(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all shadow-lg shadow-blue-500/25">
            <Plus className="w-4 h-4" /> Add Category
          </button>
        )}
      </div>

      {/* Menu type toggle: this is what the QR code shows */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-gray-900">Menu type</div>
            <div className="text-xs text-gray-500">What customers see when they scan your QR code</div>
          </div>
          {restaurant.slug && (
            <a href={`/r/${restaurant.slug}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700">
              <ExternalLink className="w-3.5 h-3.5" /> Open public menu
            </a>
          )}
        </div>
        <div role="radiogroup" aria-label="Menu type" className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl">
          {([
            { value: "dynamic", label: "Digital menu", hint: "Categories & items", icon: LayoutList },
            { value: "static", label: "PDF / Photos", hint: "Flip-book menu", icon: BookOpen },
          ] as const).map(({ value, label, hint, icon: Icon }) => {
            const active = effectiveMode === value;
            return (
              <button key={value} type="button" role="radio" aria-checked={active}
                onClick={() => setMenuMode(value)} disabled={saving}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all disabled:cursor-wait ${
                  active ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}>
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
                <span className={`hidden sm:inline text-xs font-normal ${active ? "text-gray-400" : "text-gray-400"}`}>· {hint}</span>
              </button>
            );
          })}
        </div>
        {modeChanged && (
          <div className="text-xs font-medium text-amber-700">
            Not saved yet. Customers still see the {savedMode === "static" ? "PDF / photo" : "digital"} menu until you press Save.
          </div>
        )}
        {isBook && !hasBook && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Nothing uploaded yet. Upload a PDF or photos below before you save, otherwise customers see an empty menu.</span>
          </div>
        )}
      </div>

      {isBook ? (
        <div className="space-y-5">
        <MenuBookEditor
          key={editorKey}
          restaurantId={restaurant.id}
          restaurantSlug={restaurant.slug}
          value={bookValue}
          onChange={(next) => setDraftBook(
            next.menuPdfUrl === savedBook.menuPdfUrl && (next.basedOn ?? null) === savedBook.basedOn && normTitle(next.title) === normTitle(savedBook.title)
              ? null
              : next,
          )}
          savedValue={savedBook}
          onStaged={(url) => { stagedUploadsRef.current.push(url); }}
          editingTitle={menuOf(bookValue.basedOn)?.title ?? null}
          defaultTitle={defaultTitle}
        />
        <MenuHistory
          restaurantId={restaurant.id}
          history={history}
          liveMode={savedMode}
          draftMenuPdfUrl={bookValue.menuPdfUrl}
          onUseVersion={loadHistoryVersion}
          onEditDirtyChange={setHistoryEditDirty}
        />
        </div>
      ) : (
      <>
      {addingCategory && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <CategoryForm restaurantId={restaurant.id} onSave={() => { setAddingCategory(false); load(); }} onCancel={() => setAddingCategory(false)} />
        </div>
      )}

      {categories.length === 0 && !addingCategory && (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
          <Tag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-700 mb-1">No categories yet</h3>
          <p className="text-gray-500 text-sm mb-4">Start by adding a category like "Starters" or "Main Courses"</p>
          <button onClick={() => setAddingCategory(true)}
            className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl">
            <Plus className="w-4 h-4 inline mr-1" /> Add First Category
          </button>
        </div>
      )}

      <div className="space-y-4">
        {categories.map((cat) => {
          const expanded = expandedCats.has(cat.id);
          return (
            <div key={cat.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Category header */}
              <div className="flex items-center gap-3 p-4">
                <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                <span className="text-xl">{cat.icon || "📂"}</span>
                {editingCategory?.id === cat.id ? (
                  <div className="flex-1">
                    <CategoryForm restaurantId={restaurant.id} cat={cat}
                      onSave={() => { setEditingCategory(null); load(); }}
                      onCancel={() => setEditingCategory(null)} />
                  </div>
                ) : (
                  <>
                    <div className="flex-1">
                      <div className={`font-semibold text-gray-900 ${pendingCatDeletes.has(cat.id) ? "line-through decoration-red-400" : ""}`}>{cat.name}</div>
                      <div className="text-xs text-gray-500">
                        {cat.items.length} items
                        {pendingCatDeletes.has(cat.id) && <span className="ml-2 text-red-600 font-medium">Category and its items will be deleted</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditingCategory(cat)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteCategory(cat.id)} title={pendingCatDeletes.has(cat.id) ? "Undo delete" : "Delete category"}
                        className={`p-1.5 rounded-lg transition-colors ${pendingCatDeletes.has(cat.id) ? "text-red-600 bg-red-100 hover:bg-red-200" : "text-gray-400 hover:text-red-600 hover:bg-red-50"}`}>
                        {pendingCatDeletes.has(cat.id) ? <Undo2 className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setExpandedCats((prev) => { const n = new Set(prev); n.has(cat.id) ? n.delete(cat.id) : n.add(cat.id); return n; })}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Items */}
              {expanded && (
                <div className="border-t border-gray-50 px-4 py-3 space-y-2">
                  {cat.items.map((item) => (
                    <div key={item.id}>
                      {editingItem?.item.id === item.id ? (
                        <ItemForm restaurantId={restaurant.id} categoryId={cat.id} item={item}
                          onSave={() => { setEditingItem(null); load(); }}
                          onCancel={() => setEditingItem(null)}
                          restaurantTags={restaurantTags}
                          onAddCustomTag={addCustomTag}
                          onRemoveCustomTag={removeCustomTag} />
                      ) : (
                        <div className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                          pendingItemDeletes.has(item.id) || pendingCatDeletes.has(cat.id)
                            ? "bg-red-50/60"
                            : !isItemAvailable(item) ? "opacity-50 hover:bg-gray-50" : "hover:bg-gray-50"
                        }`}>
                          <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                          {item.image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-sm font-medium text-gray-900 truncate ${pendingItemDeletes.has(item.id) || pendingCatDeletes.has(cat.id) ? "line-through decoration-red-400 text-gray-500" : ""}`}>{item.name}</span>
                              {item.isFeatured && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">⭐ Featured</span>}
                              {item.isHidden && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><EyeOff className="w-2.5 h-2.5" />Hidden</span>}
                              {!isItemAvailable(item) && <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full">Unavailable</span>}
                              {pendingItemDeletes.has(item.id) && <span className="inline-block text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Will be deleted</span>}
                              {pendingAvailability.has(item.id) && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Unsaved</span>}
                              {item.spiceLevel != null && item.spiceLevel > 0 && (
                                <span className="text-[10px] text-red-500">{"🌶️".repeat(Math.min(item.spiceLevel, 5))}</span>
                              )}
                              {item.calories != null && (
                                <span className="text-[10px] bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded-full">{item.calories} kcal</span>
                              )}
                              {item.costPrice != null && item.price > 0 && (
                                <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full">{Math.round(((item.price - item.costPrice) / item.price) * 100)}% margin</span>
                              )}
                            </div>
                            {item.description && <div className="text-xs text-gray-500 truncate">{item.description}</div>}
                          </div>
                          {item.prepTime && (
                            <span className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-0.5">
                              <Clock className="w-3 h-3" />{item.prepTime}m
                            </span>
                          )}
                          <span className={`text-sm font-bold text-gray-900 whitespace-nowrap ${pendingItemDeletes.has(item.id) || pendingCatDeletes.has(cat.id) ? "line-through decoration-red-400 text-gray-500" : ""}`}>€{item.price.toFixed(2)}</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => toggleAvailability(item)} title={isItemAvailable(item) ? "Available" : "Unavailable"}
                              className={`w-8 h-4 rounded-full transition-colors relative ${isItemAvailable(item) ? "bg-green-400" : "bg-gray-300"}`}>
                              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${isItemAvailable(item) ? "translate-x-4" : "translate-x-0.5"}`} />
                            </button>
                            <button onClick={async () => {
                              const res = await fetch(`/api/restaurants/${restaurant.id}/clone-item`, {
                                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: item.id }),
                              });
                              if (res.ok) { toast.success("Item cloned!"); load(); }
                              else toast.error("Clone failed");
                            }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Clone item">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setEditingItem({ catId: cat.id, item })}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => deleteItem(item.id)} title={pendingItemDeletes.has(item.id) ? "Undo delete" : "Delete item"}
                              className={`p-1.5 rounded-lg transition-colors ${pendingItemDeletes.has(item.id) ? "text-red-600 bg-red-100 hover:bg-red-200" : "text-gray-400 hover:text-red-600 hover:bg-red-50"}`}>
                              {pendingItemDeletes.has(item.id) ? <Undo2 className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {addingItem === cat.id ? (
                    <ItemForm restaurantId={restaurant.id} categoryId={cat.id}
                      onSave={() => { setAddingItem(null); load(); }}
                      onCancel={() => setAddingItem(null)}
                      restaurantTags={restaurantTags}
                      onAddCustomTag={addCustomTag}
                      onRemoveCustomTag={removeCustomTag} />
                  ) : (
                    <button onClick={() => setAddingItem(cat.id)}
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium w-full px-3 py-2 rounded-xl hover:bg-blue-50 transition-colors">
                      <Plus className="w-4 h-4" /> Add Item
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {categories.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">New or edited items and categories are saved with the Save button in their form. Deleting, availability switches and the menu type are saved with the Save changes bar at the bottom.</p>
        </div>
      )}
      </>
      )}

      {/* Save bar: shows up after any change */}
      {changeCount > 0 && (
        <div className="sticky bottom-4 z-30">
          <div className="mx-auto max-w-2xl flex items-center gap-3 rounded-2xl bg-gray-900 text-white px-4 py-3 shadow-2xl">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span className="text-sm font-medium flex-1">
              {changeCount} unsaved change{changeCount === 1 ? "" : "s"}
            </span>
            <button onClick={discardChanges} disabled={saving}
              className="text-sm font-medium text-gray-300 hover:text-white px-3 py-2 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-50">
              Discard
            </button>
            <button onClick={saveChanges} disabled={saving}
              className="flex items-center gap-2 text-sm font-semibold bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 px-4 py-2 rounded-xl transition-all disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
