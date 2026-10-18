// Moving the old skano.menu (Laravel / MySQL) restaurants into this app (Admin > Import old database).
//
// The old database dump has users (one restaurant each: business_name, business_username, address, phone,
// facebook / instagram), menus (per owner, active 1 / null = shown, 0 = hidden) and menu_files (photos of each
// menu, in order). Only owners who uploaded a menu are brought over.
//
// Steps (each one a request, so they fit the time limit of a serverless function):
//   1. analyze: read the dump, read every restaurant's page on the old site (which menus it shows, with which
//      buttons, and where the photos are), and count what is in the database now
//   2. backup:  the current database as JSON, downloaded by the admin before anything is deleted
//   3. run:     delete everything (super admin accounts stay) and import
//   4. photos:  copy the photos from the old site into our storage, a batch at a time

import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { saveMenuFile } from "@/lib/menu-files";
import { defaultMenuTitle } from "@/lib/menu-history";
import { slugify as treeSlug, type MenuTree, type TreeNode } from "@/lib/menu-tree-types";

/** The old site (LEGACY_SITE only to test against a copy) */
export const OLD_SITE = (process.env.LEGACY_SITE || "https://skano.menu").replace(/\/+$/, "");

// ── Reading the dump ─────────────────────────────────────────────────────────

type Value = string | number | null;
export type Tables = Record<string, Record<string, Value>[]>;

