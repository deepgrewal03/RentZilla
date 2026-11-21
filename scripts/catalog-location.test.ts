import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const { districts, punjabTowns, resolveCatalogLocation, matchesCatalogLocation, matchesCatalogListing } =
  createRequire(import.meta.url)("../artifacts/mobile/lib/catalogLocation.ts") as typeof import("../artifacts/mobile/lib/catalogLocation");

test("spreadsheet contains 23 districts and 237 town/city entries", () => {
  assert.equal(districts.length, 23);
  assert.equal(Object.values(punjabTowns).flat().length, 237);
});
test("town-only and full comma-separated address identify the same district", () => {
  assert.deepEqual(resolveCatalogLocation("Jagraon"), { district: "Ludhiana", town: "Jagraon" });
  assert.deepEqual(resolveCatalogLocation("House 12, Jagraon, District Ludhiana, Punjab 142026"), { district: "Ludhiana", town: "Jagraon" });
  assert.equal(matchesCatalogLocation("Jagraon, Ludhiana", "Ludhiana", ""), true);
  assert.equal(matchesCatalogLocation("Jagraon, Ludhiana", "Ludhiana", "Ludhiana"), false);
  assert.equal(matchesCatalogLocation("Jagraon, Ludhiana", "Amritsar", ""), false);
});
test("ambiguous town names require the saved district, never the selected filter", () => {
  assert.equal(resolveCatalogLocation("Jandiala"), null);
  assert.equal(matchesCatalogLocation("Jandiala", "Amritsar", "Jandiala"), false);
  assert.deepEqual(resolveCatalogLocation("Jandiala, Jalandhar"), { district: "Jalandhar", town: "Jandiala" });
  assert.deepEqual(resolveCatalogLocation("Jandiala, Amritsar"), { district: "Amritsar", town: "Jandiala" });
});
test("common location aliases map to spreadsheet labels", () => {
  assert.deepEqual(resolveCatalogLocation("Mohali"), { district: "Sahibzada Ajit Singh Nagar", town: "SAS Nagar" });
  assert.deepEqual(resolveCatalogLocation("Ferozepur"), { district: "Ferozepur", town: "Firozpur" });
  assert.deepEqual(resolveCatalogLocation("Ropar"), { district: "Rupnagar", town: "Rupnagar" });
});
test("road substrings and conflicting districts never create false matches", () => {
  assert.equal(resolveCatalogLocation("Gill Road"), null);
  assert.equal(resolveCatalogLocation("Amritsar, Ludhiana"), null);
  assert.equal(matchesCatalogLocation("Unlisted village", "", ""), true);
  assert.equal(matchesCatalogLocation("Unlisted village", "Ludhiana", ""), false);
});
test("category pages only show available listings of the exact selected type", () => {
  const item = { category: "equipment", subcategory: "Tractor", location: "Jagraon", isAvailable: true, providerId: "owner" };
  assert.equal(matchesCatalogListing(item, "equipment", "Tractor", "Ludhiana", "Jagraon", "customer"), true);
  assert.equal(matchesCatalogListing(item, "equipment", "Harvester", "", ""), false);
  assert.equal(matchesCatalogListing({ ...item, isAvailable: false }, "equipment", "Tractor", "", ""), false);
  assert.equal(matchesCatalogListing(item, "equipment", "Tractor", "", "", "owner"), false);
  const service = { ...item, category: "services", subcategory: "Plumbing" };
  assert.equal(matchesCatalogListing(service, "services", "Plumbing", "Ludhiana", ""), true);
  assert.equal(matchesCatalogListing(service, "equipment", "Plumbing", "", ""), false);
});
