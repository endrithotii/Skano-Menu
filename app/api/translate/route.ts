import { NextRequest, NextResponse } from "next/server";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const SUPPORTED_LANGS: Record<string, string> = {
  en: "English",
  sq: "Albanian",
  it: "Italian",
  de: "German",
  fr: "French",
  es: "Spanish",
  ar: "Arabic",
  zh: "Chinese (Simplified)",
};

export async function POST(req: NextRequest) {
  try {
    const key = process.env.GROQ_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "AI not configured" }, { status: 503 });
    }

    const { lang, menu } = await req.json() as {
      lang: string;
      menu: {
        restaurantName: string;
        description: string | null;
        categories: {
          name: string;
          description: string | null;
          items: { id: string; name: string; description: string | null }[];
        }[];
      };
    };

    if (!SUPPORTED_LANGS[lang]) {
      return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
    }
    if (lang === "en") {
      return NextResponse.json({ translations: null });
    }

    const targetLang = SUPPORTED_LANGS[lang];

    // Build a compact representation to translate
    const toTranslate: Record<string, string> = {
      restaurant_name: menu.restaurantName,
      restaurant_desc: menu.description ?? "",
    };
    for (const cat of menu.categories) {
      toTranslate[`cat_${cat.name}`] = cat.name;
      if (cat.description) toTranslate[`catdesc_${cat.name}`] = cat.description;
      for (const item of cat.items) {
        toTranslate[`item_${item.id}`] = item.name;
        if (item.description) toTranslate[`itemdesc_${item.id}`] = item.description;
      }
    }

    const prompt = `Translate the following JSON object values from their original language to ${targetLang}.

Rules:
- Translate ONLY the values, keep the keys exactly as-is
- Keep proper nouns (brand names, specific dish names with no common translation) as-is
- Food items should be translated in a natural culinary style
- Return ONLY valid JSON, no explanation

Input JSON:
${JSON.stringify(toTranslate, null, 2)}`;

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2048,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[translate error]", err);
      return NextResponse.json({ error: "Translation failed" }, { status: 502 });
    }

    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";

    // Extract JSON from response
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: "Invalid translation response" }, { status: 500 });
    }

    const translations = JSON.parse(match[0]);
    return NextResponse.json({ translations });
  } catch (error) {
    console.error("[POST /api/translate]", error);
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
