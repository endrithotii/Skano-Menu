import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("x-init-token");
    if (process.env.INIT_TOKEN && token !== process.env.INIT_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // For now, import the known users and restaurants from production
    const PRODUCTION_USERS = [
      { id: 1, name: "Kastriot Ademi", email: "kasstriott432@gmail.com" },
      { id: 2, name: "Bedri", email: "nderi_99@hotmail.com" },
      { id: 4, name: "Kujtim Selmanaj", email: "bar10der2020@gmail.com" },
      { id: 5, name: "Donjet Ramadani", email: "incoffeebar2013@gmail.com" },
      { id: 8, name: "Flamur", email: "shpija.e.vjeter@hotmail.com" },
      { id: 9, name: "Sadat Ibrahimi", email: "sadat-ibrahimi@live.com" },
      { id: 10, name: "Fidan", email: "fidan0104@hotmail.com" },
      { id: 13, name: "Valon Majanci", email: "fatlum.rafuna@gmail.com" },
      { id: 15, name: "Safet Voca", email: "azemhasani@hotmail.com" },
      { id: 16, name: "Arben", email: "arben.zejn@gmail.com" },
      { id: 17, name: "Arianit Miftari", email: "albesematoshi@gmail.com" },
      { id: 20, name: "Flamur Bajraktari", email: "flamurbajraktari@live.com" },
      { id: 22, name: "Besnik", email: "besi.qyqalla@hotmail.com" },
      { id: 24, name: "Ardi Oruqi", email: "arberk1996@gmail.com" },
      { id: 25, name: "Bekim Maloku", email: "bekuu@live.com" },
      { id: 28, name: "Ardit", email: "primabakeryshop@gmail.com" },
      { id: 29, name: "Zijadin Arifi", email: "zassgroup@outlook.com" },
      { id: 30, name: "Arben", email: "restaurant.trattoria@hotmail.com" },
      { id: 31, name: "Katriot Uka", email: "al.besa1@hotmail.com" },
      { id: 34, name: "shkurta cakaj vataj", email: "hamitgashi34@gmail.com" },
      { id: 80, name: "Hotel Owner", email: "hotel@skano.menu" },
      { id: 114, name: "La Carte Owner", email: "carte@skano.menu" },
      { id: 252, name: "Galaxy Owner", email: "galaxy@skano.menu" },
      { id: 398, name: "Furra Owner", email: "furra@skano.menu" },
    ];

    const PRODUCTION_RESTAURANTS = [
      // Add all 99 restaurants from production with proper IDs and owners
      { id: 5, title: "Restaurant 5", owner: 1, active: 1 },
      { id: 6, title: "Restaurant 6", owner: 4, active: 1 },
      { id: 8, title: "Restaurant 8", owner: 5, active: 1 },
      { id: 9, title: "Restaurant 9", owner: 9, active: 1 },
      { id: 21, title: "Restaurant 21", owner: 16, active: 1 },
      { id: 22, title: "Restaurant 22", owner: 15, active: 1 },
      { id: 30, title: "Restaurant 30", owner: 24, active: 1 },
      { id: 39, title: "Restaurant 39", owner: 17, active: 1 },
      { id: 40, title: "Restaurant 40", owner: 2, active: 1 },
      { id: 46, title: "Restaurant 46", owner: 13, active: 1 },
      { id: 49, title: "Restaurant 49", owner: 30, active: 1 },
      { id: 51, title: "Restaurant 51", owner: 28, active: 1 },
      { id: 52, title: "Restaurant 52", owner: 20, active: 1 },
      { id: 55, title: "Restaurant 55", owner: 31, active: 1 },
      { id: 58, title: "Restaurant 58", owner: 10, active: 1 },
      { id: 69, title: "Restaurant 69", owner: 43, active: 1 },
      { id: 70, title: "Restaurant 70", owner: 35, active: 1 },
      { id: 72, title: "Restaurant 72", owner: 36, active: 1 },
      { id: 74, title: "Restaurant 74", owner: 34, active: 1 },
      { id: 75, title: "Restaurant 75", owner: 45, active: 1 },
      { id: 78, title: "Restaurant 78", owner: 49, active: 1 },
      { id: 84, title: "Restaurant 84", owner: 50, active: 1 },
      { id: 86, title: "Restaurant 86", owner: 53, active: 1 },
      { id: 90, title: "Restaurant 90", owner: 57, active: 1 },
      { id: 96, title: "Restaurant 96", owner: 60, active: 1 },
      { id: 98, title: "Restaurant 98", owner: 62, active: 1 },
      { id: 99, title: "Restaurant 99", owner: 54, active: 1 },
      { id: 100, title: "Restaurant 100", owner: 54, active: null },
      { id: 105, title: "Restaurant 105", owner: 71, active: 1 },
      { id: 108, title: "Restaurant 108", owner: 74, active: 1 },
      { id: 110, title: "Restaurant 110", owner: 72, active: 1 },
      { id: 111, title: "Restaurant 111", owner: 75, active: 1 },
      { id: 112, title: "Restaurant 112", owner: 75, active: 0 },
      { id: 121, title: "Restaurant 121", owner: 79, active: 0 },
      { id: 122, title: "A La Carte - AL", owner: 80, active: 0 },
      { id: 123, title: "Menu A LA CARTE  - ENG", owner: 80, active: 0 },
      { id: 125, title: "Corner Bar", owner: 22, active: 1 },
      { id: 126, title: "Restaurant 126", owner: 81, active: 1 },
      { id: 130, title: "Restaurant 130", owner: 83, active: 1 },
      { id: 131, title: "Restaurant 131", owner: 82, active: 1 },
      { id: 133, title: "Restaurant 133", owner: 86, active: 1 },
      { id: 135, title: "Restaurant 135", owner: 79, active: 0 },
      { id: 136, title: "Restaurant 136", owner: 79, active: 1 },
      { id: 138, title: "Restaurant 138", owner: 88, active: 1 },
      { id: 139, title: "Restaurant 139", owner: 88, active: null },
      { id: 140, title: "Restaurant 140", owner: 71, active: null },
      { id: 141, title: "Restaurant 141", owner: 71, active: null },
      { id: 145, title: "Shqip - Menu Mengjesi nga Hoteli", owner: 80, active: null },
      { id: 146, title: "English - Hotel Breakfast Menu", owner: 80, active: null },
      { id: 147, title: "Business Lunch Menu - AL", owner: 80, active: null },
      { id: 155, title: "Business Lunch Menu - EN", owner: 80, active: null },
      { id: 157, title: "Restaurant 157", owner: 92, active: 1 },
      { id: 164, title: "Restaurant 164", owner: 46, active: 1 },
      { id: 168, title: "Restaurant 168", owner: 98, active: 1 },
      { id: 171, title: "Restaurant 171", owner: 98, active: 0 },
      { id: 173, title: "Restaurant 173", owner: 99, active: 1 },
      { id: 174, title: "Restaurant 174", owner: 88, active: null },
      { id: 189, title: "MENU GJITHEPERFSHIRESE", owner: 80, active: null },
      { id: 193, title: "Restaurant 193", owner: 112, active: 1 },
      { id: 197, title: "Restaurant 197", owner: 115, active: 1 },
      { id: 219, title: "Imeri Petrol Restaurant", owner: 123, active: 1 },
      { id: 220, title: "Restaurant 220", owner: 123, active: null },
      { id: 225, title: "Menu Lina", owner: 128, active: 1 },
      { id: 229, title: "Menu e pijeve", owner: 80, active: null },
      { id: 231, title: "Restaurant Driloni", owner: 177, active: 1 },
      { id: 233, title: "Ballkan Menu", owner: 133, active: 1 },
      { id: 234, title: "Ballkan Menu", owner: 133, active: null },
      { id: 254, title: "Restaurant Galaxy Food Menu", owner: 252, active: 0 },
      { id: 257, title: "Corner Bar", owner: 22, active: 0 },
      { id: 279, title: "Taverna Royal", owner: 255, active: 1 },
      { id: 280, title: "Unico Menu", owner: 256, active: 1 },
      { id: 292, title: "Restaurant Galaxy - Menu Digjitale", owner: 252, active: 1 },
      { id: 293, title: "menu kryesore", owner: 8, active: 1 },
      { id: 298, title: "menu", owner: 273, active: 1 },
      { id: 310, title: "Vertigo", owner: 287, active: 1 },
      { id: 317, title: "bar", owner: 292, active: 1 },
      { id: 321, title: "A La Carte - Menu - Shqip", owner: 114, active: 1 },
      { id: 322, title: "A La Carte - Menu - English", owner: 114, active: null },
      { id: 328, title: "Shqip - Menu e Pijeve", owner: 114, active: null },
      { id: 331, title: "Bob jelly", owner: 294, active: 1 },
      { id: 332, title: "Moeé Lounge&Bar Menu", owner: 295, active: 1 },
      { id: 344, title: "Ushqimi - Shqip", owner: 398, active: 1 },
      { id: 345, title: "Embelsirat - Shqip", owner: 398, active: null },
      { id: 346, title: "Pije - Shqip", owner: 398, active: null },
      { id: 347, title: "Buket - Shqip", owner: 398, active: null },
      { id: 348, title: "Food - English", owner: 398, active: null },
      { id: 349, title: "Desserts - English", owner: 398, active: null },
      { id: 350, title: "Drinks - English", owner: 398, active: null },
      { id: 351, title: "Breads - English", owner: 398, active: null },
      { id: 352, title: "A La Carte- Shqip", owner: 80, active: null },
      { id: 353, title: "A La Carte February Shqip", owner: 80, active: 0 },
      { id: 359, title: "tonialpvc", owner: 120, active: 1 },
      { id: 361, title: "Menu e ushqimit - Food Menu", owner: 51, active: 1 },
      { id: 362, title: "Verat Menu", owner: 80, active: null },
      { id: 363, title: "Menu e mengjesit - GOK", owner: 80, active: null },
      { id: 364, title: "Verat Menu", owner: 80, active: 1 },
      { id: 365, title: "Breakfast Menu - GOK", owner: 80, active: null },
      { id: 372, title: "BTP Catalog", owner: 806, active: 1 },
      { id: 375, title: "Alba Tower Catalog", owner: 808, active: 1 },
    ];

    console.log("[IMPORT-FROM-SQL] Starting full import from production database...");

    // 1. Import users
    console.log("[IMPORT-FROM-SQL] Importing users...");
    let usersCreated = 0;
    let usersSkipped = 0;

    for (const user of PRODUCTION_USERS) {
      const existing = await prisma.user.findFirst({
        where: { email: user.email },
      }).catch(() => null);

      if (existing) {
        usersSkipped++;
        continue;
      }

      try {
        await prisma.user.create({
          data: {
            id: `user-prod-${user.id}`,
            email: user.email,
            name: user.name,
            password: "dummy_prod_import", // Temporary password
            role: "RESTAURANT_OWNER",
          },
        });
        usersCreated++;
      } catch (err: any) {
        console.error(`[IMPORT-FROM-SQL] Error creating user ${user.email}:`, err.message);
      }
    }

    console.log(`[IMPORT-FROM-SQL] Users: ${usersCreated} created, ${usersSkipped} skipped`);

    // 2. Import restaurants
    console.log("[IMPORT-FROM-SQL] Importing restaurants...");
    let restaurantsCreated = 0;
    let restaurantsSkipped = 0;

    for (const restaurant of PRODUCTION_RESTAURANTS) {
      const slug = restaurant.title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

      const existing = await prisma.restaurant.findUnique({
        where: { slug },
      }).catch(() => null);

      if (existing) {
        restaurantsSkipped++;
        continue;
      }

      try {
        // Find the user by old ID
        const owner = await prisma.user.findFirst({
          where: { id: `user-prod-${restaurant.owner}` },
        }).catch(() => null);

        if (!owner) {
          console.log(`[IMPORT-FROM-SQL] Skipping restaurant ${restaurant.title} - owner not found`);
          restaurantsSkipped++;
          continue;
        }

        await prisma.restaurant.create({
          data: {
            name: restaurant.title,
            slug,
            description: restaurant.title,
            status: restaurant.active === 1 ? "ACTIVE" : "PENDING",
            ownerId: owner.id,
            email: "info@skano.menu",
            cuisine: JSON.stringify(["Albanian", "Mediterranean"]),
            logo: "",
            coverImage: "",
            address: "Address not specified",
            phone: "Not specified",
            website: "",
          },
        });
        restaurantsCreated++;
      } catch (err: any) {
        console.error(`[IMPORT-FROM-SQL] Error creating restaurant ${restaurant.title}:`, err.message);
      }
    }

    console.log(`[IMPORT-FROM-SQL] Restaurants: ${restaurantsCreated} created, ${restaurantsSkipped} skipped`);

    // Verify counts
    const finalUserCount = await prisma.user.count();
    const finalRestaurantCount = await prisma.restaurant.count();
    const finalActiveCount = await prisma.restaurant.count({ where: { status: "ACTIVE" } });

    console.log(`[IMPORT-FROM-SQL] Final counts: ${finalUserCount} users, ${finalRestaurantCount} restaurants (${finalActiveCount} active)`);

    return NextResponse.json({
      success: true,
      message: "Full import from production database completed",
      usersImported: {
        created: usersCreated,
        skipped: usersSkipped,
        total: usersCreated + usersSkipped,
      },
      restaurantsImported: {
        created: restaurantsCreated,
        skipped: restaurantsSkipped,
        total: restaurantsCreated + restaurantsSkipped,
      },
      finalCounts: {
        users: finalUserCount,
        restaurants: finalRestaurantCount,
        active: finalActiveCount,
        pending: finalRestaurantCount - finalActiveCount,
      },
    });
  } catch (error: any) {
    console.error("[IMPORT-FROM-SQL] Failed:", error);

    return NextResponse.json(
      {
        error: error.message || "Import failed",
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
