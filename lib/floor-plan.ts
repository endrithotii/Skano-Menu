// Floor plan & tables: the restaurant built as a plan (areas with tables, walls, windows, doors, plants, rooms
// and text). Sizes are in meters. Later customers will reserve tables from it.
// Shared by the builder and the API (no server-only imports here).
//
// Stored in the MenuSnapshot table (no migration), one record per restaurant:
//   '{"type":"floor-plan","plan":{ version: 1, areas: [...] },"updatedAt":...}'

export type ObjectType = "table" | "wall" | "window" | "door" | "plant" | "room" | "text" | "bar" | "pillar";
export type TableShape = "round" | "square" | "rect";

export interface FloorObject {
  id: string;
  type: ObjectType;
  /** Center, in meters from the top left corner of the area */
  x: number;
  y: number;
  /** Size in meters (a wall: length x thickness) */
  w: number;
  h: number;
  /** Degrees, clockwise */
  rotation: number;
  /** Table number / name, room name, text */
  label?: string;
  /** Tables */
  seats?: number;
  shape?: TableShape;
  /** Fill color (rooms, walls, bar, text) */
  color?: string;
  /** Text size in meters (text and room names) */
  fontSize?: number;
  /** Doors: which way it opens */
  flip?: boolean;
}

export interface FloorArea {
  id: string;
  name: string;
  /** Size of the area in meters */
  width: number;
  height: number;
  objects: FloorObject[];
}

export interface FloorPlan {
  version: 1;
  areas: FloorArea[];
}

export const LIMITS = { areas: 10, objects: 600, size: 200, seats: 30, label: 40, text: 120 };

export const newId = (p = "o") => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const round = (n: number, step = 0.01) => Number((Math.round(n / step) * step).toFixed(2));
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

/** A good table size for the seats (meters) */
export function tableSize(shape: TableShape, seats: number): { w: number; h: number } {
  const s = clamp(Math.round(seats), 1, LIMITS.seats);
  if (shape === "round") { const d = round(clamp(0.45 + s * 0.15, 0.6, 3), 0.05); return { w: d, h: d }; }
  if (shape === "square") { const a = round(clamp(0.5 + Math.ceil(s / 4) * 0.25, 0.7, 2.5), 0.05); return { w: a, h: a }; }
  return { w: round(clamp(Math.ceil(s / 2) * 0.6, 1.2, 8), 0.05), h: s > 2 ? 0.8 : 0.7 };
}

/** The palette: what can be added, with its starting size */
export const OBJECT_KINDS: { type: ObjectType; label: string; preset?: Partial<FloorObject> }[] = [
  { type: "table", label: "Round table", preset: { shape: "round", seats: 4, ...tableSize("round", 4) } },
  { type: "table", label: "Square table", preset: { shape: "square", seats: 4, ...tableSize("square", 4) } },
  { type: "table", label: "Long table", preset: { shape: "rect", seats: 6, ...tableSize("rect", 6) } },
  { type: "table", label: "Table for 2", preset: { shape: "square", seats: 2, w: 0.7, h: 0.7 } },
  { type: "wall", label: "Wall", preset: { w: 4, h: 0.15, color: "#475569" } },
  { type: "window", label: "Window", preset: { w: 1.5, h: 0.15 } },
  { type: "door", label: "Door", preset: { w: 0.9, h: 0.9 } },
  { type: "room", label: "Room / zone", preset: { w: 4, h: 3, label: "Kitchen", color: "#f1f5f9", fontSize: 0.45 } },
  { type: "bar", label: "Bar counter", preset: { w: 3, h: 0.7, label: "Bar", color: "#92400e" } },
  { type: "plant", label: "Plant", preset: { w: 0.6, h: 0.6 } },
  { type: "pillar", label: "Pillar", preset: { w: 0.4, h: 0.4 } },
  { type: "text", label: "Text", preset: { w: 3, h: 0.6, label: "Terrace", color: "#334155", fontSize: 0.4 } },
];

export function makeObject(kindIndex: number, x: number, y: number, label?: string): FloorObject {
  const k = OBJECT_KINDS[kindIndex];
  return { id: newId(), type: k.type, x, y, w: 1, h: 1, rotation: 0, ...k.preset, ...(label ? { label } : {}) };
}

/** A new area: an empty room with walls around it and an entrance */
export function newArea(name: string, width = 16, height = 10): FloorArea {
  const t = 0.2;
  const wall = (x: number, y: number, w: number, rot: number): FloorObject => ({ id: newId(), type: "wall", x, y, w, h: t, rotation: rot, color: "#475569" });
  return {
    id: newId("a"), name, width, height,
    objects: [
      wall(width / 2, t / 2, width, 0),
      wall(width / 2, height - t / 2, width, 0),
      wall(t / 2, height / 2, height, 90),
      wall(width - t / 2, height / 2, height, 90),
      { id: newId(), type: "door", x: width / 2, y: height - 0.65, w: 1.2, h: 1.2, rotation: 0, label: "Entrance" },
    ],
  };
}

export const emptyPlan = (): FloorPlan => ({ version: 1, areas: [newArea("Main hall")] });

