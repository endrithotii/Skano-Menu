import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

function buildMenuContext(restaurant: {
  name: string;
  description: string | null;
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
  return lines.join("\n");
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const key = process.env.GEMINI_API_KEY;
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

    const systemPrompt = `You are a friendly and knowledgeable menu assistant for ${restaurant.name}.
Your job is to help customers explore the menu, find dishes that match their preferences,
dietary needs, or budget, and answer questions about ingredients and allergens.

Be warm, concise, and conversational. Always answer based on the menu below.
If asked about something not on the menu, politely say it's not available.
When recommending dishes, mention the price. Use the exact item names from the menu.
Keep responses short — 2-4 sentences max unless listing multiple items.

${menuContext}`;

    // Gemini conversation format: "user" and "model" roles
    const recentHistory = history.slice(-8);
    const contents = [
      ...recentHistory.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];

    const res = await fetch(GEMINI_URL(key), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("[Gemini chat error]", err);
      return NextResponse.json({ error: "AI unavailable" }, { status: 502 });
    }

    const data = await res.json();
    const reply: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "Sorry, I couldn't generate a response.";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[POST /api/restaurants/[id]/chat]", error);
    return NextResponse.json({ error: "AI unavailable" }, { status: 500 });
  }
}
