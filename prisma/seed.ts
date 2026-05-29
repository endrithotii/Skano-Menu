import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

const dbUrl = process.env.DATABASE_URL || "file:./prisma/dev.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;
const adapter = new PrismaLibSql({ url: dbUrl, ...(authToken ? { authToken } : {}) });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
async function main() {
  const adminPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@skano.menu" },
    update: {},
    create: { email: "admin@skano.menu", password: adminPassword, name: "Super Admin", role: "SUPER_ADMIN" },
  });

  const ownerPassword = await bcrypt.hash("owner123", 10);
  const owner = await prisma.user.upsert({
    where: { email: "resto@skano.menu" },
    update: {},
    create: { email: "resto@skano.menu", password: ownerPassword, name: "Arben Krasniqi", role: "MANAGER" },
  });

  const owner2Password = await bcrypt.hash("owner123", 10);
  const owner2 = await prisma.user.upsert({
    where: { email: "cafe@skano.menu" },
    update: {},
    create: { email: "cafe@skano.menu", password: owner2Password, name: "Blerim Hoxha", role: "MANAGER" },
  });

  const existing = await prisma.restaurant.findUnique({ where: { slug: "bella-vista-prishtina" } });
  if (!existing) {
    const restaurant = await prisma.restaurant.create({
      data: {
        name: "Bella Vista",
        slug: "bella-vista-prishtina",
        description: "Fine Mediterranean dining in the heart of Prishtina.",
        address: "Rr. Nena Tereze 15, Prishtina, Kosovo",
        phone: "+383 44 123 456",
        email: "info@bellavista.ks",
        cuisine: JSON.stringify(["Mediterranean", "Italian", "Grill & BBQ"]),
        status: "ACTIVE",
        templateId: "elegant",
        primaryColor: "#c9a84c",
        ownerId: owner.id,
      },
    });

    const starters = await prisma.menuCategory.create({ data: { name: "Starters", icon: "🥗", order: 0, restaurantId: restaurant.id } });
    const mains = await prisma.menuCategory.create({ data: { name: "Main Courses", icon: "🍽️", order: 1, restaurantId: restaurant.id } });
    const drinks = await prisma.menuCategory.create({ data: { name: "Drinks", icon: "🍷", order: 2, restaurantId: restaurant.id } });
    const desserts = await prisma.menuCategory.create({ data: { name: "Desserts", icon: "🍰", order: 3, restaurantId: restaurant.id } });

    await prisma.menuItem.createMany({
      data: [
        { name: "Bruschetta", description: "Toasted bread with fresh tomatoes and basil", price: 4.5, tags: JSON.stringify(["vegetarian","popular"]), allergens: JSON.stringify(["Gluten"]), categoryId: starters.id, isFeatured: true },
        { name: "Caprese Salad", description: "Buffalo mozzarella, tomatoes, fresh basil, balsamic glaze", price: 6.5, tags: JSON.stringify(["vegetarian","gluten-free"]), allergens: JSON.stringify(["Dairy"]), categoryId: starters.id },
        { name: "Grilled Octopus", description: "Tender grilled octopus with lemon and capers", price: 12.0, tags: JSON.stringify(["popular","chef-special"]), allergens: JSON.stringify(["Shellfish"]), categoryId: starters.id },
        { name: "Beef Tenderloin", description: "200g prime beef with truffle butter and roasted potatoes", price: 24.0, tags: JSON.stringify(["popular","chef-special"]), allergens: JSON.stringify(["Dairy"]), categoryId: mains.id, isFeatured: true },
        { name: "Seabass Fillet", description: "Pan-seared seabass with lemon butter and asparagus", price: 18.5, tags: JSON.stringify(["gluten-free"]), allergens: JSON.stringify(["Fish","Dairy"]), categoryId: mains.id },
        { name: "Truffle Tagliatelle", description: "Fresh egg pasta with black truffle and parmesan", price: 16.0, tags: JSON.stringify(["vegetarian","popular"]), allergens: JSON.stringify(["Gluten","Dairy","Eggs"]), categoryId: mains.id },
        { name: "Tiramisu", description: "Classic Italian dessert with mascarpone and espresso", price: 6.0, tags: JSON.stringify(["popular"]), allergens: JSON.stringify(["Dairy","Eggs","Gluten"]), categoryId: desserts.id },
        { name: "Panna Cotta", description: "Vanilla panna cotta with wild berry coulis", price: 5.5, tags: JSON.stringify(["gluten-free"]), allergens: JSON.stringify(["Dairy"]), categoryId: desserts.id, isFeatured: true },
        { name: "House Red Wine", description: "Selected Italian red wine, 200ml", price: 5.0, categoryId: drinks.id, tags: JSON.stringify([]) },
        { name: "Aperol Spritz", description: "Aperol spritz with prosecco and soda", price: 6.0, categoryId: drinks.id, tags: JSON.stringify(["popular"]) },
        { name: "Fresh Lemonade", description: "House-made lemonade with fresh mint", price: 3.5, categoryId: drinks.id, tags: JSON.stringify(["vegan"]) },
      ],
    });

    await prisma.feedback.createMany({
      data: [
        { rating: 5, comment: "Amazing food and service!", customerName: "Maria K.", restaurantId: restaurant.id },
        { rating: 4, comment: "Great atmosphere, the beef tenderloin was exceptional", customerName: "Driton B.", restaurantId: restaurant.id },
        { rating: 5, comment: "Best restaurant in Prishtina!", customerName: "Ana M.", restaurantId: restaurant.id },
        { rating: 4, comment: "Loved the tiramisu", customerName: "Faton H.", restaurantId: restaurant.id },
      ],
    });

    for (let i = 0; i < 47; i++) {
      await prisma.menuScan.create({
        data: {
          restaurantId: restaurant.id,
          deviceType: i % 3 === 0 ? "desktop" : "mobile",
          createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        },
      });
    }

    const today = new Date().toISOString().split("T")[0];
    await prisma.dailyMenu.create({
      data: {
        date: today,
        title: "Today's Specials",
        description: "Fresh seasonal dishes curated by our chef",
        isActive: true,
        restaurantId: restaurant.id,
        items: JSON.stringify([
          { name: "Chef's Pasta of the Day", price: 9.0, description: "Ask your server for today's selection" },
          { name: "Grilled Fish Platter", price: 15.0, description: "Fresh catch with Mediterranean herbs" },
          { name: "Seasonal Risotto", price: 11.0, description: "Creamy risotto with today's finest ingredients" },
        ]),
      },
    });
  }

  const existing2 = await prisma.restaurant.findUnique({ where: { slug: "urban-coffee-prizren" } });
  if (!existing2) {
    const cafe = await prisma.restaurant.create({
      data: {
        name: "Urban Coffee",
        slug: "urban-coffee-prizren",
        description: "Specialty coffee and artisan food in Prizren's historic center.",
        address: "Sheshi Shatërvan, Prizren, Kosovo",
        phone: "+383 45 789 012",
        email: "hello@urbancoffee.ks",
        cuisine: JSON.stringify(["Coffee & Cafe", "Desserts"]),
        status: "ACTIVE",
        templateId: "vibrant",
        primaryColor: "#6f4e37",
        ownerId: owner2.id,
      },
    });

    const coffees = await prisma.menuCategory.create({ data: { name: "Coffee", icon: "☕", order: 0, restaurantId: cafe.id } });
    const food = await prisma.menuCategory.create({ data: { name: "Food & Snacks", icon: "🥪", order: 1, restaurantId: cafe.id } });
    const juices = await prisma.menuCategory.create({ data: { name: "Cold Drinks", icon: "🥤", order: 2, restaurantId: cafe.id } });

    await prisma.menuItem.createMany({
      data: [
        { name: "Espresso", price: 1.5, description: "Single shot of our house blend", categoryId: coffees.id, tags: JSON.stringify(["popular","vegan"]) },
        { name: "Cappuccino", price: 2.5, description: "Double espresso with steamed milk foam", categoryId: coffees.id, tags: JSON.stringify(["popular"]), allergens: JSON.stringify(["Dairy"]), isFeatured: true },
        { name: "Cold Brew", price: 3.5, description: "12-hour cold extracted coffee", categoryId: coffees.id, tags: JSON.stringify(["popular","vegan"]), isFeatured: true },
        { name: "Avocado Toast", price: 6.5, description: "Sourdough toast with smashed avocado, feta and chili flakes", categoryId: food.id, tags: JSON.stringify(["vegetarian","popular"]), allergens: JSON.stringify(["Gluten","Dairy"]) },
        { name: "Croissant", price: 2.5, description: "Fresh baked buttery croissant", categoryId: food.id, tags: JSON.stringify([]), allergens: JSON.stringify(["Gluten","Dairy","Eggs"]) },
        { name: "Fresh Orange Juice", price: 3.0, description: "Freshly squeezed Valencia oranges", categoryId: juices.id, tags: JSON.stringify(["vegan"]) },
        { name: "Mango Smoothie", price: 4.0, description: "Fresh mango, banana and coconut milk", categoryId: juices.id, tags: JSON.stringify(["vegan","popular"]), isFeatured: true },
      ],
    });

    for (let i = 0; i < 23; i++) {
      await prisma.menuScan.create({
        data: {
          restaurantId: cafe.id,
          deviceType: i % 4 === 0 ? "tablet" : "mobile",
          createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  console.log("Seed complete");
  console.log("Admin: admin@skano.menu / admin123");
  console.log("Restaurant owner: resto@skano.menu / owner123");
  console.log("Cafe owner: cafe@skano.menu / owner123");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
