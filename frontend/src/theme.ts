// Design tokens for Vaultra DigiGold. Light customer theme + dedicated admin (dark) tokens.
// Keys match the "color" block of /app/design_guidelines.json.

import { useMemo } from "react";
import { Appearance, Platform, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FFFFFF",
  onSurface: "#111827",
  surfaceSecondary: "#F8F9FA",
  onSurfaceSecondary: "#111827",
  surfaceTertiary: "#F5F5F4",
  onSurfaceTertiary: "#4B5563",
  surfaceInverse: "#111827",
  onSurfaceInverse: "#FFFFFF",
  muted: "#6B7280",
  mutedLight: "#9CA3AF",

  brand: "#D4AF37",
  onBrand: "#FFFFFF",
  brandPrimary: "#D4AF37",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#C5A028",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#FDF8E8",
  onBrandTertiary: "#A18222",
  brandDeep: "#8A6E1C",

  success: "#16A34A",
  onSuccess: "#FFFFFF",
  successTint: "#DCFCE7",
  warning: "#F59E0B",
  onWarning: "#FFFFFF",
  warningTint: "#FEF3C7",
  error: "#DC2626",
  onError: "#FFFFFF",
  errorTint: "#FEE2E2",
  info: "#3B82F6",
  onInfo: "#FFFFFF",

  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
  divider: "#F3F4F6",
  scrim: "rgba(17,24,39,0.55)",
  overlayLight: "rgba(255,255,255,0.16)",

  // Admin console (always dark)
  adminSurface: "#0F172A",
  adminOnSurface: "#F8FAFC",
  adminSurfaceSecondary: "#1E293B",
  adminOnSurfaceSecondary: "#F1F5F9",
  adminSurfaceTertiary: "#111827",
  adminOnSurfaceTertiary: "#CBD5E1",
  adminMuted: "#94A3B8",
  adminBorder: "#334155",
  adminGoldTint: "rgba(212,175,55,0.14)",
  adminSuccessTint: "rgba(22,163,74,0.16)",
  adminErrorTint: "rgba(220,38,38,0.16)",
  adminWarningTint: "rgba(245,158,11,0.16)",

  // Gift greeting card art (decorative, fixed across schemes)
  giftDiwali: "#7C2D12",
  giftDiwaliAccent: "#FDBA74",
  giftBirthday: "#831843",
  giftBirthdayAccent: "#F9A8D4",
  giftWedding: "#4C0519",
  giftWeddingAccent: "#FDA4AF",
  giftThanks: "#14532D",
  giftThanksAccent: "#86EFAC",
  giftCongrats: "#111827",
  giftCongratsAccent: "#D4AF37",
};

export type ThemeColors = typeof light;

export const colors = light;

export const fonts = {
  regular: "Inter-400",
  medium: "Inter-500",
  semibold: "Inter-600",
  bold: "Inter-700",
  black: "Inter-800",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 14, lg: 20, pill: 999 };

export const cardShadow = Platform.select({
  web: { boxShadow: "0 4px 20px -2px rgba(0,0,0,0.06)" } as any,
  default: { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
});

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = (system === "light" || system === "dark") && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