/** The INSERT statements of a phpMyAdmin / mysqldump file, as rows per table */
export function parseDump(sql: string): Tables {
  const tables: Tables = {};
  const re = /INSERT INTO `(\w+)` \(([^)]*)\) VALUES\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    const name = m[1];
    const cols = m[2].split(",").map((c) => c.trim().replace(/`/g, ""));
    let i = re.lastIndex, depth = 0, buf = "", quoted = false, inq = false;
    let row: Value[] = [];
    const rows: Record<string, Value>[] = [];
    for (; i < sql.length; i++) {
      const ch = sql[i];
      if (inq) {
        if (ch === "\\") { const n = sql[i + 1]; buf += ({ n: "\n", r: "\r", t: "\t", "0": "\0" } as Record<string, string>)[n] ?? n; i++; continue; }
        if (ch === "'") { if (sql[i + 1] === "'") { buf += "'"; i++; continue; } inq = false; continue; }
        buf += ch; continue;
      }
      if (ch === "'") { inq = true; quoted = true; buf = ""; continue; }
      if (depth === 0 && ch === ";") break;
      if (ch === "(" && depth === 0) { depth = 1; row = []; buf = ""; quoted = false; continue; }
      if ((ch === "," || ch === ")") && depth === 1) {
        const v = buf.trim();
        row.push(quoted ? buf : v.toUpperCase() === "NULL" ? null : /^-?\d+$/.test(v) ? Number(v) : v);
        buf = ""; quoted = false;
        if (ch === ")") { depth = 0; rows.push(Object.fromEntries(cols.map((c, k) => [c, row[k] ?? null]))); }
        continue;
      }
      if (depth === 1) buf += ch;
    }
    re.lastIndex = i;
    (tables[name] ??= []).push(...rows);
  }
  return tables;
}

// ── What will be imported ────────────────────────────────────────────────────

const clean = (v: Value) => (v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim());
const date = (v: Value) => { const t = Date.parse(`${clean(v).replace(" ", "T")}Z`); return Number.isFinite(t) ? new Date(t) : new Date(); };

export interface PlanMenu { oldId: number; title: string; shown: boolean; active: boolean; createdAt: string; files: string[] }
export interface PlanRestaurant {
  oldUserId: number;
  owner: { name: string; email: string; password: string; createdAt: string };
  name: string; username: string; slug: string; address: string; phone: string;
  social: { facebook?: string; instagram?: string };
  menus: PlanMenu[];
}
export interface Plan {
  totals: { users: number; menus: number; files: number };
  restaurants: PlanRestaurant[];
  skipped: { id: number; email: string; business: string; reason: string }[];
  fixes: string[];
}

export function buildPlan(t: Tables): Plan {
  const users = t.users ?? [], menus = t.menus ?? [], files = t.menu_files ?? [];
  const byMenu = new Map<number, Record<string, Value>[]>();
  for (const f of files) { const k = Number(f.menu_id); byMenu.set(k, [...(byMenu.get(k) ?? []), f]); }
  const owners = new Set(menus.map((x) => Number(x.owner)));
  const fixes: string[] = [];
  const restaurants: PlanRestaurant[] = [];
  const skipped: Plan["skipped"] = [];
  const slugs = new Set<string>();
  for (const u of users) {
    const id = Number(u.id);
    if (!owners.has(id)) { skipped.push({ id, email: clean(u.email), business: clean(u.business_name), reason: "no menu" }); continue; }
    const username = clean(u.business_username);
    let slug = username.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || `restaurant-${id}`;
    if (slugs.has(slug)) slug = `${slug}-${id}`;
    slugs.add(slug);
    const rawPw = String(u.password ?? "");
    if (rawPw !== rawPw.trim()) fixes.push(`${clean(u.business_name)}: removed spaces / line breaks around the saved password, so the owner can still log in`);
    const email = clean(u.email).toLowerCase();
    if (email !== clean(u.email)) fixes.push(`${clean(u.business_name)}: email written in small letters (${email})`);
    const own = menus.filter((x) => Number(x.owner) === id).sort((a, b) => date(a.created_at).getTime() - date(b.created_at).getTime() || Number(a.id) - Number(b.id));
    const name = clean(u.business_name);
    const fb = clean(u.facebook_url), ig = clean(u.instagram_url);
    restaurants.push({
      oldUserId: id,
      owner: { name: clean(u.name) || name, email, password: rawPw.trim(), createdAt: date(u.created_at).toISOString() },
      name, username, slug, address: clean(u.business_address), phone: clean(u.business_phone),
      social: { ...(fb ? { facebook: fb } : {}), ...(ig ? { instagram: ig } : {}) },
      menus: own.map((x) => {
        const created = date(x.created_at);
        const title = clean(x.title) || defaultMenuTitle(name, created);
        return {
          oldId: Number(x.id), title, shown: x.active !== 0, active: x.active === 1, createdAt: created.toISOString(),
          files: (byMenu.get(Number(x.id)) ?? []).sort((a, b) => Number(a.order) - Number(b.order) || Number(a.id) - Number(b.id)).map((f) => clean(f.photo_path)).filter(Boolean),
        };
      }),
    });
  }
  const untitled = restaurants.flatMap((r) => r.menus).filter((x) => !clean((menus.find((m) => Number(m.id) === x.oldId)?.title) ?? null)).length;
  if (untitled) fixes.push(`${untitled} menus had no name: they are called "<Restaurant>'s menu - <date it was made>", like new menus`);
  return { totals: { users: users.length, menus: menus.length, files: files.length }, restaurants, skipped, fixes };
}

// ── Reading the old site ─────────────────────────────────────────────────────

async function get(url: string): Promise<{ ok: boolean; status: number; type: string; text: string }> {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "SkanoMenu-Import/1.0" } });
    const type = res.headers.get("content-type") ?? "";
    return { ok: res.ok, status: res.status, type, text: type.includes("text") || type.includes("json") ? await res.text() : "" };
  } catch {
    return { ok: false, status: 0, type: "", text: "" };
  }
}

const strip = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#039;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Links on a page of the restaurant: /<username>/<segment> with their text */
function linksOf(html: string, username: string): { seg: string; text: string }[] {
  const out: { seg: string; text: string }[] = [];
  const re = new RegExp(`<a[^>]+href=["'](?:https?://(?:www\\.)?skano\\.menu)?/${escapeRe(username)}/([\\w-]+)/?["'][^>]*>([\\s\\S]*?)</a>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) if (!out.some((x) => x.seg === m![1])) out.push({ seg: m[1], text: strip(m[2]) });
  return out;
}

export interface Structure {
  /** "single": the page shows one menu. "tree": buttons (maybe a language step first) */
  kind: "single" | "tree";
  menuId: number | null;
  nodes: { label: string; menuId?: number; children?: { label: string; menuId: number }[] }[];
  /** How we know: the old site or (when it couldn't be read) the database */
  source: "site" | "database";
}

/** Which menus the old page of a restaurant shows, and how (buttons, language pages) */
export async function readStructure(r: PlanRestaurant): Promise<Structure> {
  const own = new Set(r.menus.map((m) => m.oldId));
  const fallback = (): Structure => {
    const shown = r.menus.filter((m) => m.shown);
    const live = r.menus.find((m) => m.active) ?? shown[shown.length - 1] ?? r.menus[r.menus.length - 1];
    if (shown.length <= 1) return { kind: "single", menuId: live?.oldId ?? null, nodes: [], source: "database" };
    return { kind: "tree", menuId: null, nodes: shown.map((m) => ({ label: m.title, menuId: m.oldId })), source: "database" };
  };
  const home = await get(`${OLD_SITE}/${r.username}`);
  if (!home.ok || !home.text) return fallback();
  const links = linksOf(home.text, r.username);
  const menuLinks = links.filter((l) => /^\d+$/.test(l.seg) && own.has(Number(l.seg)));
  const pageLinks = links.filter((l) => !/^\d+$/.test(l.seg));
  if (!links.length) return { ...fallback(), kind: "single", nodes: [], source: "site", menuId: (r.menus.find((m) => m.active) ?? r.menus[r.menus.length - 1])?.oldId ?? null };
  const nodes: Structure["nodes"] = menuLinks.map((l) => ({ label: l.text || `Menu ${l.seg}`, menuId: Number(l.seg) }));
  for (const p of pageLinks) {
    const sub = await get(`${OLD_SITE}/${r.username}/${p.seg}`);
    const inner = sub.ok ? linksOf(sub.text, r.username).filter((l) => /^\d+$/.test(l.seg) && own.has(Number(l.seg))) : [];
    if (inner.length) nodes.push({ label: p.text || p.seg, children: inner.map((l) => ({ label: l.text || `Menu ${l.seg}`, menuId: Number(l.seg) })) });
  }
  if (!nodes.length) return fallback();
  if (nodes.length === 1 && nodes[0].menuId) return { kind: "single", menuId: nodes[0].menuId, nodes: [], source: "site" };
  return { kind: "tree", menuId: null, nodes, source: "site" };
}

/** Where the old site keeps the photos: finds a known file name in the page of its menu, then checks it is an image */
export async function findPhotoBase(r: PlanRestaurant, s: Structure): Promise<string | null> {
  const menuId = s.menuId ?? s.nodes.find((n) => n.menuId)?.menuId ?? s.nodes[0]?.children?.[0]?.menuId;
  const menu = r.menus.find((m) => m.oldId === menuId) ?? r.menus.find((m) => m.files.length);
  const file = menu?.files[0];
  if (!file || !menu) return null;
  for (const page of [`${OLD_SITE}/${r.username}/${menu.oldId}`, `${OLD_SITE}/${r.username}`]) {
    const p = await get(page);
    const m = p.text.match(new RegExp(`["'(]([^"'()\\s]*${escapeRe(file)})`));
    if (m) {
      const url = new URL(m[1], page).toString();
      const check = await fetch(url, { method: "GET", signal: AbortSignal.timeout(15_000) }).catch(() => null);
      if (check?.ok && (check.headers.get("content-type") ?? "").startsWith("image/")) return url.slice(0, url.length - file.length);
    }
  }
  for (const dir of ["/storage/", "/storage/menus/", "/storage/menu_files/", "/uploads/", "/images/", "/menu_files/", "/menus/", "/storage/app/public/"]) {
    const res = await fetch(`${OLD_SITE}${dir}${file}`, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (res?.ok && (res.headers.get("content-type") ?? "").startsWith("image/")) return `${OLD_SITE}${dir}`;
  }
  return null;
}

// ── The database now ─────────────────────────────────────────────────────────

type Delegate = { count: (a?: unknown) => Promise<number>; findMany: (a?: unknown) => Promise<unknown[]>; deleteMany: (a?: unknown) => Promise<unknown> };
const db = prisma as unknown as Record<string, Delegate>;
/** Children first, so deleting never trips over a relation */
export const TABLES = ["waiterPushSub", "waiterCall", "searchTerm", "menuScan", "feedbackReply", "feedback", "dailyMenu", "loyaltyCard", "flashSale",
  "menuItem", "menuCategory", "auditLog", "operatingException", "restaurantManager", "menuSnapshot", "restaurant", "user"];

export async function currentCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of TABLES) out[t] = await db[t]?.count().catch(() => -1) ?? -1;
  out.superAdmins = await prisma.user.count({ where: { role: "SUPER_ADMIN" } }).catch(() => -1);
  return out;
}

/** One page of a table, for the backup */
export async function backupPage(table: string, skip: number, take: number): Promise<unknown[]> {
  if (!TABLES.includes(table)) throw new Error("Unknown table");
  return db[table].findMany({ skip, take, orderBy: { id: "asc" } });
}

// ── Import ───────────────────────────────────────────────────────────────────

export interface RunResult { deleted: Record<string, number>; created: { users: number; restaurants: number; menus: number; trees: number; photos: number }; keptAdmins: number }

const bookData = (v: { menuId: string; title: string; menuPdfUrl: string; menuPdfName: string | null }) =>
  JSON.stringify({ type: "book", menuId: v.menuId, title: v.title, menuPdfUrl: v.menuPdfUrl, menuPdfName: v.menuPdfName });

/** Deletes everything except super admin accounts, then imports the plan. Photos still point to the old site (see copyPhotos). */
export async function runImport(plan: Plan, structures: Record<number, Structure>, photoBase: string): Promise<RunResult> {
  const before = await currentCounts();
  for (const t of TABLES) {
    if (t === "user") await prisma.user.deleteMany({ where: { NOT: { role: "SUPER_ADMIN" } } });
    else await db[t]?.deleteMany({}).catch((e: unknown) => { if (t !== "operatingException") throw e; });
  }
  const created = { users: 0, restaurants: 0, menus: 0, trees: 0, photos: 0 };
  for (const r of plan.restaurants) {
    // A super admin with the same email (kept above) owns it, else a new owner account with the old password
    const user = (await prisma.user.findFirst({ where: { email: r.owner.email }, select: { id: true } }))
      ?? await prisma.user.create({
        data: { email: r.owner.email, password: r.owner.password, name: r.owner.name, role: "MANAGER", createdAt: new Date(r.owner.createdAt) },
        select: { id: true },
      });
    created.users++;
    const s = structures[r.oldUserId];
    const pagesOf = (m: PlanMenu) => JSON.stringify(m.files.map((f) => `${photoBase}${f}`));
    const live = r.menus.find((m) => m.oldId === s?.menuId) ?? r.menus.find((m) => m.active) ?? r.menus[r.menus.length - 1];
    const restaurant = await prisma.restaurant.create({
      data: {
        name: r.name, slug: r.slug, address: r.address || null, phone: r.phone || null, ownerId: user.id, status: "ACTIVE",
        primaryMenu: s?.kind === "tree" ? "tree" : "static", menuPdfUrl: live ? pagesOf(live) : null, menuPdfName: live ? `${live.files.length} photos` : null,
        socialLinks: JSON.stringify(r.social), notes: `Moved from the old skano.menu (user ${r.oldUserId}, ${OLD_SITE}/${r.username})`,
        createdAt: new Date(r.owner.createdAt),
      },
      select: { id: true },
    });
    created.restaurants++;
    // Every old menu in the menu history (made on its own date), so nothing is lost
    const ids = new Map<number, string>();
    for (const m of r.menus) {
      if (!m.files.length) continue;
      const menuId = randomUUID();
      ids.set(m.oldId, menuId);
      await prisma.menuSnapshot.create({ data: { restaurantId: restaurant.id, label: m.title, data: bookData({ menuId, title: m.title, menuPdfUrl: pagesOf(m), menuPdfName: `${m.files.length} photos` }), createdAt: new Date(m.createdAt) } });
      created.menus++; created.photos += m.files.length;
    }
    // Several menus with buttons on the old page: the same as a menu tree
    if (s?.kind === "tree") {
      const used = new Set<string>();
      const slugOf = (label: string) => { const b = treeSlug(label) || "menu"; let k = b, n = 2; while (used.has(k)) k = `${b}-${n++}`; used.add(k); return k; };
      const node = (label: string, oldId: number): TreeNode => ({ id: randomUUID(), label: label.slice(0, 60), slug: slugOf(label), kind: "menu", menuId: ids.get(oldId) ?? null });
      const tree: MenuTree = {
        version: 1, subtitle: "", logo: null, background: null,
        children: s.nodes.map((n) => n.children
          ? { id: randomUUID(), label: n.label.slice(0, 60), slug: slugOf(n.label), kind: "submenu", children: n.children.map((c) => node(c.label, c.menuId)) }
          : node(n.label, n.menuId!)),
      };
      await prisma.menuSnapshot.create({ data: { restaurantId: restaurant.id, label: "Menu tree", data: JSON.stringify({ type: "tree", tree }) } });
      created.trees++;
    }
  }
  const deleted = Object.fromEntries(TABLES.map((t) => [t, t === "user" ? before.user - before.superAdmins : before[t]]));
  return { deleted, created, keptAdmins: before.superAdmins };
}

// ── Copying the photos ───────────────────────────────────────────────────────

/** Old-site photo addresses still used, per restaurant */
async function legacyUrls(photoBase: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const add = (rid: string, text: string | null) => {
    // Up to a quote, space, comma, bracket or backslash (the photos list is JSON inside JSON in the menu history)
    for (const u of text?.match(new RegExp(`${escapeRe(photoBase)}[^"'\\s,\\]\\\\]+`, "g")) ?? []) if (!out.has(u)) out.set(u, rid);
  };
  for (const r of await prisma.restaurant.findMany({ select: { id: true, menuPdfUrl: true } })) add(r.id, r.menuPdfUrl);
  const rows: { restaurantId: string; data: string }[] = await prisma.menuSnapshot.findMany({ where: { data: { startsWith: '{"type":"book"' } }, select: { restaurantId: true, data: true } });
  for (const s of rows) add(s.restaurantId, s.data);
  return out;
}

/** Copies up to `max` photos into our storage and points the menus to the copies. */
export async function copyPhotos(photoBase: string, skip: string[] = [], max = 20, budgetMs = 40_000): Promise<{ copied: number; failed: { url: string; why: string }[]; remaining: number }> {
  const started = Date.now();
  // Photos that failed before are not tried again in this run
  const todo = [...(await legacyUrls(photoBase))].filter(([u]) => !skip.includes(u));
  let copied = 0;
  const failed: { url: string; why: string }[] = [];
  const done = new Map<string, string>();
  for (const [url, rid] of todo.slice(0, max)) {
    if (Date.now() - started > budgetMs) break;
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) }).catch(() => null);
    const type = res?.headers.get("content-type") ?? "";
    if (!res?.ok || !type.startsWith("image/")) { failed.push({ url, why: res ? `the old site answered ${res.status}${type ? ` (${type})` : ""}` : "the old site didn't answer" }); continue; }
    const ext = type.includes("png") ? ".png" : type.includes("webp") ? ".webp" : ".jpg";
    const file = new File([await res.arrayBuffer()], `photo${ext}`, { type: type.split(";")[0] });
    done.set(url, await saveMenuFile(file, rid, ext));
    copied++;
  }
  // Point everything to the copies
  if (done.size) {
    const swap = (text: string) => { let t = text; for (const [a, b] of done) t = t.split(a).join(b); return t; };
    const rids = new Set([...done.keys()].map((u) => todo.find(([x]) => x === u)![1]));
    for (const rid of rids) {
      const r = await prisma.restaurant.findFirst({ where: { id: rid }, select: { menuPdfUrl: true } });
      if (r?.menuPdfUrl && swap(r.menuPdfUrl) !== r.menuPdfUrl) await prisma.restaurant.update({ where: { id: rid }, data: { menuPdfUrl: swap(r.menuPdfUrl) } });
      const rows: { id: string; data: string }[] = await prisma.menuSnapshot.findMany({ where: { restaurantId: rid, data: { startsWith: '{"type":"book"' } }, select: { id: true, data: true } });
      for (const s of rows) if (swap(s.data) !== s.data) await prisma.menuSnapshot.update({ where: { id: s.id }, data: { data: swap(s.data) } });
    }
  }
  return { copied, failed, remaining: (await legacyUrls(photoBase)).size };
}
