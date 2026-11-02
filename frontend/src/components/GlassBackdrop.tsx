import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

import { colors } from "@/src/theme";

/** Soft pastel backdrop with blurred orbs that the frosted-glass cards sit on. */
export function GlassBackdrop() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[colors.bgA, colors.bgB, colors.bgC]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.orb, { top: -60, right: -70, width: 240, height: 240, backgroundColor: colors.orbA }]} />
      <View style={[styles.orb, { top: "38%", left: -90, width: 220, height: 220, backgroundColor: colors.orbB }]} />
      <View style={[styles.orb, { bottom: 60, right: -40, width: 180, height: 180, backgroundColor: colors.orbA }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: "absolute",
    borderRadius: 999,
    ...(Platform.OS === "web" ? ({ filter: "blur(40px)" } as any) : { opacity: 0.8 }),
  },
});
