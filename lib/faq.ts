// The FAQ in the dashboard (app/dashboard/faq). One entry per question, in groups.
// need: who sees it. Anyone with one of these actions (Staff & roles), the owner always. [] = everyone.
// To add a question: add an entry here, nothing else to change.

import type { Permission } from "@/lib/permissions";

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
}
export interface Tour { path: string; steps: TourStep[] }

export const findTour = (id: string): Tour | null => {
  for (const g of FAQ) for (const f of g.items) if (f.id === id && f.tour) return f.tour;
  return null;
};
export interface FaqGroup { name: string; items: FaqItem[] }

export const FAQ: FaqGroup[] = [
  {
    name: "Menu",
    items: [
      {
        id: "design-menu",
        question: "How do I design my digital menu?",
        answer: "Open Design your digital Menu, start from a template or a blank page, then drag things onto the pages and change them how you like. Save it and make it the active menu when it's ready.",
        steps: [
          "In the sidebar, under Menu, open Design your digital Menu, and pick a template or Blank page to start with.",
          "Drag things from the left onto the page: headings, text, menu items, menu sections, photos, shapes, lines and ornaments. You can also drop a photo from your computer onto the page.",
          "Double-click a text to write in it. Click anything on the page to change its font, size and colors on the right.",
          "Click an empty spot of the page to change its background: a color, a gradient or a photo.",
          "Under the pages you can add, copy, move or delete a page. At the top choose Book (customers flip the pages) or Scroll (they scroll down).",
          "Press Preview to see the menu like customers do, on a phone or a computer.",
          "Press Save and give the menu a name. Tick \"Make this the active menu\" if customers should see it right away.",
        ],
        tips: [
          "Made a mistake? Ctrl+Z undoes it, Ctrl+Y does it again.",
          "Select several things with Shift and line them up with the align buttons in the toolbar.",
          "Nothing changes for customers until you save with \"Make this the active menu\" ticked.",
          "You can also download the menu as a PDF or as pictures, for printing.",
        ],
        link: { href: "/dashboard/design-menu", label: "Open Design your digital Menu" },
        need: ["design.edit"],
      },
      {
        id: "design-template",
        question: "How do I pick a template for my digital menu?",
        answer: "When you start a new design, Design your digital Menu shows all the templates. Choose the page size, then click the one you like. It's only a start, you can change everything after.",
        steps: [
          "In the sidebar, under Menu, open Design your digital Menu. If a menu is already open, press New design.",
          "At the top right, choose the page size: A4, A5 or Square.",
          "Look at the templates: Blank page, Classic, Dark elegant, Modern minimal, Chalkboard, Rustic, Fresh & green, Bold pizzeria, Café pastel, Navy & gold, Street food and Botanical. Each one shows how its first page looks.",
          "Click the template you like. It opens in the designer with your restaurant name on it.",
          "Change the texts, colors and photos to your own, then press Save.",
        ],
        tips: [
          "Want to try another template? Press New design and pick another one. The menus you saved stay, you find them in the Open a design list.",
          "Blank page is an empty page, for when you want to build everything yourself.",
        ],
        link: { href: "/dashboard/design-menu", label: "Open Design your digital Menu" },
        tour: {
          path: "/dashboard/design-menu",
          steps: [
            { target: "#new-design", waitFor: "[data-design-ready]", skipIf: "[data-templates]", action: "click", title: "Start a new design", text: "A menu is open now. Press New design to see the templates. Your saved menus stay." },
            { target: "[data-tour=page-size]", action: "next", title: "Choose the page size", text: "Pick A4, A5 or Square here. The templates below change to that size. Then press Next." },
            { target: "[data-templates]", action: "click", title: "Click a template", text: "Each card shows how the first page looks. Click the one you like. It opens with your restaurant name on it." },
            { target: "[data-tour=design-save]", action: "next", title: "Make it yours and save", text: "Change the texts, colors and photos to your own. When it's ready, press Save here and give the menu a name." },
          ],
        },
        need: ["design.edit"],
      },
    ],
  },
];
