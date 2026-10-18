// ─── SkanoMenu packages ──────────────────────────────────────────────────────
// One place for the packages, their prices and what you can do in each.
// Used by the landing page and /pricing. No free package: every package starts with a 14-day trial.

export type PlanId = "premium" | "pro" | "start";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** € per month when paid monthly. Yearly = 10 months for 12 (2 months free) */
  monthlyPrice: number;
  /** Shown on the card, top first */
  highlights: string[];
  /** "Everything in Pro, plus" */
  includes?: string;
  recommended?: boolean;
  ctaText: string;
  ctaHref: string;
}

export const TRIAL_DAYS = 14;

// Top package first: people see the biggest price first, the others feel small next to it
export const PLANS: Plan[] = [
  {
    id: "premium",
    name: "Premium",
    tagline: "Everything SkanoMenu does, and we set it up for you.",
    monthlyPrice: 89,
    includes: "Everything in Pro, plus",
    highlights: [
      "Reminders so guests don't forget, and staff call to confirm",
      "Reminder emails to guests with a cancel link",
      "Table photos and 360 views",
      "Receipt photos for loyalty stamps",
      "Ask about the dishes",
      "Unlimited staff, access with dates",
      "We move your menus in and build your floor plan",
      "Personal contact person",
    ],
    recommended: true,
    ctaText: "Try Premium 14 days free",
    ctaHref: "/register?plan=premium",
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Reservations, floor plan and a loyalty card.",
    monthlyPrice: 69,
    includes: "Everything in Start, plus",
    highlights: [
      "Reservations with their own QR code",
      "Add reservations for callers, block tables",
      "Floor plan with accessibility items",
      "Loyalty card with stamps",
      "5 staff, your own roles",
    ],
    ctaText: "Try Pro 14 days free",
    ctaHref: "/register?plan=pro",
  },
  {
    id: "start",
    name: "Start",
    tagline: "A digital menu and QR code. No reservations.",
    monthlyPrice: 29,
    highlights: [
      "Analytics: scans, 7-day chart, popular dishes",
      "Unlimited menus, history and scheduling",
      "Design your digital menu with dish icons",
      "Ingredients and dish photos",
      "All QR styles and colors",
      "Feedback, announcements, SEO",
      "2 staff with ready roles",
    ],
    ctaText: "Try Start 14 days free",
    ctaHref: "/register?plan=start",
  },
];

export const getPlan = (id: PlanId): Plan => PLANS.find((p) => p.id === id) ?? PLANS[0];

/** € per month: yearly = 10 months spread over 12 */
export const pricePerMonth = (plan: Plan, yearly: boolean) => (yearly ? Math.round((plan.monthlyPrice * 10) / 12) : plan.monthlyPrice);
/** "€2.44" a day */
export const pricePerDay = (plan: Plan, yearly: boolean) => `€${((yearly ? plan.monthlyPrice * 10 : plan.monthlyPrice * 12) / 365).toFixed(2)}`;
/** The small line under the price */
export const priceNote = (plan: Plan, yearly: boolean) =>
  yearly ? `€${plan.monthlyPrice * 10} a year, you save €${plan.monthlyPrice * 2}` : `or €${pricePerMonth(plan, true)} a month, billed yearly`;

// ─── What you can do in each package ─────────────────────────────────────────
// Grouped like the dashboard sidebar. true = included, false = not, a string = a limit.

export type Cell = boolean | string;

export interface PlanFeature {
  label: string;
  help: string;
  premium: Cell;
  pro: Cell;
  start: Cell;
}

export interface FeatureGroup {
  name: string;
  features: PlanFeature[];
}

const f = (label: string, help: string, premium: Cell, pro: Cell, start: Cell): PlanFeature => ({ label, help, premium, pro, start });
const Y = true, N = false;

