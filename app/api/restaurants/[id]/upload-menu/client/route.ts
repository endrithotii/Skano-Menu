import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { forbidUnless } from "@/lib/staff-access";

// Direct uploads from the browser to Vercel Blob, for files bigger than Vercel's ~4.5MB request limit
// (a PDF can be up to 40MB). The browser asks this route for a short-lived upload token, then sends the
// file straight to storage. The file stays "staged" until the menu is saved, like every other upload.
// GET  -> { enabled } (false in local development without BLOB_READ_WRITE_TOKEN: use the normal upload)
// POST -> handleUpload (token for the owner, only for this restaurant's menu file names)

const MAX_DIRECT_UPLOAD = 40 * 1024 * 1024; // 40MB
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

type Params = { params: Promise<{ id: string }> };

export async function GET() {
  return NextResponse.json({ enabled: !!process.env.BLOB_READ_WRITE_TOKEN, maxBytes: MAX_DIRECT_UPLOAD });
}

export async function POST(req: NextRequest, { params }: Params) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Direct uploads are not set up" }, { status: 501 });
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  // Only the owner gets a token (the "upload completed" callback comes from Vercel and is signed)
  let restaurantId = "";
  if (body.type === "blob.generate-client-token") {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const r = await prisma.restaurant.findFirst({ where: { OR: [{ id }, { slug: id }] }, select: { id: true, ownerId: true } });
    if (!r) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    { const denied = await forbidUnless(session, r, ["menu.edit", "menu.live", "design.edit"]); if (denied) return denied; }
    restaurantId = r.id;
  }

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        // Same naming as the normal upload, so the file counts as this restaurant's (see isOwnMenuUpload)
        if (!restaurantId || !new RegExp(`^menus/menu-${restaurantId}-[\\w-]+\\.(pdf|jpe?g|png|webp)$`, "i").test(pathname)) {
          throw new Error("Invalid file name");
        }
        return { allowedContentTypes: ALLOWED, maximumSizeInBytes: MAX_DIRECT_UPLOAD, addRandomSuffix: false };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[POST /api/restaurants/[id]/upload-menu/client]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 400 });
  }
}
