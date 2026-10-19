import type { NextRequest } from "next/server";
import { guestRoutes } from "@/lib/service-guest-routes";

// Table ordering for guests (public). The code is in lib/service-guest-routes.ts.
const r = guestRoutes("table");
type Ctx = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, ctx: Ctx) { return r.GET(req, ctx); }
export async function POST(req: NextRequest, ctx: Ctx) { return r.POST(req, ctx); }
