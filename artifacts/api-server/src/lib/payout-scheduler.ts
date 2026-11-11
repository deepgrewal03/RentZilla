/**
 * Provider disbursements are not connected to a bank-transfer service.
 * Razorpay checkout collects money; it does not implement provider payouts.
 * Never simulate a successful transfer by deducting the local wallet.
 */
import { logger } from "./logger.js";

export async function runWeeklyPayouts(): Promise<void> {
  logger.warn("Weekly bank payouts are unavailable; wallet balances were not changed.");
}

export function startPayoutScheduler(): void {
  // Do not schedule wallet mutations until real disbursement and reconciliation
  // are implemented. Keep the exported interface for startup/admin callers.
  logger.info("Bank payout scheduler disabled: disbursement integration is not configured.");
}
