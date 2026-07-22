import Razorpay from "razorpay";
import crypto from "crypto";

let _instance: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (!_instance) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set");
    }
    _instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return _instance;
}

export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  try {
    const secret = process.env.RAZORPAY_KEY_SECRET!;
    const body = `${params.orderId}|${params.paymentId}`;
    const expectedSig = crypto.createHmac("sha256", secret).update(body).digest("hex");
    const expected = Buffer.from(expectedSig, "hex");
    // Validate that the provided signature is a valid 64-char hex string (SHA-256)
    if (!/^[0-9a-f]{64}$/i.test(params.signature)) return false;
    const provided = Buffer.from(params.signature, "hex");
    if (expected.length !== provided.length) return false;
    return crypto.timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET!;
  const expectedSig = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expectedSig, "hex"),
    Buffer.from(signature, "hex")
  );
}

export const PURPOSES = {
  WALLET_TOPUP: "wallet_topup",
  GOLD_MEMBERSHIP: "gold_membership",
  WHEEL_SPIN: "wheel_spin",
} as const;

export type RazorpayPurpose = typeof PURPOSES[keyof typeof PURPOSES];
