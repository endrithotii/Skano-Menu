// Staff & roles: every action a staff member can be allowed to do on the platform.
// Shared by the dashboard (what to show) and the API (what to allow). No server-only imports here.
//
// A staff member gets one or more roles (each a set of actions), each optionally from / until a date, plus extra
// rules for single actions ("also allow scheduling from Monday", "not the loyalty settings until the 20th").
// The owner of the restaurant can always do everything.

export const PERMISSION_GROUPS = [
  {
    name: "Menus",
    items: [
      { key: "menu.edit", label: "Add and edit menus", help: "Upload menus, edit pages, rename, delete old versions, build the menu tree, edit the digital menu" },
      { key: "menu.live", label: "Turn menus on and off", help: "Choose which menu customers see right now" },
      { key: "design.edit", label: "Design menus", help: "Design your digital Menu" },
      { key: "schedule.manage", label: "Schedule menus", help: "Add, change or cancel scheduled menus" },
      { key: "details.edit", label: "Add ingredients and details", help: "Ingredients, comments, prices and serving times of the dishes" },
      { key: "details.ask", label: "Turn \"Ask about the dishes\" on and off", help: "The customer chat under More" },
    ],
  },
  {
    name: "Customers",
    items: [
      { key: "loyalty.stamp", label: "Confirm loyalty stamps", help: "Scan a customer's code and give a stamp or a reward" },
      { key: "loyalty.settings", label: "Loyalty card settings", help: "Turn the card on or off, stamps needed and the reward" },
      { key: "announcements.manage", label: "Announcements", help: "Add, schedule and remove announcement banners" },
      { key: "feedback.manage", label: "Customer feedback", help: "Read and answer feedback, turn feedback on or off" },
      { key: "social.edit", label: "Social media", help: "Link social media and choose which ones customers see" },
    ],
  },
  {
    name: "Restaurant",
    items: [
      { key: "hours.edit", label: "Open hours and holidays", help: "Weekly hours and special days" },
      { key: "floor.edit", label: "Floor plan and tables", help: "Build the restaurant: areas, tables and seats, walls, rooms" },
      { key: "reservations.manage", label: "Reservations", help: "Accept or refuse reservations, block tables, reservation settings" },
      { key: "settings.edit", label: "Restaurant settings", help: "Name, contact details, Wi-Fi password and currency" },
      { key: "seo.manage", label: "SEO and analytics", help: "Search settings and visitor numbers" },
      { key: "qr.view", label: "QR codes", help: "See and download the menu QR code" },
      { key: "staff.manage", label: "Staff and roles", help: "Add staff and give or take away access (like a manager)" },
      { key: "history.view", label: "See the action history", help: "Everything everyone did on the platform, with filters" },
    ],
  },
  {
    name: "HR",
    items: [
      { key: "hr.manage", label: "HR: hours, time off and work times", help: "See and fix everyone's hours, answer time off requests, set work times, vacation and sick days" },
      { key: "hr.documents", label: "Staff documents", help: "Upload, open, search and delete the documents of the staff (contracts, certificates, ...) and make document categories" },
    ],
  },
] as const;

export type Permission = (typeof PERMISSION_GROUPS)[number]["items"][number]["key"];
export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));
export const isPermission = (v: unknown): v is Permission => typeof v === "string" && (ALL_PERMISSIONS as string[]).includes(v);
const ITEMS: readonly { key: string; label: string; help: string }[] = PERMISSION_GROUPS.flatMap((g) => [...g.items]);
export const permissionLabel = (p: Permission) => ITEMS.find((i) => i.key === p)?.label ?? p;

export interface Role {
  id: string;
  name: string;
  /** "manager" can do everything (also actions added to the platform later) */
  all?: boolean;
  permissions: Permission[];
  /** Built-in roles can be changed but not deleted */
  builtin?: "manager" | "waiter" | "chef" | "hr";
}

/** One extra rule for a single action, on top of the role */
export interface ActionRule {
  permission: Permission;
  /** true = also allowed, false = not allowed (even if the role allows it) */
  allow: boolean;
  /** ISO times, null = no limit */
  from: string | null;
  until: string | null;
}

/** One role of a staff member, counting from / until these times (ISO, null = no limit) */
export interface RoleAssignment {
  roleId: string;
  from: string | null;
  until: string | null;
}

export interface Member {
  /** All their roles: they may do what any role that counts right now allows */
  roles: RoleAssignment[];
  rules: ActionRule[];
}

export interface StaffAccess {
  roles: Role[];
  members: Record<string, Member>;
}

