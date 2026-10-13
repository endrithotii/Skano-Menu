import { NextRequest, NextResponse } from "next/server";
import { extname } from "path";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  MAX_MENU_PAGES,
  allMenuFileUrls,
  parseMenuPages,
  serializeImagePages,
} from "@/lib/menu-pages";
import { deleteMenuFile, isOwnMenuUpload, saveMenuFile } from "@/lib/menu-files";
import { isFileInUse, recordBookVersion, recordLiveMenu } from "@/lib/menu-history";

// Note: on Vercel a single request body is capped at ~4.5MB, so the dashboard
// compresses photos before upload and sends them one at a time.
const MAX_SIZE = 20 * 1024 * 1024; // 20MB
const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_TYPES = ["application/pdf", ...IMAGE_TYPES];
const ALLOWED_EXTS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

type Params = { params: Promise<{ id: string }> };

async function loadAuthorized(req: NextRequest, params: Params["params"]) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { id: idOrSlug } = await params;

  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, ownerId: true, menuPdfUrl: true, menuPdfName: true, updatedAt: true },
  });

  if (!restaurant) {
    return { error: NextResponse.json({ error: "Restaurant not found" }, { status: 404 }) };
  }

  if (session.role !== "SUPER_ADMIN" && restaurant.ownerId !== session.id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { restaurant };
}

function photosName(count: number) {
  return `${count} photo${count === 1 ? "" : "s"}`;
}

async function saveImagePages(restaurantId: string, urls: string[]) {
  const menuPdfUrl = serializeImagePages(urls);
  const name = urls.length ? photosName(urls.length) : null;
  await recordBookVersion(restaurantId, menuPdfUrl, name);
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { menuPdfUrl, menuPdfName: name },
  });
  return NextResponse.json({ menuPdfUrl, name });
}

// POST  form-data: file, mode = "replace" (default) | "append" | "stage"
//   stage         -> only stores the file and returns its url (menu unchanged until PUT)
//   PDF          -> replaces whatever menu was there
//   image+replace -> menu becomes just this photo
//   image+append  -> photo is added as the next page
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadAuthorized(req, params);
    if (auth.error) return auth.error;
    const restaurant = auth.restaurant;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const rawMode = formData.get("mode");
    const mode = rawMode === "append" ? "append" : rawMode === "stage" ? "stage" : "replace";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 20MB." },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: PDF, JPG, PNG, WEBP." },
        { status: 400 }
      );
    }

    const ext = extname(file.name).toLowerCase() || (file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : ".jpg");
    if (!ALLOWED_EXTS.includes(ext)) {
      return NextResponse.json(
        { error: "Invalid file extension." },
        { status: 400 }
      );
    }

    const current = parseMenuPages(restaurant.menuPdfUrl);
    const isImage = IMAGE_TYPES.includes(file.type);

    // Stage: store the file but don't change the menu until the dashboard saves (PUT)
    if (mode === "stage") {
      const url = await saveMenuFile(file, restaurant.id, ext);
      return NextResponse.json({ url, name: file.name, kind: isImage ? "image" : "pdf" });
    }

    if (isImage && mode === "append" && current?.kind === "images") {
      if (current.urls.length >= MAX_MENU_PAGES) {
        return NextResponse.json(
          { error: `A menu can have at most ${MAX_MENU_PAGES} pages.` },
          { status: 400 }
        );
      }
      const url = await saveMenuFile(file, restaurant.id, ext);
      return saveImagePages(restaurant.id, [...current.urls, url]);
    }

    // Replace: the old menu stays in the history
    await recordLiveMenu(restaurant);
    const url = await saveMenuFile(file, restaurant.id, ext);

    if (isImage) {
      return saveImagePages(restaurant.id, [url]);
    }

    await recordBookVersion(restaurant.id, url, file.name);
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { menuPdfUrl: url, menuPdfName: file.name },
    });
    return NextResponse.json({ menuPdfUrl: url, name: file.name });
  } catch (error) {
    console.error("[POST /api/restaurants/[id]/upload-menu]", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT  json: { menuPdfUrl: string | null, menuPdfName?: string | null }
// Saves the whole uploaded menu at once (used by the dashboard Save button).
// Every file must be one this restaurant uploaded (or part of a saved version).
// The previous menu stays in the history, so its files are kept.
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadAuthorized(req, params);
    if (auth.error) return auth.error;
    const restaurant = auth.restaurant;

    const body = await req.json().catch(() => null);
    if (!body || !("menuPdfUrl" in body)) {
      return NextResponse.json({ error: "menuPdfUrl is required" }, { status: 400 });
    }
    const raw: unknown = body.menuPdfUrl;
    if (raw !== null && typeof raw !== "string") {
      return NextResponse.json({ error: "Invalid menu" }, { status: 400 });
    }

    const next = parseMenuPages(raw);
    if (raw && !next) {
      return NextResponse.json({ error: "Invalid menu" }, { status: 400 });
    }
    const current = parseMenuPages(restaurant.menuPdfUrl);
    const currentUrls = allMenuFileUrls(current);
    const nextUrls = allMenuFileUrls(next);

    if (nextUrls.length > MAX_MENU_PAGES) {
      return NextResponse.json({ error: `A menu can have at most ${MAX_MENU_PAGES} pages.` }, { status: 400 });
    }
    const foreign = nextUrls.find((u) => !currentUrls.includes(u) && !isOwnMenuUpload(u, restaurant.id));
    // Keep what is live right now in the history before replacing it
    await recordLiveMenu(restaurant);
    if (foreign) {
      return NextResponse.json({ error: "Menu contains a file that was not uploaded here" }, { status: 400 });
    }

    let menuPdfUrl: string | null = null;
    let name: string | null = null;
    if (next?.kind === "pdf") {
      menuPdfUrl = next.url;
      name = typeof body.menuPdfName === "string" && body.menuPdfName ? body.menuPdfName : "Menu.pdf";
    } else if (next?.kind === "images") {
      menuPdfUrl = serializeImagePages(next.urls);
      name = photosName(next.urls.length);
    }

    await recordBookVersion(restaurant.id, menuPdfUrl, name);
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { menuPdfUrl, menuPdfName: name },
    });

    return NextResponse.json({ menuPdfUrl, name });
  } catch (error) {
    console.error("[PUT /api/restaurants/[id]/upload-menu]", error);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}

