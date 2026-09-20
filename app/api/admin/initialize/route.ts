import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

// Demo users - used if no SQL data is provided
const DEMO_USERS = [
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

// Demo restaurants
const DEMO_RESTAURANTS = [
  {
    name: "Arben's Restaurant",
    slug: "arbens-restaurant",
    description: "Traditional Albanian cuisine",
    cuisine: JSON.stringify(["Albanian", "Mediterranean"]),
    ownerId: "", // Will be set dynamically
  },
  {
    name: "Blerim's Cafe",
    slug: "blems-cafe",
    description: "Cozy cafe with fresh coffee",
    cuisine: JSON.stringify(["Cafe", "Desserts"]),
    ownerId: "", // Will be set dynamically
  },
];

export async function GET(request: Request) {
  return Response.json({
    message: "Database initialization endpoint",
    instructions: "POST to this endpoint to initialize the database",
  });
}

async function importFromSQL(prisma: any, sqlContent: string) {
  let usersCreated = 0;
  let restaurantsCreated = 0;
  const userMap: Record<number, string> = {};

  // Parse users
  const userLines = sqlContent.match(/INSERT INTO `users`[^;]+;/gi) || [];

  for (const line of userLines) {
    const valueMatches = line.match(/VALUES\s+(.*?)(?:;|$)/i);
    if (!valueMatches) continue;

    const valuesStr = valueMatches[1];
    const valueGroups = valuesStr.match(/\([^)]+\)/g) || [];

    for (const group of valueGroups) {
      try {
        const cleanGroup = group.slice(1, -1);
        const parts = cleanGroup.match(/'[^']*'|"[^"]*"|NULL|\d+/g) || [];

        if (parts.length < 6) continue;

        const oldId = parseInt(parts[0] || '0');
        const name = parts[1]?.slice(1, -1) || '';
        const email = parts[2]?.slice(1, -1) || '';
        const password = parts[4]?.slice(1, -1) || '';

        const existing = await prisma.user.findUnique({
          where: { email },
        });

        if (existing) {
          userMap[oldId] = existing.id;
          continue;
        }

        const created = await prisma.user.create({
          data: {
            email,
            password,
            name: name || email.split('@')[0],
            role: "MANAGER",
          },
        });

        userMap[oldId] = created.id;
        usersCreated++;
      } catch (e: any) {
        console.log(`[SQL] Error parsing user: ${e.message}`);
      }
    }
  }

  // Parse menus (restaurants)
  const menuLines = sqlContent.match(/INSERT INTO `menus`[^;]+;/gi) || [];

  for (const line of menuLines) {
    const valueMatches = line.match(/VALUES\s+(.*?)(?:;|$)/i);
    if (!valueMatches) continue;

    const valuesStr = valueMatches[1];
    const valueGroups = valuesStr.match(/\([^)]+\)/g) || [];

    for (const group of valueGroups) {
      try {
        const cleanGroup = group.slice(1, -1);
        const parts = cleanGroup.match(/'[^']*'|"[^"]*"|NULL|\d+/g) || [];

        if (parts.length < 4) continue;

        const oldMenuId = parseInt(parts[0] || '0');
        const oldOwnerId = parseInt(parts[3] || '0');
        const active = parts[4] === '1' || parts[4] === 'true';
        const title = parts[5]?.slice(1, -1) || `Menu ${oldMenuId}`;

        const ownerId = userMap[oldOwnerId];
        if (!ownerId) continue;

        const slug = title
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');

        const existing = await prisma.restaurant.findUnique({
          where: { slug },
        });

        if (existing) continue;

        await prisma.restaurant.create({
          data: {
            name: title,
            slug,
            description: title,
            status: active ? "ACTIVE" : "PENDING",
            ownerId,
            email: "info@skano.menu",
            cuisine: JSON.stringify([]),
            logo: "",
            coverImage: "",
            address: "Address not specified",
            phone: "Not specified",
            website: "",
          },
        });

        restaurantsCreated++;
      } catch (e: any) {
        console.log(`[SQL] Error parsing restaurant: ${e.message}`);
      }
    }
  }

  return {
    usersCreated,
    restaurantsCreated,
    totalUsersImported: Object.keys(userMap).length,
  };
}

async function initializeDatabase(
  prisma: any,
  usersToImport: typeof DEMO_USERS,
  restaurantsToImport: typeof DEMO_RESTAURANTS
) {
  const createdUsers: Record<string, string> = {};

  // Create users
  for (const user of usersToImport) {
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
  let restaurantCount = 0;
  for (const resto of restaurantsToImport) {
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
      restaurantCount++;
      console.log(`[INIT] Created restaurant: ${resto.name}`);
    }
  }

  return { createdUsers, restaurantCount };
}

export async function POST(request: Request) {
  try {
    // Skip token verification if INIT_TOKEN is not set (for development/testing)
    const token = request.headers.get("x-init-token");
    if (process.env.INIT_TOKEN && token !== process.env.INIT_TOKEN) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { sqlContent } = body || {};

    const adapter = new PrismaLibSql({
      url: process.env.DATABASE_URL!,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    const prisma = new PrismaClient({ adapter } as any);

    console.log("[INIT] Starting database initialization...");

    // If SQL content provided, parse and import it (even if data exists)
    if (sqlContent) {
      const result = await importFromSQL(prisma, sqlContent);
      console.log("[INIT] ✅ SQL import completed");
      await prisma.$disconnect();
      return Response.json({
        success: true,
        message: "Database imported from SQL",
        stats: {
          usersCreated: result.usersCreated,
          restaurantsCreated: result.restaurantsCreated,
          totalUsersImported: result.totalUsersImported,
        },
      });
    }

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

    // Otherwise use demo data
    const result = await initializeDatabase(prisma, DEMO_USERS, DEMO_RESTAURANTS);

    console.log("[INIT] ✅ Database initialization completed");
    await prisma.$disconnect();

    return Response.json({
      success: true,
      message: "Database initialized successfully",
      users: Object.keys(result.createdUsers).length,
      restaurants: result.restaurantCount,
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
