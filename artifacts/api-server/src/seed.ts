import { db } from "@workspace/db";
import { usersTable, listingsTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";

function id() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

async function seed() {
  console.log("Seeding database...");

  // Clear existing data
  await db.execute(sql`DELETE FROM bookings`);
  await db.execute(sql`DELETE FROM reviews`);
  await db.execute(sql`DELETE FROM messages`);
  await db.execute(sql`DELETE FROM chats`);
  await db.execute(sql`DELETE FROM listings`);
  await db.execute(sql`DELETE FROM users`);

  // Insert providers
  const providers = [
    { id: id(), phone: "9815001001", name: "Gurpreet Singh", role: "provider" as const, location: "Ludhiana" },
    { id: id(), phone: "9815001002", name: "Harjinder Kaur", role: "provider" as const, location: "Amritsar" },
    { id: id(), phone: "9815001003", name: "Balwinder Kumar", role: "provider" as const, location: "Patiala" },
    { id: id(), phone: "9815001004", name: "Manpreet Dhaliwal", role: "provider" as const, location: "Jalandhar" },
    { id: id(), phone: "9815001005", name: "Sukhwinder Singh", role: "provider" as const, location: "Bathinda" },
  ];

  for (const p of providers) {
    await db.insert(usersTable).values({ ...p, profileImage: null }).onConflictDoNothing();
  }

  // Insert listings
  const listings = [
    // Cars
    {
      id: id(), providerId: providers[0].id,
      category: "cars" as const, subcategory: "Sedan",
      title: "Honda City 2022 – Well Maintained AC Car",
      description: "Clean, well-maintained Honda City. Ideal for weddings, events, or daily travel. AC works perfectly. Available across Ludhiana.",
      price: 1800, priceUnit: "per_day" as const, location: "Ludhiana",
      images: ["https://images.unsplash.com/photo-1590362891991-f776e747a588?w=800"],
      isAvailable: true,
    },
    {
      id: id(), providerId: providers[0].id,
      category: "cars" as const, subcategory: "SUV",
      title: "Mahindra Thar 4x4 – Off-road Adventures",
      description: "Tough Mahindra Thar for off-road and city drives. Perfect for group outings to Himachal or Wagah Border.",
      price: 2800, priceUnit: "per_day" as const, location: "Ludhiana",
      images: ["https://images.unsplash.com/photo-1612825173281-9a193378527e?w=800"],
      isAvailable: true,
    },
    {
      id: id(), providerId: providers[1].id,
      category: "cars" as const, subcategory: "Van",
      title: "Innova Crysta 7-Seat Van for Family Trips",
      description: "Spacious Toyota Innova Crysta for family outings, pilgrimages to Harmandir Sahib, or corporate travel.",
      price: 2500, priceUnit: "per_day" as const, location: "Amritsar",
      images: ["https://images.unsplash.com/photo-1619767886558-efdc259b6e09?w=800"],
      isAvailable: true,
    },
    // Equipment
    {
      id: id(), providerId: providers[2].id,
      category: "equipment" as const, subcategory: "Tractor",
      title: "Mahindra 575 DI Tractor – Paddy & Wheat Ready",
      description: "Powerful 45HP Mahindra 575 DI tractor. Comes with rotavator attachment. Ideal for paddy transplanting and wheat sowing in Punjab fields.",
      price: 1200, priceUnit: "per_day" as const, location: "Patiala",
      images: ["https://images.unsplash.com/photo-1589923188900-85dae523342b?w=800"],
      isAvailable: true,
    },
    {
      id: id(), providerId: providers[2].id,
      category: "equipment" as const, subcategory: "Harvester",
      title: "New Holland TC 5.30 Combine Harvester",
      description: "High-capacity combine harvester for wheat and paddy. Expert operator included. 20 acres/day capacity. Available during season.",
      price: 3500, priceUnit: "per_day" as const, location: "Patiala",
      images: ["https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800"],
      isAvailable: true,
    },
    {
      id: id(), providerId: providers[3].id,
      category: "equipment" as const, subcategory: "Rotavator",
      title: "Sonalika Rotavator 6ft – Field Preparation",
      description: "Heavy-duty 6-foot rotavator for perfect seedbed preparation. Works with any 40HP+ tractor. Rent for the season.",
      price: 800, priceUnit: "per_day" as const, location: "Jalandhar",
      images: ["https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800"],
      isAvailable: true,
    },
    {
      id: id(), providerId: providers[4].id,
      category: "equipment" as const, subcategory: "Sprayer",
      title: "Boom Sprayer – Pesticide & Fertilizer",
      description: "12m boom sprayer for efficient crop protection. Compatible with tractors. Covers large areas quickly. Maintains quality application.",
      price: 600, priceUnit: "per_day" as const, location: "Bathinda",
      images: ["https://images.unsplash.com/photo-1625246333195-78d73c02f5e2?w=800"],
      isAvailable: true,
    },
    // Services
    {
      id: id(), providerId: providers[1].id,
      category: "services" as const, subcategory: "Plumber",
      title: "Expert Plumber – Bathroom & Kitchen Repairs",
      description: "Certified plumber with 10 years experience. Pipe fitting, tap repair, geyser installation, bathroom fitting. Available 24/7 for emergencies.",
      price: 500, priceUnit: "per_hour" as const, location: "Amritsar",
      images: [],
      isAvailable: true,
    },
    {
      id: id(), providerId: providers[3].id,
      category: "services" as const, subcategory: "Electrician",
      title: "Licensed Electrician – Wiring & Repairs",
      description: "Experienced electrician for home and commercial wiring, switchboard repairs, AC installation, and inverter setup.",
      price: 450, priceUnit: "per_hour" as const, location: "Jalandhar",
      images: [],
      isAvailable: true,
    },
    {
      id: id(), providerId: providers[0].id,
      category: "services" as const, subcategory: "Beauty",
      title: "Professional Beauty & Makeup Artist",
      description: "Certified makeup artist specializing in bridal makeup, sangeet looks, and everyday grooming. Home visits available for Ludhiana & nearby areas.",
      price: 2000, priceUnit: "per_day" as const, location: "Ludhiana",
      images: [],
      isAvailable: true,
    },
    {
      id: id(), providerId: providers[4].id,
      category: "services" as const, subcategory: "Carpenter",
      title: "Skilled Carpenter – Furniture & Woodwork",
      description: "Professional carpenter for custom furniture, door fitting, kitchen cabinets, and repair work. Quality craftsmanship at affordable rates.",
      price: 700, priceUnit: "per_day" as const, location: "Bathinda",
      images: [],
      isAvailable: true,
    },
  ];

  for (const l of listings) {
    await db.insert(listingsTable).values(l).onConflictDoNothing();
  }

  console.log(`Seeded ${providers.length} providers and ${listings.length} listings`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
