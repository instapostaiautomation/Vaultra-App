import { BlurView } from "expo-blur";
import React from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors } from "@/src/theme";

/** iOS-style frosted "liquid glass" surface. Android gets a near-opaque fill because its blur is unreliable. */
export function Glass({ style, contentStyle, children, intensity = 60, radius = 24, testID }: {
  style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>; children?: React.ReactNode; intensity?: number; radius?: number; testID?: string;
}) {
  const android = Platform.OS === "android";
  return (
    <View testID={testID} style={[styles.wrap, { borderRadius: radius }, style]}>
      {android ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassFallback }]} />
      ) : (
        <BlurView intensity={intensity} tint={colors.glassTint as any} style={StyleSheet.absoluteFill} />
      )}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassFill }]} />
      <View pointerEvents="none" style={[styles.highlight, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]} />
      {children ? <View style={[styles.content, contentStyle]}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth * 1.5,
    borderColor: colors.glassBorder,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 8 },
      default: { boxShadow: "0px 8px 32px rgba(0,0,0,0.10)" } as any,
    }),
  },
  highlight: { position: "absolute", left: 0, right: 0, top: 0, height: "45%", backgroundColor: colors.glassHighlight },
  content: { position: "relative", zIndex: 1, flex: 1, alignItems: "center", justifyContent: "center" },
});
