// Ordering from a phone, shared by two services that work the same way:
//   Room service (hotels): guests scan a QR code in their room and order food to the room
//   Table ordering (restaurants): guests scan a QR code on their table and order from their phone
// Shared by the API and the pages. KINDS has the words, links and permissions of each one.

import { DEFAULT_STYLE, sanitizeStyle, type QrStyle } from "@/lib/qr-style";

export type ServiceKind = "room" | "table";
export type OrderMode = "text" | "menu" | "both";
/** What guests see to pick from: only the list of dishes, or the official menu (as on the public menu page) and the list */
export type MenuView = "dishes" | "official";
/** Where the room number goes on a room's QR code */
export type RoomLabel = "center" | "below" | "both" | "none";
export type OrderStatus = "new" | "accepted" | "preparing" | "on-the-way" | "delivered" | "cancelled";

export const STATUS_FLOW: OrderStatus[] = ["new", "accepted", "preparing", "on-the-way", "delivered"];
export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "New", accepted: "Accepted", preparing: "Preparing", "on-the-way": "On the way", delivered: "Delivered", cancelled: "Cancelled",
};
/** What the guest sees */
export const GUEST_STATUS: Record<OrderStatus, string> = {
  new: "Sent. The restaurant will see it in a moment.",
  accepted: "The restaurant got your order.",
  preparing: "Your order is being prepared.",
  "on-the-way": "Your order is on the way to you.",
  delivered: "Delivered. Enjoy your meal!",
  cancelled: "This order was cancelled.",
};
/** The same steps, with the words of each service: at a table it's "Served", not "Delivered" */
export const statusLabel = (kind: ServiceKind, st: OrderStatus) => (kind === "table" && st === "delivered" ? "Served" : STATUS_LABEL[st]);
export const guestStatus = (kind: ServiceKind, st: OrderStatus) => (kind === "table" && st === "delivered" ? "Served. Enjoy your meal!" : kind === "table" && st === "on-the-way" ? "Your order is on the way to your table." : GUEST_STATUS[st]);
export const nextStatus = (s: OrderStatus): OrderStatus | null => {
  const i = STATUS_FLOW.indexOf(s);
  return i >= 0 && i < STATUS_FLOW.length - 1 ? STATUS_FLOW[i + 1] : null;
};

/** floorId (tables only): the table on Floor plan & tables that has this QR code. One table, one QR code. */
export interface Room { id: string; name: string; floorId?: string }

export interface RoomServiceSettings {
  enabled: boolean;
  mode: OrderMode;
  /** The steps guests see at the top */
  steps: string[];
  /** A short line above the steps (optional) */
  welcome: string;
  /** Guests must write their name */
  askName: boolean;
  rooms: Room[];
  /** null = the same style as the QR Codes page */
  qrStyle: QrStyle | null;
  roomLabel: RoomLabel;
  /** Text before the room number on the code, like "Room " */
  roomPrefix: string;
  menuView: MenuView;
  /** Guests can rate the food after it's delivered */
  feedback: boolean;
}

export const DEFAULT_STEPS = [
  "Write your room number, or your name and surname.",
  "Write what you'd like, or pick dishes from the menu.",
  "Send the order. You see here when it's on the way.",
  "Payment is added to your room bill.",
];

export const DEFAULT_TABLE_STEPS = [
  "Write your table number, or your name.",
  "Write what you'd like, or pick dishes from the menu.",
  "Send the order. You see here when it's on the way.",
  "Pay at the table or at the counter, like always.",
];

export const KINDS = {
  room: {
    kind: "room" as const,
    title: "Room service", unit: "room", Unit: "Room", units: "rooms", Units: "Rooms",
    guestPath: "room", api: "room-service", dashboard: "/dashboard/room-service",
    perm: { orders: "roomservice.orders" as const, manage: "roomservice.manage" as const },
    log: { order: "roomservice.order" as const, settings: "roomservice.settings" as const, units: "roomservice.rooms" as const },
    settingsType: "room-service-settings", orderType: "room-order",
    steps: DEFAULT_STEPS, prefix: "Room ", frameText: "Room service",
    intro: "Hotel guests scan a QR code in their room and order food to their room.",
    generalHint: "Put it in every room, at the reception or in the elevator. The guest writes their room number, or their name and surname.",
    askLabel: "Room number, or your name and surname", askPlaceholder: "For example: 204, or Ana Hoxha", askError: "Write your room number, or your name and surname.",
    locked: "Delivered to", closed: "Room service is closed right now. Please call the reception.", help: "Please call the reception if you have questions.",
    stepsHelp: "Write how it works in your hotel: payment, delivery time, the reception number.",
    welcomePlaceholder: "For example: Room service is open from 7:00 to 23:00",
    rangeFrom: "101", rangeTo: "120", onePlaceholder: "For example: 305, or Suite Panorama", nameExample: "Suite Panorama",
  },
  table: {
    kind: "table" as const,
    title: "Table ordering", unit: "table", Unit: "Table", units: "tables", Units: "Tables",
    guestPath: "table", api: "table-service", dashboard: "/dashboard/table-service",
    perm: { orders: "tableservice.orders" as const, manage: "tableservice.manage" as const },
    log: { order: "tableservice.order" as const, settings: "tableservice.settings" as const, units: "tableservice.tables" as const },
    settingsType: "table-service-settings", orderType: "table-order",
    steps: DEFAULT_TABLE_STEPS, prefix: "Table ", frameText: "Order here",
    intro: "Guests scan the QR code on their table and order from their phone. You see what they ordered and move it on until it's served.",
    generalHint: "Put it at the door, on the counter or on the menu cards. The guest writes their table number, or their name.",
    askLabel: "Table number, or your name", askPlaceholder: "For example: 12, or Ana", askError: "Write your table number, or your name.",
    locked: "Your table", closed: "Ordering from your phone is closed right now. Please ask a waiter.", help: "Please ask a waiter if you have questions.",
    stepsHelp: "Write how it works in your restaurant: payment, how long it takes, when to call a waiter.",
    welcomePlaceholder: "For example: The kitchen is open until 22:30",
    rangeFrom: "1", rangeTo: "20", onePlaceholder: "For example: 14, or Terrace", nameExample: "Terrace",
  },
};
export type KindInfo = (typeof KINDS)[ServiceKind];

