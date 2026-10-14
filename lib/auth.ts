import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  // Without its own secret anyone who knows the default could make a valid login cookie
  console.warn("[auth] JWT_SECRET is not set. Set a long random value in the Vercel environment variables.");
}
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "skano-menu-secret-key"
);

/** "Keep me signed in": the login lasts 30 days (renewed while the user keeps using the dashboard) */
export const REMEMBER_SECONDS = 60 * 60 * 24 * 30;
/** Not ticked: the cookie ends when the browser is closed, and the login lasts at most 12 hours */
export const SHORT_SECONDS = 60 * 60 * 12;

export interface JWTPayload {
  id: string;
  email: string;
  name: string;
  role: string;
  restaurantId?: string;
  /** Logged in with "Keep me signed in" */
  remember?: boolean;
  /** Issued at (seconds, set by signToken) */
  iat?: number;
}

export async function signToken(payload: JWTPayload): Promise<string> {
  const { iat: _iat, exp: _exp, ...claims } = payload as JWTPayload & { exp?: number };
  void _iat; void _exp;
  const seconds = payload.remember ? REMEMBER_SECONDS : SHORT_SECONDS;
  return new SignJWT(claims as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + seconds)
    .sign(JWT_SECRET);
}

/** Cookie settings for the login cookie. Without "remember" it's a browser-session cookie (gone when the browser closes) */
export function sessionCookieOptions(remember: boolean) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    ...(remember ? { maxAge: REMEMBER_SECONDS } : {}),
  };
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function getSessionFromRequest(req: NextRequest): Promise<JWTPayload | null> {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}
