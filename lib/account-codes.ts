// Codes sent by email for "My account" (server only).
//   "me":    sent to the email you have now. Proves it's you, instead of your current password.
//   "email": sent to the new email. Proves the new address is right and yours.
// A code has 6 digits and works for 5 minutes. Nothing is saved: the browser gets a signed "ticket"
// that only says which code was sent, for whom and until when. The code itself is never in it, only a keyed hash.
// The ticket stops working when the password or the email changes, and after 5 wrong tries.

import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";

export type CodePurpose = "me" | "email";
export const CODE_MINUTES = 5;

const secretText = () => process.env.JWT_SECRET || "skano-menu-secret-key";
const key = () => new TextEncoder().encode(`${secretText()}|account-code`);
const digest = (code: string, uid: string, purpose: CodePurpose, target: string, lock: string) =>
  createHmac("sha256", secretText()).update(`${code}|${uid}|${purpose}|${target.toLowerCase()}|${lock}`).digest("hex");

/** Part of the password hash: a ticket stops working once the password changes */
const lockOf = (passwordHash: string, email: string) => createHmac("sha256", secretText()).update(`${passwordHash}|${email.toLowerCase()}`).digest("hex").slice(0, 16);

export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export async function makeTicket(user: { id: string; password: string; email: string }, purpose: CodePurpose, target: string, code: string) {
  const exp = Math.floor(Date.now() / 1000) + CODE_MINUTES * 60;
  const ticket = await new SignJWT({ u: user.id, p: purpose, t: target.toLowerCase(), h: digest(code, user.id, purpose, target, lockOf(user.password, user.email)) })
    .setProtectedHeader({ alg: "HS256" }).setExpirationTime(exp).setJti(newCode() + Date.now().toString(36)).sign(key());
  return { ticket, expiresAt: new Date(exp * 1000).toISOString() };
}

// Wrong tries per ticket (best effort, per server)
const tries = new Map<string, number>();

export type CodeCheck = "ok" | "expired" | "wrong" | "too-many";
export async function checkCode(user: { id: string; password: string; email: string }, purpose: CodePurpose, target: string, ticket: unknown, code: unknown): Promise<CodeCheck> {
  if (typeof ticket !== "string" || typeof code !== "string") return "wrong";
  let payload: Record<string, unknown>;
  try { payload = (await jwtVerify(ticket, key())).payload as Record<string, unknown>; } catch { return "expired"; }
  if (payload.u !== user.id || payload.p !== purpose || payload.t !== target.toLowerCase()) return "wrong";
  const id = String(payload.jti ?? "");
  if ((tries.get(id) ?? 0) >= 5) return "too-many";
  const want = Buffer.from(String(payload.h ?? ""), "hex");
  const got = Buffer.from(digest(code.replace(/\s+/g, ""), user.id, purpose, target, lockOf(user.password, user.email)), "hex");
  if (want.length === got.length && timingSafeEqual(want, got)) return "ok";
  tries.set(id, (tries.get(id) ?? 0) + 1);
  if (tries.size > 5000) for (const k of [...tries.keys()].slice(0, 1000)) tries.delete(k);
  return "wrong";
}

export const codeError: Record<Exclude<CodeCheck, "ok">, string> = {
  expired: "This code has expired. Ask for a new one.",
  wrong: "This code is not right",
  "too-many": "Too many wrong tries. Ask for a new code.",
};

// Not too many emails: one per 45 seconds and 6 per hour, per person
const sent = new Map<string, number[]>();
export function tooManyCodes(userId: string, now = Date.now()): string | null {
  const list = (sent.get(userId) ?? []).filter((t) => now - t < 3600_000);
  if (list.length && now - list[list.length - 1] < 45_000) return "We just sent a code. Wait a moment before asking for another.";
  if (list.length >= 6) return "You asked for a lot of codes. Try again in an hour.";
  list.push(now); sent.set(userId, list);
  return null;
}
