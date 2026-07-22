/**
 * RazorpayCheckout — modal WebView that loads the Razorpay payment form.
 *
 * Usage:
 *   <RazorpayCheckout
 *     visible={show}
 *     orderId="order_xxx"
 *     amount={50000}          // paise
 *     keyId="rzp_test_xxx"
 *     prefill={{ name, email, contact }}
 *     description="Wallet Top-up"
 *     onSuccess={({ razorpayPaymentId, razorpayOrderId, razorpaySignature }) => ...}
 *     onDismiss={() => setShow(false)}
 *   />
 */

import React, { useRef } from "react";
import {
  Modal, View, StyleSheet, Platform, ActivityIndicator,
  Pressable, Text,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";

export type RazorpaySuccessPayload = {
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
};

type Props = {
  visible: boolean;
  orderId: string;
  amount: number;
  keyId: string;
  prefill: { name?: string; email?: string; contact?: string };
  description?: string;
  onSuccess: (payload: RazorpaySuccessPayload) => void;
  onDismiss: () => void;
};

function buildCheckoutHtml(props: Omit<Props, "visible" | "onSuccess" | "onDismiss">) {
  const { orderId, amount, keyId, prefill, description } = props;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <title>Pay with Razorpay</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0F1F3D; display: flex; align-items: center; justify-content: center;
           min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
    .card { background: #1a2e52; border-radius: 16px; padding: 32px 24px; max-width: 380px;
            width: 90%; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
    .logo { font-size: 28px; margin-bottom: 8px; }
    h2 { color: #fff; font-size: 18px; margin-bottom: 6px; }
    .amount { color: #FF7A18; font-size: 32px; font-weight: 700; margin: 12px 0 20px; }
    .desc { color: rgba(255,255,255,0.6); font-size: 13px; margin-bottom: 24px; }
    button { background: linear-gradient(135deg, #FF7A18, #FF9F43); color: #fff; border: none;
             border-radius: 12px; padding: 14px 32px; font-size: 16px; font-weight: 600;
             width: 100%; cursor: pointer; transition: opacity 0.2s; }
    button:active { opacity: 0.85; }
    .secure { color: rgba(255,255,255,0.4); font-size: 11px; margin-top: 16px; }
    .spinner { display: none; }
    .spinner.active { display: block; color: #FF7A18; margin-top: 12px; }
    .error { color: #ef4444; font-size: 13px; margin-top: 12px; display: none; }
    .error.active { display: block; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🧡</div>
    <h2>RentZilla Secure Pay</h2>
    <div class="amount">₹${(amount / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
    <div class="desc">${description || "Payment"}</div>
    <button id="payBtn" onclick="openCheckout()">Pay Now</button>
    <p class="spinner" id="spinner">Opening secure checkout…</p>
    <p class="error" id="errMsg"></p>
    <p class="secure">🔒 Secured by Razorpay · PCI-DSS Compliant</p>
  </div>

  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    function openCheckout() {
      document.getElementById('payBtn').disabled = true;
      document.getElementById('spinner').classList.add('active');
      document.getElementById('errMsg').classList.remove('active');

      var options = {
        key: "${keyId}",
        amount: ${amount},
        currency: "INR",
        name: "RentZilla",
        description: "${(description || "Payment").replace(/"/g, '\\"')}",
        image: "",
        order_id: "${orderId}",
        prefill: {
          name: "${(prefill.name || "").replace(/"/g, '\\"')}",
          email: "${(prefill.email || "").replace(/"/g, '\\"')}",
          contact: "${(prefill.contact || "").replace(/"/g, '\\"')}"
        },
        theme: { color: "#FF7A18" },
        modal: { escape: false, backdropclose: false },
        handler: function(response) {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
            type: "PAYMENT_SUCCESS",
            razorpayPaymentId: response.razorpay_payment_id,
            razorpayOrderId: response.razorpay_order_id,
            razorpaySignature: response.razorpay_signature
          }));
        }
      };

      var rzp = new Razorpay(options);

      rzp.on('payment.failed', function(response) {
        document.getElementById('payBtn').disabled = false;
        document.getElementById('spinner').classList.remove('active');
        var err = (response.error && response.error.description) || "Payment failed. Please try again.";
        document.getElementById('errMsg').textContent = err;
        document.getElementById('errMsg').classList.add('active');
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
          type: "PAYMENT_FAILED", error: err
        }));
      });

      rzp.on('modal.closed', function() {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
          type: "PAYMENT_DISMISSED"
        }));
      });

      rzp.open();
    }
  </script>
</body>
</html>
`;
}

export default function RazorpayCheckout({
  visible, orderId, amount, keyId, prefill, description, onSuccess, onDismiss,
}: Props) {
  const [loading, setLoading] = React.useState(true);
  const insets = useSafeAreaInsets();
  const html = buildCheckoutHtml({ orderId, amount, keyId, prefill, description });

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "PAYMENT_SUCCESS") {
        onSuccess({
          razorpayPaymentId: msg.razorpayPaymentId,
          razorpayOrderId: msg.razorpayOrderId,
          razorpaySignature: msg.razorpaySignature,
        });
      } else if (msg.type === "PAYMENT_DISMISSED") {
        onDismiss();
      }
    } catch {}
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}>
      <SafeAreaView style={s.container} edges={["top", "left", "right"]}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Secure Payment</Text>
          <Pressable onPress={onDismiss} hitSlop={12} style={s.closeBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </View>

        {loading && (
          <View style={s.loader}>
            <ActivityIndicator color="#FF7A18" size="large" />
            <Text style={s.loaderText}>Loading secure checkout…</Text>
          </View>
        )}

        {/* paddingBottom pushes WebView viewport above the Android system nav bar
            so Razorpay's "Continue" button is never hidden behind it */}
        <View style={[s.webviewContainer, { paddingBottom: insets.bottom }]}>
          <WebView
            source={{ html, baseUrl: "https://checkout.razorpay.com" }}
            onMessage={handleMessage}
            onLoadEnd={() => setLoading(false)}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={["*"]}
            style={[s.webview, loading && { opacity: 0 }]}
            onShouldStartLoadWithRequest={() => true}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F1F3D" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
  closeBtn: { position: "absolute", right: 16 },
  webviewContainer: { flex: 1, backgroundColor: "#fff" },
  webview: { flex: 1 },
  loader: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 10 },
  loaderText: { color: "rgba(255,255,255,0.6)", marginTop: 12, fontSize: 14 },
});
