import type { NextRequest } from "next/server";
import { manageRoutes } from "@/lib/service-manage-routes";

// Room service for staff. The code is in lib/service-manage-routes.ts.
const r = manageRoutes("room");
type Ctx = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, ctx: Ctx) { return r.GET(req, ctx); }
export async function POST(req: NextRequest, ctx: Ctx) { return r.POST(req, ctx); }
