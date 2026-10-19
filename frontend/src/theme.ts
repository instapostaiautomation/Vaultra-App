// Design tokens for Vaultra DigiGold. Light + Dark customer themes + dedicated admin tokens.
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet } from "react-native";

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

const dark: typeof light = {
  surface: "#0F172A",
  onSurface: "#F1F5F9",
  surfaceSecondary: "#1E293B",
  onSurfaceSecondary: "#F1F5F9",
  surfaceTertiary: "#1A2332",
  onSurfaceTertiary: "#94A3B8",
  surfaceInverse: "#F8FAFC",
  onSurfaceInverse: "#0F172A",
  muted: "#94A3B8",
  mutedLight: "#64748B",
  brand: "#D4AF37",
  onBrand: "#FFFFFF",
  brandPrimary: "#D4AF37",
  onBrandPrimary: "#111827",
  brandSecondary: "#E8C840",
  onBrandSecondary: "#111827",
  brandTertiary: "#1C1A0E",
  onBrandTertiary: "#D4AF37",
  brandDeep: "#B8960F",
  success: "#22C55E",
  onSuccess: "#FFFFFF",
  successTint: "rgba(22,163,74,0.16)",
  warning: "#FBBF24",
  onWarning: "#111827",
  warningTint: "rgba(245,158,11,0.16)",
  error: "#EF4444",
  onError: "#FFFFFF",
  errorTint: "rgba(220,38,38,0.16)",
  info: "#60A5FA",
  onInfo: "#111827",
  border: "#334155",
  borderStrong: "#475569",
  divider: "#1E293B",
  scrim: "rgba(0,0,0,0.7)",
  overlayLight: "rgba(255,255,255,0.08)",
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
  giftDiwali: "#7C2D12",
  giftDiwaliAccent: "#FDBA74",
  giftBirthday: "#831843",
  giftBirthdayAccent: "#F9A8D4",
  giftWedding: "#4C0519",
  giftWeddingAccent: "#FDA4AF",
  giftThanks: "#14532D",
  giftThanksAccent: "#86EFAC",
  giftCongrats: "#0F172A",
  giftCongratsAccent: "#D4AF37",
};

export type ThemeColors = typeof light;

// Reactive theme context
const ThemeCtx = createContext<{ scheme: ColorScheme; colors: ThemeColors; toggle: () => void }>({
  scheme: "light",
  colors: light,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setScheme] = useState<ColorScheme>("light");

  useEffect(() => {
    AsyncStorage.getItem("theme_preference").then((v) => {
      if (v === "dark" || v === "light") setScheme(v);
    });
  }, []);

  const toggle = useCallback(() => {
    setScheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      AsyncStorage.setItem("theme_preference", next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ scheme, colors: scheme === "dark" ? dark : light, toggle }), [scheme, toggle]);

  return React.createElement(ThemeCtx.Provider, { value }, children);
}

export function useTheme() {
  return useContext(ThemeCtx);
}

// Static colors for files that import { colors } directly - uses light as default
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

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
