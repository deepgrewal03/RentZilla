export type CaptureDecision =
  | { action: "capture" }
  | { action: "idempotent" }
  | { action: "reject"; reason: "PAYMENT_AMOUNT_MISMATCH" | "PAYMENT_REPLAY_MISMATCH" | "PAYMENT_NOT_CAPTURABLE" };

export function decidePaymentCapture(input: {
  status: string;
  storedPaymentId?: string | null;
  incomingPaymentId: string;
  expectedAmountPaise: number;
  receivedAmountPaise?: number;
}): CaptureDecision {
  if (
    input.receivedAmountPaise != null
    && input.receivedAmountPaise !== input.expectedAmountPaise
  ) {
    return { action: "reject", reason: "PAYMENT_AMOUNT_MISMATCH" };
  }
  if (input.status === "paid") {
    return input.storedPaymentId === input.incomingPaymentId
      ? { action: "idempotent" }
      : { action: "reject", reason: "PAYMENT_REPLAY_MISMATCH" };
  }
  if (input.status !== "created") {
    return { action: "reject", reason: "PAYMENT_NOT_CAPTURABLE" };
  }
  return { action: "capture" };
}

export function isBookingPayable(status: string, paymentStatus: string): boolean {
  return status === "pending" && paymentStatus === "pending";
}