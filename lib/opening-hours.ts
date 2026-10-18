// Opening hours on the public menu (More > Opening hours, and questions in Ask about the dishes).
// Uses the viewer's clock, like the rest of the public menu. Special days (Open hours & holidays) replace the weekly hours.

/** A break inside a day: closed from..to (e.g. 12:00 to 16:00 = open 08:00-12:00 and 16:00-20:00) */
export type Break = { from: string; to: string };
export type DayHours = { open?: string; close?: string; closed?: boolean; breaks?: Break[] };
/** One stretch of time the restaurant is open */
export type Range = { open: string; close: string };
export type HoursData = {
  hours: Record<string, DayHours> | null;
  exceptions: { date: string; label: string; closed: boolean; openTime: string | null; closeTime: string | null }[];
  /** The restaurant has a loyalty stamp card */
  loyalty?: boolean;
  /** Wi-Fi password for customers (Settings), or null */
  wifi?: string | null;
  /** Customers can reserve a table online */
  reserve?: boolean;
};
export type Day = { date: Date; closed: boolean; open: string | null; close: string | null; label: string | null; ranges: Range[] };

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const minutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
const hhmm = (n: number) => { const v = ((n % 1440) + 1440) % 1440; return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`; };
const isTime = (t: unknown): t is string => typeof t === "string" && /^\d{1,2}:\d{2}$/.test(t);

/** Opening to closing minus the breaks, in minutes from midnight (closing after midnight goes past 1440) */
export function dayMinutes(open: string, close: string, breaks?: Break[]): [number, number][] {
  const o = minutes(open);
  let c = minutes(close);
  if (c <= o) c += 1440;
  const cuts = (breaks ?? []).filter((b) => isTime(b.from) && isTime(b.to)).map((b) => {
    let f = minutes(b.from), t = minutes(b.to);
    if (f < o) f += 1440;
    if (t < f) t += 1440;
    return [Math.max(f, o), Math.min(t, c)] as [number, number];
  }).filter(([f, t]) => t > f).sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let at = o;
  for (const [f, t] of cuts) { if (f > at) out.push([at, f]); at = Math.max(at, t); }
  if (c > at) out.push([at, c]);
  return out;
}
export function dayRanges(open: string, close: string, breaks?: Break[]): Range[] {
  return dayMinutes(open, close, breaks).map(([a, b]) => ({ open: hhmm(a), close: hhmm(b) }));
}
/** "08:00 – 12:00, 16:00 – 20:00" */
export const rangesText = (r: Range[], sep = ", ") => r.map((x) => `${x.open} – ${x.close}`).join(sep);

/** Today and the next 7 days, with special days (Holiday Hours) taking the place of the weekly hours */
export function nextDays(data: HoursData, from = new Date()): Day[] {
  return Array.from({ length: 8 }, (_, i) => {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const special = data.exceptions.find((e) => e.date === ymd(d));
    const week = data.hours?.[WEEKDAYS[d.getDay()]];
    const closed = special ? special.closed || !special.openTime || !special.closeTime : !week || !!week.closed || !week.open || !week.close;
    const open = special && !special.closed ? special.openTime : week?.open;
    const close = special && !special.closed ? special.closeTime : week?.close;
    // Breaks belong to the weekly hours, a special day is one stretch
    const ranges = closed || !open || !close ? [] : dayRanges(open, close, special ? [] : week?.breaks);
    return { date: d, closed: closed || !ranges.length, open: open ?? null, close: close ?? null, label: special?.label ?? null, ranges };
  });
}

/** Open right now? (also handles closing after midnight, e.g. 18:00 to 02:00) */
export function openNow(data: HoursData, now = new Date()): boolean {
  return !!openUntil(data, now);
}

/** Minutes of a day's open stretches (from the day's own midnight) */
function stretches(d: Day): [number, number][] {
  if (d.closed || !d.ranges.length) return [];
  return d.ranges.map((r) => { const a = minutes(r.open); let b = minutes(r.close); if (b <= a) b += 1440; return [a, b] as [number, number]; })
    .map(([a, b], i, all) => (i > 0 && a < all[i - 1][0] ? [a + 1440, b + 1440] as [number, number] : [a, b] as [number, number]));
}

/** When it closes (or starts a break) if it is open now ("23:00"), or null when closed */
export function openUntil(data: HoursData, now: Date): string | null {
  const n = now.getHours() * 60 + now.getMinutes();
  const [yesterday, today] = nextDays(data, new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  for (const [a, b] of stretches(today)) if (n >= a && n < b) return hhmm(b);
  // Still open from yesterday evening (closing after midnight)
  for (const [a, b] of stretches(yesterday)) if (b > 1440 && n + 1440 >= a && n + 1440 < b) return hhmm(b);
  return null;
}

/** When it opens next: { day: 0 = today, time } or null in the next 7 days */
export function nextOpening(data: HoursData, now = new Date()): { day: number; time: string; afterBreak: boolean } | null {
  const n = now.getHours() * 60 + now.getMinutes();
  const days = nextDays(data, now);
  for (let i = 0; i < days.length; i++) {
    const st = stretches(days[i]);
    for (let j = 0; j < st.length; j++) {
      if (i === 0 && st[j][0] <= n) continue;
      return { day: i, time: hhmm(st[j][0]), afterBreak: i === 0 && j > 0 && st[j - 1][1] <= n };
    }
  }
  return null;
}

/** For the badge on the menu: "Open · Closes 23:00", "Break · Opens again at 16:00", "Closed · Opens Tomorrow 08:00" */
export function statusNow(data: HoursData, now = new Date()): { isOpen: boolean; text: string } | null {
  if (!data.hours && !data.exceptions.length) return null;
  const until = openUntil(data, now);
  const today = nextDays(data, now)[0];
  if (until) {
    const more = stretches(today).some(([a]) => a > now.getHours() * 60 + now.getMinutes());
    return { isOpen: true, text: more ? `Open · Break at ${until}` : `Open · Closes ${until}` };
  }
  const next = nextOpening(data, now);
  if (!next) return { isOpen: false, text: "Closed" };
  if (next.day === 0) return { isOpen: false, text: next.afterBreak ? `Break · Opens again at ${next.time}` : `Closed · Opens at ${next.time}` };
  const name = next.day === 1 ? "Tomorrow" : new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(nextDays(data, now)[next.day].date);
  return { isOpen: false, text: `Closed · Opens ${name} ${next.time}` };
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
    hours: days[i].closed ? "Closed" : rangesText(days[i].ranges),
    label: days[i].label, today: i === 0,
  });
  const until = openUntil(data, now);
  const onBreak = !until && !!nextOpening(data, now)?.afterBreak;
  const nowLine = until ? `Open now, until ${until}.` : onBreak ? "On a break right now." : "Closed right now.";
  const nowTitle = until ? `Open now, until ${until}` : onBreak ? "On a break right now" : "Closed right now";

  // When it opens next (today later, after a break, or another day)
  const nextOpen = () => {
    const x = nextOpening(data, now);
    if (!x) return "There are no opening hours for the next 7 days.";
    if (x.day === 0) return x.afterBreak ? `It's a break now, it opens again at ${x.time}.` : `It opens today at ${x.time}.`;
    return `It opens ${x.day === 1 ? "tomorrow" : `on ${weekday.format(days[x.day].date)}`} at ${x.time}.`;
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
        : days[one].closed ? `${onDay(one)} the restaurant is closed` : `${onDay(one)}: open ${rangesText(days[one].ranges, " and ")}`,
      rows: picked.map(row),
      notes: [...picked.flatMap(special), ...(picked.includes(0) ? [nowLine] : [])],
    };
  }

  // Open now? / Today / When do you close?
  if (/\bnow\b|right now|still open|currently|tonight|today|\bsot\b|tani|are you open|is it open|jeni hapur|eshte hapur|when do you (close|open)|what time do you (close|open)|until when|till when|how late|deri ne sa|deri kur/.test(q)) {
    return {
      kind: "hours",
      title: nowTitle,
      rows: [row(0)],
      notes: [...special(0), ...(until ? [] : [nextOpen()])],
    };
  }

  // The whole week
  return {
    kind: "hours",
    title: nowTitle,
    rows: days.map((_, i) => row(i)),
    notes: until ? [] : [nextOpen()],
  };
}
