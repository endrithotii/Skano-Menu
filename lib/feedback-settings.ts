// Customer feedback can be turned off per restaurant (Customer Feedback page).
// Stored in Restaurant.themeConfig as { feedbackEnabled: false }. Missing = on.
// New restaurants start with it off (NEW_RESTAURANT_THEME), the owner turns it on on the Feedback page.
// Restaurants made before that keep what they had.

export function feedbackEnabled(themeConfig: string | null | undefined): boolean {
  try {
    const v = JSON.parse(themeConfig || "{}");
    return !(v && typeof v === "object" && v.feedbackEnabled === false);
  } catch {
    return true;
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
  if (on) delete v.feedbackEnabled;
  else v.feedbackEnabled = false;
  return JSON.stringify(v);
}
