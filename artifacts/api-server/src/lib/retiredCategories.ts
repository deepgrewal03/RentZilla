import { sql } from "drizzle-orm";
import { listingsTable } from "@workspace/db/schema";

const retired = new Set(["sprayer", "rockbreaker", "bulldozer", "painter", "wheelloader"]);
export function isRetiredCategory(value: unknown): boolean {
  return typeof value === "string" && retired.has(value.toLowerCase().replace(/[\s_-]+/g, ""));
}

// Keep historical rows for bookings/invoices, but exclude them from the catalog.
export const activeCatalog = sql`regexp_replace(lower(coalesce(${listingsTable.subcategory}, '')), '[[:space:]_-]+', '', 'g') NOT IN ('sprayer', 'rockbreaker', 'bulldozer', 'painter', 'wheelloader')`;
