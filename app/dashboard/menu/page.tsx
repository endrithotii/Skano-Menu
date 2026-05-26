"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, GripVertical, Tag, AlertCircle, X, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { ALLERGENS, ITEM_TAGS } from "@/lib/utils";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  allergens: string;
  tags: string;
  prepTime: number | null;
  isAvailable: boolean;
  isFeatured: boolean;
  order: number;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  order: number;
  items: MenuItem[];
}

interface Restaurant { id: string; name: string; }

function parseArr(s: string): string[] { try { return JSON.parse(s); } catch { return []; } }

function CustomChipInput({ label, values, onChange, colorClass }: {
  label: string; values: string[]; onChange: (v: string[]) => void; colorClass: string;
}) {
  const [input, setInput] = useState("");
  function add() {
    const val = input.trim();
    if (val && !values.includes(val)) onChange([...values, val]);
    setInput("");
  }
  return (
    <div className="flex items-center gap-1 mt-1.5">
      <input value={input} onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        placeholder={`Add custom ${label.toLowerCase()}...`}
        className="flex-1 px-2.5 py-1 rounded-xl border border-dashed border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-white" />
      <button type="button" onClick={add}
        className={`px-2.5 py-1 rounded-xl text-xs font-semibold ${colorClass} transition-all disabled:opacity-40`}
        disabled={!input.trim()}>
        + Add
      </button>
    </div>
  );
}

