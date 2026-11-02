import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Gem, Home, RefreshCw, Vault } from "lucide-react-native";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts } from "@/src/theme";

/** Floating iOS-style liquid-glass tab bar. */
function GlassBar() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.barClip]}>
      {Platform.OS === "android" ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassFallback }]} />
      ) : (
        <BlurView intensity={70} tint={colors.glassTint as any} style={StyleSheet.absoluteFill} />
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassFill }]} />
      <View style={styles.shine} />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "transparent" },
        tabBarActiveTintColor: colors.brandDeep,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.2 },
        tabBarBackground: () => <GlassBar />,
        tabBarItemStyle: { paddingTop: 4, paddingBottom: 2 },
        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: Math.max(insets.bottom, 12),
          height: 68,
          paddingBottom: 6,
          borderRadius: 32,
          borderTopWidth: 0,
          borderWidth: StyleSheet.hairlineWidth * 1.5,
          borderColor: colors.glassBorder,
          backgroundColor: "transparent",
          elevation: 8,
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
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

const styles = StyleSheet.create({
  barClip: { borderRadius: 32, overflow: "hidden" },
  shine: { position: "absolute", left: 0, right: 0, top: 0, height: "50%", backgroundColor: colors.glassHighlight },
});
