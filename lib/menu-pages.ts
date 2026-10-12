// The uploaded ("scanned") menu is stored in Restaurant.menuPdfUrl.
// It can hold:
//   - a single URL to a PDF            -> "https://.../menu.pdf"
//   - a single URL to an image (legacy) -> "https://.../menu.jpg"
//   - a JSON array of image URLs        -> '["https://.../1.jpg","https://.../2.jpg"]'
// Keeping it in one column means no database migration is needed.

export type MenuPages =
  | { kind: "pdf"; url: string }
  | { kind: "images"; urls: string[] };

export const MAX_MENU_PAGES = 40;

export function parseMenuPages(value: string | null | undefined): MenuPages | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) {
        const urls = arr.filter((u): u is string => typeof u === "string" && u.length > 0);
        return urls.length ? { kind: "images", urls } : null;
      }
    } catch {
      return null;
    }
    return null;
  }

  if (isPdfUrl(trimmed)) return { kind: "pdf", url: trimmed };
  return { kind: "images", urls: [trimmed] };
}

export function serializeImagePages(urls: string[]): string | null {
  return urls.length ? JSON.stringify(urls) : null;
}

export function allMenuFileUrls(pages: MenuPages | null): string[] {
  if (!pages) return [];
  return pages.kind === "pdf" ? [pages.url] : pages.urls;
}

export function isPdfUrl(url: string): boolean {
  return url.split("?")[0].toLowerCase().endsWith(".pdf");
}
