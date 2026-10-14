import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  PressableProps,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { KeyboardAvoidingView, KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

import { cardShadow, colors, fonts, radius } from "@/src/theme";

export function T({ style, weight = "regular", ...p }: React.ComponentProps<typeof Text> & { weight?: keyof typeof fonts }) {
  return <Text {...p} style={[{ fontFamily: fonts[weight], color: colors.onSurface }, style]} />;
}

type BtnProps = PressableProps & {
  title: string;
  variant?: "gold" | "dark" | "outline" | "ghost" | "danger" | "success" | "adminOutline";
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  size?: "md" | "lg" | "sm";
};

export function Button({ title, variant = "gold", loading, icon, style, textStyle, size = "md", disabled, onPress, ...p }: BtnProps) {
  const v = BTN[variant];
  const h = size === "lg" ? 56 : size === "sm" ? 40 : 48;
  return (
    <Pressable
      {...p}
      disabled={disabled || loading}
      onPress={(e) => {
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.btn,
        { height: h, backgroundColor: v.bg, borderColor: v.border, opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        pressed && v.pressed ? { backgroundColor: v.pressed } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon}
          <Text style={[styles.btnText, { color: v.fg, fontSize: size === "lg" ? 16 : size === "sm" ? 13 : 15 }, textStyle]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const BTN: Record<string, { bg: string; fg: string; border: string; pressed?: string }> = {
  gold: { bg: colors.brandPrimary, fg: colors.onBrandPrimary, border: colors.brandPrimary, pressed: colors.brandSecondary },
  dark: { bg: colors.surfaceInverse, fg: colors.onSurfaceInverse, border: colors.surfaceInverse },
  outline: { bg: colors.surface, fg: colors.onSurface, border: colors.border, pressed: colors.surfaceTertiary },
  ghost: { bg: "transparent", fg: colors.onSurface, border: "transparent" },
  danger: { bg: colors.error, fg: colors.onError, border: colors.error },
  success: { bg: colors.success, fg: colors.onSuccess, border: colors.success },
  adminOutline: { bg: colors.adminSurfaceSecondary, fg: colors.adminOnSurface, border: colors.adminBorder },
};

export function Card({ style, children, testID }: { style?: StyleProp<ViewStyle>; children: React.ReactNode; testID?: string }) {
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}

const STATUS: Record<string, { bg: string; fg: string; label: string }> = {
  completed: { bg: colors.successTint, fg: colors.success, label: "Completed" },
  processing: { bg: colors.warningTint, fg: "#B45309", label: "Processing" },
  pending: { bg: colors.warningTint, fg: "#B45309", label: "Pending" },
  reversed: { bg: colors.errorTint, fg: colors.error, label: "Reversed" },
  failed: { bg: colors.errorTint, fg: colors.error, label: "Failed" },
  approved: { bg: colors.successTint, fg: colors.success, label: "KYC Approved" },
  rejected: { bg: colors.errorTint, fg: colors.error, label: "KYC Rejected" },
  not_submitted: { bg: colors.surfaceTertiary, fg: colors.muted, label: "KYC Not Submitted" },
  active: { bg: colors.successTint, fg: colors.success, label: "Active" },
  paused: { bg: colors.surfaceTertiary, fg: colors.muted, label: "Paused" },
  collected: { bg: colors.successTint, fg: colors.success, label: "Collected" },
};

export function StatusBadge({ status, label, testID, dark }: { status: string; label?: string; testID?: string; dark?: boolean }) {
  const s = STATUS[status] || STATUS.pending;
  const bg = dark
    ? status === "completed" || status === "approved" || status === "collected" || status === "active"
      ? colors.adminSuccessTint
      : status === "reversed" || status === "rejected" || status === "failed"
        ? colors.adminErrorTint
        : colors.adminWarningTint
    : s.bg;
  const fg = dark && (s.fg === "#B45309" || s.fg === colors.muted) ? colors.warning : s.fg;
  return (
    <View testID={testID} style={[styles.badge, { backgroundColor: bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: fg }]} />
      <Text style={[styles.badgeText, { color: fg }]}>{label || s.label}</Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  testID,
  dark,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
  dark?: boolean;
}) {
  const bg = dark ? (selected ? colors.adminGoldTint : colors.adminSurfaceSecondary) : selected ? colors.surfaceInverse : colors.surface;
  const fg = dark ? (selected ? colors.brandPrimary : colors.adminOnSurfaceTertiary) : selected ? colors.onSurfaceInverse : colors.onSurfaceTertiary;
  const bc = dark ? (selected ? colors.brandPrimary : colors.adminBorder) : selected ? colors.surfaceInverse : colors.border;
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={[styles.chip, { backgroundColor: bg, borderColor: bc }]}
    >
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children, dark, style }: { children: React.ReactNode; dark?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ height: 56, backgroundColor: dark ? colors.adminSurface : colors.surface }, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, alignItems: "center" }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** Bottom sheet built on Modal so it renders above tabs and headers. */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  dark,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  dark?: boolean;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.sheetRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} testID={testID ? `${testID}-backdrop` : undefined}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
          </Pressable>
          <View
            testID={testID}
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + 16, backgroundColor: dark ? colors.adminSurfaceSecondary : colors.surface },
            ]}
          >
            <View style={[styles.grabber, { backgroundColor: dark ? colors.adminBorder : colors.borderStrong }]} />
            {title ? (
              <View style={styles.sheetHead}>
                <Text style={[styles.sheetTitle, { color: dark ? colors.adminOnSurface : colors.onSurface }]}>{title}</Text>
                <Pressable onPress={onClose} hitSlop={12} testID={testID ? `${testID}-close` : "sheet-close"} style={styles.closeBtn}>
                  <X size={20} color={dark ? colors.adminMuted : colors.muted} />
                </Pressable>
              </View>
            ) : null}
            <KeyboardAwareScrollView bottomOffset={72} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
              {children}
            </KeyboardAwareScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Row({ label, value, bold, dark, testID }: { label: string; value: string; bold?: boolean; dark?: boolean; testID?: string }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: dark ? colors.adminMuted : colors.muted }, bold && { fontFamily: fonts.semibold, color: dark ? colors.adminOnSurface : colors.onSurface }]}>
        {label}
      </Text>
      <Text
        testID={testID}
        style={[styles.rowValue, { color: dark ? colors.adminOnSurface : colors.onSurface }, bold && { fontFamily: fonts.bold, fontSize: 16 }]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  btnText: { fontFamily: fonts.semibold, letterSpacing: -0.2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    ...cardShadow,
  },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, height: 24, borderRadius: radius.pill, alignSelf: "flex-start" },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11 },
  chip: { height: 36, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center", flexShrink: 0 },
  chipText: { fontFamily: fonts.semibold, fontSize: 13 },
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: "92%", paddingTop: 8, width: "100%", maxWidth: 640, alignSelf: "center" },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 8 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 8 },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.4 },
  closeBtn: { width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  rowLabel: { fontFamily: fonts.regular, fontSize: 14 },
  rowValue: { fontFamily: fonts.semibold, fontSize: 14 },
});