// PATCH  json: { order: string[] }  -> reorder photo pages
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadAuthorized(req, params);
    if (auth.error) return auth.error;
    const restaurant = auth.restaurant;

    const body = await req.json().catch(() => null);
    const order: unknown = body?.order;
    const current = parseMenuPages(restaurant.menuPdfUrl);

    if (current?.kind !== "images" || !Array.isArray(order)) {
      return NextResponse.json({ error: "Nothing to reorder" }, { status: 400 });
    }

    const same =
      order.length === current.urls.length &&
      order.every((u) => typeof u === "string" && current.urls.includes(u)) &&
      new Set(order).size === order.length;

    if (!same) {
      return NextResponse.json({ error: "Order must contain the existing pages" }, { status: 400 });
    }

    await recordLiveMenu(restaurant);
    return saveImagePages(restaurant.id, order as string[]);
  } catch (error) {
    console.error("[PATCH /api/restaurants/[id]/upload-menu]", error);
    return NextResponse.json({ error: "Reorder failed" }, { status: 500 });
  }
}

// DELETE ?staged=url -> delete an uploaded file that was never saved into the menu
// DELETE            -> take the uploaded menu off (it stays in the history)
// DELETE ?index=n   -> remove one photo page
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadAuthorized(req, params);
    if (auth.error) return auth.error;
    const restaurant = auth.restaurant;

    const current = parseMenuPages(restaurant.menuPdfUrl);
    const indexParam = req.nextUrl.searchParams.get("index");
    const staged = req.nextUrl.searchParams.get("staged");

    // Discarded upload that was never saved into the menu
    if (staged !== null) {
      if (!isOwnMenuUpload(staged, restaurant.id) || (await isFileInUse(restaurant.id, restaurant.menuPdfUrl, staged))) {
        return NextResponse.json({ error: "Not a discardable upload" }, { status: 400 });
      }
      await deleteMenuFile(staged);
      return NextResponse.json({ success: true });
    }

    if (indexParam !== null && current?.kind === "images") {
      const index = Number(indexParam);
      if (!Number.isInteger(index) || index < 0 || index >= current.urls.length) {
        return NextResponse.json({ error: "Invalid page" }, { status: 400 });
      }
      const remaining = current.urls.filter((_, i) => i !== index);
      await recordLiveMenu(restaurant);
      return saveImagePages(restaurant.id, remaining);
    }

    // Removing the live menu keeps it in the history
    await recordLiveMenu(restaurant);
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { menuPdfUrl: null, menuPdfName: null },
    });

    return NextResponse.json({ success: true, menuPdfUrl: null, name: null });
  } catch (error) {
    console.error("[DELETE /api/restaurants/[id]/upload-menu]", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
