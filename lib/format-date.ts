// Fixed, locale-independent date formats, e.g. "13 Oct 2026" and "13 Oct 2026, 21:40".
// (Intl's en-GB output differs between runtimes, e.g. "Sept" vs "Sep".)

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `utc` = format in UTC (server side), otherwise in the viewer's local time */
export function formatDay(input: Date | string, utc = false): string {
  const d = new Date(input);
  const day = utc ? d.getUTCDate() : d.getDate();
  const month = utc ? d.getUTCMonth() : d.getMonth();
  const year = utc ? d.getUTCFullYear() : d.getFullYear();
  return `${day} ${MONTHS[month]} ${year}`;
}

export function formatDayTime(input: Date | string): string {
  const d = new Date(input);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDay(d)}, ${hh}:${mm}`;
}

export function defaultMenuName(restaurantName: string | null | undefined, date: Date = new Date(), utc = false): string {
  const name = (restaurantName || "").trim();
  return name ? `${name}'s menu - ${formatDay(date, utc)}` : `Menu - ${formatDay(date, utc)}`;
}
