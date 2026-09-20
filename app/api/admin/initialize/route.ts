import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

const PRODUCTION_USERS = [
  {
    email: "admin@skano.menu",
    password: "admin123",
    name: "System Admin",
    role: "SUPER_ADMIN",
  },
  {
    email: "resto@skano.menu",
    password: "owner123",
    name: "Arben Krasniqi",
    role: "MANAGER",
  },
  {
    email: "cafe@skano.menu",
    password: "owner123",
    name: "Blerim Hoxha",
    role: "MANAGER",
  },
];

export async function POST(request: Request) {
  try {
    // Verify admin token from header
    const token = request.headers.get("x-init-token");
    if (token !== process.env.INIT_TOKEN && process.env.INIT_TOKEN) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adapter = new PrismaLibSql({
      url: process.env.DATABASE_URL!,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    const prisma = new PrismaClient({ adapter } as any);

    console.log("[INIT] Starting database initialization...");

    // Check if data already exists
    const existingUsers = await prisma.user.count();
    const existingRestaurants = await prisma.restaurant.count();

    if (existingUsers > 0 && existingRestaurants > 0) {
      console.log(`[INIT] Database already populated with ${existingUsers} users and ${existingRestaurants} restaurants`);
      await prisma.$disconnect();
      return Response.json({
        success: true,
        message: "Database already initialized",
        users: existingUsers,
        restaurants: existingRestaurants,
      });
    }

    const createdUsers: Record<string, string> = {};

    // Create users
    for (const user of PRODUCTION_USERS) {
      const existing = await prisma.user.findUnique({
        where: { email: user.email },
      });

      if (existing) {
        createdUsers[user.email] = existing.id;
        console.log(`[INIT] User already exists: ${user.email}`);
      } else {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        const created = await prisma.user.create({
          data: {
            email: user.email,
            password: hashedPassword,
            name: user.name,
            role: user.role,
          },
        });
        createdUsers[user.email] = created.id;
        console.log(`[INIT] Created user: ${user.email}`);
      }
    }

    // Create restaurants
    const restaurants = [
      {
        name: "Arben's Restaurant",
        slug: "arbens-restaurant",
        description: "Traditional Albanian cuisine",
        cuisine: JSON.stringify(["Albanian", "Mediterranean"]),
        ownerId: createdUsers["resto@skano.menu"],
      },
      {
        name: "Blerim's Cafe",
        slug: "blems-cafe",
        description: "Cozy cafe with fresh coffee",
        cuisine: JSON.stringify(["Cafe", "Desserts"]),
        ownerId: createdUsers["cafe@skano.menu"],
      },
    ];

    for (const resto of restaurants) {
      const existing = await prisma.restaurant.findUnique({
        where: { slug: resto.slug },
      });

      if (existing) {
        console.log(`[INIT] Restaurant already exists: ${resto.name}`);
      } else {
        await prisma.restaurant.create({
          data: {
            name: resto.name,
            slug: resto.slug,
            description: resto.description,
            cuisine: resto.cuisine,
            ownerId: resto.ownerId,
            status: "ACTIVE",
            logo: "",
            coverImage: "",
            address: "Sample Address",
            phone: "+1234567890",
            email: "restaurant@skano.menu",
            website: "",
          },
        });
        console.log(`[INIT] Created restaurant: ${resto.name}`);
      }
    }

    console.log("[INIT] ✅ Database initialization completed");
    await prisma.$disconnect();

    return Response.json({
      success: true,
      message: "Database initialized successfully",
      users: Object.keys(createdUsers).length,
      restaurants: restaurants.length,
    });
  } catch (error: any) {
    console.error("[INIT] Failed:", error);
    return Response.json(
      {
        error: error.message || "Initialization failed",
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
