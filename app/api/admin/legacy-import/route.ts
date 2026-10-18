import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import {
  OLD_SITE, TABLES, backupPage, buildPlan, copyPhotos, currentCounts, findPhotoBase, parseDump, readStructure, runImport,
  type Plan, type Structure,
} from "@/lib/legacy-import";

// Admin > Import old database (super admin only). See lib/legacy-import.ts.
// POST { action: "analyze", sql }                         -> plan, how each restaurant's old page looks, photo address, the database now
// POST { action: "backup", table, skip }                   -> one page (500 rows) of a table, to download before deleting
// POST { action: "run", sql, structures, photoBase, confirm: "DELETE EVERYTHING" } -> deletes and imports
// POST { action: "photos", photoBase, skip }               -> copies the next photos into our storage

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Only a super admin can do this" }, { status: 403 });
  const body = await req.json().catch(() => null);
  try {
    if (body?.action === "analyze") {
      if (typeof body.sql !== "string" || !body.sql.includes("INSERT INTO `users`")) return NextResponse.json({ error: "This doesn't look like the old skano.menu database (no users)." }, { status: 400 });
      const plan = buildPlan(parseDump(body.sql));
      // Each restaurant's page on the old site, 6 at a time
      const structures: Record<number, Structure> = {};
      const list = plan.restaurants;
      for (let i = 0; i < list.length; i += 6) {
        const part = await Promise.all(list.slice(i, i + 6).map((r) => readStructure(r)));
        part.forEach((s, k) => { structures[list[i + k].oldUserId] = s; });
      }
      let photoBase: string | null = null;
      for (const r of list.slice(0, 5)) { photoBase = await findPhotoBase(r, structures[r.oldUserId]); if (photoBase) break; }
      return NextResponse.json({ plan: summary(plan), structures, photoBase, oldSite: OLD_SITE, now: await currentCounts() });
    }
    if (body?.action === "backup") {
      const table = String(body.table);
      if (!TABLES.includes(table)) return NextResponse.json({ error: "Unknown table" }, { status: 400 });
      const rows = await backupPage(table, Math.max(0, Number(body.skip) || 0), 500);
      return NextResponse.json({ table, rows, tables: TABLES });
    }
    if (body?.action === "run") {
      if (body.confirm !== "DELETE EVERYTHING") return NextResponse.json({ error: "Type DELETE EVERYTHING to confirm." }, { status: 400 });
      if (typeof body.photoBase !== "string" || !/^https?:\/\//.test(body.photoBase)) return NextResponse.json({ error: "The photo address of the old site is missing." }, { status: 400 });
      const plan = buildPlan(parseDump(String(body.sql ?? "")));
      if (!plan.restaurants.length) return NextResponse.json({ error: "No restaurants to import." }, { status: 400 });
      const structures = (body.structures && typeof body.structures === "object" ? body.structures : {}) as Record<number, Structure>;
      const result = await runImport(plan, structures, body.photoBase);
      return NextResponse.json({ result, now: await currentCounts() });
    }
    if (body?.action === "photos") {
      if (typeof body.photoBase !== "string" || !/^https?:\/\//.test(body.photoBase)) return NextResponse.json({ error: "Photo address missing" }, { status: 400 });
      const skip = Array.isArray(body.skip) ? body.skip.filter((x: unknown): x is string => typeof x === "string") : [];
      return NextResponse.json(await copyPhotos(body.photoBase, skip));
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[legacy-import]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong" }, { status: 500 });
  }
}

/** What the admin page shows (no password hashes) */
function summary(p: Plan) {
  return {
    totals: p.totals, fixes: p.fixes, skipped: p.skipped,
    restaurants: p.restaurants.map((r) => ({
      oldUserId: r.oldUserId, name: r.name, username: r.username, slug: r.slug, email: r.owner.email, owner: r.owner.name,
      address: r.address, phone: r.phone, social: r.social,
      menus: r.menus.map((m) => ({ oldId: m.oldId, title: m.title, shown: m.shown, active: m.active, photos: m.files.length, firstFile: m.files[0] ?? null })),
    })),
    counts: {
      restaurants: p.restaurants.length, menus: p.restaurants.reduce((n, r) => n + r.menus.length, 0),
      photos: p.restaurants.reduce((n, r) => n + r.menus.reduce((k, m) => k + m.files.length, 0), 0),
    },
  };
}
