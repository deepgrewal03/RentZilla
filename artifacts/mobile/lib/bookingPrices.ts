export interface GoldStatus {
  isGoldMember: boolean;
  isExpired: boolean;
  expiresAt: string | null;
  discountPercent: number;
}

export function hasActiveGold(status: GoldStatus | null, now = Date.now()): boolean {
  return !!status?.isGoldMember && !status.isExpired &&
    !!status.expiresAt && new Date(status.expiresAt).getTime() > now;
}

const money = (value: number) => Math.round(value * 100) / 100;

/** Mirrors listing-booking settlement: Gold applies after promos, not to later extras. */
export function bookingPrices(base: number, promo = 0, extras = 0, percent = 4) {
  const subtotal = Math.max(0, base - promo);
  const saving = money(subtotal * percent / 100);
  return {
    normal: money(subtotal + extras),
    gold: money(Math.max(0, subtotal - saving) + extras),
    saving,
  };
}

export function listingBookingBase(price: number, count: number) {
  return Number(price) * Math.max(1, count);
}
