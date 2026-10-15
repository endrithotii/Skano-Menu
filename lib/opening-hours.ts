// Opening hours on the public menu (More > Opening hours, and questions in Ask about the dishes).
// Uses the viewer's clock, like the rest of the public menu. Special days (Open hours & holidays) replace the weekly hours.

export type DayHours = { open?: string; close?: string; closed?: boolean };
export type HoursData = {
  hours: Record<string, DayHours> | null;
  exceptions: { date: string; label: string; closed: boolean; openTime: string | null; closeTime: string | null }[];
  /** The restaurant has a loyalty stamp card */
  loyalty?: boolean;
  /** Wi-Fi password for customers (Settings), or null */
  wifi?: string | null;
};
export type Day = { date: Date; closed: boolean; open: string | null; close: string | null; label: string | null };

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const minutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };

/** Today and the next 7 days, with special days (Holiday Hours) taking the place of the weekly hours */
export function nextDays(data: HoursData, from = new Date()): Day[] {
  return Array.from({ length: 8 }, (_, i) => {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const special = data.exceptions.find((e) => e.date === ymd(d));
    const week = data.hours?.[WEEKDAYS[d.getDay()]];
    const closed = special ? special.closed || !special.openTime || !special.closeTime : !week || !!week.closed || !week.open || !week.close;
    const open = special && !special.closed ? special.openTime : week?.open;
    const close = special && !special.closed ? special.closeTime : week?.close;
    return { date: d, closed, open: open ?? null, close: close ?? null, label: special?.label ?? null };
  });
}

/** Open right now? (also handles closing after midnight, e.g. 18:00 to 02:00) */
export function openNow(data: HoursData, now = new Date()): boolean {
  return !!openUntil(data, now);
}

/** When it closes if it is open now ("23:00"), or null when closed */
function openUntil(data: HoursData, now: Date): string | null {
  const n = now.getHours() * 60 + now.getMinutes();
  const [yesterday, today] = nextDays(data, new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  if (!today.closed && today.open && today.close) {
    const o = minutes(today.open), c = minutes(today.close);
    if (c > o ? n >= o && n < c : n >= o) return today.close;
  }
  if (!yesterday.closed && yesterday.open && yesterday.close && minutes(yesterday.close) <= minutes(yesterday.open) && n < minutes(yesterday.close)) return yesterday.close;
  return null;
}

// ── Wi-Fi (Ask about the dishes) ────────────────────────────────────────────

/** "What's the wifi password?", "a keni wifi?", "internet", "fjalekalimi" */
export function isWifiQuestion(question: string): boolean {
  const q = question.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return /wi-?fi|wireless|internet|\bwlan\b|hotspot|password|passcode|fjalekalim|\bpass\b|\bnet\b/.test(q);
}

// ── Questions about the hours (Ask about the dishes) ────────────────────────

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/** "Are you open now?", "opening hours", "what time do you close?", "a jeni hapur te dielen?", "orari" */
export function isHoursQuestion(question: string): boolean {
  const q = norm(question);
  if (/allerg|intoleran|vegetarian|vegan|gluten|ingredient|contain|price|cost|euro|€|\$|cheap|budget|dish|starter|dessert|main course|serv(ed|e) (in|quick)|how long (does|will) (the|it|my)|what'?s in|what is in|made (of|with)|\bthe [a-z]+ (have|has)\b/.test(q)) return false;
  return /\bopen(?!-)|\bclos(e|ed|es|ing)\b|opening|hours\b|what time|till when|until when|how late|schedule|holiday|\borari|hapur|mbyll|\bhapeni|\bhapet|deri ne sa|deri kur|sa jeni/.test(q);
}

const DAY_WORDS: [RegExp, number][] = [
  [/sunday|\bdiel/, 0], [/monday|\bhene/, 1], [/tuesday|\bmarte/, 2], [/wednesday|merkur/, 3],
  [/thursday|\benjte/, 4], [/friday|\bpremte/, 5], [/saturday|shtun/, 6],
];

export interface HoursRow { day: string; hours: string; label: string | null; today: boolean }
export interface HoursAnswer { kind: "hours"; title: string; rows: HoursRow[]; notes: string[] }

/** Answers a question about the hours from the restaurant's hours and special days only */
export function answerHours(question: string, data: HoursData | null, now = new Date()): HoursAnswer {
  if (!data?.hours && !data?.exceptions.length) {
    return { kind: "hours", title: "The restaurant hasn't added its opening hours here", rows: [], notes: ["Please ask the waiter."] };
  }
  const q = norm(question);
  const days = nextDays(data, now);
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "long" });
  const short = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
  const dayName = (i: number) => (i === 0 ? "Today" : i === 1 ? "Tomorrow" : weekday.format(days[i].date));
  const onDay = (i: number) => (i <= 1 ? dayName(i) : `On ${dayName(i)}`);
  const row = (i: number): HoursRow => ({
    day: `${dayName(i)} · ${short.format(days[i].date)}`,
    hours: days[i].closed ? "Closed" : `${days[i].open} – ${days[i].close}`,
    label: days[i].label, today: i === 0,
  });
  const until = openUntil(data, now);
  const nowLine = until ? `Open now, until ${until}.` : "Closed right now.";

  // When it opens next (today later, or another day)
  const nextOpen = () => {
    const n = now.getHours() * 60 + now.getMinutes();
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      if (d.closed || !d.open) continue;
      if (i === 0 && minutes(d.open) <= n) continue;
      return i === 0 ? `It opens today at ${d.open}.` : `It opens ${i === 1 ? "tomorrow" : `on ${weekday.format(d.date)}`} at ${d.open}.`;
    }
    return "There are no opening hours for the next 7 days.";
  };

  // A day asked for: tomorrow, a weekday, the weekend
  const asked: number[] = [];
  if (/tomorrow|\bneser/.test(q)) asked.push(1);
  for (const [re, wd] of DAY_WORDS) if (re.test(q)) asked.push(days.findIndex((d) => d.date.getDay() === wd));
  if (/weekend|fundjav/.test(q)) for (const wd of [6, 0]) asked.push(days.findIndex((d) => d.date.getDay() === wd));
  const picked = [...new Set(asked.filter((i) => i >= 0))].sort((a, b) => a - b);
  const special = (i: number) => (days[i].label ? [`${dayName(i)} is a special day: ${days[i].label}.`] : []);

  if (picked.length) {
    const one = picked.length === 1 ? picked[0] : null;
    return {
      kind: "hours",
      title: one === null ? "Opening hours on those days"
        : days[one].closed ? `${onDay(one)} the restaurant is closed` : `${onDay(one)}: open ${days[one].open} – ${days[one].close}`,
      rows: picked.map(row),
      notes: [...picked.flatMap(special), ...(picked.includes(0) ? [nowLine] : [])],
    };
  }

  // Open now? / Today / When do you close?
  if (/\bnow\b|right now|still open|currently|tonight|today|\bsot\b|tani|are you open|is it open|jeni hapur|eshte hapur|when do you (close|open)|what time do you (close|open)|until when|till when|how late|deri ne sa|deri kur/.test(q)) {
    return {
      kind: "hours",
      title: until ? `Open now, until ${until}` : "Closed right now",
      rows: [row(0)],
      notes: [...special(0), ...(until ? [] : [nextOpen()])],
    };
  }

  // The whole week
  return {
    kind: "hours",
    title: until ? `Open now, until ${until}` : "Closed right now",
    rows: days.map((_, i) => row(i)),
    notes: until ? [] : [nextOpen()],
  };
}
