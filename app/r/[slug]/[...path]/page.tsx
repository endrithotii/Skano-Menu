"use client";

import { use } from "react";
import { MenuTreePage } from "@/components/menu-tree-view";

// Deeper pages of a restaurant's menu tree, e.g. /r/aroma/menu-shqip/a-la-carte
export default function MenuTreePathPage({ params }: { params: Promise<{ slug: string; path: string[] }> }) {
  const { slug, path } = use(params);
  return <MenuTreePage slug={slug} path={path.map((p) => decodeURIComponent(p))} />;
}