export const BUILTIN_ROLES: Role[] = [
  { id: "manager", name: "Manager", all: true, permissions: [...ALL_PERMISSIONS], builtin: "manager" },
  { id: "waiter", name: "Waiter", permissions: ["loyalty.stamp"], builtin: "waiter" },
  { id: "chef", name: "Chef", permissions: ["details.edit", "details.ask"], builtin: "chef" },
  { id: "hr", name: "HR", permissions: ["hr.manage", "hr.documents"], builtin: "hr" },
];

export const emptyMember = (): Member => ({ roles: [], rules: [] });

/** The roles of a member that count right now */
export function activeRoles(access: Pick<StaffAccess, "roles">, member: Member | undefined, now = new Date()): Role[] {
  if (!member) return [];
  return member.roles
    .filter((a) => inWindow(a.from, a.until, now))
    .map((a) => access.roles.find((r) => r.id === a.roleId))
    .filter((r): r is Role => !!r);
}

/** Is a time window open at `now`? */
export function inWindow(from: string | null, until: string | null, now = new Date()): boolean {
  const t = now.getTime();
  if (from && Number.isFinite(Date.parse(from)) && t < Date.parse(from)) return false;
  if (until && Number.isFinite(Date.parse(until)) && t > Date.parse(until)) return false;
  return true;
}

/** "active" | "upcoming" (starts later) | "ended" */
export function windowStatus(from: string | null, until: string | null, now = new Date()): "active" | "upcoming" | "ended" {
  const t = now.getTime();
  if (until && Number.isFinite(Date.parse(until)) && t > Date.parse(until)) return "ended";
  if (from && Number.isFinite(Date.parse(from)) && t < Date.parse(from)) return "upcoming";
  return "active";
}

/** What a staff member may do right now */
export function effectivePermissions(access: StaffAccess, member: Member | undefined, now = new Date()): Set<Permission> {
  const out = new Set<Permission>();
  if (!member) return out;
  for (const role of activeRoles(access, member, now)) {
    for (const p of role.all ? ALL_PERMISSIONS : role.permissions) out.add(p);
  }
  // Extra rules: allowed ones first, then "not allowed" wins
  for (const r of member.rules) if (r.allow && inWindow(r.from, r.until, now)) out.add(r.permission);
  for (const r of member.rules) if (!r.allow && inWindow(r.from, r.until, now)) out.delete(r.permission);
  return out;
}

// ── Cleaning what the dashboard sends ────────────────────────────────────────

const time = (v: unknown): string | null => (typeof v === "string" && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null);
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");

export function sanitizeRoles(input: unknown): Role[] {
  const list = Array.isArray(input) ? input : [];
  const custom: Role[] = [];
  for (const raw of list.slice(0, 40)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === "string" && /^[\w-]{1,40}$/.test(r.id) ? r.id : null;
    if (!id || BUILTIN_ROLES.some((b) => b.id === id)) continue;
    const name = clip(r.name, 40);
    if (!name) continue;
    custom.push({ id, name, permissions: [...new Set((Array.isArray(r.permissions) ? r.permissions : []).filter(isPermission))] });
  }
  // Built-in roles are always there. Waiter and Chef keep the actions chosen for them, Manager is everything.
  const builtins = BUILTIN_ROLES.map((b) => {
    if (b.all) return b;
    const sent = list.find((x) => x && typeof x === "object" && (x as Role).id === b.id) as Role | undefined;
    return sent ? { ...b, name: clip(sent.name, 40) || b.name, permissions: [...new Set((Array.isArray(sent.permissions) ? sent.permissions : []).filter(isPermission))] } : b;
  });
  return [...builtins, ...custom];
}

export function sanitizeMember(input: unknown, roles: Role[]): Member {
  const m = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  // Saved before several roles were possible: one roleId with its dates
  const list: unknown[] = Array.isArray(m.roles) ? m.roles : typeof m.roleId === "string" ? [{ roleId: m.roleId, from: m.from, until: m.until }] : [];
  const assigned: RoleAssignment[] = [];
  for (const raw of list.slice(0, 20)) {
    const a = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    if (typeof a.roleId !== "string" || !roles.some((r) => r.id === a.roleId)) continue;
    if (assigned.some((x) => x.roleId === a.roleId)) continue;
    assigned.push({ roleId: a.roleId, from: time(a.from), until: time(a.until) });
  }
  const rules: ActionRule[] = [];
  for (const raw of (Array.isArray(m.rules) ? m.rules : []).slice(0, 60)) {
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    if (!isPermission(r.permission)) continue;
    if (rules.some((x) => x.permission === r.permission)) continue;
    rules.push({ permission: r.permission, allow: r.allow !== false, from: time(r.from), until: time(r.until) });
  }
  return { roles: assigned, rules };
}
