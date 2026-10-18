import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import {
  OLD_SITE, TABLES, backupPage, buildPlan, copyPhotos, currentCounts, findPhotoBase, importBatch, parseDump, readStructure, wipeAll,
  type Plan, type Structure,
} from "@/lib/legacy-import";

// Admin > Import old database (super admin only). See lib/legacy-import.ts.
// Every action is small, so each request ends long before the time limit. The admin page calls them one after another.
// POST { action: "analyze", sql }                       -> plan and the database now (nothing is fetched)
// POST { action: "structure", sql, ids: [oldUserId] }   -> how these restaurants' old pages look (a few per request)
// POST { action: "probe", sql, id, structure }          -> where the old site keeps the photos
// POST { action: "backup", table, skip }                -> one page (500 rows) of a table
// POST { action: "wipe", confirm: "DELETE EVERYTHING" } -> deletes everything except super admins
// POST { action: "import", sql, ids, structures, photoBase } -> imports these restaurants
// POST { action: "photos", photoBase, skip }            -> copies the next photos into our storage

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Only a super admin can do this" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const planOf = (): Plan => {
    if (typeof body?.sql !== "string" || !body.sql.includes("INSERT INTO `users`")) throw new Error("This doesn't look like the old skano.menu database (no users).");
    return buildPlan(parseDump(body.sql));
  };
  const ids = (v: unknown) => (Array.isArray(v) ? v.map(Number).filter(Number.isFinite).slice(0, 10) : []);
  const base = (v: unknown) => (typeof v === "string" && /^https?:\/\//.test(v) ? v : null);
  try {
    switch (body?.action) {
      case "analyze": {
        const plan = planOf();
        return NextResponse.json({ plan: summary(plan), oldSite: OLD_SITE, now: await currentCounts() });
      }
      case "structure": {
        const plan = planOf(), want = ids(body.ids);
        const list = plan.restaurants.filter((r) => want.includes(r.oldUserId));
        const found = await Promise.all(list.map((r) => readStructure(r)));
        return NextResponse.json({ structures: Object.fromEntries(list.map((r, i) => [r.oldUserId, found[i]])) });
      }
      case "probe": {
        const plan = planOf();
        const r = plan.restaurants.find((x) => x.oldUserId === Number(body.id));
        if (!r) return NextResponse.json({ photoBase: null });
        return NextResponse.json({ photoBase: await findPhotoBase(r, body.structure as Structure) });
      }
      case "backup": {
        const table = String(body.table);
        if (!TABLES.includes(table)) return NextResponse.json({ error: "Unknown table" }, { status: 400 });
        return NextResponse.json({ table, rows: await backupPage(table, Math.max(0, Number(body.skip) || 0), 500), tables: TABLES });
      }
      case "wipe": {
        if (body.confirm !== "DELETE EVERYTHING") return NextResponse.json({ error: "Type DELETE EVERYTHING to confirm." }, { status: 400 });
        return NextResponse.json(await wipeAll());
      }
      case "import": {
        const photoBase = base(body.photoBase);
        if (!photoBase) return NextResponse.json({ error: "The photo address of the old site is missing." }, { status: 400 });
        const structures = (body.structures && typeof body.structures === "object" ? body.structures : {}) as Record<number, Structure>;
        return NextResponse.json(await importBatch(planOf(), ids(body.ids), structures, photoBase));
      }
      case "photos": {
        const photoBase = base(body.photoBase);
        if (!photoBase) return NextResponse.json({ error: "Photo address missing" }, { status: 400 });
        const skip = Array.isArray(body.skip) ? body.skip.filter((x: unknown): x is string => typeof x === "string") : [];
        return NextResponse.json(await copyPhotos(photoBase, skip));
      }
      case "counts":
        return NextResponse.json({ now: await currentCounts() });
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
