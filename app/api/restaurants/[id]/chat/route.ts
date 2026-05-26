import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

function buildMenuContext(restaurant: {
  name: string;
  description: string | null;
  cuisine: string;
  currency: string;
  categories: {
    name: string;
    description: string | null;
    items: {
      name: string;
      description: string | null;
      price: number;
      tags: string;
      allergens: string;
      prepTime: number | null;
      isAvailable: boolean;
      isFeatured: boolean;
    }[];
  }[];
}): string {
  const lines: string[] = [
    `Restaurant: ${restaurant.name}`,
    restaurant.description ? `About: ${restaurant.description}` : "",
    `Currency: ${restaurant.currency || "€"}`,
    "",
    "=== FULL MENU ===",
  ];

  for (const cat of restaurant.categories) {
    lines.push(`\n[${cat.name.toUpperCase()}]`);
    if (cat.description) lines.push(`  ${cat.description}`);
    for (const item of cat.items) {
      if (!item.isAvailable) continue;
      const tags = (() => { try { return JSON.parse(item.tags) as string[]; } catch { return []; } })();
      const allergens = (() => { try { return JSON.parse(item.allergens) as string[]; } catch { return []; } })();
      const details: string[] = [];
      if (tags.length) details.push(`tags: ${tags.join(", ")}`);
      if (allergens.length) details.push(`allergens: ${allergens.join(", ")}`);
      if (item.prepTime) details.push(`prep: ${item.prepTime}min`);
      if (item.isFeatured) details.push("⭐ featured");
      lines.push(`  • ${item.name} — ${restaurant.currency || "€"}${item.price.toFixed(2)}`);
      if (item.description) lines.push(`    ${item.description}`);
      if (details.length) lines.push(`    [${details.join(" | ")}]`);
    }
  }

  return lines.filter((l) => l !== undefined).join("\n");
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "AI not configured" }, { status: 503 });
    }

    const { id } = await params;
    const { message, history = [] } = await req.json() as {
      message: string;
      history: { role: "user" | "assistant"; content: string }[];
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Fetch restaurant with menu
    const restaurant = await prisma.restaurant.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: {
        categories: {
          orderBy: { order: "asc" },
          include: { items: { orderBy: { order: "asc" } } },
        },
      },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const menuContext = buildMenuContext(restaurant);

    const client = new Anthropic({ apiKey: key });

    // Build message history (max last 8 turns to keep context manageable)
    const recentHistory = history.slice(-8);

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      system: `You are a friendly and knowledgeable menu assistant for ${restaurant.name}.
Your job is to help customers explore the menu, find dishes that match their preferences,
dietary needs, or budget, and answer questions about ingredients and allergens.

Be warm, concise, and conversational. Always answer based on the menu below.
If asked about something not on the menu, politely say it's not available.
When recommending dishes, mention the price. Use the exact item names from the menu.
Keep responses short — 2-4 sentences max unless listing multiple items.

${menuContext}`,
      messages: [
        ...recentHistory.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: message },
      ],
    });

    const reply = response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[POST /api/restaurants/[id]/chat]", error);
    return NextResponse.json({ error: "AI unavailable" }, { status: 500 });
  }
}
