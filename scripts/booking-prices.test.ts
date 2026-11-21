import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const { bookingPrices, hasActiveGold, listingBookingBase } =
  createRequire(import.meta.url)("../artifacts/mobile/lib/bookingPrices.ts") as typeof import("../artifacts/mobile/lib/bookingPrices");

test("Gold is 4% of the subtotal after promo discounts", () => {
  assert.deepEqual(bookingPrices(1000, 100), { normal: 900, gold: 864, saving: 36 });
});
test("subsequent service fees and extras are not discounted", () => {
  assert.deepEqual(bookingPrices(1000, 100, 75), { normal: 975, gold: 939, saving: 36 });
});
test("rounds discounts to paise and preserves a zero payable amount", () => {
  assert.deepEqual(bookingPrices(99.99), { normal: 99.99, gold: 95.99, saving: 4 });
  assert.deepEqual(bookingPrices(100, 100), { normal: 0, gold: 0, saving: 0 });
});
test("days and slots both use the listing rate, not service-rule estimates", () => {
  assert.equal(listingBookingBase(250, 3), 750);
  assert.equal(bookingPrices(listingBookingBase(250, 3)).gold, 720);
});
test("only a non-expired membership with an expiry date qualifies", () => {
  const status = { isGoldMember: true, isExpired: false, expiresAt: "2030-01-01T00:00:00Z", discountPercent: 4 };
  const now = Date.parse("2026-01-01T00:00:00Z");
  assert.equal(hasActiveGold(status, now), true);
  assert.equal(hasActiveGold({ ...status, isGoldMember: false }, now), false);
  assert.equal(hasActiveGold({ ...status, isExpired: true }, now), false);
  assert.equal(hasActiveGold({ ...status, expiresAt: null }, now), false);
  assert.equal(hasActiveGold(status, Date.parse(status.expiresAt)), false);
  assert.equal(hasActiveGold(null, now), false);
});
