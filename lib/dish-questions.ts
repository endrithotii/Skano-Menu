// Answers customer questions about the dishes ("I'm allergic to peanuts", "which main dish comes quickest?")
// using ONLY what the kitchen entered on the Ingredients & details page.
//
// Safety rules (this can matter for someone's health):
// - Only dishes the kitchen finished (done) are used. Other dishes are never suggested.
// - The answer is built from the data here, never written freely by an AI. AI (if set up) only helps to
//   understand the question and to add MORE words to avoid, it can never add a dish.
// - Avoiding something is strict: a dish is left out if the word (or a related word) appears anywhere in its
//   name, menu text, ingredients, ingredient comments or note. Leaving out too much is better than too little.
// - Every answer ends by asking the customer to confirm with the waiter, firmly for allergies.

import type { Dish } from "@/lib/dish-details";

export interface AnswerDish { name: string; section: string; menu: string; ingredients: string; minutes: number | null; note: string }
export interface Answer {
  kind: "avoid" | "quickest" | "dish" | "contains" | "list" | "unknown" | "empty";
  title: string;
  dishes: AnswerDish[];
  /** Short facts about the answer (what was left out and why) */
  notes: string[];
  /** Always shown last */
  warning: string;
}

// ── Words ───────────────────────────────────────────────────────────────────

/** Lower case, no accents (ë -> e, ç -> c) */
export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

/** Allergen / diet groups: the trigger words in a question, and every word that means the dish has it */
const GROUPS: { name: string; triggers: string[]; words: string[] }[] = [
  {
    name: "peanuts", triggers: ["peanut", "groundnut", "kikirik"],
    words: ["peanut", "groundnut", "arachis", "satay", "monkey nut", "kikirik"],
  },
  {
    name: "nuts", triggers: ["nut", "nuts", "tree nut", "arra", "lajthi", "bajame"],
    words: ["nut", "almond", "walnut", "hazelnut", "cashew", "pistachio", "pecan", "macadamia", "brazil nut", "pine nut", "praline", "marzipan",
      "nougat", "gianduja", "nutella", "frangipane", "pesto", "amaretto", "amaretti", "baklava", "peanut", "arra", "lajthi", "bajame", "fistik", "kikirik"],
  },
  {
    name: "milk and dairy", triggers: ["milk", "dairy", "lactose", "cheese", "butter", "cream", "qumesht", "bulmet", "laktoz"],
    words: ["milk", "dairy", "lactose", "cheese", "butter", "cream", "yogurt", "yoghurt", "mozzarella", "parmesan", "parmigiano", "ricotta", "mascarpone",
      "feta", "cheddar", "gorgonzola", "burrata", "ghee", "whey", "casein", "custard", "bechamel", "kefir", "creme", "latte", "cappuccino", "macchiato",
      "tiramisu", "gelato", "ice cream", "paneer", "halloumi", "brie", "camembert", "emmental", "gouda", "kashkaval", "kackavall", "pecorino", "provolone",
      "stracciatella", "milkshake", "frappe", "qumesht", "djath", "gjalp", "kos", "ajke", "bulmet", "salep", "sutliash", "trilece"],
  },
  {
    name: "eggs", triggers: ["egg", "eggs", "veze", "vez"],
    words: ["egg", "mayonnaise", "mayo", "aioli", "meringue", "omelet", "frittata", "carbonara", "custard", "hollandaise", "tiramisu", "brioche",
      "pancake", "crepe", "waffle", "veze", "vez", "trilece"],
  },
  {
    name: "gluten", triggers: ["gluten", "wheat", "celiac", "coeliac", "flour", "gluteni", "miell"],
    words: ["gluten", "wheat", "flour", "bread", "pasta", "spaghetti", "penne", "fusilli", "tagliatelle", "linguine", "fettuccine", "ravioli", "tortellini",
      "gnocchi", "lasagna", "lasagne", "noodle", "pizza", "dough", "crust", "barley", "rye", "malt", "couscous", "semolina", "bulgur", "seitan", "breadcrumb",
      "panko", "crouton", "beer", "cracker", "biscuit", "cake", "pastry", "pie", "tortilla", "pita", "pitta", "focaccia", "bun", "sandwich", "toast",
      "croissant", "waffle", "pancake", "crepe", "burek", "byrek", "pite", "baklava", "tiramisu", "brownie", "cookie", "muffin", "donut", "doughnut",
      "brume", "buke", "miell", "fli", "pogac", "lakror", "tempura", "battered", "breaded", "soy sauce"],
  },
  {
    name: "fish", triggers: ["fish", "peshk"],
    words: ["fish", "salmon", "tuna", "cod", "anchov", "sardine", "trout", "sea bass", "seabass", "branzino", "bass", "mackerel", "halibut", "swordfish",
      "hake", "sole", "tilapia", "carp", "caviar", "roe", "fish sauce", "worcestershire", "caesar", "peshk", "levrek", "koran"],
  },
  {
    name: "shellfish and seafood", triggers: ["shellfish", "seafood", "crustacean", "shrimp", "prawn", "fruta deti", "karkalec"],
    words: ["shellfish", "seafood", "crustacean", "shrimp", "prawn", "crab", "lobster", "langoustine", "mussel", "clam", "oyster", "scallop", "squid",
      "calamar", "octopus", "crayfish", "cuttlefish", "fruta deti", "frutti di mare", "karkalec", "midhje", "kallamar", "oktapod"],
  },
  { name: "soy", triggers: ["soy", "soya", "soja"], words: ["soy", "soya", "soja", "tofu", "edamame", "miso", "tempeh", "teriyaki"] },
  { name: "sesame", triggers: ["sesame", "susam"], words: ["sesame", "tahini", "tahina", "hummus", "humus", "halva", "susam"] },
  { name: "mustard", triggers: ["mustard", "mustard"], words: ["mustard", "dijon", "mustarde"] },
  { name: "celery", triggers: ["celery", "selino"], words: ["celery", "celeriac", "selino"] },
  { name: "sulphites", triggers: ["sulphite", "sulfite"], words: ["sulphite", "sulfite", "wine", "vinegar", "dried fruit", "vere"] },
  {
    name: "meat (vegetarian)", triggers: ["vegetarian", "veggie", "no meat", "without meat", "vegjetarian"],
    words: ["meat", "beef", "pork", "chicken", "lamb", "veal", "ham", "bacon", "sausage", "salami", "prosciutto", "pepperoni", "chorizo", "mince",
      "steak", "burger", "turkey", "duck", "goat", "rabbit", "gelatin", "gelatine", "lard", "pancetta", "guanciale", "kebab", "kebap", "qebap", "doner",
      "gyro", "meatball", "qofte", "sujuk", "suxhuk", "mish", "pule", "vic", "derr", "qengj", "proshut", "salsiche", "anchov", "fish", "salmon", "tuna",
      "shrimp", "prawn", "seafood", "squid", "calamar", "octopus", "mussel", "peshk", "broth", "stock", "worcestershire", "caesar"],
  },
];
const VEGAN_EXTRA = ["honey", "mjalt"];

