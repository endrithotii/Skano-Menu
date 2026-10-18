import { notFound, permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/db";

// Old QR codes and links of skano.menu: /<username> and /<username>/<menu or language>.
// They open the restaurant's menu here (/r/<slug>). The pages of this app (dashboard, login, ...) come first.

export const dynamic = "force-dynamic";

export default async function LegacyLink({ params }: { params: Promise<{ legacy: string; rest?: string[] }> }) {
  const { legacy } = await params;
  const slug = decodeURIComponent(legacy).trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug || slug.length > 80) notFound();
  const r = await prisma.restaurant.findFirst({ where: { slug }, select: { slug: true } }).catch(() => null);
  if (!r) notFound();
  permanentRedirect(`/r/${r.slug}`);
}
