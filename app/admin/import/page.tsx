"use client";

// Admin > Import old database: moves the restaurants of the old skano.menu (MySQL dump) into this app.
// 1. Read the file  2. Check what will happen  3. Download a backup  4. Delete and import  5. Copy the photos

import { useState } from "react";
import Link from "next/link";
import { Upload, Loader2, Download, AlertTriangle, CheckCircle2, Database, Image as ImageIcon, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";

interface Summary {
  totals: { users: number; menus: number; files: number };
  counts: { restaurants: number; menus: number; photos: number };
  fixes: string[];
  skipped: { id: number; email: string; business: string; reason: string }[];
  restaurants: { oldUserId: number; name: string; username: string; slug: string; email: string; owner: string; address: string; phone: string; social: Record<string, string>; menus: { oldId: number; title: string; shown: boolean; active: boolean; photos: number }[] }[];
}
interface Structure { kind: "single" | "tree"; menuId: number | null; nodes: { label: string; menuId?: number; children?: { label: string; menuId: number }[] }[]; source: "site" | "database" }
interface Analysis { plan: Summary; structures: Record<number, Structure>; photoBase: string | null; oldSite: string; now: Record<string, number> }

const card = "rounded-2xl bg-gray-900 border border-white/10 p-5";
const btn = "inline-flex items-center gap-2 text-sm font-semibold rounded-xl px-4 py-2.5 disabled:opacity-40";
const post = async (body: unknown) => {
  const res = await fetch("/api/admin/legacy-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const d = await res?.json().catch(() => null);
  if (!res?.ok) throw new Error(d?.error ?? `The server answered ${res?.status ?? "nothing"}`);
  return d;
};

export default function ImportOldDatabase() {
  const [sql, setSql] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [a, setA] = useState<Analysis | null>(null);
  const [photoBase, setPhotoBase] = useState("");
  const [backedUp, setBackedUp] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState<{ result: { deleted: Record<string, number>; created: Record<string, number>; keptAdmins: number }; now: Record<string, number> } | null>(null);
  const [photos, setPhotos] = useState<{ copied: number; remaining: number; failed: { url: string; why: string }[]; running: boolean } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function analyze(text: string) {
    setBusy("analyze");
    try {
      const d: Analysis = await post({ action: "analyze", sql: text });
      setA(d); setPhotoBase(d.photoBase ?? "");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not read it"); }
    setBusy(null);
  }

  async function backup() {
    setBusy("backup");
    try {
      const out: Record<string, unknown[]> = {};
      const tables: string[] = (await post({ action: "backup", table: "user", skip: 0 })).tables;
      for (const t of tables) {
        out[t] = [];
        for (let skip = 0; ; skip += 500) {
          const d = await post({ action: "backup", table: t, skip });
          out[t].push(...d.rows);
          if (d.rows.length < 500) break;
        }
      }
      const blob = new Blob([JSON.stringify({ madeAt: new Date().toISOString(), tables: out }, null, 1)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob); link.download = `skano-backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`; link.click();
      setBackedUp(true);
      toast.success(`Backup downloaded: ${Object.entries(out).reduce((n, [, v]) => n + v.length, 0)} rows`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Backup failed"); }
    setBusy(null);
  }

  async function run() {
    if (!a || !sql) return;
    setBusy("run");
    try {
      const d = await post({ action: "run", sql, structures: a.structures, photoBase, confirm });
      setResult(d);
      toast.success("Imported. Now the photos are copied.");
      void copyAll();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Import failed"); }
    setBusy(null);
  }

  async function copyAll() {
    const failed: { url: string; why: string }[] = [];
    let copied = 0;
    setPhotos({ copied, remaining: -1, failed, running: true });
    for (let round = 0; round < 200; round++) {
      try {
        const d = await post({ action: "photos", photoBase, skip: failed.map((f) => f.url) });
        copied += d.copied; failed.push(...d.failed);
        setPhotos({ copied, remaining: d.remaining, failed: [...failed], running: true });
        if (d.remaining - failed.length <= 0 || (d.copied === 0 && d.failed.length === 0)) break;
      } catch (e) {
        toast.error(`Copying stopped: ${e instanceof Error ? e.message : "error"}. Press "Copy photos" to go on.`);
        break;
      }
    }
    setPhotos((p) => (p ? { ...p, running: false } : p));
  }

  const p = a?.plan;
  const toggle = (k: string) => setOpen((o) => (o === k ? null : k));

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Database className="w-6 h-6 text-violet-400" /> Import the old database</h1>
        <p className="text-gray-400 text-sm mt-1">Moves the restaurants of the old skano.menu here. Everything that is in this database now is deleted, only super admin accounts stay.</p>
      </div>

      {/* 1. The file */}
      <section className={card}>
        <h2 className="text-white font-semibold">1. The old database file (.sql)</h2>
        <label className={`${btn} mt-3 bg-violet-500 hover:bg-violet-600 text-white cursor-pointer`}>
          {busy === "analyze" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {busy === "analyze" ? "Reading it and the old site…" : fileName || "Choose the .sql file"}
          <input type="file" accept=".sql,text/plain" hidden id="sql-file" disabled={!!busy} onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            const text = await f.text(); setSql(text); setFileName(f.name); setA(null); setResult(null); setPhotos(null); setBackedUp(false);
            void analyze(text);
          }} />
        </label>
        {busy === "analyze" && <p className="text-xs text-gray-400 mt-2">This reads every restaurant&apos;s page on the old site, it takes about a minute.</p>}
      </section>

      {p && a && (
        <>
          {/* 2. What will happen */}
          <section className={card} data-plan>
            <h2 className="text-white font-semibold">2. What will happen</h2>
            <div className="grid sm:grid-cols-3 gap-3 mt-3 text-sm">
              <div className="rounded-xl bg-gray-800 p-3"><div className="text-gray-400 text-xs">Old database</div><div className="text-white">{p.totals.users} accounts, {p.totals.menus} menus, {p.totals.files} photos</div></div>
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3"><div className="text-emerald-300 text-xs">Will be imported</div><div className="text-white" data-import-counts>{p.counts.restaurants} restaurants with their owners, {p.counts.menus} menus, {p.counts.photos} photos</div></div>
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3"><div className="text-red-300 text-xs">Deleted now</div><div className="text-white">{a.now.restaurant} restaurants, {a.now.user - a.now.superAdmins} accounts, {a.now.menuSnapshot} saved items. {a.now.superAdmins} super admin{a.now.superAdmins === 1 ? "" : "s"} stay.</div></div>
            </div>
            <p className="text-xs text-gray-400 mt-3">Owners log in with their old email and password. Old links and QR codes (skano.menu/&lt;name&gt;) open the menu here once the domain points to this app.</p>

            <div className="mt-4 space-y-2 text-sm">
              <div className="text-gray-300 font-medium">Photos on the old site</div>
              {a.photoBase ? <p className="text-emerald-300 text-xs flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Found: {a.photoBase}</p>
                : <p className="text-amber-300 text-xs flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Not found by itself. Open a menu on the old site, copy a photo&apos;s address and paste the part before the file name here.</p>}
              <input value={photoBase} onChange={(e) => setPhotoBase(e.target.value.trim())} placeholder="https://skano.menu/storage/" id="photo-base"
                className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
            </div>

            {p.fixes.length > 0 && (
              <div className="mt-4">
                <div className="text-gray-300 font-medium text-sm">Cleaned up while importing</div>
                <ul className="mt-1 space-y-0.5">{p.fixes.map((f, i) => <li key={i} className="text-xs text-gray-400">{f}</li>)}</ul>
              </div>
            )}

            <button type="button" onClick={() => toggle("list")} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-violet-300">
              {open === "list" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} The {p.counts.restaurants} restaurants
            </button>
            {open === "list" && (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs text-left" data-restaurants>
                  <thead className="text-gray-400"><tr><th className="py-1.5 pr-3">Restaurant</th><th className="pr-3">Owner</th><th className="pr-3">Old link → new</th><th className="pr-3">Menus</th><th>What customers see</th></tr></thead>
                  <tbody className="text-gray-200 divide-y divide-white/5">
                    {p.restaurants.map((r) => {
                      const s = a.structures[r.oldUserId];
                      const title = (id?: number | null) => r.menus.find((m) => m.oldId === id)?.title ?? `menu ${id}`;
                      return (
                        <tr key={r.oldUserId} className="align-top">
                          <td className="py-1.5 pr-3"><div className="font-semibold">{r.name}</div><div className="text-gray-500">{r.address}{r.phone ? `, ${r.phone}` : ""}</div></td>
                          <td className="pr-3">{r.owner}<div className="text-gray-500">{r.email}</div></td>
                          <td className="pr-3 whitespace-nowrap">/{r.username} → /r/{r.slug}</td>
                          <td className="pr-3">{r.menus.length} ({r.menus.reduce((n, m) => n + m.photos, 0)} photos)</td>
                          <td>
                            {s?.kind === "tree"
                              ? <span>Buttons: {s.nodes.map((n) => n.children ? `${n.label} (${n.children.map((c) => c.label).join(", ")})` : n.label).join(" · ")}</span>
                              : <span>{title(s?.menuId)}</span>}
                            <span className="text-gray-500"> · {s?.source === "site" ? "as on the old site" : "old site not readable, from the database"}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <button type="button" onClick={() => toggle("skipped")} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-gray-400">
              {open === "skipped" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} Not imported: {p.skipped.length} accounts without a menu
            </button>
            {open === "skipped" && (
              <ul className="mt-2 max-h-72 overflow-y-auto text-xs text-gray-400 space-y-0.5">
                {p.skipped.map((s) => <li key={s.id}>{s.id} · {s.business} · {s.email}</li>)}
              </ul>
            )}
          </section>

          {/* 3. Backup */}
          <section className={card}>
            <h2 className="text-white font-semibold">3. Download a backup of the database now</h2>
            <p className="text-xs text-gray-400 mt-1">Keep this file: it has everything that will be deleted.</p>
            <button type="button" onClick={backup} disabled={!!busy} id="backup" className={`${btn} mt-3 bg-gray-700 hover:bg-gray-600 text-white`}>
              {busy === "backup" ? <Loader2 className="w-4 h-4 animate-spin" /> : backedUp ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Download className="w-4 h-4" />} {backedUp ? "Backup downloaded" : "Download backup"}
            </button>
          </section>

          {/* 4. Run */}
          <section className={`${card} border-red-500/30`}>
            <h2 className="text-white font-semibold">4. Delete everything and import</h2>
            <p className="text-xs text-gray-400 mt-1">This can&apos;t be undone (only with the backup). Type DELETE EVERYTHING to confirm.</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE EVERYTHING" id="confirm" disabled={!backedUp || !!result}
                className="flex-1 min-w-[12rem] bg-gray-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white disabled:opacity-40" />
              <button type="button" onClick={run} disabled={!backedUp || confirm !== "DELETE EVERYTHING" || !/^https?:\/\//.test(photoBase) || !!busy || !!result} id="run"
                className={`${btn} bg-red-600 hover:bg-red-700 text-white`}>
                {busy === "run" ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />} Delete and import
              </button>
            </div>
            {!backedUp && <p className="text-xs text-amber-300 mt-2">Download the backup first.</p>}
            {result && (
              <div className="mt-4 text-sm text-gray-200 space-y-1" data-result>
                <p className="text-emerald-300 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Imported {result.result.created.restaurants} restaurants, {result.result.created.users} owners, {result.result.created.menus} menus ({result.result.created.photos} photos), {result.result.created.trees} menu trees.</p>
                <p className="text-gray-400 text-xs">Deleted before: {Object.entries(result.result.deleted).filter(([, n]) => n > 0).map(([t, n]) => `${t} ${n}`).join(", ") || "nothing"}. Super admins kept: {result.result.keptAdmins}.</p>
                <p className="text-gray-400 text-xs">The database now: {result.now.restaurant} restaurants, {result.now.user} accounts ({result.now.superAdmins} super admin{result.now.superAdmins === 1 ? "" : "s"}), {result.now.menuSnapshot} saved menus and trees.</p>
              </div>
            )}
          </section>

          {/* 5. Photos */}
          <section className={card}>
            <h2 className="text-white font-semibold flex items-center gap-2"><ImageIcon className="w-4 h-4" /> 5. Copy the photos here</h2>
            <p className="text-xs text-gray-400 mt-1">Until then the menus show the photos from the old site. When they are copied, the old site can be switched off.</p>
            {photos && (
              <div className="mt-3 text-sm" data-photos>
                <div className="h-2 rounded-full bg-gray-800 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${photos.remaining < 0 ? 0 : Math.round((photos.copied / Math.max(1, photos.copied + photos.remaining)) * 100)}%` }} /></div>
                <p className="text-gray-300 mt-1.5">{photos.copied} copied{photos.remaining >= 0 ? `, ${photos.remaining} left` : ""}{photos.failed.length ? `, ${photos.failed.length} failed` : ""} {photos.running && <Loader2 className="inline w-3.5 h-3.5 animate-spin" />}</p>
                {!photos.running && photos.remaining === 0 && <p className="text-emerald-300 text-xs mt-1">All photos are copied.</p>}
                {photos.failed.length > 0 && (
                  <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-amber-300 space-y-0.5">{photos.failed.map((f) => <li key={f.url}>{f.url.split("/").pop()}: {f.why}</li>)}</ul>
                )}
              </div>
            )}
            <button type="button" onClick={copyAll} disabled={!result && !photos || !!photos?.running || !photoBase} id="copy-photos" className={`${btn} mt-3 bg-gray-700 hover:bg-gray-600 text-white`}>
              <ImageIcon className="w-4 h-4" /> {photos ? "Copy photos again" : "Copy photos"}
            </button>
            {result && <Link href="/admin/restaurants" className="mt-3 ml-3 inline-flex items-center gap-1 text-sm text-violet-300"><ExternalLink className="w-4 h-4" /> See the restaurants</Link>}
          </section>
        </>
      )}
      {!sql && <p className="text-xs text-gray-500">Nothing is changed until step 4.</p>}
    </div>
  );
}