/** Builds word matchers: a word matches at the start of a word ("peanut" matches "peanuts", "peanut butter") */
function matcher(words: string[]) {
  const list = [...new Set(words.map(norm).filter((w) => w.length >= 2))];
  if (!list.length) return null;
  const esc = list.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+"));
  return new RegExp(`(^|[^a-z0-9])(${esc.join("|")})`, "i");
}

/** Everything written about a dish, as one searchable text */
function dishText(d: Dish): string {
  return norm([d.name, d.menuText, d.note, ...d.ingredients.flatMap((i) => [i.name, i.note])].join(" | "));
}

const describe = (d: Dish) => d.ingredients.map((i) => (i.note ? `${i.name} (${i.note})` : i.name)).join(", ");

function toAnswerDish(x: { dish: Dish; menu: string }): AnswerDish {
  return { name: x.dish.name, section: x.dish.section, menu: x.menu, ingredients: describe(x.dish), minutes: x.dish.prepMinutes, note: x.dish.note };
}

// ── Understanding the question ──────────────────────────────────────────────

export interface Intent {
  avoid: string[];
  /** Names of the groups found (for the answer text) */
  avoidGroups: string[];
  contains: string[];
  quickest: boolean;
  /** Dishes named in full in the question */
  dishNames: string[];
  /** Dishes the question seems to be about (a word of their name, e.g. "omelette" for "Omelette with ham") */
  dishGuess: string[];
  list: boolean;
}

const STOP = new Set(["a", "an", "the", "any", "some", "my", "me", "i", "to", "of", "and", "or", "in", "on", "for", "with", "food", "foods", "dish",
  "dishes", "please", "something", "anything", "it", "is", "are", "am", "be", "which", "what", "that", "this", "can", "eat", "have", "has"]);

