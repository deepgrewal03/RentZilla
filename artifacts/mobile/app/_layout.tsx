import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import NetworkGate from "@/components/NetworkGate";
import SplashAnimation from "@/components/SplashAnimation";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { SoundProvider, StartupSound } from "@/context/SoundContext";
import { setBaseUrl } from "@workspace/api-client-react";
import { API_BASE_URL } from "@/constants/apiUrl";

setBaseUrl(API_BASE_URL);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Public routes that don't require authentication
const PUBLIC_ROUTES = new Set([
  "sign-in", "sign-up", "auth", "forgot-password", "reset-password",
]);

/**
 * Guards protected routes — redirects to sign-in when not authenticated
 * and redirects authenticated users away from auth screens.
 * Must be rendered inside AuthProvider.
 */
function AuthGuard() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const rootSegment = segments[0] as string | undefined;
    const inTabsGroup = rootSegment === "(tabs)";
    const inPublicRoute = rootSegment !== undefined && PUBLIC_ROUTES.has(rootSegment);

    if (!user && inTabsGroup) {
      // Not logged in — send to sign-in
      router.replace("/sign-in");
    } else if (user && inPublicRoute) {
      // Already logged in — send to app
      router.replace("/(tabs)");
    }
  }, [user, isLoading, segments]);

  return null;
}

(async () => {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    await fetch(`${API_BASE_URL}/api/healthz`, { signal: ctrl.signal });
    clearTimeout(timer);
  } catch {
    // silent — server unavailable at startup
  }
})();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="listing/[id]" options={{ presentation: "card" }} />
      <Stack.Screen name="booking/[id]" options={{ presentation: "card" }} />
      <Stack.Screen name="chat/[id]" options={{ presentation: "card" }} />
      <Stack.Screen name="settings" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="become-provider" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="add-listing" options={{ presentation: "modal" }} />
      <Stack.Screen name="new-booking/[id]" options={{ presentation: "card", animation: "slide_from_bottom" }} />
      <Stack.Screen name="provider/[id]" options={{ presentation: "card" }} />
      <Stack.Screen name="promo-vault" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="wallet" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="gold-membership" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="referral" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="trust-verification" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="forgot-password" options={{ presentation: "card", animation: "slide_from_bottom" }} />
      <Stack.Screen name="reset-password" options={{ presentation: "card", animation: "slide_from_bottom" }} />
      <Stack.Screen name="become-customer" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="edit-listing" options={{ presentation: "modal" }} />
      <Stack.Screen name="provider-wallet" options={{ presentation: "card", animation: "slide_from_right" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <SoundProvider>
              <StartupSound splashDone={splashDone} />
              <AuthProvider>
                <AuthGuard />
                <FavoritesProvider>
                  <GestureHandlerRootView style={{ flex: 1 }}>
                    <KeyboardAvoidingView
                      style={{ flex: 1 }}
                      behavior={Platform.OS === "ios" ? "padding" : undefined}
                      keyboardVerticalOffset={0}
                    >
                      <NetworkGate>
                        <RootLayoutNav />
                        {!splashDone && (
                          <SplashAnimation
                            onDone={() => {
                              setSplashDone(true);
                            }}
                          />
                        )}
                      </NetworkGate>
                    </KeyboardAvoidingView>
                  </GestureHandlerRootView>
                </FavoritesProvider>
              </AuthProvider>
            </SoundProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
