import { Redirect, Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { BadgeCheck, LayoutDashboard, PackageCheck, ReceiptIndianRupee } from "lucide-react-native";
import { ActivityIndicator, Platform, View } from "react-native";

import { usesNativeTabs } from "@/src/navigation";
import { useStaff } from "@/src/store/StaffContext";
import { colors, fonts } from "@/src/theme";

export default function AdminTabs() {
  const { staff, booting } = useStaff();
  if (booting) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.adminSurface, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }
  if (!staff) return <Redirect href="/admin/login" />;

  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        <NativeTabs.Trigger name="dashboard">
          <NativeTabs.Trigger.Icon sf="square.grid.2x2.fill" />
          <NativeTabs.Trigger.Label>Overview</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="kyc-review">
          <NativeTabs.Trigger.Icon sf="person.text.rectangle.fill" />
          <NativeTabs.Trigger.Label>KYC</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="pickups">
          <NativeTabs.Trigger.Icon sf="shippingbox.fill" />
          <NativeTabs.Trigger.Label>Pickups</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="counter-sale">
          <NativeTabs.Trigger.Icon sf="creditcard.fill" />
          <NativeTabs.Trigger.Label>POS</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.adminMuted,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.adminSurfaceTertiary,
          borderTopColor: colors.adminBorder,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        sceneStyle: { backgroundColor: colors.adminSurface },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Overview", tabBarButtonTestID: "admin-tab-dashboard", tabBarIcon: ({ color }) => <LayoutDashboard size={22} color={color} /> }} />
      <Tabs.Screen name="kyc-review" options={{ title: "KYC", tabBarButtonTestID: "admin-tab-kyc", tabBarIcon: ({ color }) => <BadgeCheck size={22} color={color} /> }} />
      <Tabs.Screen name="pickups" options={{ title: "Pickups", tabBarButtonTestID: "admin-tab-pickups", tabBarIcon: ({ color }) => <PackageCheck size={22} color={color} /> }} />
      <Tabs.Screen name="counter-sale" options={{ title: "POS", tabBarButtonTestID: "admin-tab-pos", tabBarIcon: ({ color }) => <ReceiptIndianRupee size={22} color={color} /> }} />
    </Tabs>
  );
}
