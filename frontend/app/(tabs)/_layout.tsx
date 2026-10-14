import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Gem, Home, Repeat, Wallet } from "lucide-react-native";
import { Platform } from "react-native";

import { usesNativeTabs } from "@/src/navigation";
import { colors, fonts } from "@/src/theme";

export default function TabsLayout() {
  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandSecondary}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="house.fill" />
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="vault">
          <NativeTabs.Trigger.Icon sf="lock.shield.fill" />
          <NativeTabs.Trigger.Label>Vault</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="jewellery">
          <NativeTabs.Trigger.Icon sf="sparkles" />
          <NativeTabs.Trigger.Label>Jewellery</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="sip">
          <NativeTabs.Trigger.Icon sf="arrow.triangle.2.circlepath" />
          <NativeTabs.Trigger.Label>SIP</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.onSurface,
        tabBarInactiveTintColor: colors.mutedLight,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarButtonTestID: "tab-home", tabBarIcon: ({ color, focused }) => <Home size={22} color={focused ? colors.brandSecondary : color} /> }} />
      <Tabs.Screen name="vault" options={{ title: "Vault", tabBarButtonTestID: "tab-vault", tabBarIcon: ({ color, focused }) => <Wallet size={22} color={focused ? colors.brandSecondary : color} /> }} />
      <Tabs.Screen name="jewellery" options={{ title: "Jewellery", tabBarButtonTestID: "tab-jewellery", tabBarIcon: ({ color, focused }) => <Gem size={22} color={focused ? colors.brandSecondary : color} /> }} />
      <Tabs.Screen name="sip" options={{ title: "SIP", tabBarButtonTestID: "tab-sip", tabBarIcon: ({ color, focused }) => <Repeat size={22} color={focused ? colors.brandSecondary : color} /> }} />
    </Tabs>
  );
}