/** Words right after "allergic to", "without", "no", "free of", "pa" ... */
function wordsAfter(q: string, triggers: RegExp): string[] {
  const out: string[] = [];
  for (const m of q.matchAll(triggers)) {
    const rest = q.slice((m.index ?? 0) + m[0].length).split(/[.?!;]| but | however /)[0];
    for (const part of rest.split(/,| and | or | e | ose |\//)) {
      const w = part.trim().split(" ").filter((x) => x && !STOP.has(x)).slice(0, 3).join(" ");
      if (w.length >= 3) out.push(w.replace(/s$/, ""));
    }
  }
  return out;
}

export function understand(question: string, dishNames: string[]): Intent {
  const q = norm(question);
  const avoid: string[] = [];
  const groups: string[] = [];
  const avoidMode = /allerg|alergji|intoleran|without|free|can ?not eat|can'?t eat|cannot have|can'?t have|avoid|don'?t eat|do not eat|no |vegetarian|vegan|veggie|celiac|coeliac|pa |nuk ha|vegjetarian/.test(q);

  if (avoidMode) {
    for (const g of GROUPS) {
      if (g.triggers.some((t) => new RegExp(`(^|[^a-z])${norm(t)}`).test(q))) { avoid.push(...g.words); groups.push(g.name); }
    }
    if (/vegan/.test(q)) {
      for (const g of GROUPS.filter((g) => ["meat (vegetarian)", "milk and dairy", "eggs", "fish", "shellfish and seafood"].includes(g.name))) avoid.push(...g.words);
      avoid.push(...VEGAN_EXTRA);
      groups.push("animal products (vegan)");
    }
    // Plain words the customer named ("allergic to onion", "without garlic", "pa qepe")
    const named = wordsAfter(q, /allergic to |allergy to |allergies to |allergy:? |intolerant to |without |no |free of |avoid |can'?t eat |cannot eat |don'?t eat |do not eat |alergji (?:nga |ndaj )?|pa |nuk ha /g);
    for (const w of named) {
      if (/^(allerg|thank|problem|one|idea|time|wait)/.test(w)) continue;
      avoid.push(w);
      if (!groups.some((g) => g.includes(w))) groups.push(w);
    }
    const free = [...q.matchAll(/([a-z]+)[- ]free/g)].map((m) => m[1]);
    for (const w of free) { const g = GROUPS.find((x) => x.triggers.includes(w)); if (g) { avoid.push(...g.words); groups.push(g.name); } else { avoid.push(w); groups.push(w); } }
  }

  const contains = !avoidMode ? wordsAfter(q, /with |contain(?:s|ing)? |have (?:any )?|has |me /g).filter((w) => !/^(the |a )/.test(w)) : [];
  const quickest = /quick|fast|shortest|soonest|how long|least time|waiting|wait time|in a hurry|hurry|shpejt|sa kohe|sa zgjat/.test(q);
  const mentioned = dishNames.filter((n) => { const nn = norm(n); return nn.length >= 3 && new RegExp(`(^|[^a-z])${nn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(q); });
  // A word of a dish name, unless the customer used it as an ingredient ("anything with cheese" is not about "Cheese burger")
  const asIngredient = contains.join(" ");
  const guess = mentioned.length ? mentioned : dishNames.filter((n) => norm(n).split(/[^a-z]+/).some((w) =>
    w.length >= 5 && !STOP.has(w) && !asIngredient.includes(w.replace(/s$/, "")) && new RegExp(`(^|[^a-z])${w}`).test(q)));
  const list = /what (can|do) (i|you)|recommend|what is (good|there)|show (me )?(the )?(menu|dishes)|all dishes|menu/.test(q);
  return { avoid: [...new Set(avoid)], avoidGroups: [...new Set(groups)], contains: [...new Set(contains)], quickest, dishNames: mentioned, dishGuess: guess, list };
}

/** Section words for "main dish", "dessert", "starter", "drink" */
const SECTION_HINTS: { q: RegExp; section: RegExp }[] = [
  { q: /main|entree|kryesor/, section: /main|entree|kryesor|grill|pasta|pizza|burger|steak|meat|fish/ },
  { q: /dessert|sweet|embelsir/, section: /dessert|sweet|embelsir|cake/ },
  { q: /starter|appetizer|antipast|meze|paraget/, section: /starter|appetizer|antipast|meze|paraget|salad|soup/ },
  { q: /drink|beverage|pije|coffee|kafe/, section: /drink|beverage|pije|coffee|kafe|bar|wine|beer|juice/ },
  { q: /breakfast|mengjes/, section: /breakfast|mengjes/ },
  { q: /salad|sallat/, section: /salad|sallat/ },
  { q: /soup|sup/, section: /soup|sup/ },
];

// ── The answer ──────────────────────────────────────────────────────────────

const WAITER = "Please confirm with the waiter before you order. They know the kitchen best.";
const ALLERGY_WARNING = "This list only uses the ingredients the kitchen entered. Sauces, oils, toppings or the way food is prepared (shared pans, fryers, traces) may not be listed. If your allergy or condition is serious, please talk to the waiter before you order.";

export function answerQuestion(question: string, items: { dish: Dish; menu: string }[], withoutDetails: number, extra?: Partial<Intent>): Answer {
  const notMentioned = withoutDetails > 0 ? [`${withoutDetails} dish${withoutDetails === 1 ? "" : "es"} on the menu ${withoutDetails === 1 ? "has" : "have"} no details from the kitchen yet, so ${withoutDetails === 1 ? "it is" : "they are"} not included here. Ask the waiter about ${withoutDetails === 1 ? "it" : "them"}.`] : [];
  if (!items.length) {
    return { kind: "empty", title: "The kitchen hasn't added dish details yet", dishes: [], notes: ["So we can't answer questions about the dishes here."], warning: "Please ask the waiter, they will be happy to help." };
  }
  const intent = understand(question, items.map((x) => x.dish.name));
  if (extra?.avoid?.length) { intent.avoid = [...new Set([...intent.avoid, ...extra.avoid])]; }
  if (extra?.avoidGroups?.length) intent.avoidGroups = [...new Set([...intent.avoidGroups, ...extra.avoidGroups])];
  if (extra?.quickest) intent.quickest = true;
  if (extra?.contains?.length && !intent.avoid.length) intent.contains = [...new Set([...intent.contains, ...extra.contains])];

  const q = norm(question);
  const sectionHint = SECTION_HINTS.find((h) => h.q.test(q));
  const inSection = (d: Dish) => !sectionHint || sectionHint.section.test(norm(`${d.section} ${d.name}`));

  // 1. Something to avoid (allergy, diet)
  if (intent.avoid.length) {
    const m = matcher(intent.avoid)!;
    let pool = items;
    if (intent.dishNames.length) pool = items.filter((x) => intent.dishNames.some((n) => norm(n) === norm(x.dish.name)));
    const safe = pool.filter((x) => !m.test(dishText(x.dish)) && inSection(x.dish));
    const left = pool.filter((x) => m.test(dishText(x.dish))).length;
    const what = intent.avoidGroups.length ? intent.avoidGroups.join(", ") : "what you mentioned";
    if (intent.dishNames.length) {
      const hit = pool.filter((x) => m.test(dishText(x.dish)));
      return {
        kind: "avoid",
        title: hit.length
          ? `${hit.map((x) => x.dish.name).join(", ")}: the kitchen's details mention something related to ${what}`
          : `${pool.map((x) => x.dish.name).join(", ")}: nothing related to ${what} in the kitchen's details`,
        dishes: pool.map(toAnswerDish), notes: hit.length ? ["Please don't order it without talking to the waiter."] : [], warning: ALLERGY_WARNING,
      };
    }
    if (intent.quickest) safe.sort((a, b) => (a.dish.prepMinutes ?? 9999) - (b.dish.prepMinutes ?? 9999));
    return {
      kind: "avoid",
      title: safe.length ? `Dishes without ${what}, based on the kitchen's details` : `We couldn't find a dish without ${what} in the kitchen's details`,
      dishes: safe.map(toAnswerDish),
      notes: [
        ...(left ? [`${left} dish${left === 1 ? " was" : "es were"} left out because ${left === 1 ? "its" : "their"} details mention ${what} or something related.`] : []),
        ...(sectionHint ? ["Only dishes from the matching part of the menu are shown."] : []),
        ...notMentioned,
      ],
      warning: ALLERGY_WARNING,
    };
  }

  // 2. A dish by name ("what's in the omelette?")
  if (intent.dishGuess.length && !intent.quickest && !intent.contains.length) {
    const found = items.filter((x) => intent.dishGuess.some((n) => norm(n) === norm(x.dish.name)));
    return { kind: "dish", title: found.length === 1 ? `About ${found[0].dish.name}` : "About these dishes", dishes: found.map(toAnswerDish), notes: [], warning: WAITER };
  }

  // 3. The quickest
  if (intent.quickest) {
    const timed = items.filter((x) => x.dish.prepMinutes && inSection(x.dish)).sort((a, b) => a.dish.prepMinutes! - b.dish.prepMinutes!);
    const untimed = items.filter((x) => !x.dish.prepMinutes && inSection(x.dish)).length;
    if (!timed.length) {
      return { kind: "quickest", title: "The kitchen hasn't added serving times for these dishes yet", dishes: [], notes: notMentioned, warning: "Please ask the waiter how long it takes." };
    }
    return {
      kind: "quickest",
      title: `Quickest ${sectionHint ? "dishes in that part of the menu" : "dishes"}, from the kitchen's times`,
      dishes: timed.slice(0, 5).map(toAnswerDish),
      notes: [
        ...(untimed ? [`${untimed} dish${untimed === 1 ? " has" : "es have"} no serving time yet and ${untimed === 1 ? "is" : "are"} not compared.`] : []),
        "Times are the kitchen's estimate and can be longer when the restaurant is busy.",
      ],
      warning: WAITER,
    };
  }

  // 4. Dishes with something ("anything with chicken?", "does the omelette have cheese?")
  if (intent.contains.length && intent.dishGuess.length) {
    const found = items.filter((x) => intent.dishGuess.some((n) => norm(n) === norm(x.dish.name)));
    return { kind: "dish", title: found.length === 1 ? `About ${found[0].dish.name}` : "About these dishes", dishes: found.map(toAnswerDish), notes: [], warning: WAITER };
  }
  if (intent.contains.length) {
    const m = matcher(intent.contains)!;
    const hits = items.filter((x) => m.test(dishText(x.dish)) && inSection(x.dish));
    return {
      kind: "contains",
      title: hits.length ? `Dishes with ${intent.contains.join(", ")}, from the kitchen's details` : `No dish with ${intent.contains.join(", ")} in the kitchen's details`,
      dishes: hits.map(toAnswerDish), notes: notMentioned, warning: WAITER,
    };
  }

  // 5. Everything
  if (intent.list || sectionHint) {
    const all = items.filter((x) => inSection(x.dish));
    return { kind: "list", title: "Dishes with details from the kitchen", dishes: all.map(toAnswerDish), notes: notMentioned, warning: WAITER };
  }

  return {
    kind: "unknown",
    title: "Sorry, we can only answer questions about the dishes' ingredients and serving times",
    dishes: [],
    notes: ["Try: \"I'm allergic to peanuts\", \"What's in the omelette?\", \"Which main dish comes quickest?\" or \"Vegetarian dishes\"."],
    warning: "For anything else, please ask the waiter.",
  };
}

/** Optional AI help to understand the question (only adds words to avoid / detects the kind, never adds dishes) */
export async function understandWithAI(question: string): Promise<Partial<Intent> | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const prompt = `A restaurant customer asked: """${question.slice(0, 500)}"""
Return JSON only: {"avoid":[...],"avoidGroups":[...],"contains":[...],"quickest":false}
- "avoid": if the customer must or wants to avoid something (allergy, intolerance, diet, religion), list in English lower case EVERY ingredient word that could reveal it in a dish's ingredient list, including derived foods (e.g. for lactose: milk, cheese, butter, cream, yogurt, mozzarella...). Be generous: more words is safer. Otherwise [].
- "avoidGroups": short names of what is avoided, e.g. ["peanuts"], or [].
- "contains": ingredients the customer is looking FOR (not avoiding), or [].
- "quickest": true if they ask what is served fastest / how long it takes.`;
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: prompt }], temperature: 0, max_tokens: 600,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const d = JSON.parse((await res.json())?.choices?.[0]?.message?.content ?? "{}");
    const words = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.trim().toLowerCase()).filter((x) => x.length >= 2 && x.length < 40).slice(0, 80) : []);
    return { avoid: words(d.avoid), avoidGroups: words(d.avoidGroups).slice(0, 5), contains: words(d.contains), quickest: d.quickest === true };
  } catch {
    return null;
  }
}