/** Next free table number ("T1", "T2", ...) over all areas */
export function nextTableLabel(plan: FloorPlan): string {
  const used = new Set(plan.areas.flatMap((a) => a.objects).filter((o) => o.type === "table").map((o) => (o.label ?? "").trim().toLowerCase()));
  for (let i = 1; ; i++) if (!used.has(`t${i}`)) return `T${i}`;
}

/** Chairs around a table, in the table's own frame (meters from its center) */
export function chairPositions(o: Pick<FloorObject, "shape" | "seats" | "w" | "h">): { x: number; y: number; angle: number }[] {
  const n = clamp(Math.round(o.seats ?? 0), 0, LIMITS.seats);
  if (!n) return [];
  const gap = 0.32; // chair center distance from the table edge
  if (o.shape === "round") {
    const r = Math.max(o.w, o.h) / 2 + gap;
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r, angle: (a * 180) / Math.PI + 90 };
    });
  }
  // Square / long tables: long sides first, then the ends
  const W = o.w, H = o.h;
  const long = W >= H;
  const ends = n >= 5 && (long ? H : W) >= 0.7 ? (n % 2 ? 1 : 2) : n === 1 ? 0 : n === 3 ? 1 : 0;
  const sideSeats = n - ends;
  const top = Math.ceil(sideSeats / 2), bottom = sideSeats - top;
  const out: { x: number; y: number; angle: number }[] = [];
  const along = (count: number, len: number) => Array.from({ length: count }, (_, i) => -len / 2 + (len * (i + 0.5)) / count);
  if (long) {
    along(top, W).forEach((x) => out.push({ x, y: -H / 2 - gap, angle: 0 }));
    along(bottom, W).forEach((x) => out.push({ x, y: H / 2 + gap, angle: 180 }));
    if (ends >= 1) out.push({ x: -W / 2 - gap, y: 0, angle: 270 });
    if (ends >= 2) out.push({ x: W / 2 + gap, y: 0, angle: 90 });
  } else {
    along(top, H).forEach((y) => out.push({ x: W / 2 + gap, y, angle: 90 }));
    along(bottom, H).forEach((y) => out.push({ x: -W / 2 - gap, y, angle: 270 }));
    if (ends >= 1) out.push({ x: 0, y: -H / 2 - gap, angle: 0 });
    if (ends >= 2) out.push({ x: 0, y: H / 2 + gap, angle: 180 });
  }
  return out;
}

export function planStats(plan: FloorPlan) {
  const tables = plan.areas.flatMap((a) => a.objects.filter((o) => o.type === "table"));
  return { tables: tables.length, seats: tables.reduce((n, t) => n + (t.seats ?? 0), 0) };
}

/** Table numbers used more than once (a customer must be able to pick one table) */
export function duplicateLabels(plan: FloorPlan): string[] {
  const seen = new Map<string, number>();
  for (const o of plan.areas.flatMap((a) => a.objects)) {
    if (o.type !== "table") continue;
    const k = (o.label ?? "").trim().toLowerCase();
    if (k) seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  return [...seen].filter(([, n]) => n > 1).map(([k]) => k.toUpperCase());
}

// ── Cleaning what the dashboard sends ────────────────────────────────────────

const TYPES: ObjectType[] = ["table", "wall", "window", "door", "plant", "room", "text", "bar", "pillar"];
const num = (v: unknown, a: number, b: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? clamp(v, a, b) : d);
const str = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
const color = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : undefined);

export function sanitizePlan(input: unknown): FloorPlan {
  const p = (input && typeof input === "object" ? input : {}) as { areas?: unknown };
  const areas: FloorArea[] = [];
  for (const raw of (Array.isArray(p.areas) ? p.areas : []).slice(0, LIMITS.areas)) {
    const a = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const width = num(a.width, 3, LIMITS.size, 16), height = num(a.height, 3, LIMITS.size, 10);
    const objects: FloorObject[] = [];
    for (const r of (Array.isArray(a.objects) ? a.objects : []).slice(0, LIMITS.objects)) {
      const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
      const type = TYPES.find((t) => t === o.type);
      if (!type) continue;
      const obj: FloorObject = {
        id: typeof o.id === "string" && /^[\w-]{1,40}$/.test(o.id) ? o.id : newId(),
        type,
        x: round(num(o.x, -5, width + 5, width / 2)), y: round(num(o.y, -5, height + 5, height / 2)),
        w: round(num(o.w, 0.05, LIMITS.size, 1)), h: round(num(o.h, 0.05, LIMITS.size, 1)),
        rotation: Math.round(num(o.rotation, -360, 360, 0)) % 360,
      };
      const label = str(o.label, type === "text" ? LIMITS.text : LIMITS.label);
      if (label) obj.label = label;
      if (type === "table") {
        obj.seats = Math.round(num(o.seats, 1, LIMITS.seats, 4));
        obj.shape = o.shape === "round" || o.shape === "square" || o.shape === "rect" ? o.shape : "square";
      }
      const c = color(o.color);
      if (c) obj.color = c;
      if (type === "text" || type === "room") obj.fontSize = round(num(o.fontSize, 0.15, 3, 0.4));
      if (type === "door" && o.flip === true) obj.flip = true;
      objects.push(obj);
    }
    areas.push({ id: typeof a.id === "string" && /^[\w-]{1,40}$/.test(a.id) ? a.id : newId("a"), name: str(a.name, 40) || `Area ${areas.length + 1}`, width, height, objects });
  }
  return { version: 1, areas };
}
