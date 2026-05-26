import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSessionFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "AI not configured" }, { status: 503 });
    }

    const { type, payload } = await req.json() as {
      type: "description" | "tags" | "daily-special";
      payload: Record<string, unknown>;
    };

    const client = new Anthropic({ apiKey: key });

    let prompt = "";

    if (type === "description") {
      const { name, price, tags, allergens, category } = payload as {
        name: string; price: number; tags: string[]; allergens: string[];
        category: string; currency: string;
      };
      prompt = `Write a short, appetising menu description for a dish called "${name}" in the category "${category}".
Price: ${price}. Tags: ${tags.join(", ") || "none"}. Allergens: ${allergens.join(", ") || "none"}.
Requirements:
- 1-2 sentences max, 20-35 words
- Mouth-watering and sensory (mention flavours, textures, cooking methods if plausible)
- No mention of price or allergens
- No quotes, no bullet points, just the description text
- Professional restaurant tone`;
    } else if (type === "tags") {
      const { name, description, category } = payload as {
        name: string; description: string; category: string;
      };
      prompt = `Suggest dietary/cuisine tags for a menu item.
Item: "${name}" in category "${category}".
Description: "${description}".

Return ONLY a JSON array of 2-5 short tag strings. Choose from common dietary labels like:
Vegan, Vegetarian, Gluten-Free, Dairy-Free, Halal, Spicy, Nut-Free, Keto, Low-Carb, Seafood, Grilled, Fried.
Example output: ["Vegan","Gluten-Free","Spicy"]
Return only the JSON array, nothing else.`;
    } else if (type === "daily-special") {
      const { categories } = payload as {
        categories: { name: string; items: { name: string; price: number }[] }[];
      };
      const menuSummary = categories
        .map((c) => `${c.name}: ${c.items.map((i) => i.name).join(", ")}`)
        .join("\n");
      prompt = `You are a restaurant manager creating today's specials list.
Given this menu:
${menuSummary}

Pick 3 items that would work well as today's specials (variety across courses).
Return ONLY a JSON array like:
[{"name":"Item Name","price":12.50,"description":"One enticing sentence about why it's special today"}]
Pick real items from the menu above. Return only the JSON array.`;
    } else {
      return NextResponse.json({ error: "Unknown type" }, { status: 400 });
    }

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    if (type === "tags" || type === "daily-special") {
      try {
        // Extract JSON even if wrapped in markdown
        const match = text.match(/\[[\s\S]*\]/);
        const parsed = JSON.parse(match ? match[0] : text);
        return NextResponse.json({ result: parsed });
      } catch {
        return NextResponse.json({ result: text });
      }
    }

    return NextResponse.json({ result: text });
  } catch (error) {
    console.error("[POST /api/ai/generate]", error);
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
  }
}
