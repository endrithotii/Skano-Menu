import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

interface SeedItem {
  name: string; price: number; description?: string;
  tags?: string[]; allergens?: string[]; isFeatured?: boolean;
  spiceLevel?: number; calories?: number; protein?: number;
  carbs?: number; fat?: number; costPrice?: number; prepTime?: number;
}
interface SeedCategory { id: string; name: string; icon?: string; items: SeedItem[] }
interface SeedFeedback { rating: number; comment?: string; customerName?: string }
interface SeedRestaurant {
  id: string; slug: string; name: string; description?: string;
  address?: string; phone?: string; email?: string; website?: string;
  cuisine: string[]; templateId: string; primaryColor: string; currency?: string;
  openingHours?: Record<string, unknown>; wifiPassword?: string; bookingUrl?: string;
  owner: { id: string; email: string; name: string; password: string };
  categories: SeedCategory[];
  feedbacks?: SeedFeedback[];
}

// POST /api/admin/seed-restaurants
// Protected by x-migrate-secret header

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-migrate-secret");
  const expected = process.env.MIGRATE_SECRET;
  if (!secret || !expected || secret !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results: string[] = [];

  async function run(label: string, fn: () => Promise<void>) {
    try { await fn(); results.push(`✅ ${label}`); }
    catch (e: any) {
      if (e?.message?.includes("UNIQUE") || e?.message?.includes("already exists") || e?.message?.includes("unique")) {
        results.push(`⏭️  ${label} (already exists)`);
      } else {
        results.push(`❌ ${label}: ${e?.message ?? String(e)}`);
      }
    }
  }

  const hash = (p: string) => bcrypt.hash(p, 10);

  // ─── Restaurant data ──────────────────────────────────────────────────────────

  const restaurants: SeedRestaurant[] = [
    {
      id: "rest_sushi_kodo",
      slug: "sushi-kodo-prishtina",
      name: "Sushi Kodo",
      description: "Authentic Japanese cuisine in the heart of Prishtina. Premium sushi, ramen, and sake.",
      address: "Rr. Agim Ramadani 5, Prishtina, Kosovo",
      phone: "+383 44 234 567",
      email: "info@sushikodo.ks",
      website: "https://sushikodo.ks",
      cuisine: ["Sushi", "Japanese", "Asian"],
      templateId: "tokyo",
      primaryColor: "#e53e3e",
      currency: "€",
      openingHours: { monday:{open:"12:00",close:"23:00",closed:false}, tuesday:{open:"12:00",close:"23:00",closed:false}, wednesday:{open:"12:00",close:"23:00",closed:false}, thursday:{open:"12:00",close:"23:00",closed:false}, friday:{open:"12:00",close:"00:00",closed:false}, saturday:{open:"12:00",close:"00:00",closed:false}, sunday:{open:"13:00",close:"22:00",closed:false} },
      wifiPassword: "sushi2024",
      owner: { id: "user_sushi_owner", email: "owner@sushikodo.ks", name: "Yuki Tanaka", password: "sushi123" },
      categories: [
        { id: "cat_sk_rolls", name: "Signature Rolls", icon: "🍣", items: [
          { name: "Dragon Roll", price: 14.5, description: "Shrimp tempura, avocado, topped with tuna and spicy mayo", tags: ["popular","spicy"], allergens: ["Fish","Shellfish","Gluten"], spiceLevel: 2 },
          { name: "Rainbow Roll", price: 16, description: "California roll topped with assorted sashimi", tags: ["popular","chef-special"], allergens: ["Fish","Shellfish"] },
          { name: "Volcano Roll", price: 15.5, description: "Spicy tuna inside, baked scallop on top with sriracha", tags: ["spicy","popular"], allergens: ["Fish","Shellfish"], spiceLevel: 4 },
          { name: "Philly Roll", price: 13, description: "Salmon, cream cheese, cucumber", tags: ["vegetarian-friendly"], allergens: ["Fish","Dairy","Gluten"] },
          { name: "Spider Roll", price: 15, description: "Soft shell crab, avocado, cucumber, spicy mayo", allergens: ["Shellfish","Gluten"] },
        ]},
        { id: "cat_sk_nigiri", name: "Nigiri & Sashimi", icon: "🐟", items: [
          { name: "Salmon Nigiri (2pc)", price: 8, description: "Fresh Atlantic salmon over seasoned rice", tags: ["gluten-free","popular"], allergens: ["Fish"] },
          { name: "Tuna Nigiri (2pc)", price: 9, description: "Premium bluefin tuna over rice", tags: ["gluten-free","chef-special"], allergens: ["Fish"] },
          { name: "Sashimi Platter", price: 24, description: "12 pieces of chef's choice sashimi", tags: ["gluten-free","chef-special"], allergens: ["Fish"] },
          { name: "Yellowtail Nigiri (2pc)", price: 10, description: "Delicate Japanese yellowtail", tags: ["gluten-free"], allergens: ["Fish"] },
        ]},
        { id: "cat_sk_ramen", name: "Ramen & Hot Bowls", icon: "🍜", items: [
          { name: "Tonkotsu Ramen", price: 13.5, description: "Rich pork bone broth, chashu pork, soft-boiled egg, nori", tags: ["popular"], allergens: ["Gluten","Eggs","Dairy"], prepTime: 15 },
          { name: "Spicy Miso Ramen", price: 14, description: "Miso-based broth with chili oil, corn, bamboo shoots", tags: ["spicy","vegan"], allergens: ["Gluten","Soy"], spiceLevel: 3, prepTime: 15 },
          { name: "Vegetable Ramen", price: 12, description: "Clear vegetable broth with seasonal vegetables and tofu", tags: ["vegan","healthy"], allergens: ["Gluten","Soy"] },
        ]},
        { id: "cat_sk_drinks", name: "Drinks & Sake", icon: "🍶", items: [
          { name: "Japanese Sake (200ml)", price: 9, description: "Premium Junmai sake, served warm or cold" },
          { name: "Asahi Beer", price: 5, description: "Japanese draft beer, crisp and refreshing" },
          { name: "Matcha Latte", price: 5.5, description: "Ceremonial grade matcha with oat milk", tags: ["vegan"] },
          { name: "Yuzu Lemonade", price: 4.5, description: "Fresh yuzu citrus with sparkling water", tags: ["vegan","popular"] },
        ]},
      ],
      feedbacks: [
        { rating: 5, comment: "Best sushi in Kosovo! The dragon roll is incredible.", customerName: "Artan K." },
        { rating: 5, comment: "Authentic Japanese experience. The tonkotsu ramen warmed my soul.", customerName: "Maria L." },
        { rating: 4, comment: "Great quality fish, a bit pricey but worth every penny.", customerName: "Driton B." },
        { rating: 5, comment: "The sake selection is impressive. Will definitely come back!", customerName: "Florim H." },
        { rating: 4, comment: "Volcano roll was 🔥. Service was a bit slow on Saturday night.", customerName: "Sara M." },
      ],
    },
    {
      id: "rest_burger_republic",
      slug: "burger-republic-pristina",
      name: "Burger Republic",
      description: "Smash burgers, loaded fries, and craft shakes. The tastiest burgers in Kosovo.",
      address: "Sheshi Bill Clinton 3, Prishtina, Kosovo",
      phone: "+383 45 345 678",
      email: "hello@burgerrepublic.ks",
      cuisine: ["Burgers", "American", "Fast Food"],
      templateId: "vibrant",
      primaryColor: "#e53e3e",
      currency: "€",
      openingHours: { monday:{open:"11:00",close:"23:00",closed:false}, tuesday:{open:"11:00",close:"23:00",closed:false}, wednesday:{open:"11:00",close:"23:00",closed:false}, thursday:{open:"11:00",close:"23:00",closed:false}, friday:{open:"11:00",close:"01:00",closed:false}, saturday:{open:"11:00",close:"01:00",closed:false}, sunday:{open:"12:00",close:"22:00",closed:false} },
      owner: { id: "user_burger_owner", email: "owner@burgerrepublic.ks", name: "Blerim Hoxha", password: "burger123" },
      categories: [
        { id: "cat_br_burgers", name: "Smash Burgers", icon: "🍔", items: [
          { name: "The Republic Smash", price: 10.5, description: "Double smash patty, american cheese, pickles, special sauce, brioche bun", tags: ["popular","chef-special"], allergens: ["Gluten","Dairy","Eggs"], isFeatured: true },
          { name: "BBQ Bacon Smash", price: 12, description: "Double patty, crispy bacon, BBQ sauce, cheddar, caramelised onions", tags: ["popular"], allergens: ["Gluten","Dairy"] },
          { name: "Mushroom Swiss", price: 11.5, description: "Single patty, sautéed mushrooms, Swiss cheese, truffle mayo", allergens: ["Gluten","Dairy","Eggs"] },
          { name: "Spicy Jalapeno", price: 11, description: "Double patty, jalapenos, pepper jack, chipotle mayo", tags: ["spicy"], allergens: ["Gluten","Dairy"], spiceLevel: 3 },
          { name: "Crispy Chicken Smash", price: 11, description: "Crispy fried chicken breast, coleslaw, honey mustard", allergens: ["Gluten","Eggs"] },
          { name: "Veggie Smash", price: 9.5, description: "Beyond meat patty, lettuce, tomato, vegan cheese, sriracha", tags: ["vegan"], allergens: ["Gluten","Soy"] },
        ]},
        { id: "cat_br_sides", name: "Sides & Fries", icon: "🍟", items: [
          { name: "Loaded Cheese Fries", price: 6.5, description: "Crispy fries, cheese sauce, bacon bits, jalapeños, sour cream", tags: ["popular"], allergens: ["Dairy","Gluten"] },
          { name: "Truffle Parmesan Fries", price: 7, description: "Double-fried fries, truffle oil, fresh parmesan, herbs", allergens: ["Dairy","Gluten"] },
          { name: "Onion Rings", price: 5, description: "Beer-battered, served with ranch dip", allergens: ["Gluten","Dairy","Eggs"] },
          { name: "Mac & Cheese Bites", price: 6, description: "Crispy fried mac and cheese cubes", tags: ["popular"], allergens: ["Gluten","Dairy","Eggs"] },
        ]},
        { id: "cat_br_shakes", name: "Craft Shakes", icon: "🥤", items: [
          { name: "Oreo Smash Shake", price: 7, description: "Vanilla ice cream, crushed Oreos, whipped cream, chocolate drizzle", tags: ["popular"], allergens: ["Dairy","Gluten","Eggs"] },
          { name: "Strawberry Cheesecake Shake", price: 7.5, description: "Strawberry, cream cheese, graham cracker crumble", allergens: ["Dairy","Gluten","Eggs"] },
          { name: "Salted Caramel Shake", price: 7, description: "Caramel ice cream, sea salt, pretzel crust rim", allergens: ["Dairy","Gluten","Eggs"] },
          { name: "Classic Vanilla", price: 5.5, description: "Simple, creamy, perfect", allergens: ["Dairy","Eggs"] },
        ]},
      ],
      feedbacks: [
        { rating: 5, comment: "Best burger I've had outside the US! The loaded fries are addictive.", customerName: "James R." },
        { rating: 5, comment: "The Oreo shake + Republic Smash combo is unbeatable 🤤", customerName: "Vjosa K." },
        { rating: 5, comment: "Finally a real smash burger in Prishtina!", customerName: "Luan M." },
        { rating: 4, comment: "Delicious but the wait was long on Friday night.", customerName: "Albana B." },
        { rating: 5, comment: "The BBQ Bacon Smash is my new religion.", customerName: "Gent F." },
        { rating: 4, comment: "Good value for the quality. Portions are generous!", customerName: "Rina H." },
      ],
    },
    {
      id: "rest_green_bowl",
      slug: "green-bowl-prishtina",
      name: "Green Bowl",
      description: "Plant-based, wholesome, and delicious. Nourish your body with our seasonal bowls and smoothies.",
      address: "Rr. Fehmi Agani 22, Prishtina, Kosovo",
      phone: "+383 44 456 789",
      email: "hello@greenbowl.ks",
      cuisine: ["Vegan", "Vegetarian", "Healthy"],
      templateId: "minimal",
      primaryColor: "#38a169",
      currency: "€",
      openingHours: { monday:{open:"08:00",close:"20:00",closed:false}, tuesday:{open:"08:00",close:"20:00",closed:false}, wednesday:{open:"08:00",close:"20:00",closed:false}, thursday:{open:"08:00",close:"20:00",closed:false}, friday:{open:"08:00",close:"21:00",closed:false}, saturday:{open:"09:00",close:"21:00",closed:false}, sunday:{open:"09:00",close:"18:00",closed:false} },
      wifiPassword: "greenbowl",
      owner: { id: "user_green_owner", email: "owner@greenbowl.ks", name: "Anita Berisha", password: "green123" },
      categories: [
        { id: "cat_gb_bowls", name: "Nourish Bowls", icon: "🥗", items: [
          { name: "Goddess Bowl", price: 12.5, description: "Quinoa, roasted chickpeas, kale, avocado, tahini dressing", tags: ["vegan","gluten-free","popular"], allergens: ["Sesame"], isFeatured: true, calories: 520, protein: 18, carbs: 65, fat: 22 },
          { name: "Poke Bowl", price: 13.5, description: "Brown rice, edamame, cucumber, mango, soy-ginger dressing", tags: ["vegan","gluten-free"], allergens: ["Soy"], calories: 580, protein: 15 },
          { name: "Buddha Bowl", price: 12, description: "Sweet potato, chickpeas, broccoli, rice, peanut sauce", tags: ["vegan","popular"], allergens: ["Peanuts","Soy"], calories: 610, protein: 19 },
          { name: "Mediterranean Bowl", price: 13, description: "Falafel, hummus, tabbouleh, roasted peppers, pita", tags: ["vegan"], allergens: ["Gluten","Sesame"], calories: 640, protein: 22 },
          { name: "Green Power Bowl", price: 11.5, description: "Spinach, edamame, cucumber, snap peas, green goddess dressing", tags: ["vegan","gluten-free","healthy"], allergens: ["Soy","Tree Nuts"], calories: 380, protein: 16 },
        ]},
        { id: "cat_gb_smoothies", name: "Smoothies & Juices", icon: "🥤", items: [
          { name: "Green Machine", price: 7.5, description: "Spinach, banana, mango, coconut water, chia seeds", tags: ["vegan","popular"], calories: 210 },
          { name: "Berry Bliss", price: 7.5, description: "Mixed berries, açaí, almond milk, dates", tags: ["vegan"], calories: 240 },
          { name: "Golden Turmeric Latte", price: 6, description: "Oat milk, turmeric, ginger, cinnamon, black pepper", tags: ["vegan","healthy"] },
          { name: "Cold Press Citrus", price: 6.5, description: "Orange, carrot, ginger, lemon, fresh pressed", tags: ["vegan","gluten-free"], calories: 130 },
        ]},
        { id: "cat_gb_bites", name: "Healthy Bites", icon: "🥙", items: [
          { name: "Avocado Toast", price: 8.5, description: "Sourdough, smashed avocado, microgreens, everything bagel seasoning", tags: ["vegan","popular"], allergens: ["Gluten","Sesame"] },
          { name: "Açaí Bowl", price: 10, description: "Açaí blend, granola, banana, coconut flakes, honey", tags: ["vegan","popular"], allergens: ["Gluten","Tree Nuts"] },
          { name: "Energy Balls (3pc)", price: 5.5, description: "Dates, oats, peanut butter, chocolate chips, rolled in coconut", tags: ["vegan","gluten-free"], allergens: ["Peanuts","Tree Nuts"] },
          { name: "Hummus Plate", price: 9, description: "House-made hummus, pita, crudités, olive oil, zaatar", tags: ["vegan"], allergens: ["Gluten","Sesame"] },
        ]},
      ],
      feedbacks: [
        { rating: 5, comment: "The Goddess Bowl changed my life. Coming here every day now!", customerName: "Teuta M." },
        { rating: 5, comment: "Finally healthy food that actually tastes amazing in Kosovo 🌿", customerName: "Besa H." },
        { rating: 4, comment: "Love the smoothie selection. The Green Machine is my morning ritual.", customerName: "Edona K." },
        { rating: 5, comment: "Best açaí bowl outside of Brazil! Great vibe too.", customerName: "Carlos R." },
        { rating: 5, comment: "The poke bowl is fresh and beautiful. Instagram-worthy too!", customerName: "Alina S." },
      ],
    },
    {
      id: "rest_trattoria_napoli",
      slug: "trattoria-napoli-peja",
      name: "Trattoria Napoli",
      description: "Authentic Neapolitan cuisine. Hand-tossed pizzas from our wood-fired oven, fresh pasta made daily.",
      address: "Rr. Mbretëreshës 12, Peja, Kosovo",
      phone: "+383 39 234 567",
      email: "ciao@trattorianapoli.ks",
      cuisine: ["Italian", "Pizza"],
      templateId: "brasserie",
      primaryColor: "#c9a84c",
      currency: "€",
      openingHours: { monday:{open:"12:00",close:"22:30",closed:false}, tuesday:{open:"12:00",close:"22:30",closed:false}, wednesday:{open:"12:00",close:"22:30",closed:false}, thursday:{open:"12:00",close:"22:30",closed:false}, friday:{open:"12:00",close:"23:30",closed:false}, saturday:{open:"12:00",close:"23:30",closed:false}, sunday:{open:"12:00",close:"21:30",closed:false} },
      wifiPassword: "napoli2024",
      owner: { id: "user_napoli_owner", email: "chef@trattorianapoli.ks", name: "Marco Esposito", password: "napoli123" },
      categories: [
        { id: "cat_tn_pizza", name: "Pizze Napoletane", icon: "🍕", items: [
          { name: "Margherita DOP", price: 11, description: "San Marzano tomatoes, fior di latte mozzarella, fresh basil, extra virgin olive oil", tags: ["vegetarian","popular"], allergens: ["Gluten","Dairy"], isFeatured: true },
          { name: "Diavola", price: 13.5, description: "Tomato, mozzarella, spicy Calabrian salami, chili oil", tags: ["spicy","popular"], allergens: ["Gluten","Dairy"], spiceLevel: 3 },
          { name: "Quattro Stagioni", price: 14, description: "Artichokes, ham, mushrooms, olives, mozzarella, tomato", allergens: ["Gluten","Dairy"] },
          { name: "Truffle Bianca", price: 16.5, description: "No sauce, fior di latte, truffle cream, mushrooms, parmesan, rocket", tags: ["vegetarian","chef-special"], allergens: ["Gluten","Dairy"] },
          { name: "Nduja e Burrata", price: 15, description: "Tomato, burrata, spicy Nduja spread, honey", tags: ["spicy","chef-special"], allergens: ["Gluten","Dairy"], spiceLevel: 2 },
          { name: "Prosciutto e Rucola", price: 15, description: "Tomato, mozzarella, 24-month Parma ham, rocket, shaved parmesan", allergens: ["Gluten","Dairy"] },
        ]},
        { id: "cat_tn_pasta", name: "Pasta Fresca", icon: "🍝", items: [
          { name: "Spaghetti alla Carbonara", price: 13, description: "Guanciale, egg yolk, Pecorino Romano, black pepper — the authentic way", tags: ["popular","chef-special"], allergens: ["Gluten","Eggs","Dairy"], prepTime: 15 },
          { name: "Pappardelle al Ragù", price: 14.5, description: "Slow-cooked beef and pork ragù, fresh pappardelle, parmesan", tags: ["popular"], allergens: ["Gluten","Dairy"], prepTime: 20 },
          { name: "Cacio e Pepe", price: 12, description: "Tonnarelli, aged Pecorino, black pepper — Roman perfection", tags: ["vegetarian","chef-special"], allergens: ["Gluten","Dairy"] },
          { name: "Gnocchi al Pesto", price: 13, description: "House-made potato gnocchi, Ligurian basil pesto, cherry tomatoes", tags: ["vegetarian"], allergens: ["Gluten","Dairy","Tree Nuts"] },
        ]},
        { id: "cat_tn_dessert", name: "Dolci", icon: "🍮", items: [
          { name: "Tiramisù della Nonna", price: 6.5, description: "Our grandmother's recipe — mascarpone, espresso-soaked ladyfingers, cocoa", tags: ["popular","chef-special"], allergens: ["Dairy","Eggs","Gluten"] },
          { name: "Panna Cotta al Caramello", price: 6, description: "Vanilla panna cotta, salted caramel, candied hazelnuts", allergens: ["Dairy","Tree Nuts"] },
          { name: "Cannolo Siciliano", price: 5.5, description: "Crispy shell, sweetened ricotta, candied peel, pistachios", allergens: ["Gluten","Dairy","Tree Nuts"] },
        ]},
        { id: "cat_tn_vini", name: "Vini & Bevande", icon: "🍷", items: [
          { name: "Chianti Classico (Glass)", price: 7, description: "Tuscan Sangiovese, earthy, medium-bodied" },
          { name: "Pinot Grigio (Glass)", price: 6.5, description: "Crisp Veneto white, citrus, mineral" },
          { name: "Prosecco (Glass)", price: 7.5, description: "Extra dry, fine bubbles, elegant" },
          { name: "San Pellegrino 500ml", price: 3 },
          { name: "Espresso", price: 2, description: "Double shot, Italian blend" },
          { name: "Limoncello", price: 4.5, description: "House-made from Amalfi lemons" },
        ]},
      ],
      feedbacks: [
        { rating: 5, comment: "The most authentic Italian pizza I've had since Rome. Incredible!", customerName: "Giulia T." },
        { rating: 5, comment: "Carbonara was perfect — no cream, just as God intended 🍝", customerName: "Roberto M." },
        { rating: 5, comment: "Best restaurant in Peja by a mile. The Truffle Bianca is divine.", customerName: "Fitim K." },
        { rating: 4, comment: "Everything was delicious. The tiramisu is the best I've ever had.", customerName: "Valentina B." },
        { rating: 5, comment: "Marco's pasta makes me feel like I'm back in Naples 🇮🇹", customerName: "Luca P." },
        { rating: 5, comment: "We celebrated our anniversary here and it was absolutely magical.", customerName: "Ardita & Kushtrim" },
      ],
    },
    {
      id: "rest_grill_house",
      slug: "grill-house-gjilan",
      name: "The Grill House",
      description: "Premium cuts, live fire grilling, and the best smokehouse experience in Kosovo.",
      address: "Rr. Dëshmorët e Kombit 8, Gjilan, Kosovo",
      phone: "+383 44 567 890",
      email: "smoke@thegrillhouse.ks",
      cuisine: ["Grill & BBQ", "Traditional", "Balkan"],
      templateId: "street",
      primaryColor: "#c05621",
      currency: "€",
      openingHours: { monday:{open:"11:00",close:"23:00",closed:false}, tuesday:{open:"11:00",close:"23:00",closed:false}, wednesday:{open:"11:00",close:"23:00",closed:false}, thursday:{open:"11:00",close:"23:00",closed:false}, friday:{open:"11:00",close:"00:00",closed:false}, saturday:{open:"11:00",close:"00:00",closed:false}, sunday:{open:"12:00",close:"22:00",closed:false} },
      owner: { id: "user_grill_owner", email: "owner@thegrillhouse.ks", name: "Ramadan Krasniqi", password: "grill123" },
      categories: [
        { id: "cat_gh_cuts", name: "Prime Cuts", icon: "🥩", items: [
          { name: "Ribeye 300g", price: 26, description: "28-day dry-aged ribeye, charred to your preference, herb butter", tags: ["popular","chef-special"], allergens: ["Dairy"], isFeatured: true, costPrice: 14 },
          { name: "T-Bone 400g", price: 32, description: "Premium T-bone, served with roasted garlic and chimichurri", tags: ["chef-special"], costPrice: 17 },
          { name: "Lamb Chops (4pc)", price: 24, description: "Marinated lamb chops, sumac, mint yogurt, flatbread", tags: ["popular"], allergens: ["Dairy","Gluten"], costPrice: 12 },
          { name: "Chicken Wings (8pc)", price: 14, description: "Smoked wings, three sauces: BBQ, Buffalo, honey-garlic", tags: ["popular"], allergens: ["Dairy","Gluten"], spiceLevel: 2 },
          { name: "Mixed Grill Platter", price: 38, description: "Ribeye, lamb chops, chicken, beef sausage, pljeskavica. For 2.", tags: ["popular","chef-special"], allergens: ["Gluten","Dairy"] },
        ]},
        { id: "cat_gh_traditional", name: "Kosovo Classics", icon: "🇽🇰", items: [
          { name: "Qebapa (10pc)", price: 12, description: "Traditional minced meat kebabs, onion, ajvar, flatbread", tags: ["popular"], allergens: ["Gluten"], costPrice: 5 },
          { name: "Pljeskavica", price: 11, description: "Grilled meat patty, kaymak, ajvar, shopska salad", tags: ["popular"], allergens: ["Gluten","Dairy"] },
          { name: "Tavë Kosi", price: 14, description: "Baked lamb and rice in yogurt sauce — Kosovo national dish", tags: ["chef-special"], allergens: ["Dairy","Eggs"] },
          { name: "Flia me Kaymak", price: 9, description: "Traditional layered pancake with creamy kaymak", tags: ["vegetarian"], allergens: ["Gluten","Dairy","Eggs"] },
        ]},
        { id: "cat_gh_sides", name: "Sides & Salads", icon: "🥗", items: [
          { name: "Shopska Salad", price: 6, description: "Tomatoes, cucumber, peppers, onion, white cheese", tags: ["vegetarian","gluten-free","popular"], allergens: ["Dairy"] },
          { name: "Roasted Corn on the Cob", price: 4, description: "Grilled corn, butter, smoked paprika", tags: ["vegetarian","gluten-free"], allergens: ["Dairy"] },
          { name: "Truffle Mashed Potato", price: 6.5, description: "Creamy mashed potato, truffle oil, chives", tags: ["vegetarian","gluten-free"], allergens: ["Dairy"] },
          { name: "Grilled Halloumi", price: 8, description: "Thick-cut halloumi, pomegranate molasses, mint", tags: ["vegetarian","gluten-free"], allergens: ["Dairy"] },
        ]},
        { id: "cat_gh_drinks", name: "Cold Drinks", icon: "🍺", items: [
          { name: "Peja Beer (Draught)", price: 3.5, description: "Local Kosovo craft lager, refreshing" },
          { name: "Rakia Shot", price: 3, description: "House grape rakia, aged 5 years" },
          { name: "Kosovo Red Wine", price: 5, description: "Local winery, Vranac grape variety" },
          { name: "Ayran", price: 2.5, description: "Chilled yogurt drink, salted", allergens: ["Dairy"] },
        ]},
      ],
      feedbacks: [
        { rating: 5, comment: "The Mixed Grill Platter is the best thing I've ever eaten. Period.", customerName: "Mentor B." },
        { rating: 5, comment: "Tavë Kosi just like my grandmother made. Brought tears to my eyes.", customerName: "Arta K." },
        { rating: 5, comment: "Ribeye was cooked to absolute perfection. 10/10 would recommend.", customerName: "Stefan V." },
        { rating: 4, comment: "Great traditional food. The Qebapa were better than anything in Pristina.", customerName: "Hana M." },
        { rating: 5, comment: "Came from Prishtina just for this place. Worth every kilometre!", customerName: "Bujar L." },
      ],
    },
    {
      id: "rest_pastry_corner",
      slug: "pastry-corner-prizren",
      name: "Pastry Corner",
      description: "Artisan pastries, celebration cakes, and specialty coffee. Where every day deserves a treat.",
      address: "Rr. Shadervan 7, Prizren, Kosovo",
      phone: "+383 29 345 678",
      email: "sweet@pastrycorner.ks",
      cuisine: ["Desserts", "Coffee & Cafe"],
      templateId: "elegant",
      primaryColor: "#9b59b6",
      currency: "€",
      openingHours: { monday:{open:"07:30",close:"21:00",closed:false}, tuesday:{open:"07:30",close:"21:00",closed:false}, wednesday:{open:"07:30",close:"21:00",closed:false}, thursday:{open:"07:30",close:"21:00",closed:false}, friday:{open:"07:30",close:"22:00",closed:false}, saturday:{open:"08:00",close:"22:00",closed:false}, sunday:{open:"09:00",close:"20:00",closed:false} },
      wifiPassword: "sweetlife",
      owner: { id: "user_pastry_owner", email: "owner@pastrycorner.ks", name: "Mirela Gashi", password: "pastry123" },
      categories: [
        { id: "cat_pc_pastries", name: "Artisan Pastries", icon: "🥐", items: [
          { name: "Croissant au Beurre", price: 3, description: "Classic French butter croissant, baked fresh every morning", tags: ["popular","vegetarian"], allergens: ["Gluten","Dairy","Eggs"], isFeatured: true, calories: 280 },
          { name: "Pain au Chocolat", price: 3.5, description: "Buttery pastry with dark Belgian chocolate", tags: ["vegetarian","popular"], allergens: ["Gluten","Dairy","Eggs"], calories: 320 },
          { name: "Baklava Tart", price: 4.5, description: "Flaky pastry, pistachio, honey, rose water — our signature fusion", tags: ["vegetarian","popular","chef-special"], allergens: ["Gluten","Dairy","Tree Nuts"] },
          { name: "Almond Danish", price: 3.5, description: "Laminated dough, almond cream, flaked almonds, icing", allergens: ["Gluten","Dairy","Eggs","Tree Nuts"] },
          { name: "Cinnamon Roll", price: 4, description: "Oversized, gooey, cream cheese frosting", tags: ["vegetarian","popular"], allergens: ["Gluten","Dairy","Eggs"] },
        ]},
        { id: "cat_pc_cakes", name: "Cakes & Slices", icon: "🎂", items: [
          { name: "Tiramisu Slice", price: 6, description: "Layers of mascarpone, espresso sponge, cocoa", tags: ["vegetarian","popular"], allergens: ["Dairy","Eggs","Gluten"] },
          { name: "Strawberry Pavlova", price: 6.5, description: "Crisp meringue, cream, fresh strawberries, passion fruit", tags: ["vegetarian","gluten-free"], allergens: ["Eggs","Dairy"] },
          { name: "Chocolate Fondant", price: 7, description: "Warm, molten centre, served with vanilla gelato", tags: ["vegetarian","popular","chef-special"], allergens: ["Gluten","Dairy","Eggs"] },
          { name: "Cheesecake of the Day", price: 5.5, description: "Ask your server for today's flavour!", tags: ["vegetarian"], allergens: ["Dairy","Eggs","Gluten"] },
          { name: "Lemon Posset", price: 5, description: "Set cream with zingy lemon, shortbread crumble", tags: ["vegetarian","gluten-free"], allergens: ["Dairy","Gluten"] },
        ]},
        { id: "cat_pc_coffee", name: "Specialty Coffee", icon: "☕", items: [
          { name: "Flat White", price: 3, description: "Double espresso, micro-foam, velvety smooth", tags: ["vegetarian","popular"] },
          { name: "Matcha Oat Latte", price: 4, description: "Ceremonial matcha, steamed oat milk, hint of vanilla", tags: ["vegan","popular"] },
          { name: "Cold Brew", price: 4.5, description: "18-hour steep, black or with oat milk", tags: ["vegan"] },
          { name: "Espresso Tonic", price: 4.5, description: "Double espresso over tonic water, orange peel", tags: ["vegan"] },
          { name: "Turkish Coffee", price: 2.5, description: "Traditional Prizren-style, served with lokum", tags: ["vegan","popular"] },
        ]},
      ],
      feedbacks: [
        { rating: 5, comment: "The Baklava Tart is a revelation — East meets West perfectly!", customerName: "Sevim K." },
        { rating: 5, comment: "Best croissant in the Balkans. Seriously. I've eaten a LOT of croissants.", customerName: "Pierre D." },
        { rating: 5, comment: "The view from the terrace + a Flat White + Pain au Chocolat = perfect morning", customerName: "Lora B." },
        { rating: 4, comment: "Amazing cakes. The tiramisu slice is huge and delicious.", customerName: "Arber M." },
        { rating: 5, comment: "Came for a birthday cake. Left planning our wedding here 😂 Just perfect.", customerName: "Drita & Agim" },
      ],
    },
    {
      id: "rest_sea_breeze",
      slug: "sea-breeze-prishtina",
      name: "Sea Breeze",
      description: "Fresh Adriatic seafood flown in daily. The ocean comes to Kosovo.",
      address: "Rr. UÇK 44, Prishtina, Kosovo",
      phone: "+383 44 678 901",
      email: "fish@seabreezerestaurant.ks",
      cuisine: ["Seafood", "Mediterranean"],
      templateId: "mediterranean",
      primaryColor: "#2b6cb0",
      currency: "€",
      openingHours: { monday:{open:"12:00",close:"23:00",closed:false}, tuesday:{open:"12:00",close:"23:00",closed:false}, wednesday:{open:"12:00",close:"23:00",closed:false}, thursday:{open:"12:00",close:"23:00",closed:false}, friday:{open:"12:00",close:"00:00",closed:false}, saturday:{open:"12:00",close:"00:00",closed:false}, sunday:{open:"12:00",close:"22:00",closed:false} },
      wifiPassword: "ocean2024",
      owner: { id: "user_sea_owner", email: "owner@seabreezerestaurant.ks", name: "Nikolla Gjergji", password: "sea123" },
      categories: [
        { id: "cat_sb_starters", name: "Starters", icon: "🦀", items: [
          { name: "Oysters (6pc)", price: 18, description: "Fresh Adriatic oysters, mignonette, lemon, Tabasco", tags: ["gluten-free","chef-special","popular"], allergens: ["Shellfish"] },
          { name: "Grilled Calamari", price: 14, description: "Tender calamari, lemon, herbs, house aioli", tags: ["gluten-free","popular"], allergens: ["Shellfish","Eggs"] },
          { name: "Shrimp Cocktail (8pc)", price: 16, description: "Poached tiger prawns, Marie Rose sauce, avocado", tags: ["gluten-free"], allergens: ["Shellfish","Eggs"] },
          { name: "Burrata & Anchovy", price: 13, description: "Fresh burrata, white anchovies, tomatoes, focaccia", allergens: ["Fish","Dairy","Gluten"] },
        ]},
        { id: "cat_sb_mains", name: "Main Courses", icon: "🐟", items: [
          { name: "Whole Sea Bass", price: 28, description: "500g grilled sea bass, capers, white wine butter sauce, seasonal veg", tags: ["gluten-free","popular","chef-special"], allergens: ["Fish","Dairy"], isFeatured: true },
          { name: "Lobster Pasta", price: 35, description: "Half lobster, linguine, cherry tomatoes, bisque sauce, herbs", allergens: ["Shellfish","Gluten","Dairy"], tags: ["chef-special"] },
          { name: "Seafood Risotto", price: 24, description: "Clams, mussels, shrimp, squid, saffron risotto, parmesan", allergens: ["Shellfish","Dairy"] },
          { name: "Grilled Swordfish Steak", price: 26, description: "200g swordfish, salsa verde, roasted potatoes", tags: ["gluten-free"], allergens: ["Fish"] },
          { name: "Mussels Marinière", price: 18, description: "1kg mussels, white wine, shallots, cream, crusty bread", allergens: ["Shellfish","Dairy","Gluten"], tags: ["popular"] },
        ]},
        { id: "cat_sb_wines", name: "Wine & Drinks", icon: "🍾", items: [
          { name: "Sauvignon Blanc (Glass)", price: 8, description: "New Zealand, crisp, citrusy, perfect with seafood" },
          { name: "Chablis (Glass)", price: 10, description: "French Burgundy, mineral, bone-dry" },
          { name: "Rosé Provence (Glass)", price: 8.5, description: "Pale pink, strawberry, freshwater" },
          { name: "Local Kosovo White", price: 5.5, description: "Chardonnay from Rahovec winery" },
        ]},
      ],
      feedbacks: [
        { rating: 5, comment: "The oysters are the freshest I've had in the Balkans. Unbelievable quality.", customerName: "Hektor B." },
        { rating: 5, comment: "Whole Sea Bass was flawless. Cooked to perfection with amazing sauce.", customerName: "Natalia V." },
        { rating: 5, comment: "Lobster pasta at this price? In Prishtina?! I'm in disbelief.", customerName: "Flamur G." },
        { rating: 4, comment: "Excellent seafood, nice ambiance. Worth the splurge for a special occasion.", customerName: "Enis M." },
        { rating: 5, comment: "The seafood risotto is better than anything I've had in Dubrovnik.", customerName: "Marija L." },
      ],
    },
    {
      id: "rest_albanian_house",
      slug: "albanian-house-gjakova",
      name: "Shtëpia Shqiptare",
      description: "Traditional Albanian hospitality and cuisine. Recipes passed down through generations in our family kitchen.",
      address: "Çarshia e Madhe 3, Gjakova, Kosovo",
      phone: "+383 390 12 345",
      email: "family@shtepiatrad.ks",
      cuisine: ["Albanian", "Traditional", "Balkan"],
      templateId: "classic",
      primaryColor: "#d43f00",
      currency: "€",
      openingHours: { monday:{open:"10:00",close:"22:00",closed:false}, tuesday:{open:"10:00",close:"22:00",closed:false}, wednesday:{open:"10:00",close:"22:00",closed:false}, thursday:{open:"10:00",close:"22:00",closed:false}, friday:{open:"10:00",close:"23:00",closed:false}, saturday:{open:"10:00",close:"23:00",closed:false}, sunday:{open:"11:00",close:"21:00",closed:false} },
      owner: { id: "user_albanian_owner", email: "owner@shtepiatrad.ks", name: "Fatmire Kelmendi", password: "shtepi123" },
      categories: [
        { id: "cat_ah_soups", name: "Supë & Appetizers", icon: "🍲", items: [
          { name: "Supë Pule me Makarona", price: 5, description: "Traditional chicken soup with homemade pasta, fresh herbs", tags: ["popular"], allergens: ["Gluten"] },
          { name: "Tarator", price: 4.5, description: "Cold yogurt, cucumber, garlic, walnuts, dill — refreshing starter", tags: ["vegetarian","gluten-free"], allergens: ["Dairy","Tree Nuts"] },
          { name: "Byrek me Spinaq", price: 6, description: "Flaky phyllo pastry, fresh spinach, feta, egg", tags: ["vegetarian","popular"], allergens: ["Gluten","Dairy","Eggs"] },
          { name: "Byrek me Mish", price: 7, description: "Homemade phyllo, seasoned minced meat, onion", tags: ["popular"], allergens: ["Gluten"] },
        ]},
        { id: "cat_ah_mains", name: "Gjellë Kryesore", icon: "🍖", items: [
          { name: "Tavë Elbasani", price: 15, description: "Baked lamb, yogurt, eggs, rice — Albanian national pride", tags: ["popular","chef-special"], allergens: ["Dairy","Eggs"] },
          { name: "Misër me Fasule", price: 10, description: "White beans stewed with pork, tomato, sweet paprika", allergens: [] },
          { name: "Kapama", price: 16, description: "Slow-braised lamb shoulder, onions, spices, plums — festive dish", tags: ["chef-special","seasonal"], allergens: [] },
          { name: "Peshk i Skuqur", price: 17, description: "River-fresh trout, deep fried, tartar sauce, lemon", allergens: ["Fish","Gluten","Eggs"] },
          { name: "Petulla me Djathë", price: 9, description: "Fried dough balls served with local white cheese and honey", tags: ["vegetarian","popular"], allergens: ["Gluten","Dairy","Eggs"] },
        ]},
        { id: "cat_ah_embëlsira", name: "Embëlsira", icon: "🍯", items: [
          { name: "Baklava Familjare", price: 5.5, description: "Our 4-generation recipe: walnuts, honey, rose water, phyllo", tags: ["vegetarian","popular"], allergens: ["Gluten","Tree Nuts","Dairy"] },
          { name: "Trilece", price: 6, description: "Albanian three-milk cake, caramel, light cream", tags: ["vegetarian","popular"], allergens: ["Dairy","Eggs","Gluten"] },
          { name: "Ballokume Elbasani", price: 4, description: "Traditional cornmeal cookie, butter, sugar — Eid specialty", tags: ["vegetarian"], allergens: ["Dairy","Eggs","Gluten"] },
        ]},
      ],
      feedbacks: [
        { rating: 5, comment: "Tavë Elbasani made by Fatmire is the best thing I've ever eaten. Emotional.", customerName: "Agron B." },
        { rating: 5, comment: "Real, authentic Albanian food. No shortcuts. The byrek is incredible.", customerName: "Shpresa M." },
        { rating: 5, comment: "We drive from Prishtina every Sunday for this family cooking.", customerName: "Valbona K." },
        { rating: 4, comment: "The Kapama is worth ordering days in advance. Absolutely special.", customerName: "Fitim A." },
        { rating: 5, comment: "The baklava recipe is a true family treasure. Best I've ever had.", customerName: "Ibrahim H." },
        { rating: 5, comment: "Pure Albanian soul food. Every dish tells a story.", customerName: "Nora G." },
      ],
    },
    {
      id: "rest_neon_nights",
      slug: "neon-nights-bar-prishtina",
      name: "Neon Nights",
      description: "Late-night cocktails, DJ nights, and gourmet snacks. Prishtina's coolest cocktail bar.",
      address: "Rr. Nëna Tereze 89, Prishtina, Kosovo",
      phone: "+383 44 789 012",
      email: "drinks@neonnights.ks",
      cuisine: ["Coffee & Cafe", "International"],
      templateId: "neon",
      primaryColor: "#00d4ff",
      currency: "€",
      openingHours: { monday:{open:"18:00",close:"02:00",closed:false}, tuesday:{open:"18:00",close:"02:00",closed:false}, wednesday:{open:"18:00",close:"02:00",closed:false}, thursday:{open:"18:00",close:"03:00",closed:false}, friday:{open:"18:00",close:"04:00",closed:false}, saturday:{open:"18:00",close:"04:00",closed:false}, sunday:{open:"20:00",close:"02:00",closed:false} },
      wifiPassword: "neon2024",
      bookingUrl: "https://neonnights.ks/reserve",
      owner: { id: "user_neon_owner", email: "owner@neonnights.ks", name: "Diell Morina", password: "neon123" },
      categories: [
        { id: "cat_nn_signatures", name: "Signature Cocktails", icon: "🍸", items: [
          { name: "Neon Sour", price: 10, description: "Butterfly pea gin, lemon, egg white, elderflower, pea flower ice", tags: ["popular","chef-special"], allergens: ["Eggs"], isFeatured: true },
          { name: "Kosovo Mule", price: 9, description: "Rakia, ginger beer, lime, cucumber, mint", tags: ["popular"] },
          { name: "Smoked Old Fashioned", price: 11, description: "Bourbon, demerara, bitters, smoked with cherry wood", tags: ["chef-special"] },
          { name: "Passion Spritz", price: 9.5, description: "Aperol, passion fruit, prosecco, orange zest", tags: ["popular"] },
          { name: "Velvet Underground", price: 10, description: "Espresso vodka, blackberry, coffee foam, vanilla", tags: ["popular"] },
          { name: "Zero-Proof Sunset", price: 7, description: "Seedlip, mango, chili, lime, soda — stunning non-alcoholic", tags: ["vegan","popular"], spiceLevel: 1 },
        ]},
        { id: "cat_nn_bites", name: "Late Night Bites", icon: "🍟", items: [
          { name: "Truffle & Cheese Tater Tots", price: 9, description: "Crispy tots, truffle mayo, parmesan, chives", tags: ["vegetarian","popular"], allergens: ["Dairy","Gluten"] },
          { name: "Wagyu Sliders (3pc)", price: 16, description: "Mini wagyu burgers, pickle, special sauce, brioche", tags: ["popular","chef-special"], allergens: ["Gluten","Dairy","Eggs"] },
          { name: "Spicy Chicken Wings (6pc)", price: 13, description: "Korean gochujang glaze, sesame, spring onion", tags: ["spicy","popular"], allergens: ["Soy","Sesame","Gluten"], spiceLevel: 3 },
          { name: "Cheese Board", price: 18, description: "Selection of 5 cheeses, quince jelly, crackers, grapes, nuts", allergens: ["Dairy","Gluten","Tree Nuts"] },
          { name: "Loaded Nachos", price: 12, description: "Tortilla chips, guacamole, sour cream, jalapeño, cheese", tags: ["vegetarian","popular"], allergens: ["Dairy","Gluten"], spiceLevel: 2 },
        ]},
        { id: "cat_nn_wine", name: "Wines & Champagne", icon: "🥂", items: [
          { name: "Champagne (Glass)", price: 15, description: "Moët & Chandon Brut, NV" },
          { name: "Prosecco DOC (Glass)", price: 8, description: "Veneto, elegant, fine bubbles" },
          { name: "House Red (Glass)", price: 7, description: "Vranac from Kosovo's Rahovec valley" },
          { name: "Natural Wine (Glass)", price: 10, description: "Biodynamic selection, changes monthly" },
        ]},
      ],
      feedbacks: [
        { rating: 5, comment: "The Neon Sour is unlike anything I've ever tasted. Magic in a glass.", customerName: "Lumturi K." },
        { rating: 5, comment: "Best cocktail bar in Kosovo. The atmosphere on Friday nights is electric.", customerName: "Astrit B." },
        { rating: 4, comment: "Great cocktails, excellent music. The wagyu sliders are a revelation.", customerName: "Donika H." },
        { rating: 5, comment: "Kosovo Mule with rakia is genius. Changed my life.", customerName: "Engjell M." },
      ],
    },
    {
      id: "rest_steakhouse_luxury",
      slug: "black-marble-prishtina",
      name: "Black Marble",
      description: "Prishtina's premier fine dining steakhouse. Reserve your table for an unforgettable evening.",
      address: "Rr. Garibaldi 1, Prishtina, Kosovo",
      phone: "+383 44 890 123",
      email: "reservations@blackmarble.ks",
      website: "https://blackmarble.ks",
      cuisine: ["Grill & BBQ", "International"],
      templateId: "luxury",
      primaryColor: "#c9a84c",
      currency: "€",
      openingHours: { monday:{open:"18:00",close:"23:00",closed:false}, tuesday:{open:"18:00",close:"23:00",closed:false}, wednesday:{open:"18:00",close:"23:00",closed:false}, thursday:{open:"18:00",close:"23:30",closed:false}, friday:{open:"18:00",close:"00:00",closed:false}, saturday:{open:"18:00",close:"00:00",closed:false}, sunday:{open:"18:00",close:"22:30",closed:false} },
      bookingUrl: "https://blackmarble.ks/reservations",
      owner: { id: "user_luxury_owner", email: "gm@blackmarble.ks", name: "Viktor Cvetkovic", password: "luxury123" },
      categories: [
        { id: "cat_bm_starters", name: "First Course", icon: "🥗", items: [
          { name: "Foie Gras Torchon", price: 24, description: "Duck foie gras, brioche, Sauternes jelly, micro herbs", tags: ["chef-special"], allergens: ["Gluten","Dairy","Eggs"] },
          { name: "Wagyu Tartare", price: 22, description: "A5 wagyu, truffle vinaigrette, quail egg, crisps", tags: ["chef-special","popular"], allergens: ["Eggs","Gluten"] },
          { name: "Burrata Caprese", price: 16, description: "Buffalo burrata, heirloom tomatoes, aged balsamic, basil oil", tags: ["vegetarian"], allergens: ["Dairy"] },
          { name: "Lobster Bisque", price: 18, description: "Velvet smooth, cognac cream, lobster claw garnish", allergens: ["Shellfish","Dairy"] },
        ]},
        { id: "cat_bm_steaks", name: "The Steaks", icon: "🥩", items: [
          { name: "Wagyu A5 Sirloin 200g", price: 95, description: "Japanese A5 Wagyu from Kagoshima, simply seasoned, served with sauce trio", tags: ["chef-special"], isFeatured: true, costPrice: 55 },
          { name: "Dry-Aged Tomahawk 1kg", price: 85, description: "45-day dry-aged Hereford, for two to share. Tableside carving service.", tags: ["popular","chef-special"], allergens: ["Dairy"], costPrice: 42 },
          { name: "Prime Ribeye 300g", price: 48, description: "28-day dry-aged Black Angus, bone marrow butter, watercress", tags: ["popular"], allergens: ["Dairy"], costPrice: 22 },
          { name: "Filet Mignon 200g", price: 52, description: "Centre-cut tenderloin, périgueux sauce, foie gras", allergens: ["Dairy","Gluten"], costPrice: 26 },
        ]},
        { id: "cat_bm_desserts", name: "Desserts", icon: "🍫", items: [
          { name: "Valrhona Chocolate Soufflé", price: 14, description: "Single-origin 70% Valrhona, vanilla bean ice cream, 20 min wait", tags: ["vegetarian","chef-special","popular"], allergens: ["Gluten","Dairy","Eggs"], prepTime: 20 },
          { name: "Cheese Trolley Selection", price: 18, description: "A selection of 5 aged European cheeses, accompaniments", allergens: ["Dairy","Gluten","Tree Nuts"] },
          { name: "Île Flottante", price: 12, description: "Floating meringue, crème anglaise, praline, salted caramel", allergens: ["Dairy","Eggs","Tree Nuts"] },
        ]},
        { id: "cat_bm_wine", name: "Fine Wines", icon: "🍷", items: [
          { name: "Château Pétrus 2015 (Glass)", price: 85, description: "Pomerol, Merlot, legendary Bordeaux" },
          { name: "Opus One 2018 (Glass)", price: 55, description: "Napa Valley, Cabernet Sauvignon blend" },
          { name: "White Burgundy (Glass)", price: 28, description: "Meursault Premier Cru, Chardonnay" },
          { name: "Sommelier's Selection (Glass)", price: 18, description: "Ask our sommelier for tonight's recommendation" },
        ]},
      ],
      feedbacks: [
        { rating: 5, comment: "The A5 Wagyu was the most extraordinary thing I've ever eaten. Life-changing.", customerName: "Bashkim I." },
        { rating: 5, comment: "Tomahawk for two, bottle of Opus One. Best anniversary dinner imaginable.", customerName: "Venera & Besnik" },
        { rating: 5, comment: "Michelin-star worthy in every respect. Kosovo has arrived.", customerName: "Jean-Pierre M." },
        { rating: 5, comment: "The chocolate soufflé is perfection. Viktor and his team are extraordinary.", customerName: "Adelina K." },
        { rating: 4, comment: "Incredible quality but pricey. Worth saving up for a special occasion.", customerName: "Ariana M." },
      ],
    },
  ];

  // ─── Create each restaurant ───────────────────────────────────────────────────

  for (const r of restaurants) {
    await run(`User: ${r.owner.email}`, async () => {
      const hashed = await hash(r.owner.password);
      await (prisma as any).$executeRawUnsafe(`
        INSERT INTO "User" ("id","email","password","name","role","assignedTables","createdAt","updatedAt")
        VALUES (?,?,?,?,'MANAGER','[]',datetime('now'),datetime('now'))
      `, r.owner.id, r.owner.email, hashed, r.owner.name);
    });

    await run(`Restaurant: ${r.name}`, async () => {
      await (prisma as any).$executeRawUnsafe(`
        INSERT INTO "Restaurant" (
          "id","name","slug","description","address","phone","email","website",
          "cuisine","status","templateId","primaryColor","currency","ownerId",
          "openingHours","socialLinks","primaryMenu","promotions","customTags",
          "themeConfig","flashSales","planTier","isVerified","loyaltyEnabled",
          "loyaltyStamps","loyaltyReward","tableMap","sections",
          "bookingUrl","wifiPassword","createdAt","updatedAt"
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))
      `,
        r.id, r.name, r.slug,
        r.description ?? null,
        r.address ?? null,
        r.phone ?? null,
        r.email ?? null,
        r.website ?? null,
        JSON.stringify(r.cuisine),
        "ACTIVE",
        r.templateId, r.primaryColor, r.currency ?? "€",
        r.owner.id,
        JSON.stringify(r.openingHours ?? {}),
        "{}",
        "dynamic",
        "[]", "[]", "{}", "[]",
        "free", 0, 0, 10, "Free item", "[]", "[]",
        r.bookingUrl ?? null,
        r.wifiPassword ?? null
      );
    });

    // Categories and items
    let catOrder = 0;
    for (const cat of r.categories) {
      await run(`Category: ${r.name} / ${cat.name}`, async () => {
        await (prisma as any).$executeRawUnsafe(`
          INSERT INTO "MenuCategory" ("id","name","description","icon","order","restaurantId","createdAt","updatedAt")
          VALUES (?,?,NULL,?,?,?,datetime('now'),datetime('now'))
        `, cat.id, cat.name, cat.icon ?? null, catOrder++, r.id);
      });

      let itemOrder = 0;
      for (const item of cat.items) {
        const itemId = `${cat.id}_item_${itemOrder}`;
        await run(`Item: ${item.name}`, async () => {
          await (prisma as any).$executeRawUnsafe(`
            INSERT INTO "MenuItem" (
              "id","name","description","price","image","allergens","tags","prepTime",
              "isAvailable","isFeatured","isHidden","order","categoryId",
              "spiceLevel","calories","protein","carbs","fat","costPrice","chefNote",
              "images","variants","viewCount","createdAt","updatedAt"
            ) VALUES (?,?,?,?,NULL,?,?,?,1,?,0,?,?,?,?,?,?,?,?,NULL,'[]','[]',?,datetime('now'),datetime('now'))
          `,
            itemId,
            item.name,
            item.description ?? null,
            item.price,
            JSON.stringify(item.allergens ?? []),
            JSON.stringify(item.tags ?? []),
            item.prepTime ?? null,
            item.isFeatured ? 1 : 0,
            itemOrder++,
            cat.id,
            item.spiceLevel ?? null,
            item.calories ?? null,
            item.protein ?? null,
            item.carbs ?? null,
            item.fat ?? null,
            item.costPrice ?? null,
            Math.floor(Math.random() * 120 + 10), // random viewCount
          );
        });
      }
    }

    // Feedbacks
    let fbIdx = 0;
    for (const fb of (r.feedbacks ?? [])) {
      const fbId = `${r.id}_fb_${fbIdx++}`;
      await run(`Feedback: ${r.name} #${fbIdx}`, async () => {
        await prisma.feedback.create({
          data: {
            id: fbId,
            rating: fb.rating,
            comment: fb.comment ?? null,
            customerName: fb.customerName ?? null,
            restaurantId: r.id,
          },
        });
      });
    }
  }

  return NextResponse.json({ results, total: restaurants.length });
}
