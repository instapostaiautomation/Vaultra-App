import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastProvider } from "@/src/components/Toast";
import { queryClient } from "@/src/query-client";
import { AppProvider } from "@/src/store/AppContext";
import { StaffProvider } from "@/src/store/StaffContext";
import { fonts } from "@/src/theme";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    [fonts.regular]: require("../assets/fonts/Inter-400.ttf"),
    [fonts.medium]: require("../assets/fonts/Inter-500.ttf"),
    [fonts.semibold]: require("../assets/fonts/Inter-600.ttf"),
    [fonts.bold]: require("../assets/fonts/Inter-700.ttf"),
    [fonts.black]: require("../assets/fonts/Inter-800.ttf"),
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <KeyboardProvider>
          <AppProvider>
            <StaffProvider>
              <ToastProvider>
                <StatusBar style="dark" />
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="login" options={{ presentation: "modal" }} />
                  <Stack.Screen name="profile" />
                  <Stack.Screen name="faq" />
                  <Stack.Screen name="gift" />
                  <Stack.Screen name="referral" />
                  <Stack.Screen name="notifications" />
                  <Stack.Screen name="product-detail" />
                  <Stack.Screen name="checkout" options={{ presentation: "modal" }} />
                  <Stack.Screen name="admin" />
                </Stack>
              </ToastProvider>
            </StaffProvider>
          </AppProvider>
        </KeyboardProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
