import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { colors } from "@/src/theme";

export default function AdminLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.adminSurface } }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="customers" />
        <Stack.Screen name="ledger" />
      </Stack>
    </>
  );
}
