import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

async function callGemini(key: string, prompt: string, maxTokens = 256): Promise<string> {
  const res = await fetch(GEMINI_URL(key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.8 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "AI not configured" }, { status: 503 });
    }

    const { type, payload } = await req.json() as {
      type: "description" | "tags" | "daily-special";
      payload: Record<string, unknown>;
    };

    let prompt = "";

    if (type === "description") {
      const { name, price, tags, allergens, category } = payload as {
        name: string; price: number; tags: string[];
        allergens: string[]; category: string;
      };
      prompt = `Write a short, appetising menu description for a dish called "${name}" in the category "${category}".
Price: ${price}. Tags: ${(tags ?? []).join(", ") || "none"}. Allergens: ${(allergens ?? []).join(", ") || "none"}.
Requirements:
- 1-2 sentences max, 20-35 words
- Mouth-watering and sensory (mention flavours, textures, cooking methods if plausible)
- No mention of price or allergens
- No quotes, no bullet points — just the description text
- Professional restaurant tone`;
    } else if (type === "tags") {
      const { name, description, category } = payload as {
        name: string; description: string; category: string;
      };
      prompt = `Suggest dietary/cuisine tags for a menu item.
Item: "${name}" in category "${category}".
Description: "${description || "none"}".

Return ONLY a JSON array of 2-5 short tag strings. Choose from:
Vegan, Vegetarian, Gluten-Free, Dairy-Free, Halal, Spicy, Nut-Free, Keto, Low-Carb, Seafood, Grilled, Fried.
Example: ["Vegan","Gluten-Free"]
Return only the JSON array, nothing else.`;
    } else if (type === "daily-special") {
      const { categories } = payload as {
        categories: { name: string; items: { name: string; price: number }[] }[];
      };
      const menuSummary = (categories ?? [])
        .map((c) => `${c.name}: ${c.items.map((i) => i.name).join(", ")}`)
        .join("\n");
      prompt = `You are a restaurant manager picking today's specials.
Menu:
${menuSummary}

Pick 3 items that make a good varied specials board (starter / main / dessert if possible).
Return ONLY a JSON array:
[{"name":"Item Name","price":12.50,"description":"One enticing sentence about why it is special today"}]
Use exact item names from the menu. Return only the JSON array.`;
    } else {
      return NextResponse.json({ error: "Unknown type" }, { status: 400 });
    }

    const text = await callGemini(key, prompt, type === "description" ? 128 : 256);

    if (type === "tags" || type === "daily-special") {
      try {
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