export const FEATURE_GROUPS: FeatureGroup[] = [
  { name: "Analytics", features: [
    f("Scans and visitors", "Total scans, scans today, a 7-day chart and your popular dishes", Y, Y, Y),
    f("Google Analytics", "Connect your own analytics", Y, Y, Y),
  ]},
  { name: "Menus", features: [
    f("Upload your menu", "PDF or photos, shown as a menu guests turn page by page", Y, Y, Y),
    f("Menus and menu history", "Unlimited menus, put an old one back live with one click", Y, Y, Y),
    f("Menu tree", "Several menus in one place, like Food, Drinks, or English and Albanian", Y, Y, Y),
    f("Schedule menus", "A breakfast menu in the morning, a new menu from a date you pick", Y, Y, Y),
    f("Design your digital menu", "Build the menu in the editor instead of uploading a file", Y, Y, Y),
    f("Dish icons and icon key", "Chicken, beef, fish, vegetarian, vegan, spicy, gluten free, nuts, egg, dairy", Y, Y, Y),
    f("Ingredients and details", "What each dish is made of, prices and serving times", Y, Y, Y),
    f("Dish photos", "Guests see them under More", Y, Y, Y),
    f("Ask about the dishes", "Guests ask, answers come only from your own dish details", Y, N, N),
  ]},
  { name: "QR codes", features: [
    f("Menu QR code", "Download and print for every table", Y, Y, Y),
    f("QR styles and colors", "Presets and your own colors, with a warning if a code is hard to scan", Y, Y, Y),
    f("Reservation QR code", "A second code that opens your booking page", Y, Y, N),
  ]},
  { name: "Reservations and tables", features: [
    f("Take reservations", "Accept or refuse each request, the guest gets an email", Y, Y, N),
    f("Guests pick their table", "Or you choose one for them when you accept", Y, Y, N),
    f("Add reservations for guests", "For people who call or come by, accepted right away", Y, Y, N),
    f("Block tables", "For a private event or repairs, for the time you choose", Y, Y, N),
    f("No double bookings", "A taken or blocked table can't be booked again", Y, Y, N),
    f("Floor plan", "Areas, tables and seats, walls, doors, windows and rooms", Y, Y, N),
    f("Accessibility on the plan", "Accessible tables, stairs, ramp, lift and speakers", Y, Y, N),
    f("Reminders to your team", "A notification to a person or a role to call and confirm", Y, N, N),
    f("Reminder emails to guests", "1 day, 2 days or hours before, with a link to cancel", Y, N, N),
    f("Table photos and 360 views", "Guests see the table before they book it", Y, N, N),
  ]},
  { name: "Opening hours", features: [
    f("Weekly opening hours", "Shown to guests under More, open or closed now", Y, Y, Y),
    f("Breaks in the day", "Like 8:00 to 12:00 and 16:00 to 20:00", Y, Y, Y),
    f("Holidays and special days", "Other hours, or closed, on dates you pick", Y, Y, Y),
  ]},
  { name: "Guests and loyalty", features: [
    f("Wi-Fi password and social links", "On the menu, so guests don't have to ask", Y, Y, Y),
    f("Announcement banner", "A message at the top of the menu, with start and end dates", Y, Y, Y),
    f("Customer feedback", "Read and answer what guests write", Y, Y, Y),
    f("SEO", "How your menu looks in Google: title and description", Y, Y, Y),
    f("Loyalty card", "Guests collect stamps, a staff member confirms each one", Y, Y, N),
    f("Receipt photos", "Guests send a photo of the receipt, staff gives the stamp later", Y, N, N),
  ]},
  { name: "Team", features: [
    f("Staff accounts", "People with their own sign-in. The owner is not counted", "Unlimited", "5", "2"),
    f("Ready roles", "Manager, Waiter and Chef", Y, Y, Y),
    f("Your own roles", "Choose exactly which actions a role can do", Y, Y, N),
    f("Access with dates", "A role or a single action from one date until another", Y, N, N),
    f("Notifications", "The bell for reservations, reminders and receipts", Y, Y, Y),
    f("Action history", "Who did what, with filters", "All", "90 days", "30 days"),
  ]},
  { name: "Help", features: [
    f("Support", "How you reach us", "Personal contact", "Priority email", "Email"),
    f("Move your menus in", "We import them for you", Y, N, N),
    f("Floor plan set up with you", "We build it together on a call", Y, N, N),
    f("Several restaurants in one account", "Coming soon", "Soon", N, N),
  ]},
];
