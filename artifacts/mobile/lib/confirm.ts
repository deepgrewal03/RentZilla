import { Alert, Platform } from "react-native";

/**
 * Cross-platform confirmation dialog.
 *
 * React Native's Alert.alert with buttons is a silent no-op on web
 * (react-native-web renders nothing), which makes buttons wired through it
 * appear "broken" in the browser preview. This helper uses the browser's
 * native confirm() on web and Alert.alert on iOS/Android.
 */
export function confirmAction(opts: {
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const { title, message, confirmText, cancelText = "Cancel", destructive = false, onConfirm } = opts;

  if (Platform.OS === "web") {
    // eslint-disable-next-line no-alert
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) {
      void onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: cancelText, style: "cancel" },
    {
      text: confirmText,
      style: destructive ? "destructive" : "default",
      onPress: () => void onConfirm(),
    },
  ]);
}