export const DEFAULT_ROOM_SETTINGS: RoomServiceSettings = {
  enabled: false, mode: "both", steps: DEFAULT_STEPS, welcome: "", askName: false, rooms: [], qrStyle: null, roomLabel: "both", roomPrefix: "Room ", menuView: "dishes", feedback: true,
};

export const MAX_ROOMS = 500;
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");

export function sanitizeRooms(v: unknown): Room[] {
  const out: Room[] = [];
  for (const raw of (Array.isArray(v) ? v : []).slice(0, MAX_ROOMS)) {
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const id = typeof r.id === "string" && /^[a-z0-9]{6,16}$/.test(r.id) ? r.id : null;
    const name = clip(r.name, 30);
    const floorId = typeof r.floorId === "string" && /^[\w-]{1,60}$/.test(r.floorId) ? r.floorId : null;
    if (!id || !name || out.some((x) => x.id === id)) continue;
    // A floor plan table keeps only one QR code
    out.push(floorId && !out.some((x) => x.floorId === floorId) ? { id, name, floorId } : { id, name });
  }
  return out;
}

export function sanitizeRoomSettings(v: unknown, kind: ServiceKind = "room"): RoomServiceSettings {
  const s = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const steps = Array.isArray(s.steps) ? s.steps.map((x) => clip(x, 200)).filter(Boolean).slice(0, 10) : KINDS[kind].steps;
  return {
    enabled: s.enabled === true,
    mode: s.mode === "text" || s.mode === "menu" ? s.mode : "both",
    steps,
    welcome: clip(s.welcome, 200),
    askName: s.askName === true,
    rooms: sanitizeRooms(s.rooms),
    qrStyle: s.qrStyle && typeof s.qrStyle === "object" ? sanitizeStyle(s.qrStyle) : null,
    roomLabel: s.roomLabel === "center" || s.roomLabel === "below" || s.roomLabel === "none" ? s.roomLabel : "both",
    roomPrefix: typeof s.roomPrefix === "string" ? s.roomPrefix.replace(/\s+/g, " ").slice(0, 12) : KINDS[kind].prefix,
    menuView: s.menuView === "official" ? "official" : "dishes",
    feedback: s.feedback !== false,
  };
}

export interface OrderItem { dishId: string; name: string; qty: number; price: number | null; note: string }
/** What the guest thought of the food (once, after it was delivered) */
export interface OrderFeedback { rating: number; comment: string; items: { dishId: string; name: string; rating: number }[]; at: string }
export interface RoomOrder {
  id: string;
  /** Short number staff and guest talk about, like #12 */
  number: number;
  roomId: string | null;
  /** The room number or name the guest wrote (or the room of the QR code) */
  room: string;
  guestName: string;
  text: string;
  items: OrderItem[];
  total: number | null;
  status: OrderStatus;
  /** Why it was cancelled (the guest sees it) */
  reason: string;
  history: { status: OrderStatus; at: string; by: string | null }[];
  createdAt: string;
  feedback: OrderFeedback | null;
}

/** "Room 101" for numbers, but "Suite Panorama" stays as it is */
export const roomTitle = (prefix: string, name: string) => (/^\d/.test(name) ? `${prefix}${name}` : name).trim();
/** The badge in the middle fits about 8 letters. Longer names go under the code instead */
export const CENTER_MAX = 8;

/** The QR style for room codes, with the room number where the manager wants it */
export function roomQrStyle(base: QrStyle, s: Pick<RoomServiceSettings, "roomLabel" | "roomPrefix">, roomName: string | null, kind: ServiceKind = "room"): { style: QrStyle; center: string | null } {
  const style = { ...base };
  if (!roomName) return { style: { ...style, frameText: style.frameText || KINDS[kind].frameText }, center: null };
  const wantsCenter = s.roomLabel === "center" || s.roomLabel === "both";
  const fits = roomName.length <= CENTER_MAX;
  const below = s.roomLabel === "below" || s.roomLabel === "both" || (wantsCenter && !fits);
  if (below) { style.frame = style.frame === "none" ? "label" : style.frame; style.frameText = roomTitle(s.roomPrefix, roomName); }
  return { style, center: wantsCenter && fits ? roomName : null };
}

export { DEFAULT_STYLE };
