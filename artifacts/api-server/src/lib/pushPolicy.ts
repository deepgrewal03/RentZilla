export const PUSH_CHANNELS = ["bookings", "messages", "payments", "rentals", "offers", "account"] as const;
export function pushCategory(value: unknown): string {
  return PUSH_CHANNELS.includes(value as any) ? String(value) : "account";
}
export function pushTarget(type: unknown, id: unknown): { targetType?: string; targetId?: string } {
  if (!["booking", "chat", "listing"].includes(String(type)) ||
      typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,120}$/.test(id)) return {};
  return { targetType: String(type), targetId: id };
}
export function retryDelay(attempt: number): number {
  return Math.min(3600, 15 * 2 ** Math.min(attempt, 8));
}
export function isExpoPushToken(value: unknown): value is string {
  return typeof value === "string" && /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(value) && value.length <= 200;
}
