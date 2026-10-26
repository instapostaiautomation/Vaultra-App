import React from "react";
import { Tabs } from "expo-router";
import { View, Text, StyleSheet, Platform } from "react-native";
import { useTheme } from "@/src/theme";
import { Home, Vault, ShoppingBag, TrendingUp, Wallet } from "lucide-react-native";

function TabIcon({ Icon, label, focused, color }: { Icon: any; label: string; focused: boolean; color: string }) {
  return (
    <View style={styles.tabItem}>
      <Icon size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
      <Text style={[styles.tabLabel, { color, fontWeight: focused ? "700" : "400" }]}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused, color }) => <TabIcon Icon={Home} label="Home" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          tabBarIcon: ({ focused, color }) => <TabIcon Icon={Vault} label="Vault" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="jewellery"
        options={{
          tabBarIcon: ({ focused, color }) => <TabIcon Icon={ShoppingBag} label="Jewellery" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sip"
        options={{
          tabBarIcon: ({ focused, color }) => <TabIcon Icon={TrendingUp} label="SIP" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          tabBarIcon: ({ focused, color }) => <TabIcon Icon={Wallet} label="Wallet" focused={focused} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: { alignItems: "center", justifyContent: "center", gap: 2 },
  tabLabel: { fontSize: 10, marginTop: 2 },
});
