// Action history: the kinds of actions that are saved (shared by the API and the Action history page).

export const ACTION_GROUPS = [
  {
    name: "Menus",
    items: [
      { key: "menu.live", label: "Changed the live menu" },
      { key: "menu.add", label: "Added a menu or a new version" },
      { key: "menu.rename", label: "Renamed a menu" },
      { key: "menu.delete", label: "Deleted a menu version" },
      { key: "menu.pages", label: "Changed the pages of the live menu" },
      { key: "menu.type", label: "Changed the menu type" },
      { key: "menu.tree", label: "Changed the menu tree" },
      { key: "digital.edit", label: "Edited the digital menu" },
      { key: "digital.price", label: "Changed a price on the digital menu" },
      { key: "design.save", label: "Saved a design" },
      { key: "design.rename", label: "Renamed a design" },
      { key: "design.delete", label: "Deleted a design" },
      { key: "schedule.add", label: "Scheduled a menu" },
      { key: "schedule.change", label: "Changed a schedule" },
      { key: "schedule.cancel", label: "Cancelled a schedule" },
    ],
  },
  {
    name: "Dishes",
    items: [
      { key: "dish.price", label: "Changed the price of a dish" },
      { key: "dish.details", label: "Changed ingredients and details" },
      { key: "dish.list", label: "Changed the list of dishes" },
      { key: "ask.toggle", label: "Turned \"Ask about the dishes\" on or off" },
    ],
  },
  {
    name: "Customers",
    items: [
      { key: "loyalty.stamp", label: "Gave a stamp or a reward" },
      { key: "loyalty.settings", label: "Changed the loyalty card" },
      { key: "announcement.add", label: "Added an announcement" },
      { key: "announcement.change", label: "Changed an announcement" },
      { key: "announcement.delete", label: "Deleted an announcement" },
      { key: "feedback.reply", label: "Answered or removed a feedback answer" },
      { key: "feedback.toggle", label: "Turned feedback on or off" },
      { key: "social.edit", label: "Changed social media" },
    ],
  },
  {
    name: "Reservations",
    items: [
      { key: "reservation.create", label: "Made a reservation for a customer" },
      { key: "reservation.accept", label: "Accepted a reservation" },
      { key: "reservation.refuse", label: "Refused a reservation" },
      { key: "reservation.cancel", label: "Cancelled a reservation" },
      { key: "reservation.table", label: "Changed the table of a reservation" },
      { key: "reservation.reminders", label: "Changed the reminders of a reservation" },
      { key: "reservation.call", label: "Called a customer about a reservation" },
      { key: "reservation.customer-cancel", label: "A customer cancelled with the email link" },
      { key: "reservation.block", label: "Blocked or unblocked tables" },
      { key: "reservation.settings", label: "Changed the reservation settings" },
    ],
  },
  {
    name: "Restaurant",
    items: [
      { key: "hours.edit", label: "Changed the weekly hours" },
      { key: "holidays.edit", label: "Changed holidays and special days" },
      { key: "floor.edit", label: "Changed the floor plan and tables" },
      { key: "floor.schedule", label: "Scheduled a floor plan change" },
      { key: "settings.edit", label: "Changed the restaurant settings" },
      { key: "currency.change", label: "Changed the currency" },
      { key: "seo.edit", label: "Changed SEO settings" },
      { key: "qr.style", label: "Changed the QR code style" },
    ],
  },
  {
    name: "Staff",
    items: [
      { key: "staff.add", label: "Added a staff member" },
      { key: "staff.remove", label: "Removed a staff member" },
      { key: "staff.access", label: "Changed someone's access" },
      { key: "staff.password", label: "Changed a staff password" },
      { key: "roles.edit", label: "Changed the roles" },
      { key: "auth.login", label: "Signed in" },
    ],
  },
] as const;

export type ActionType = (typeof ACTION_GROUPS)[number]["items"][number]["key"];
const ITEMS: readonly { key: string; label: string }[] = ACTION_GROUPS.flatMap((g) => [...g.items]);
export const ALL_ACTIONS = ITEMS.map((i) => i.key) as ActionType[];
export const isActionType = (v: unknown): v is ActionType => typeof v === "string" && ITEMS.some((i) => i.key === v);
export const actionLabel = (a: string) => ITEMS.find((i) => i.key === a)?.label ?? a;

export interface ActionEntry {
  id: string;
  at: string;
  action: ActionType;
  userId: string;
  userName: string;
  userEmail: string;
  /** The roles the person had at that moment ("owner" for the owner) */
  roles: { id: string; name: string }[];
  summary: string;
  details: string[];
}
