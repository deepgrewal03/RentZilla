/**
 * useRazorpay — hook to create a Razorpay order, show checkout, verify payment.
 *
 * const { initiatePayment, checkoutProps, clearCheckout } = useRazorpay();
 *
 * 1. Call initiatePayment({ purpose, amount? }) — creates order on server
 * 2. Render <RazorpayCheckout {...checkoutProps} />
 * 3. On success, verification happens automatically — onSuccess(result) called
 * 4. Call clearCheckout() to reset
 */

import { useState, useCallback } from "react";
import { useApi } from "./useApi";
import type { RazorpaySuccessPayload } from "@/components/RazorpayCheckout";

export type RazorpayPurpose = "wallet_topup" | "gold_membership" | "wheel_spin";

export type RazorpayVerifyResult = {
  success: boolean;
  purpose: RazorpayPurpose;
  newBalance?: number;
  paidSpinBalance?: number;
  isGoldMember?: boolean;
  expiresAt?: string;
  transactionId?: string;
  paymentId?: string;
  alreadyFulfilled?: boolean;
};

type CheckoutState = {
  visible: boolean;
  orderId: string;
  amount: number;
  keyId: string;
  prefill: { name?: string; email?: string; contact?: string };
  description: string;
  onSuccess: (payload: RazorpaySuccessPayload) => void;
  onDismiss: () => void;
};

export function useRazorpay() {
  const { post } = useApi();
  const [checkout, setCheckout] = useState<CheckoutState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiatePayment = useCallback(
    async ({
      purpose,
      amount,
      description,
      onSuccess,
      onError,
      onDismiss,
    }: {
      purpose: RazorpayPurpose;
      amount?: number;
      description?: string;
      onSuccess: (result: RazorpayVerifyResult) => void;
      onError?: (msg: string) => void;
      onDismiss?: () => void;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const order = await post<{
          orderId: string;
          amount: number;
          keyId: string;
          prefill: { name?: string; email?: string; contact?: string };
          purpose: string;
          amountINR: number;
        }>("/payments/create-order", { purpose, amount });

        const desc =
          description ||
          (purpose === "wallet_topup"
            ? `Wallet Top-up ₹${order.amountINR}`
            : purpose === "gold_membership"
            ? "Gold Membership — ₹2.49/year"
            : "Wheel of Fortune Spin — ₹1");

        setCheckout({
          visible: true,
          orderId: order.orderId,
          amount: order.amount,
          keyId: order.keyId,
          prefill: order.prefill,
          description: desc,
          onSuccess: async (payload: RazorpaySuccessPayload) => {
            setCheckout(null);
            setLoading(true);
            try {
              const verified = await post<RazorpayVerifyResult>("/payments/verify", {
                razorpayOrderId: payload.razorpayOrderId,
                razorpayPaymentId: payload.razorpayPaymentId,
                razorpaySignature: payload.razorpaySignature,
              });
              onSuccess(verified);
            } catch (e: any) {
              const msg = e?.message || "Payment verification failed";
              setError(msg);
              onError?.(msg);
            } finally {
              setLoading(false);
            }
          },
          onDismiss: () => {
            setCheckout(null);
            onDismiss?.();
          },
        });
      } catch (e: any) {
        const msg = e?.message || "Could not initiate payment";
        setError(msg);
        onError?.(msg);
      } finally {
        setLoading(false);
      }
    },
    [post]
  );

  const clearCheckout = useCallback(() => {
    setCheckout(null);
    setError(null);
  }, []);

  return { initiatePayment, checkout, clearCheckout, loading, error };
}
