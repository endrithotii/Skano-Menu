import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { STAFF_ROLES, forbidUnless, loadStaffAccess, saveStaffAccess } from "@/lib/staff-access";
import { effectivePermissions, emptyMember, permissionLabel, sanitizeMember, sanitizeRoles, type Member, type Role } from "@/lib/permissions";
import { logAction } from "@/lib/action-log";

const dayOf = (iso: string | null) => (iso ? `{{d:${iso}}}` : "");
const span = (from: string | null, until: string | null) => (!from && !until ? "no time limit" : [from && `from ${dayOf(from)}`, until && `until ${dayOf(until)}`].filter(Boolean).join(" "));

/** What changed in someone's access, as lines for the action history */
function accessChanges(roles: Role[], before: Member, after: Member): string[] {
  const name = (id: string) => roles.find((r) => r.id === id)?.name ?? id;
  const out: string[] = [];
  for (const a of after.roles) {
    const b = before.roles.find((x) => x.roleId === a.roleId);
    if (!b) out.push(`Gave the role ${name(a.roleId)} (${span(a.from, a.until)})`);
    else if (b.from !== a.from || b.until !== a.until) out.push(`Role ${name(a.roleId)}: ${span(b.from, b.until)} → ${span(a.from, a.until)}`);
  }
  for (const b of before.roles) if (!after.roles.some((a) => a.roleId === b.roleId)) out.push(`Took away the role ${name(b.roleId)}`);
  for (const r of after.rules) {
    const b = before.rules.find((x) => x.permission === r.permission);
    const text = `${r.allow ? "Allowed" : "Not allowed"}: ${permissionLabel(r.permission)} (${span(r.from, r.until)})`;
    if (!b || b.allow !== r.allow || b.from !== r.from || b.until !== r.until) out.push(text);
  }
  for (const b of before.rules) if (!after.rules.some((r) => r.permission === b.permission)) out.push(`${permissionLabel(b.permission)} follows the roles again`);
  return out;
}

// Staff & roles (needs "Staff and roles"). See lib/permissions.ts and lib/staff-access.ts.
// GET                                   -> { roles, staff: [{ id, name, email, type, createdAt, member, now: [...] }], you }
// POST  { name, email, password, member }  -> new staff account with its access
// PUT   { roles }                       -> save the roles (Manager, Waiter, Chef and custom ones)
// PATCH { userId, member }              -> change one person's role, dates and single-action rules
// Rename, new password and delete: /api/restaurants/[id]/staff/[userId]

type Params = { params: Promise<{ id: string }> };

async function load(req: NextRequest, params: Params["params"]) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { id } = await params;
  const r = await prisma.restaurant.findFirst({ where: { OR: [{ id }, { slug: id }] }, select: { id: true, ownerId: true } });
  if (!r) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const denied = await forbidUnless(session, r, "staff.manage");
  if (denied) return { error: denied };
  return { session, restaurant: r };
}

async function listStaff(restaurantId: string) {
  const users: { id: string; name: string | null; email: string; role: string; createdAt: Date }[] = await prisma.user.findMany({
    where: { staffRestaurantId: restaurantId, role: { in: STAFF_ROLES } },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const access = await loadStaffAccess(restaurantId);
  return {
    roles: access.roles,
    staff: users.map((u) => {
      const member = access.members[u.id] ?? emptyMember();
      return {
        id: u.id, name: u.name ?? "", email: u.email, type: u.role, createdAt: u.createdAt,
        member, now: [...effectivePermissions(access, member)],
      };
    }),
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    return NextResponse.json({ ...(await listStaff(x.restaurant.id)), you: x.session.id });
  } catch (error) {
    console.error("[GET staff-access]", error);
    return NextResponse.json({ error: "Could not load" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!name || !email || !password) return NextResponse.json({ error: "Name, email and password are needed." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: "The password needs at least 6 characters." }, { status: 400 });
    if (await prisma.user.findUnique({ where: { email } })) return NextResponse.json({ error: "This email already has an account." }, { status: 409 });

    const access = await loadStaffAccess(x.restaurant.id);
    const member = sanitizeMember(body?.member, access.roles);
    const create = prisma.user.create as unknown as (args: unknown) => Promise<{ id: string }>;
    const user = await create({
      data: { name, email, password: await bcrypt.hash(password, 10), role: "STAFF", staffRestaurantId: x.restaurant.id, assignedTables: "[]" },
      select: { id: true },
    });
    access.members[user.id] = member;
    await saveStaffAccess(x.restaurant.id, access);
    await logAction(x.session, x.restaurant, "staff.add", `Added ${name} (${email}) as staff`, accessChanges(access.roles, emptyMember(), member));
    return NextResponse.json({ success: true, id: user.id, ...(await listStaff(x.restaurant.id)) }, { status: 201 });
  } catch (error) {
    console.error("[POST staff-access]", error);
    return NextResponse.json({ error: "Could not add the staff member" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const body = await req.json().catch(() => null);
    if (!Array.isArray(body?.roles)) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
    const access = await loadStaffAccess(x.restaurant.id);
    const roles = sanitizeRoles(body.roles);
    const lines: string[] = [];
    for (const r of roles) {
      const o = access.roles.find((x) => x.id === r.id);
      if (!o) lines.push(`Created the role ${r.name}: ${r.permissions.map(permissionLabel).join(", ") || "no actions"}`);
      else {
        if (o.name !== r.name) lines.push(`Renamed the role ${o.name} to ${r.name}`);
        const added = r.permissions.filter((p) => !o.permissions.includes(p)), removed = o.permissions.filter((p) => !r.permissions.includes(p));
        if (!r.all && (added.length || removed.length)) lines.push(`${r.name}: ${[...added.map((p) => `+ ${permissionLabel(p)}`), ...removed.map((p) => `- ${permissionLabel(p)}`)].join(", ")}`);
      }
    }
    for (const o of access.roles) if (!roles.some((r) => r.id === o.id)) lines.push(`Deleted the role ${o.name}`);
    // A deleted role goes from everyone who had it (their other roles and single-action rules stay)
    for (const m of Object.values(access.members)) m.roles = m.roles.filter((a) => roles.some((r) => r.id === a.roleId));
    await saveStaffAccess(x.restaurant.id, { roles, members: access.members });
    if (lines.length) await logAction(x.session, x.restaurant, "roles.edit", lines.length === 1 ? lines[0] : "Changed the roles", lines.length === 1 ? [] : lines);
    return NextResponse.json({ success: true, ...(await listStaff(x.restaurant.id)) });
  } catch (error) {
    console.error("[PUT staff-access]", error);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const body = await req.json().catch(() => null);
    const userId = typeof body?.userId === "string" ? body.userId : "";
    if (userId === x.session.id) return NextResponse.json({ error: "You can't change your own access. Ask the owner." }, { status: 400 });
    const user = await prisma.user.findFirst({ where: { id: userId, staffRestaurantId: x.restaurant.id, role: { in: STAFF_ROLES } }, select: { id: true, name: true, email: true } });
    if (!user) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    const access = await loadStaffAccess(x.restaurant.id);
    const before = access.members[userId] ?? emptyMember();
    access.members[userId] = sanitizeMember(body?.member, access.roles);
    await saveStaffAccess(x.restaurant.id, access);
    const lines = accessChanges(access.roles, before, access.members[userId]);
    if (lines.length) await logAction(x.session, x.restaurant, "staff.access", `Changed the access of ${user.name || user.email}`, lines);
    return NextResponse.json({ success: true, ...(await listStaff(x.restaurant.id)) });
  } catch (error) {
    console.error("[PATCH staff-access]", error);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}
