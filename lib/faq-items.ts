// The questions of the FAQ (see lib/faq.ts for the shape). Grouped like the sidebar.
// need: who sees it (anyone with one of these actions on Staff & roles, the owner always). [] = everyone.
// staffOnly: only staff accounts see it. tour: the "Show me how" steps on the real page.

import type { FaqGroup, TourStep } from "@/lib/faq";

// Short ways to write tour steps
const next = (target: string, title: string, text: string, more: Partial<TourStep> = {}): TourStep => ({ target, title, text, action: "next", ...more });
const click = (target: string, title: string, text: string, more: Partial<TourStep> = {}): TourStep => ({ target, title, text, action: "click", ...more });
const OWNER = ["settings.edit"] as const; // owner and managers

export const FAQ: FaqGroup[] = [
  // ── Account ──────────────────────────────────────────────────────────────
  {
    name: "Your account",
    items: [
      {
        id: "sign-in",
        question: "How do I sign in, and where do I land after?",
        answer: "Sign in with your email and password on the login page. Owners land on the Dashboard, staff land on Check in / out so they can check in right away.",
        steps: [
          "Open the SkanoMenu login page and write your email and password.",
          "Leave \"Keep me signed in\" ticked to stay signed in for 30 days on this device. Untick it on a shared computer: you are signed out when the browser closes.",
          "Press Sign in.",
        ],
        tips: ["Staff get their email and password from the owner or manager, who adds them on Staff & roles."],
        need: [],
      },
      {
        id: "account-change",
        question: "How do I change my name, email or password?",
        answer: "Press Account on your profile card at the top of the sidebar. Change what you want and press Save.",
        steps: [
          "At the top of the sidebar, on the card with your name, press Account.",
          "Change your name or email, or write a new password twice.",
          "For a new email or password, write your current password too.",
          "A new email also needs the 6-digit code we send to that new address. Press Send a code to the new email and write it.",
          "Press Save.",
        ],
        tips: ["Changing only the name doesn't need your password."],
        tour: {
          path: "/dashboard",
          steps: [
            click("button[aria-label='Open the menu']", "Open the menu", "On a phone the sidebar is hidden. Tap the menu button to open it.", { waitFor: "[data-dash-ready]", skipIf: "[data-go=account]" }),
            click("[data-go=account]", "Open your account", "Press Account on the card with your name."),
            next("#acc-email", "Name and email", "Change your name or email here. A new email gets a code to check it's right."),
            next("[data-password-box]", "The password", "Write your current password, then the new one twice. Then press Save."),
          ],
        },
        need: [],
      },
      {
        id: "forgot-password",
        question: "I don't know my current password. How do I change it?",
        answer: "Use the email code. In My account, press \"Don't know it? Email me a code\". The code replaces your current password.",
        steps: [
          "Press Account on your profile card at the top of the sidebar.",
          "Under Current password, press \"Don't know it? Email me a code\".",
          "Open your email and write the 6-digit code. It works for 5 minutes.",
          "Write your new password twice and press Save.",
        ],
        tips: [
          "No email? Look in spam, then press Send a new code. You can ask for one every 45 seconds.",
          "\"This code has expired\" or \"Too many wrong tries\": ask for a new code.",
          "If the platform says sending emails isn't set up yet, use your current password, or ask the owner to set a new one for you on Staff & roles.",
        ],
        tour: {
          path: "/dashboard",
          steps: [
            click("button[aria-label='Open the menu']", "Open the menu", "On a phone the sidebar is hidden. Tap the menu button to open it.", { waitFor: "[data-dash-ready]", skipIf: "[data-go=account]" }),
            click("[data-go=account]", "Open your account", "Press Account on the card with your name."),
            next("[data-go=send-me-code]", "Email me a code", "Press this link. We email you a 6-digit code that works for 5 minutes, and you write it instead of your current password."),
          ],
        },
        need: [],
      },
    ],
  },

  // ── Menu ─────────────────────────────────────────────────────────────────
  {
    name: "Menu",
    items: [
      {
        id: "menu-add",
        question: "How do I add my menu, and what's the difference between Menu Management and All menus?",
        answer: "Menu Management shows the menu customers see now and lets you change it or add another one. All menus is the list of every menu you saved.",
        steps: [
          "Open Menu Management and press Add a new menu.",
          "Give it a name and upload one PDF, or photos of each menu page. You can put the photos in order after uploading.",
          "Tick \"Make this the active menu\" if customers should see it now, then save.",
          "To build a menu yourself instead of uploading one, use Design your digital Menu.",
        ],
        tips: ["Under Menu type choose PDF / Photos for one menu, or Menu tree for several menus behind buttons (for example Food, Drinks, Desserts)."],
        link: { href: "/dashboard/menu", label: "Open Menu Management" },
        tour: {
          path: "/dashboard/menu",
          steps: [
            next("section[aria-label='Current menu']", "The menu customers see", "This card shows what customers see when they scan your QR code."),
            next("[role=radiogroup][aria-label='Menu type']", "One menu or several", "PDF / Photos shows one menu. Menu tree shows buttons that open several menus."),
            next("[data-tour=menu-add]", "Add a new menu", "Press this to upload a PDF or photos as a new menu."),
          ],
        },
        need: ["menu.edit", "menu.live"],
      },
      {
        id: "menu-active",
        question: "How do I change which menu customers see, or go back to an older version?",
        answer: "In Menu Management, the menu history lists every menu with its versions. Make one active and save, or open an older version and use it again.",
        steps: [
          "Open Menu Management and scroll to the menu history.",
          "On the menu you want, press Make active.",
          "Press Save changes in the bar at the bottom. Until then customers still see the old menu.",
          "For an older version, open Versions on that menu and pick the one you want.",
        ],
        tips: ["You can have as many menus as you like, for example lunch, dinner and drinks. Only the active one (or the menu tree) is shown to customers."],
        link: { href: "/dashboard/menu", label: "Open Menu Management" },
        need: ["menu.edit", "menu.live"],
      },
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
        tour: {
          path: "/dashboard/design-menu",
          steps: [
            click("[data-templates]", "Start from a template", "Pick a template or Blank page. You change everything after.", { waitFor: "[data-design-ready]", optional: true }),
            next("[data-tour=design-save]", "Design, preview and save", "Drag things from the left onto the page and change them on the right. Press Preview to check it, then Save here.", { waitFor: "[data-design-ready]" }),
          ],
        },
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
            click("#new-design", "Start a new design", "A menu is open now. Press New design to see the templates. Your saved menus stay.", { waitFor: "[data-design-ready]", skipIf: "[data-templates]" }),
            next("[data-tour=page-size]", "Choose the page size", "Pick A4, A5 or Square here. The templates below change to that size. Then press Next."),
            click("[data-templates]", "Click a template", "Each card shows how the first page looks. Click the one you like. It opens with your restaurant name on it."),
            next("[data-tour=design-save]", "Make it yours and save", "Change the texts, colors and photos to your own. When it's ready, press Save here and give the menu a name."),
          ],
        },
        need: ["design.edit"],
      },
      {
        id: "menu-schedule",
        question: "How do I schedule a menu, and what if two schedules overlap?",
        answer: "On Schedule menu, choose a saved menu, when it starts and (if you want) when it ends. While it runs customers see it, after the end they see your normal menu again.",
        steps: [
          "Open Schedule menu and press Add schedule.",
          "Choose which saved menu to show.",
          "Choose when it starts. Tick an end time for a menu that only shows for a while (for example a weekend menu), or leave it without an end to make it the active menu from that moment.",
          "Save. It shows under Upcoming, then Showing now.",
        ],
        tips: [
          "A schedule runs once, from its start to its end. For every weekend, use Schedule again on a finished one.",
          "When two schedules run at the same time, customers see the one that started last.",
          "You can only schedule menus you saved first under All menus or Menu Management.",
        ],
        link: { href: "/dashboard/schedule-menu", label: "Open Schedule menu" },
        tour: {
          path: "/dashboard/schedule-menu",
          steps: [next("[data-tour=schedule-add]", "Add a schedule", "Press this, choose a saved menu, when it starts and when it ends.")],
        },
        need: ["schedule.manage"],
      },
      {
        id: "dish-details",
        question: "How do I add ingredients, allergens, prices and photos to my dishes?",
        answer: "On Ingredients & details, open a menu, check its list of dishes, then fill in each dish: ingredients, notes like allergens, price, how long it takes, and photos.",
        steps: [
          "Open Ingredients & details and click one of your menus.",
          "Check the list of dishes we found on the menu. Add, rename or remove dishes until it's right.",
          "Open a dish and add its ingredients, a note (for example \"contains nuts\"), the price, the minutes it takes and photos.",
          "Mark the dish as done. Only done dishes are used to answer customers.",
        ],
        tips: [
          "Choose the currency of your prices at the top of the page.",
          "Want a chef to fill this in? Give them the Chef role on Staff & roles.",
        ],
        link: { href: "/dashboard/ingredients", label: "Open Ingredients & details" },
        tour: {
          path: "/dashboard/ingredients",
          steps: [
            next("#currency-select", "Your currency", "Choose the currency of your prices here.", { optional: true }),
            next("[data-tour=details-active]", "Open a menu", "Click one of your menus to see its dishes and fill in their details."),
          ],
        },
        need: ["details.edit"],
      },
      {
        id: "ask-dishes",
        question: "What does \"Let customers ask about the dishes\" do, and is it correct?",
        answer: "With it on, customers find Ask about the dishes under More on your menu. They can ask things like \"I'm allergic to peanuts\" or \"which main dish comes quickest?\".",
        steps: [
          "Open Ingredients & details and turn on \"Let customers ask about the dishes\".",
          "Fill in the dishes of your active menus and mark them done.",
        ],
        tips: [
          "Answers only use what you entered here, and only dishes marked done. The more you fill in, the better the answers.",
          "For allergies, customers should still tell the waiter. The answers help, they don't replace asking.",
        ],
        link: { href: "/dashboard/ingredients", label: "Open Ingredients & details" },
        tour: {
          path: "/dashboard/ingredients",
          steps: [next("#ask-switch", "Turn it on or off", "With this on, customers find Ask about the dishes under More on your menu.")],
        },
        need: ["details.edit", "details.ask"],
      },
    ],
  },

  // ── QR codes ─────────────────────────────────────────────────────────────
  {
    name: "QR codes",
    items: [
      {
        id: "qr-download",
        question: "Where do I download my QR code, and how do I style it?",
        answer: "On QR Code, press Download PNG under your menu code. Below the codes you can pick a style, colors, the corners and a frame with a text.",
        steps: [
          "Open QR Code.",
          "Press Download PNG under the menu QR code. Print it or send it to your printer.",
          "Under Style of your QR codes, click a ready style or change the shapes, colors and frame.",
          "Press Save style. All your codes use it.",
        ],
        tips: [
          "The page warns you when a style may not scan well. Keep the code dark on a light background for the best result.",
          "Put the codes on every table, at the door and at the counter. Table tents and stickers work well.",
        ],
        link: { href: "/dashboard/qrcode", label: "Open QR Code" },
        tour: {
          path: "/dashboard/qrcode",
          steps: [
            next("[data-tour=qr-download]", "Download your code", "Press Download PNG to save the QR code of your menu."),
            next("[data-presets]", "Pick a style", "Click a ready style. You can still change shapes, colors and the frame after."),
            next("#save-style", "Save the style", "Press Save style. All your QR codes use it."),
          ],
        },
        need: ["qr.view"],
      },
      {
        id: "qr-reserve",
        question: "What's the reservation QR code for?",
        answer: "It opens your reservation page directly. Customers pick a day, a time and a table and send a request. You accept or refuse it on Reservations.",
        tips: ["Put it near the door or on take-away bags, so people can book their next visit."],
        link: { href: "/dashboard/qrcode", label: "Open QR Code" },
        need: ["qr.view"],
      },
    ],
  },

  // ── Tables & reservations ───────────────────────────────────────────────
  {
    name: "Tables & reservations",
    items: [
      {
        id: "floor-build",
        question: "How do I build my floor plan, and can I plan a different layout for later?",
        answer: "On Floor plan & tables, drag tables, walls, doors and more onto the plan. With Schedule a change you prepare another layout (for example a summer terrace) from a date.",
        steps: [
          "Open Floor plan & tables.",
          "Drag a table from the left onto the plan, or click it. Click a table to set its number, seats and shape.",
          "Add walls, windows, doors, rooms like the kitchen, plants and text the same way.",
          "Use + Area for another room or floor, like a terrace.",
          "Press Save.",
          "For a layout that starts later, press Schedule a change and choose from when it's used.",
        ],
        tips: [
          "Give every table its own number. Reservations and table QR codes use it.",
          "Per table you choose if customers can reserve it online, and the smallest group for it.",
        ],
        link: { href: "/dashboard/floor-plan", label: "Open Floor plan & tables" },
        tour: {
          path: "/dashboard/floor-plan",
          steps: [
            next("aside[aria-label='Add to the plan']", "Add things", "Drag a table, a wall or anything else onto the plan, or click it."),
            next("#add-area", "More rooms", "Add another area, like a terrace or a second floor."),
            next("#schedule-change", "Plan a change", "Prepare another layout that starts on a date you choose."),
            next("#save-plan", "Save", "Press Save when the plan is ready."),
          ],
        },
        need: ["floor.edit"],
      },
      {
        id: "reservations-on",
        question: "How do I turn online reservations on or off, and can customers pick their table?",
        answer: "On Reservations, open Settings. Turn on Online reservations, choose how customers choose a table, and press Save settings.",
        steps: [
          "Open Reservations and click the Settings tab.",
          "Turn on Online reservations.",
          "Choose \"They pick it on the floor plan\" or \"They only fill in the form\" (then you choose the table when you accept).",
          "Set how long a reservation keeps the table, the times customers can choose, how far ahead and how long before.",
          "Press Save settings.",
        ],
        tips: ["The times follow your Open hours & holidays. Which tables can be reserved is set per table on the Floor plan."],
        link: { href: "/dashboard/reservations", label: "Open Reservations" },
        tour: {
          path: "/dashboard/reservations",
          steps: [
            click("[data-tab=settings]", "Open the settings", "Click Settings."),
            next("#set-enabled", "On or off", "Turn online reservations on or off here."),
            next("[data-picks=true]", "Who picks the table", "Customers pick a table on your floor plan, or they only fill in the form and you choose the table."),
            next("#set-save", "Save", "Press Save settings."),
          ],
        },
        need: ["reservations.manage"],
      },
      {
        id: "reservations-answer",
        question: "How do I accept or refuse a reservation, add one myself, or block a table?",
        answer: "New requests are under Requests. Accept or refuse each one, and the customer gets an email. New reservation adds one yourself, and Blocked tables keeps tables free.",
        steps: [
          "Open Reservations. Requests shows the new ones.",
          "Press Accept (you can change the table and add reminders), or refuse it with Refuse and send email.",
          "For a phone call or a walk-in, press New reservation.",
          "To keep a table free for a while, open Blocked tables.",
        ],
        tips: [
          "Reminders you set when accepting show up as notifications, and email the customer with a link to cancel.",
          "If emails aren't set up on the platform yet, call or write to the customer. Their phone and email are on each reservation.",
        ],
        link: { href: "/dashboard/reservations", label: "Open Reservations" },
        tour: {
          path: "/dashboard/reservations",
          steps: [
            next("[data-tab=requests]", "Requests", "New requests are here. Accept or refuse each one."),
            next("#new-reservation", "Add one yourself", "For a phone call or a walk-in, press New reservation."),
            next("[data-tab=blocks]", "Block a table", "Keep a table free for a while under Blocked tables."),
          ],
        },
        need: ["reservations.manage"],
      },
      {
        id: "hours",
        question: "How do I set opening hours, breaks, holidays and closed days?",
        answer: "On Open hours & holidays, set each day's hours (or Closed), add breaks, and save. Add holidays or special days below.",
        steps: [
          "Open Open hours & holidays.",
          "Set the hours of each day, or tick Closed. \"Use Monday's hours for every day\" copies Monday to all days.",
          "Add a break if you close in the afternoon.",
          "Press Save opening hours.",
          "For a holiday or a special day, press Add special day.",
        ],
        tips: ["Customers can't reserve when you're closed, and the last reservation time is an hour before closing."],
        link: { href: "/dashboard/exceptions", label: "Open Open hours & holidays" },
        tour: {
          path: "/dashboard/exceptions",
          steps: [
            next("#closed-monday", "Closed days", "Tick Closed on the days you don't open."),
            next("[data-tour=hours-save]", "Save the hours", "Press Save opening hours."),
            next("[data-tour=hours-special]", "Holidays", "Add a holiday or a special day here."),
          ],
        },
        need: ["hours.edit"],
      },
    ],
  },

  // ── Table ordering ───────────────────────────────────────────────────────
  {
    name: "Table ordering",
    items: [
      {
        id: "table-qr",
        question: "How do I make a QR code for each table?",
        answer: "On Table ordering, open QR codes & tables. Make codes for your floor plan tables in one click, or add tables yourself (one by one or a range like 1 to 20).",
        steps: [
          "Open Table ordering and click QR codes & tables.",
          "With a floor plan, press \"Yes, make N QR codes\" (or Make their QR codes). Each code stays linked to its table.",
          "Without a floor plan, write a first and last table and press Add tables, or add one table.",
          "Download one code, or Download all as PDF to print.",
        ],
        tips: [
          "The one QR code for all tables lets guests write their table number or name.",
          "Choose where the number goes: in the middle of the code, under it, both or none.",
        ],
        link: { href: "/dashboard/table-service?tab=qr", label: "Open Table ordering" },
        tour: {
          path: "/dashboard/table-service",
          steps: [
            click("[data-tab=qr]", "QR codes & tables", "Click QR codes & tables."),
            next("[data-ask-floor], [data-import]", "From your floor plan", "Make a QR code for each table of your floor plan in one click.", { optional: true }),
            next("#rooms-from", "Add tables", "Or write the first and last table number and press Add tables.", { optional: true }),
            next("[data-go=pdf]", "Print them", "Download all codes in a PDF, ready to print.", { optional: true }),
          ],
        },
        need: ["tableservice.manage"],
      },
      {
        id: "table-link",
        question: "How do I link a QR code to a table on the floor plan, and why only one per table?",
        answer: "Click a table on Floor plan & tables. In QR code for ordering, use the code with the same number, make a new one, or pick one from the list.",
        steps: [
          "Open Floor plan & tables and click a table.",
          "In the box QR code for ordering, press Use the QR code, Make a QR code, or pick one from the list.",
          "Change or Take it off works the same way.",
        ],
        tips: [
          "One table has one QR code, so every order goes to the right table. A code moved to another table leaves its old table.",
          "A deleted table keeps its code. It shows \"Not on the floor plan\" until you link it again.",
        ],
        link: { href: "/dashboard/floor-plan", label: "Open Floor plan & tables" },
        need: ["tableservice.manage"],
      },
      {
        id: "table-settings",
        question: "How do I turn table ordering on, and choose how guests order?",
        answer: "On Table ordering, open How guests order. Turn it on, choose writing, the menu or both, and press Save.",
        steps: [
          "Open Table ordering and click How guests order.",
          "Turn on \"Guests can order from their table\".",
          "Choose They write it, From the menu, or Both.",
          "Choose what guests see: only the dishes, or your official menu too.",
          "Write the steps guests see, and press Save at the bottom.",
        ],
        tips: ["The dishes list comes from Ingredients & details. With no dishes there yet, guests write their order."],
        link: { href: "/dashboard/table-service?tab=guests", label: "Open Table ordering" },
        tour: {
          path: "/dashboard/table-service",
          steps: [
            click("[data-tab=guests]", "How guests order", "Click How guests order."),
            next("#rs-on", "On or off", "Turn table ordering on here."),
            next("[data-mode-section]", "How they order", "They write it, pick from the menu, or both."),
            next("[data-go=save-guest]", "Save", "Nothing changes until you press Save."),
          ],
        },
        need: ["tableservice.manage"],
      },
      {
        id: "table-orders",
        question: "How do I handle orders, and who gets told about a new one?",
        answer: "New orders show up on the Orders tab by themselves. Move each one on with one button: Accept, Start preparing, On the way, Served. Or cancel it with a reason the guest sees.",
        tips: [
          "The owner and everyone with \"Table orders\" (waiters and chefs by default) get a notification for each new order.",
          "Guests see each step on their phone, and can rate the food once it's served.",
        ],
        link: { href: "/dashboard/table-service", label: "Open Table ordering" },
        need: ["tableservice.orders"],
      },
    ],
  },

  // ── Room service ─────────────────────────────────────────────────────────
  {
    name: "Room service",
    items: [
      {
        id: "room-rooms",
        question: "How do I add my rooms and make their QR codes?",
        answer: "On Room service, open QR codes & rooms. Add rooms one by one or a range like 101 to 120, choose where the room number goes, and download the codes.",
        steps: [
          "Open Room service and click QR codes & rooms.",
          "Write the first and last room and press Add rooms, or add one room (for example Suite Panorama).",
          "Below, choose where the room number goes: in the middle, under the code, both or none.",
          "Download one code, or Download all as PDF to print.",
        ],
        tips: ["The one QR code for all rooms lets guests write their room number or their name and surname, for example at the reception."],
        link: { href: "/dashboard/room-service?tab=qr", label: "Open Room service" },
        tour: {
          path: "/dashboard/room-service",
          steps: [
            click("[data-tab=qr]", "QR codes & rooms", "Click QR codes & rooms."),
            next("#rooms-from", "Add rooms", "Write the first and last room and press Add rooms."),
            next("[data-room-label]", "The room number on the code", "Choose where the number goes: in the middle, under it, both or none.", { optional: true }),
            next("[data-go=pdf]", "Print them", "Download all codes in a PDF, ready to print.", { optional: true }),
          ],
        },
        need: ["roomservice.manage"],
      },
      {
        id: "room-settings",
        question: "How do I turn room service on, and write the steps guests see?",
        answer: "On Room service, open How guests order. Turn it on, choose how guests order and what menu they see, write the steps, and press Save.",
        tips: [
          "Guests can also rate the food after it's delivered. You see it on the Feedback tab.",
          "Orders work like table orders: Accept, Start preparing, On the way, Delivered.",
        ],
        link: { href: "/dashboard/room-service?tab=guests", label: "Open Room service" },
        tour: {
          path: "/dashboard/room-service",
          steps: [
            click("[data-tab=guests]", "How guests order", "Click How guests order."),
            next("#rs-on", "On or off", "Turn room service on here."),
            next("[data-steps]", "The steps", "Write how ordering works in your hotel: payment, delivery time, the reception number."),
            next("[data-go=save-guest]", "Save", "Nothing changes until you press Save."),
          ],
        },
        need: ["roomservice.manage"],
      },
    ],
  },

  // ── Customers ────────────────────────────────────────────────────────────
  {
    name: "Customers",
    items: [
      {
        id: "loyalty",
        question: "How does the loyalty stamp card work, and how do I set it up?",
        answer: "Customers open the stamp card under More on your menu. A staff member confirms each stamp. After the number of stamps you choose, they get the reward.",
        steps: [
          "Open Loyalty Cards and turn on the loyalty stamp card.",
          "Write how many stamps are needed and what the reward is.",
          "Tick \"Customers can send a photo of their receipt\" if no waiter is always around.",
          "Press Save.",
        ],
        tips: ["Staff with \"Confirm loyalty stamps\" (the Waiter role has it) confirm stamps on the waiter page."],
        link: { href: "/dashboard/loyalty", label: "Open Loyalty Cards" },
        tour: {
          path: "/dashboard/loyalty",
          steps: [
            next("#loyalty-switch", "On or off", "Turn the stamp card on here."),
            next("#loyalty-stamps", "Stamps needed", "How many stamps for the reward."),
            next("#loyalty-reward", "The reward", "What customers get, for example a free coffee."),
            next("#loyalty-receipts", "Receipt photos", "Optional: customers can send a photo of their receipt instead."),
            next("[data-tour=loyalty-save]", "Save", "Press Save."),
          ],
        },
        need: ["loyalty.settings"],
      },
      {
        id: "feedback",
        question: "How do I see and reply to feedback, and turn it on or off?",
        answer: "On Feedback you see what customers wrote, with filters by stars, and you can reply. Settings turns feedback about the restaurant and about waiters on or off.",
        steps: [
          "Open Feedback. Switch between About the restaurant and About waiters.",
          "Press the reply arrow on a feedback to answer it.",
          "Open Settings to turn customer feedback on or off.",
        ],
        tips: ["Waiter ratings have charts: averages, ranking and the most used tags. Waiters can see their own feedback if you allow it."],
        link: { href: "/dashboard/feedback", label: "Open Feedback" },
        tour: {
          path: "/dashboard/feedback",
          steps: [
            click("[data-tab=settings]", "Settings", "Click Settings."),
            next("#feedback-switch", "Feedback about the restaurant", "Customers find Leave feedback under More when this is on."),
            next("#waiter-feedback-switch", "Feedback about waiters", "Customers can rate their waiter when this is on.", { optional: true }),
            next("#waiter-see-own", "Waiters see their own", "Let waiters see what customers said about them.", { optional: true }),
          ],
        },
        need: ["feedback.manage"],
      },
      {
        id: "announcement",
        question: "How do I show an announcement on my menu?",
        answer: "On Announcement Banner, press New announcement, write it, choose how it shows and when, and save.",
        steps: [
          "Open Announcement Banner and press New announcement.",
          "Write the message.",
          "Choose how it shows: always visible, the customer closes it, or it disappears by itself.",
          "Choose when it starts and ends, or show it now.",
          "Save.",
        ],
        link: { href: "/dashboard/announcements", label: "Open Announcement Banner" },
        tour: {
          path: "/dashboard/announcements",
          steps: [next("[data-tour=announce-new]", "New announcement", "Press this, write the message and choose how and when it shows.")],
        },
        need: ["announcements.manage"],
      },
      {
        id: "social",
        question: "How do I add my social media links?",
        answer: "On Social medias, paste your links (Instagram, Facebook, TikTok, X, WhatsApp, Viber, Telegram, TripAdvisor) and choose which ones show above the menu. Then save.",
        link: { href: "/dashboard/social-media", label: "Open Social medias" },
        tour: {
          path: "/dashboard/social-media",
          steps: [
            next("#social-instagram", "Your link", "Paste your link or write your name here."),
            next("#social-show-instagram", "Show it above the menu", "Tick it to show the icon above your menu. Then press Save at the bottom."),
          ],
        },
        need: ["social.edit"],
      },
      {
        id: "wifi",
        question: "How do I set the Wi-Fi password guests see?",
        answer: "On Settings, write the Wi-Fi password and press Save Settings. Guests find it under More on your menu.",
        link: { href: "/dashboard/settings", label: "Open Settings" },
        tour: {
          path: "/dashboard/settings",
          steps: [
            next("[data-tour=wifi]", "Wi-Fi password", "Write your Wi-Fi password here."),
            next("[data-tour=settings-save]", "Save", "Press Save Settings."),
          ],
        },
        need: ["settings.edit"],
      },
      {
        id: "seo-scans",
        question: "What does SEO & Analytics do, and where do I see how many people scanned my menu?",
        answer: "SEO & Analytics sets how your restaurant shows on Google (title and description) and connects Google Analytics. Your scans are on the Dashboard: total, today and the last 7 days.",
        link: { href: "/dashboard/seo", label: "Open SEO & Analytics" },
        tour: {
          path: "/dashboard/seo",
          steps: [next("[data-tour=seo-save]", "Save", "Write the title and description Google shows, then press Save SEO Settings.")],
        },
        need: ["seo.manage"],
      },
    ],
  },

  // ── Team ─────────────────────────────────────────────────────────────────
  {
    name: "Team",
    items: [
      {
        id: "staff-add",
        question: "How do I add a staff member, and what can each role do?",
        answer: "On Staff & roles, press Add staff member, write their name, email and a password, and choose a role. They sign in on the normal login page.",
        steps: [
          "Open Staff & roles and press Add staff member.",
          "Write their name, email and a password. Give the password to them.",
          "Choose one or more roles, or single actions.",
          "Save.",
        ],
        tips: [
          "Manager can do everything. Waiter confirms loyalty stamps and handles table orders. Chef fills in ingredients and handles table orders. HR handles hours, time off and documents.",
          "Press Edit on a role to change what it can do. Everyone with that role gets the change.",
        ],
        link: { href: "/dashboard/staff", label: "Open Staff & roles" },
        tour: {
          path: "/dashboard/staff",
          steps: [
            next("#add-staff", "Add staff member", "Press this, write their name, email and a password, and pick a role."),
            next("#add-role", "Your own roles", "Make a role with just the actions you choose."),
          ],
        },
        need: ["staff.manage"],
      },
      {
        id: "staff-roles",
        question: "Can I make my own role, or give access only for some dates?",
        answer: "Yes. Add a custom role picks the actions it can do. On a staff member, every role and action can start and end on a date.",
        tips: ["For example, pick tomorrow under From to start a role tomorrow, or an end date for a summer job."],
        link: { href: "/dashboard/staff", label: "Open Staff & roles" },
        need: ["staff.manage"],
      },
      {
        id: "hr-hours",
        question: "How do I see the hours my staff worked, and fix a forgotten check-out?",
        answer: "On HR, the Hours tab shows every person's hours by day, week or month, sorted how you like. Use Fix hours to correct a check-in, or Add hours for one that is missing.",
        tips: ["Today shows who is working now, who should work and didn't check in, and who is off."],
        link: { href: "/dashboard/hr", label: "Open HR" },
        tour: {
          path: "/dashboard/hr",
          steps: [
            next("[data-tab=today]", "Today", "Who is working now, who didn't check in, who is off."),
            next("[data-tab=hours]", "Hours", "Everyone's hours by day, week or month."),
          ],
        },
        need: ["hr.manage"],
      },
      {
        id: "hr-times",
        question: "How do I set work times, vacation and sick days, and answer time off requests?",
        answer: "On HR, Work times sets each person's week. Rules sets vacation days, sick days and the smallest time off. Time off lists the requests to approve or refuse.",
        tips: ["Each answer is a notification for the staff member. Approved time off counts against their days."],
        link: { href: "/dashboard/hr", label: "Open HR" },
        tour: {
          path: "/dashboard/hr",
          steps: [
            next("[data-tab=schedule]", "Work times", "Set when each person works."),
            next("[data-tab=rules]", "Rules", "Vacation days, sick days and the smallest time off."),
            next("[data-tab=timeoff]", "Time off", "Approve or refuse the requests here."),
          ],
        },
        need: ["hr.manage"],
      },
      {
        id: "hr-docs",
        question: "How do I upload contracts and documents, and make my own categories?",
        answer: "On HR, open Documents. Upload a file for a person and choose its category. You can make your own categories, like Birth certificate, and search by them.",
        tips: [
          "A new contract keeps the old one in the contract history. An old one that still runs shows until its end date.",
          "Staff see their own documents on My work.",
        ],
        link: { href: "/dashboard/hr?tab=documents", label: "Open HR" },
        tour: {
          path: "/dashboard/hr",
          steps: [click("[data-tab=documents]", "Documents", "Click Documents to upload files and make categories.")],
        },
        need: ["hr.documents", "hr.manage"],
      },
      {
        id: "history",
        question: "What is the Action history?",
        answer: "Everything everyone did on the platform: who changed a menu, accepted a reservation, signed in and more. Filter by action, person and dates.",
        link: { href: "/dashboard/history", label: "Open Action history" },
        tour: {
          path: "/dashboard/history",
          steps: [
            next("#toggle-actions", "Which actions", "Choose the kinds of actions to see."),
            next("#filter-from", "Dates", "Choose from and until when."),
          ],
        },
        need: ["history.view"],
      },
    ],
  },

  // ── Restaurant ───────────────────────────────────────────────────────────
  {
    name: "Restaurant",
    items: [
      {
        id: "settings",
        question: "How do I change my restaurant's name, address or phone?",
        answer: "On Settings, change the name, description, phone, email, address, website and cuisine types, then press Save Settings.",
        link: { href: "/dashboard/settings", label: "Open Settings" },
        tour: {
          path: "/dashboard/settings",
          steps: [next("[data-tour=settings-save]", "Save", "Change what you need above, then press Save Settings.")],
        },
        need: ["settings.edit"],
      },
      {
        id: "notifications",
        question: "What are the notifications, and why don't customers get emails?",
        answer: "The bell at the top shows notifications: new reservations, orders, ratings, time off and reminders. Each one opens the page it's about.",
        tips: ["Customer emails (reservation answers, codes) only go out when sending emails is set up on the platform. Until then the page says so, and you can call or write to them."],
        need: [...OWNER],
      },
      {
        id: "plans",
        question: "What do Start, Pro and Premium include?",
        answer: "Start is a digital menu and QR code, without reservations. Pro adds reservations, the floor plan and a loyalty card. Premium is everything SkanoMenu does, and we set it up for you.",
        tips: [
          "Start is €29, Pro €69 and Premium €89 a month. Paying yearly costs 10 months for 12.",
          "Your guests never pay anything and don't need an app.",
        ],
        link: { href: "/pricing", label: "See the prices" },
        need: [...OWNER],
      },
      {
        id: "approval",
        question: "How long until my restaurant is approved?",
        answer: "After you register, the SkanoMenu team checks your restaurant and approves it. You get an email when it's approved.",
        need: [...OWNER],
      },
    ],
  },

  // ── Staff ────────────────────────────────────────────────────────────────
  {
    name: "For staff",
    items: [
      {
        id: "check-in",
        question: "How do I check in and out, and what if I forget?",
        answer: "On Check in / out, press Check in when you start and Check out when you finish. Forgot to check out? Ask HR or the manager to fix it.",
        tips: ["This week and this month show your hours compared with your plan."],
        link: { href: "/dashboard/check-in", label: "Open Check in / out" },
        tour: {
          path: "/dashboard/check-in",
          steps: [next("[data-checkin-card]", "Check in or out", "Press the green button when you start, and Check out when you finish. A note is optional.")],
        },
        staffOnly: true,
        need: [],
      },
      {
        id: "time-off",
        question: "How do I ask for time off or a sick day, and can I cancel it?",
        answer: "On My work, press Ask for time off, choose the kind and the days, and send. HR answers with a notification. You can cancel a request, or approved time off that hasn't passed.",
        tips: ["My work also shows your work times and your documents."],
        link: { href: "/dashboard/my-work", label: "Open My work" },
        tour: {
          path: "/dashboard/my-work",
          steps: [next("[data-go=ask]", "Ask for time off", "Press this, choose Vacation, Sick or Unpaid day off, and the days.")],
        },
        staffOnly: true,
        need: [],
      },
      {
        id: "my-feedback",
        question: "Where do I see what customers said about me?",
        answer: "On My feedback, when the manager shares it with the staff. You see your average stars and each comment.",
        link: { href: "/dashboard/my-feedback", label: "Open My feedback" },
        staffOnly: true,
        need: [],
      },
      {
        id: "waiter-page",
        question: "How do I confirm a loyalty stamp and get waiter calls on my phone?",
        answer: "Open Confirm stamps. Scan the customer's QR code with your phone camera, or type their code, and confirm.",
        tips: [
          "Turn on the bell and the sound on that page to hear new calls, even with the tab in the background.",
          "Waiter calls come from the old digital menu (categories and items).",
          "The Dashboard button at the top takes you back.",
        ],
        link: { href: "/waiter", label: "Open Confirm stamps" },
        need: ["loyalty.stamp"],
      },
      {
        id: "no-access",
        question: "Why can't I open a page?",
        answer: "Your role doesn't include it. The owner or manager gives access on Staff & roles, also only from or until a date.",
        staffOnly: true,
        need: [],
      },
    ],
  },

  // ── Guests ───────────────────────────────────────────────────────────────
  {
    name: "Your guests",
    items: [
      {
        id: "guests-menu",
        question: "What can guests do on my menu?",
        answer: "Guests scan your QR code and see the menu in their browser, no app or account needed. Under More they find what you turned on: Ask about the dishes, Photos of the dishes, Loyalty stamp card, Opening hours, Wi-Fi password, Reserve a table, Leave feedback and Rate your waiter.",
        need: [...OWNER],
      },
      {
        id: "guests-reserve",
        question: "How do guests reserve a table, and cancel it?",
        answer: "With the reservation QR code or Reserve a table under More. They pick a day, a time and (if you allow it) a table, and send. The email they get has a link to cancel.",
        need: [...OWNER],
      },
      {
        id: "guests-order",
        question: "How do guests order from their table or room, and follow the order?",
        answer: "They scan the table or room QR code, write their order or pick dishes, and send. Their phone shows each step until it's served or delivered, then they can rate the food.",
        need: ["tableservice.manage", "roomservice.manage"],
      },
    ],
  },
];
