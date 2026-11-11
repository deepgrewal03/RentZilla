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

export function isConfirmedProviderPayment(
  payment: { id: string; order_id?: string | null; status: string; amount: number | string; currency: string },
  expected: { paymentId: string; orderId: string; amountPaise: number },
): boolean {
  return payment.id === expected.paymentId
    && payment.order_id === expected.orderId
    && payment.status === "captured"
    && payment.currency === "INR"
    && Number.isSafeInteger(expected.amountPaise)
    && expected.amountPaise > 0
    && Number(payment.amount) === expected.amountPaise;
}

export function isReusableProviderOrder(
  order: { id: string; currency: string; amount: number | string; status: string },
  expected: { orderId: string; amountPaise: number },
): boolean {
  return order.id === expected.orderId
    && order.currency === "INR"
    && Number(order.amount) === expected.amountPaise
    && (order.status === "created" || order.status === "attempted");
}