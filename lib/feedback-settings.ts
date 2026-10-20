// Customer feedback can be turned on per restaurant (Customer Feedback page).
// Stored in Restaurant.themeConfig as { feedbackEnabled: true }. Missing or false = off.
// Every restaurant starts with it off (also the ones made before this rule), the owner turns it on.

export function feedbackEnabled(themeConfig: string | null | undefined): boolean {
  try {
    const v = JSON.parse(themeConfig || "{}");
    return !!(v && typeof v === "object" && v.feedbackEnabled === true);
  } catch {
    return false;
  }
}

/** themeConfig of a new restaurant: customer feedback off until the owner turns it on */
export const NEW_RESTAURANT_THEME = JSON.stringify({ feedbackEnabled: false });

/** themeConfig with the switch set, keeping everything else in it */
export function withFeedbackEnabled(themeConfig: string | null | undefined, on: boolean): string {
  let v: Record<string, unknown> = {};
  try {
    const p = JSON.parse(themeConfig || "{}");
    if (p && typeof p === "object" && !Array.isArray(p)) v = p;
  } catch { /* start fresh */ }
  v.feedbackEnabled = on;
  return JSON.stringify(v);
}
