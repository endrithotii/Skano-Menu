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
  need: Permission[];
}
export interface FaqGroup { name: string; items: FaqItem[] }

export const FAQ: FaqGroup[] = [
  {
    name: "Menu",
    items: [
      {
        id: "design-template",
        question: "How do I design my digital menu and pick a template?",
        answer: "Open Design your digital Menu, pick a template to start with, then drag and change everything you like. Save it and make it the active menu when it's ready.",
        steps: [
          "In the sidebar, under Menu, open Design your digital Menu.",
          "Choose the page size at the top right (A4, A5 or Square), then click a template: Blank page, Classic, Dark elegant, Modern minimal, Chalkboard, Rustic, Fresh & green, Bold pizzeria, Café pastel, Navy & gold, Street food or Botanical. The template is only a start, you can change all of it.",
          "Drag things from the left onto the page: headings, text, menu items, menu sections, photos, shapes, lines and ornaments. Double-click a text to write in it.",
          "Click anything on the page to change its font, size and colors on the right. Click an empty spot of the page to change its background (a color, a gradient or a photo).",
          "Under the pages you can add, copy, move or delete a page. At the top choose Book (customers flip the pages) or Scroll (they scroll down).",
          "Press Preview to see the menu like customers do, on a phone or a computer.",
          "Press Save and give the menu a name. Tick \"Make this the active menu\" if customers should see it right away.",
        ],
        tips: [
          "Want another template? Press New design and pick one. Your saved menus stay, you find them in the Open a design list.",
          "Made a mistake? Ctrl+Z undoes it, Ctrl+Y does it again.",
          "Nothing changes for customers until you save with \"Make this the active menu\" ticked.",
          "You can also download the menu as a PDF or as pictures, for printing.",
        ],
        link: { href: "/dashboard/design-menu", label: "Open Design your digital Menu" },
        need: ["design.edit"],
      },
    ],
  },
];
