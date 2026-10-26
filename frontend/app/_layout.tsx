import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "@/src/theme";
import { AppProvider } from "@/src/store/AppContext";

function InnerLayout() {
  const { scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ presentation: "modal" }} />
        <Stack.Screen name="profile" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="product-detail" />
        <Stack.Screen name="referral" />
        <Stack.Screen name="gift" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="faq" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppProvider>
        <InnerLayout />
      </AppProvider>
    </ThemeProvider>
  );
}
