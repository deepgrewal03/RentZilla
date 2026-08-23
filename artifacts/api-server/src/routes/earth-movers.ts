import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { listingsTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";

const router: IRouter = Router();

const EARTH_MOVER_TYPES = [
  { id: "JCB",          label: "JCB",           icon: "construct",    description: "Backhoe loader for digging and loading" },
  { id: "Excavator",    label: "Excavator",      icon: "construct",    description: "Hydraulic excavator for heavy digging" },
  { id: "Bulldozer",    label: "Bulldozer",      icon: "build",        description: "Track-type dozer for pushing material" },
  { id: "Poclain",      label: "Poclain",        icon: "construct",    description: "Heavy-duty crawler excavator for deep digging" },
  { id: "Rock Breaker", label: "Rock Breaker",   icon: "hammer",       description: "Hydraulic breaker attachment for breaking rock" },
  { id: "Wheel Loader",  label: "Wheel Loader",   icon: "cube",         description: "Wheel loader for loading and material transport" },
  { id: "Chhota Hathi", label: "Chhota Hathi",   icon: "car",          description: "Mini goods carrier for short-distance delivery and transport" },
  { id: "Loader",       label: "Loader",         icon: "cube",         description: "Loader for material handling" },
  { id: "Backhoe",      label: "Backhoe",        icon: "construct",    description: "Backhoe for trenching and digging" },
  { id: "Roller",       label: "Roller",         icon: "disc",         description: "Compactor roller for road and soil compaction" },
  { id: "Crane",        label: "Crane",          icon: "arrow-up",     description: "Mobile crane for lifting operations" },
  { id: "Dump Truck",   label: "Dump Truck",     icon: "car-sport",    description: "Heavy-duty dump truck for material transport" },
];

router.get("/", async (_req: Request, res: Response) => {
  res.json({
    category: "Earth Movers",
    description: "Heavy construction and earth-moving equipment for hire in Punjab",
    types: EARTH_MOVER_TYPES,
  });
});

router.get("/listings", async (req: Request, res: Response) => {
  try {
    const { type, location, availability, operatorRequired, minPrice, maxPrice } = req.query;

    const earthMoverSubcats = EARTH_MOVER_TYPES.map((t) => t.id);
    const conditions = [
      eq(listingsTable.category, "equipment"),
      inArray(listingsTable.subcategory, earthMoverSubcats),
    ];

    if (type) {
      conditions.push(eq(listingsTable.subcategory, type as string));
    }
    if (availability === "true") {
      conditions.push(eq(listingsTable.isAvailable, true));
    }
    if (location) {
      conditions.push(eq(listingsTable.location, location as string));
    }

    const listings = await db
      .select()
      .from(listingsTable)
      .where(and(...conditions));

    res.json(listings.map((l) => ({
      id: l.id,
      type: l.subcategory,
      title: l.title,
      description: l.description,
      price: l.price,
      priceUnit: l.priceUnit,
      location: l.location,
      isAvailable: l.isAvailable,
      operatorIncluded: l.operatorIncluded ?? false,
      fuelIncluded: l.fuelIncluded ?? false,
      deliveryCharges: l.deliveryCharges ?? null,
      images: (l.images as string[]) || [],
      providerId: l.providerId,
    })));
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/types", (_req: Request, res: Response) => {
  res.json(EARTH_MOVER_TYPES);
});

export default router;