function ItemForm({ restaurantId, categoryId, item, onSave, onCancel }: {
  restaurantId: string; categoryId: string; item?: MenuItem;
  onSave: () => void; onCancel: () => void;
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
  });
  const [loading, setLoading] = useState(false);

  function toggleArr(arr: string[], val: string) {
    return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
  }

  // Custom tags/allergens = items not in the predefined list
  const customTags = form.tags.filter((t) => !ITEM_TAGS.includes(t));
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
      categoryId,
    };
    const url = item ? `/api/restaurants/${restaurantId}/items/${item.id}` : `/api/restaurants/${restaurantId}/items`;
    const method = item ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setLoading(false);
    if (res.ok) { toast.success(item ? "Item updated" : "Item added"); onSave(); }
    else { const d = await res.json(); toast.error(d.error || "Failed"); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-orange-50 rounded-2xl border border-orange-100">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Item name *</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Grilled Salmon" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Price (€) *</label>
          <input required type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
            placeholder="0.00" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            <Clock className="w-3 h-3 inline mr-1 text-gray-400" />Prep time (min)
          </label>
          <input type="number" min="1" max="180" value={form.prepTime} onChange={(e) => setForm({ ...form, prepTime: e.target.value })}
            placeholder="e.g. 15" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 bg-white" />
        </div>
        <div className="flex flex-col gap-2 justify-end">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} className="rounded accent-orange-500" />
            <span className="text-gray-700">Available</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} className="rounded accent-orange-500" />
            <span className="text-gray-700">Featured</span>
          </label>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe the dish..." rows={2}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 bg-white resize-none" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">Tags</label>
        <div className="flex flex-wrap gap-1.5">
          {ITEM_TAGS.map((t) => (
            <button key={t} type="button" onClick={() => setForm({ ...form, tags: toggleArr(form.tags, t) })}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all capitalize ${form.tags.includes(t) ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-orange-300"}`}>
              {t}
            </button>
          ))}
          {customTags.map((t) => (
            <span key={t} className="px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500 text-white flex items-center gap-1">
              {t}
              <button type="button" onClick={() => setForm({ ...form, tags: form.tags.filter((x) => x !== t) })}
                className="hover:opacity-75"><X className="w-2.5 h-2.5" /></button>
            </span>
          ))}
        </div>
        <CustomChipInput label="Tag" values={form.tags}
          onChange={(v) => setForm({ ...form, tags: v })}
          colorClass="bg-orange-100 text-orange-700 hover:bg-orange-200" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">Allergens</label>
        <div className="flex flex-wrap gap-1.5">
          {ALLERGENS.map((a) => (
            <button key={a} type="button" onClick={() => setForm({ ...form, allergens: toggleArr(form.allergens, a) })}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${form.allergens.includes(a) ? "bg-red-500 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-red-300"}`}>
              {a}
            </button>
          ))}
          {customAllergens.map((a) => (
            <span key={a} className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-500 text-white flex items-center gap-1">
              {a}
              <button type="button" onClick={() => setForm({ ...form, allergens: form.allergens.filter((x) => x !== a) })}
                className="hover:opacity-75"><X className="w-2.5 h-2.5" /></button>
            </span>
          ))}
        </div>
        <CustomChipInput label="Allergen" values={form.allergens}
          onChange={(v) => setForm({ ...form, allergens: v })}
          colorClass="bg-red-100 text-red-700 hover:bg-red-200" />
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={loading}
          className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold py-2 rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-60">
          {loading ? "Saving..." : item ? "Update Item" : "Add Item"}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-xl hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
}

function CategoryForm({ restaurantId, cat, onSave, onCancel }: {
  restaurantId: string; cat?: Category; onSave: () => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({ name: cat?.name ?? "", description: cat?.description ?? "", icon: cat?.icon ?? "" });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const url = cat ? `/api/restaurants/${restaurantId}/categories/${cat.id}` : `/api/restaurants/${restaurantId}/categories`;
    const method = cat ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setLoading(false);
    if (res.ok) { toast.success(cat ? "Category updated" : "Category added"); onSave(); }
    else { const d = await res.json(); toast.error(d.error || "Failed"); }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
      <input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="🍕" maxLength={4}
        className="w-16 px-2 py-2 rounded-xl border border-gray-200 text-center text-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500" />
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-700 mb-1">Category name *</label>
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Starters"
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500" />
      </div>
      <button type="submit" disabled={loading}
        className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all whitespace-nowrap">
        {loading ? "..." : cat ? "Update" : "Add"}
      </button>
      <button type="button" onClick={onCancel} className="px-3 py-2 border border-gray-200 text-gray-700 text-sm rounded-xl hover:bg-gray-50">
        <X className="w-4 h-4" />
      </button>
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

  async function load() {
    const statsRes = await fetch("/api/dashboard/stats");
    const stats = await statsRes.json();
    setRestaurant({ id: stats.restaurantId, name: stats.restaurant.name });

    const catRes = await fetch(`/api/restaurants/${stats.restaurantId}/categories`);
    const catJson = await catRes.json();
    const catData: Category[] = Array.isArray(catJson) ? catJson : (catJson.categories ?? []);
    setCategories(catData);
    setExpandedCats(new Set(catData.map((c: Category) => c.id)));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function deleteCategory(catId: string) {
    if (!restaurant || !confirm("Delete this category and all its items?")) return;
    const res = await fetch(`/api/restaurants/${restaurant.id}/categories/${catId}`, { method: "DELETE" });
    if (res.ok) { toast.success("Category deleted"); load(); }
  }

  async function deleteItem(restaurantId: string, itemId: string) {
    if (!confirm("Delete this item?")) return;
    const res = await fetch(`/api/restaurants/${restaurantId}/items/${itemId}`, { method: "DELETE" });
    if (res.ok) { toast.success("Item deleted"); load(); }
  }

  async function toggleAvailability(restaurantId: string, item: MenuItem) {
    await fetch(`/api/restaurants/${restaurantId}/items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAvailable: !item.isAvailable }),
    });
    load();
  }

  if (loading) return <div className="p-6 flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;
  if (!restaurant) return null;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu Management</h1>
          <p className="text-gray-500 text-sm mt-1">{categories.length} categories · {categories.reduce((a, c) => a + c.items.length, 0)} items total</p>
        </div>
        <button onClick={() => setAddingCategory(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/25">
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

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
            className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl">
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
                      <div className="font-semibold text-gray-900">{cat.name}</div>
                      <div className="text-xs text-gray-500">{cat.items.length} items</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditingCategory(cat)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteCategory(cat.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
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
                          onCancel={() => setEditingItem(null)} />
                      ) : (
                        <div className={`flex items-center gap-3 p-3 rounded-xl ${!item.isAvailable ? "opacity-50" : ""} hover:bg-gray-50 transition-colors`}>
                          <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 truncate">{item.name}</span>
                              {item.isFeatured && <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">Featured</span>}
                              {!item.isAvailable && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Unavailable</span>}
                            </div>
                            {item.description && <div className="text-xs text-gray-500 truncate">{item.description}</div>}
                          </div>
                          {item.prepTime && (
                            <span className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-0.5">
                              <Clock className="w-3 h-3" />{item.prepTime}m
                            </span>
                          )}
                          <span className="text-sm font-bold text-gray-900 whitespace-nowrap">€{item.price.toFixed(2)}</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => toggleAvailability(restaurant.id, item)}
                              className={`w-8 h-4 rounded-full transition-colors relative ${item.isAvailable ? "bg-green-400" : "bg-gray-300"}`}>
                              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${item.isAvailable ? "translate-x-4" : "translate-x-0.5"}`} />
                            </button>
                            <button onClick={() => setEditingItem({ catId: cat.id, item })}
                              className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => deleteItem(restaurant.id, item.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {addingItem === cat.id ? (
                    <ItemForm restaurantId={restaurant.id} categoryId={cat.id}
                      onSave={() => { setAddingItem(null); load(); }}
                      onCancel={() => setAddingItem(null)} />
                  ) : (
                    <button onClick={() => setAddingItem(cat.id)}
                      className="flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 font-medium w-full px-3 py-2 rounded-xl hover:bg-orange-50 transition-colors">
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
          <p className="text-sm text-blue-700">Changes are saved instantly and visible to customers scanning your QR code immediately.</p>
        </div>
      )}
    </div>
  );
}
