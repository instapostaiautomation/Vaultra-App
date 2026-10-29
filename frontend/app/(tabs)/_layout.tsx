import { Tabs } from "expo-router";
import { Gem, Home, RefreshCw, Vault, Wallet } from "lucide-react-native";
import React from "react";

import { usesNativeTabs } from "@/src/navigation";
import { colors, fonts } from "@/src/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandDeep,
        tabBarInactiveTintColor: colors.mutedLight,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.2 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.goldHairline,
          display: usesNativeTabs ? "flex" : undefined,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => <Home size={22} color={color} /> }} />
      <Tabs.Screen name="vault" options={{ title: "Vault", tabBarIcon: ({ color }) => <Vault size={22} color={color} /> }} />
      <Tabs.Screen name="jewellery" options={{ title: "Jewellery", tabBarIcon: ({ color }) => <Gem size={22} color={color} /> }} />
      <Tabs.Screen name="sip" options={{ title: "SIP", tabBarIcon: ({ color }) => <RefreshCw size={22} color={color} /> }} />
    </Tabs>
  );
}
