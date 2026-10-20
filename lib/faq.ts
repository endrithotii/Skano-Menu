// The FAQ in the dashboard (app/dashboard/faq). One entry per question, in groups.
// need: who sees it. Anyone with one of these actions (Staff & roles), the owner always. [] = everyone.
// The questions are in lib/faq-items.ts. To add one: add an entry there, nothing else to change.

import type { Permission } from "@/lib/permissions";
import { FAQ } from "@/lib/faq-items";

export { FAQ };

export interface FaqItem {
  id: string;
  question: string;
  /** One or two lines: the short answer */
  answer: string;
  /** The steps, in order */
  steps?: string[];
  tips?: string[];
  /** The page it's about */
  link?: { href: string; label: string };
  /** "Show me how": a guided tour on the real page (components/tour/tour.tsx) */
  tour?: Tour;
  need: Permission[];
  /** Only staff accounts see it (check in, time off...) */
  staffOnly?: boolean;
}

/** One step of a tour: the thing to look at or click, and what to say about it */
export interface TourStep {
  /** CSS selector of the thing to show (it stays clear, the rest of the page is blurred) */
  target: string;
  title: string;
  text: string;
  /** "click": the tour goes on when the person clicks it. "next": they press Next */
  action: "click" | "next";
  /** Skip this step when this is already on the page (for example: the templates are already showing) */
  skipIf?: string;
  /** Wait for this before showing the step (the page is still loading) */
  waitFor?: string;
  /** The part isn't always on the page (for example only with a floor plan): skip the step when it isn't there */
  optional?: boolean;
}
export interface Tour { path: string; steps: TourStep[] }

export const findTour = (id: string): Tour | null => {
  for (const g of FAQ) for (const f of g.items) if (f.id === id && f.tour) return f.tour;
  return null;
};
export interface FaqGroup { name: string; items: FaqItem[] }
