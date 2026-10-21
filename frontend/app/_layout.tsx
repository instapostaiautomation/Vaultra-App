import { Stack } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastProvider } from "@/src/components/Toast";
import { AppProvider } from "@/src/store/AppContext";
import { ThemeProvider } from "@/src/theme";

const qc = new QueryClient();

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SafeAreaProvider>
          <KeyboardProvider>
            <QueryClientProvider client={qc}>
              <AppProvider>
                <ToastProvider>
                  <View style={styles.outerContainer}>
                    <View style={styles.phoneContainer}>
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
                    </View>
                  </View>
                </ToastProvider>
              </AppProvider>
            </QueryClientProvider>
          </KeyboardProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const isWeb = Platform.OS === "web";

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: isWeb ? "#0a0c10" : "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  phoneContainer: {
    flex: 1,
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
});
